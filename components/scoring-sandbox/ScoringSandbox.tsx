"use client";

import { useMemo, useState } from "react";
import {
  analyzeSandbox,
  createInitialSandboxDraft,
  resetSandboxDraft,
  SANDBOX_SENSITIVITY_STEP,
  sandboxMetricControls,
  sandboxThresholdControls,
  validateSandboxDraft,
  type CandidateComparison,
} from "@/lib/scoring-sandbox";
import {
  AskAiPanel,
  type AskAiContext,
} from "@/components/AskAiPanel";
import styles from "./scoring-sandbox.module.css";

function formatScore(value: number | null): string {
  return value === null ? "Not calculated" : value.toFixed(1);
}

function formatDelta(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatRankChange(comparison: CandidateComparison): string {
  if (comparison.rankChange === null) return "Unavailable";
  if (comparison.rankChange === 0) return "No change";
  return comparison.rankChange > 0
    ? `Up ${comparison.rankChange}`
    : `Down ${Math.abs(comparison.rankChange)}`;
}

export interface ScoringSandboxProps {
  className?: string;
  showIntroduction?: boolean;
}

/**
 * Isolated, human-controlled scoring configuration sandbox.
 *
 * AI explanations consume the deterministic analysis but cannot mutate it.
 * No setting is persisted or approved.
 */
export function ScoringSandbox({
  className,
  showIntroduction = true,
}: ScoringSandboxProps) {
  const [draft, setDraft] = useState(createInitialSandboxDraft);
  const [selectedSiteId, setSelectedSiteId] = useState("nashville");
  const issues = useMemo(() => validateSandboxDraft(draft), [draft]);
  const analysis = useMemo(
    () => (issues.length === 0 ? analyzeSandbox(draft) : null),
    [draft, issues.length],
  );
  const selectedComparison =
    analysis?.comparisons.find(({ siteId }) => siteId === selectedSiteId) ??
    analysis?.comparisons[0] ??
    null;
  const classes = [styles.sandbox, className].filter(Boolean).join(" ");
  const weightTotal = sandboxMetricControls.reduce(
    (total, { metricId }) => total + (draft.weights[metricId] ?? 0),
    0,
  );
  const sandboxAiContext: AskAiContext | null =
    selectedComparison && analysis
      ? (() => {
          const score = selectedComparison.adjustedResult.systemScore;
          const scoreDelta =
            score === null ||
            selectedComparison.originalResult.systemScore === null
              ? null
              : score - selectedComparison.originalResult.systemScore;
          const largestChange = [...selectedComparison.contributionChanges]
            .filter((change) => change.delta !== null)
            .sort(
              (left, right) =>
                Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0),
            )[0];
          const coverage =
            selectedComparison.adjustedResult.dataCoverage
              .coveragePercentByWeight;

          return {
            id: `sandbox-${selectedComparison.siteId}-${analysis.configurationFingerprint}`,
            kind: "sandbox",
            title: `Explain ${selectedComparison.name}`,
            subtitle: `Live sandbox analysis · fingerprint ${analysis.configurationFingerprint}`,
            overview:
              score === null
                ? "The current deterministic result is not calculated. I can explain the blocking evidence without inventing a score."
                : `The adjusted preference score is ${score.toFixed(1)} and the current preference rank is ${selectedComparison.adjustedRank === null ? "unavailable" : `#${selectedComparison.adjustedRank}`}. I explain the calculation output but never change it.`,
            insights: [
              {
                title: "Configuration impact",
                detail:
                  scoreDelta === null
                    ? "A score change cannot be calculated from the current result."
                    : scoreDelta === 0
                      ? "The adjusted settings do not change this candidate’s total preference score."
                      : `The adjusted settings move the preference score ${scoreDelta > 0 ? "up" : "down"} ${Math.abs(scoreDelta).toFixed(1)} points from the original configuration.`,
                status: "Derived",
                sourceIds: [
                  analysis.configurationVersion,
                  analysis.configurationFingerprint,
                ],
                tone:
                  scoreDelta === null || scoreDelta === 0
                    ? "neutral"
                    : scoreDelta > 0
                      ? "positive"
                      : "caution",
              },
              {
                title: "Largest contribution change",
                detail: largestChange
                  ? `${largestChange.label} changes by ${formatDelta(largestChange.delta)} points under the adjusted weights.`
                  : "No contribution change is available.",
                status: "Derived",
                sourceIds: [analysis.configurationFingerprint],
                tone:
                  (largestChange?.delta ?? 0) < 0 ? "caution" : "neutral",
              },
              {
                title: "Sensitivity signal",
                detail: selectedComparison.rankingSensitive
                  ? `The preference rank changes in at least one valid ${SANDBOX_SENSITIVITY_STEP}-point weight-transfer scenario.`
                  : `The preference rank is stable across the ${analysis.sensitivityScenarioCount} bounded scenarios tested.`,
                status: "Derived",
                sourceIds: [analysis.configurationFingerprint],
                tone: selectedComparison.rankingSensitive
                  ? "caution"
                  : "positive",
              },
              {
                title: "Constraint and coverage",
                detail: `The separate constraint outcome is ${selectedComparison.adjustedResult.constraintOutcome}, with ${coverage.toFixed(0)}% weighted data coverage.`,
                status: "Derived",
                sourceIds: [
                  ...selectedComparison.adjustedResult.sourceReferences.map(
                    (source) => source.sourceId,
                  ),
                ],
                tone:
                  selectedComparison.adjustedResult.constraintOutcome ===
                  "passed"
                    ? "positive"
                    : "caution",
              },
            ],
            warnings: [
              ...selectedComparison.adjustedResult.warnings,
              ...(selectedComparison.constraintSensitive
                ? ["Constraint outcome changes under a bounded threshold step"]
                : []),
            ],
            limitations: [
              "all candidates, criteria, thresholds, and weights in this sandbox are synthetic and unapproved",
              "preference rank is not a recommendation or final real-estate decision",
            ],
            suggestedQuestions: [
              "What changed for this candidate?",
              "How sensitive is the result?",
              "What should a reviewer investigate?",
            ],
          };
        })()
      : null;

  function updateWeight(metricId: string, value: number) {
    setDraft((current) => ({
      ...current,
      weights: { ...current.weights, [metricId]: value },
    }));
  }

  function updateThreshold(constraintId: string, value: number) {
    setDraft((current) => ({
      ...current,
      thresholds: { ...current.thresholds, [constraintId]: value },
    }));
  }

  return (
    <section
      className={classes}
      aria-labelledby={showIntroduction ? "scoring-sandbox-title" : undefined}
      aria-label={showIntroduction ? undefined : "Explore scoring sensitivity"}
    >
      <header
        className={`${styles.header} ${
          showIntroduction ? "" : styles.headerWithoutIntroduction
        }`}
      >
        {showIntroduction ? (
          <div>
            <p className={styles.eyebrow}>Isolated configuration sandbox</p>
            <h2 id="scoring-sandbox-title">Explore scoring sensitivity</h2>
            <p>
              Adjust bounded demonstration settings to inspect deterministic
              score and preference-rank changes. No setting is saved or approved.
            </p>
          </div>
        ) : null}
        <div className={styles.headerActions}>
          <span className={styles.statusBadge}>Synthetic and unapproved</span>
          <button
            className={styles.resetButton}
            type="button"
            onClick={() => setDraft(resetSandboxDraft())}
          >
            Reset configuration
          </button>
        </div>
      </header>

      <div className={styles.disclaimer} role="note">
        Human-controlled decision support. AI cannot change these weights or
        thresholds. A higher preference score is not a recommendation to select,
        lease, or open a site.
      </div>

      <AskAiPanel
        key={sandboxAiContext?.id ?? "sandbox-invalid"}
        compact
        context={sandboxAiContext}
        emptyTitle="Explain this sandbox"
        emptyMessage="Restore a valid configuration to ask about score changes, rank sensitivity, constraints, and evidence coverage."
      />

      <div className={styles.layout}>
        <div className={styles.controls}>
          <section className={styles.controlCard}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Weighted preferences</p>
                <h3>Demonstration weights</h3>
              </div>
              <span
                className={
                  Math.abs(weightTotal - 100) < 1e-9
                    ? styles.validTotal
                    : styles.invalidTotal
                }
              >
                {weightTotal}% total
              </span>
            </div>
            <p className={styles.helper}>
              Weights must remain inside their displayed bounds and total 100%.
            </p>
            <div className={styles.controlList}>
              {sandboxMetricControls.map((control) => (
                <label className={styles.controlRow} key={control.metricId}>
                  <span>
                    <strong>{control.label}</strong>
                    <small>
                      {control.minWeight}% to {control.maxWeight}%
                    </small>
                  </span>
                  <span className={styles.inputGroup}>
                    <input
                      aria-label={`${control.label} weight`}
                      type="number"
                      min={control.minWeight}
                      max={control.maxWeight}
                      step={control.step}
                      value={
                        Number.isFinite(draft.weights[control.metricId])
                          ? draft.weights[control.metricId]
                          : ""
                      }
                      onChange={(event) =>
                        updateWeight(control.metricId, event.target.valueAsNumber)
                      }
                    />
                    <span aria-hidden="true">%</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className={styles.controlCard}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Separate screening gate</p>
                <h3>Hard constraints</h3>
              </div>
              <span className={styles.constraintBadge}>Not weighted</span>
            </div>
            <p className={styles.helper}>
              Constraint outcomes are shown beside scores but never contribute
              points to them.
            </p>
            <div className={styles.controlList}>
              {sandboxThresholdControls.map((control) => (
                <label
                  className={styles.controlRow}
                  key={control.constraintId}
                >
                  <span>
                    <strong>{control.label}</strong>
                    <small>
                      Passes at or above the threshold. Bound: {control.min} to{" "}
                      {control.max}.
                    </small>
                  </span>
                  <span className={styles.inputGroup}>
                    <input
                      aria-label={`${control.label} threshold`}
                      type="number"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={
                        Number.isFinite(
                          draft.thresholds[control.constraintId],
                        )
                          ? draft.thresholds[control.constraintId]
                          : ""
                      }
                      onChange={(event) =>
                        updateThreshold(
                          control.constraintId,
                          event.target.valueAsNumber,
                        )
                      }
                    />
                  </span>
                </label>
              ))}
            </div>
          </section>

          {issues.length > 0 ? (
            <div className={styles.validation} role="alert">
              <strong>Configuration needs review</strong>
              <ul>
                {issues.map((issue) => (
                  <li key={`${issue.code}-${issue.fieldId}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className={styles.results}>
          <section className={styles.resultCard}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Deterministic comparison</p>
                <h3>Candidate score and preference rank</h3>
              </div>
              <span className={styles.version}>
                {analysis?.configurationVersion ?? "Invalid draft"}
              </span>
            </div>

            {analysis ? (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Candidate</th>
                        <th scope="col">Original</th>
                        <th scope="col">Adjusted</th>
                        <th scope="col">Preference rank</th>
                        <th scope="col">Constraint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.comparisons.map((comparison) => (
                        <tr key={comparison.siteId}>
                          <th scope="row">
                            <button
                              className={styles.candidateButton}
                              type="button"
                              aria-pressed={
                                comparison.siteId === selectedComparison?.siteId
                              }
                              onClick={() =>
                                setSelectedSiteId(comparison.siteId)
                              }
                            >
                              {comparison.name}
                            </button>
                            {comparison.rankingSensitive ? (
                              <span className={styles.sensitiveBadge}>
                                Rank sensitive
                              </span>
                            ) : null}
                          </th>
                          <td>
                            {formatScore(
                              comparison.originalResult.systemScore,
                            )}
                          </td>
                          <td>
                            {formatScore(
                              comparison.adjustedResult.systemScore,
                            )}
                          </td>
                          <td>
                            {comparison.adjustedRank === null
                              ? "Unavailable"
                              : `#${comparison.adjustedRank}`}{" "}
                            <small>{formatRankChange(comparison)}</small>
                          </td>
                          <td>
                            <span
                              className={
                                comparison.adjustedResult.constraintOutcome ===
                                "passed"
                                  ? styles.passed
                                  : styles.failed
                              }
                            >
                              {
                                comparison.adjustedResult.constraintOutcome
                              }
                            </span>
                            {comparison.constraintSensitive ? (
                              <small>Threshold sensitive</small>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.sensitivityNote}>
                  Rank-sensitive labels test all valid one-step transfers of{" "}
                  {SANDBOX_SENSITIVITY_STEP} percentage points between
                  preference weights. Constraint sensitivity tests one bounded
                  threshold step.{" "}
                  {analysis.sensitivityScenarioCount} scenarios evaluated.
                </p>
              </>
            ) : (
              <div className={styles.blockedResult}>
                Results are paused until all settings are valid and preference
                weights total 100%.
              </div>
            )}
          </section>

          {selectedComparison ? (
            <section className={styles.resultCard}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>
                    Selected candidate detail
                  </p>
                  <h3>{selectedComparison.name} contribution changes</h3>
                </div>
                <span className={styles.fingerprint}>
                  Fingerprint {analysis?.configurationFingerprint}
                </span>
              </div>
              <div className={styles.contributionList}>
                {selectedComparison.contributionChanges.map((change) => (
                  <div className={styles.contributionRow} key={change.metricId}>
                    <span>{change.label}</span>
                    <span>{formatScore(change.original)}</span>
                    <span aria-hidden="true">→</span>
                    <span>{formatScore(change.adjusted)}</span>
                    <strong
                      className={
                        (change.delta ?? 0) === 0
                          ? styles.neutralDelta
                          : (change.delta ?? 0) > 0
                            ? styles.positiveDelta
                            : styles.negativeDelta
                      }
                    >
                      {formatDelta(change.delta)}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
