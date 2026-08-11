"use client";

import { useMemo, useState } from "react";
import {
  calculateWorkspaceResults,
  createWorkspaceActionPacket,
  genericWorkspaceContracts,
  genericWorkspaceFixtures,
  validateWorkspaceInterpretation,
  type WorkspaceFixture,
} from "@/lib/generic-workspace-fixtures";
import styles from "./generic-evaluation-workspace.module.css";

type ReviewState = "not_reviewed" | "changes_requested" | "reviewed";

function SyntheticLabel() {
  return <span className={styles.synthetic}>Synthetic fixture</span>;
}

function SectionHeading({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <SyntheticLabel />
    </div>
  );
}

export function GenericEvaluationWorkspace() {
  const [fixtureId, setFixtureId] =
    useState<WorkspaceFixture["id"]>("clinic_site");
  const fixture = genericWorkspaceFixtures.find((item) => item.id === fixtureId)!;
  const contract = genericWorkspaceContracts.get(fixture.id)!;
  const [goal, setGoal] = useState(fixture.goal);
  const [proposal, setProposal] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [isValidated, setIsValidated] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState(fixture.entities[0].id);
  const [reviewState, setReviewState] = useState<ReviewState>("not_reviewed");

  const results = useMemo(() => calculateWorkspaceResults(fixture), [fixture]);
  const selectedResult =
    results.find((result) => result.entity.id === selectedEntityId) ?? results[0];
  const actionPacket = isValidated
    ? createWorkspaceActionPacket(fixture, selectedResult, proposal)
    : null;
  const strongestContribution = [...selectedResult.contributions].sort(
    (left, right) => right.contribution - left.contribution,
  )[0];
  const strongestMetric = fixture.metrics.find(
    (metric) => metric.id === strongestContribution.metricId,
  )!;

  function chooseFixture(id: WorkspaceFixture["id"]) {
    const next = genericWorkspaceFixtures.find((item) => item.id === id)!;
    setFixtureId(id);
    setGoal(next.goal);
    setProposal("");
    setValidationMessage("");
    setIsValidated(false);
    setSelectedEntityId(next.entities[0].id);
    setReviewState("not_reviewed");
  }

  function proposeInterpretation() {
    setProposal(fixture.proposedInterpretation);
    setValidationMessage(
      "AI-proposed fixture interpretation loaded. Application validation is still required.",
    );
    setIsValidated(false);
    setReviewState("not_reviewed");
  }

  function validateAndRun() {
    try {
      validateWorkspaceInterpretation(fixture, proposal);
      setIsValidated(true);
      setValidationMessage(
        "Validated against the application contract. Deterministic operators produced the scores and ranks below.",
      );
      setReviewState("not_reviewed");
    } catch (error) {
      setIsValidated(false);
      setValidationMessage(
        error instanceof Error ? error.message : "The interpretation is invalid.",
      );
    }
  }

  return (
    <div className={styles.workspace} data-generic-evaluation-workspace="true">
      <nav className={styles.sequence} aria-label="Generic evaluation sequence">
        {[
          "Goal",
          "Decompose",
          "Contract",
          "Evidence",
          "Rank",
          "Detail",
          "Findings",
          "Draft",
          "Approval",
        ].map((label, index) => (
          <a key={label} href={`#generic-step-${index + 1}`}>
            <span>{index + 1}</span>
            {label}
          </a>
        ))}
      </nav>

      <section className={styles.hero} id="generic-step-1">
        <SectionHeading
          number={1}
          title="Goal composer"
          description="Choose a checked-in evaluation type, then state the business question."
        />
        <div className={styles.fixtureTabs} role="tablist" aria-label="Synthetic evaluation types">
          {genericWorkspaceFixtures.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={item.id === fixture.id}
              className={item.id === fixture.id ? styles.active : ""}
              key={item.id}
              onClick={() => chooseFixture(item.id)}
            >
              {item.label}
              <small>Synthetic fixture · v1.0.0</small>
            </button>
          ))}
        </div>
        <label className={styles.goalField}>
          Evaluation goal
          <textarea value={goal} onChange={(event) => setGoal(event.target.value)} />
        </label>
        <div className={styles.boundary}>
          <strong>Prototype boundary</strong>
          <span>
            No production source connection is implied. This workspace can prepare a
            draft for review; it cannot make a recommendation or trigger an action.
          </span>
        </div>
      </section>

      <section className={styles.card} id="generic-step-2">
        <SectionHeading
          number={2}
          title="Decision decomposition"
          description="AI may propose an interpretation. The application must validate it before calculations run."
        />
        <div className={styles.decomposition}>
          <div>
            <span>Decision type</span>
            <strong>{fixture.label}</strong>
          </div>
          <div>
            <span>Geography</span>
            <strong>{fixture.geographyLabel}</strong>
          </div>
          <div>
            <span>Time scope</span>
            <strong>{fixture.timeLabel}</strong>
          </div>
          <div>
            <span>Permitted output</span>
            <strong>{fixture.permittedDraftAction}</strong>
          </div>
        </div>
        <label className={styles.proposal}>
          AI-proposed structured interpretation
          <textarea
            value={proposal}
            onChange={(event) => {
              setProposal(event.target.value);
              setIsValidated(false);
            }}
            placeholder="No proposal loaded."
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={proposeInterpretation}>
            Propose interpretation
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!proposal.trim()}
            onClick={validateAndRun}
          >
            Validate and run
          </button>
          <span className={isValidated ? styles.valid : styles.pending}>
            {validationMessage || "Waiting for a validated interpretation."}
          </span>
        </div>
      </section>

      <section className={styles.card} id="generic-step-3">
        <SectionHeading
          number={3}
          title="Evaluation contract"
          description="A versioned application contract fixes inputs, formulas, weights, missing-data rules, and review gates."
        />
        <div className={styles.contractGrid}>
          <div><span>Contract</span><strong>{contract.contractId}</strong><small>Revision {contract.contractRevision}</small></div>
          <div><span>Status</span><strong>Synthetic only</strong><small>{contract.question.eligibility.allowedUse}</small></div>
          <div><span>Weights</span><strong>100% fixed</strong><small>Application-owned · no AI edits</small></div>
          <div><span>Missing data</span><strong>Fail evaluation</strong><small>No imputation or redistribution</small></div>
          <div><span>Ranking</span><strong>Deterministic cohort</strong><small>{fixture.cohortLabel}</small></div>
          <div><span>Gate</span><strong>Human review required</strong><small>{fixture.approvalRole}</small></div>
        </div>
        <div className={styles.weightList}>
          {fixture.metrics.map((metric) => (
            <div key={metric.id}>
              <span>{metric.label}</span>
              <i><b style={{ width: `${metric.weight}%` }} /></i>
              <strong>{metric.weight}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card} id="generic-step-4">
        <SectionHeading
          number={4}
          title="Evidence and lineage"
          description="Every fixture input keeps an evidence status, source ID, allowed use, and transformation version."
        />
        <div className={styles.table} role="table" aria-label="Synthetic evidence lineage">
          <div className={styles.tableHead} role="row">
            <span>Evidence</span><span>Status</span><span>Source</span><span>Use</span>
          </div>
          {fixture.metrics.map((metric) => (
            <div role="row" key={metric.id}>
              <span><strong>{metric.label}</strong><small>0–100 synthetic index · {metric.unit}</small></span>
              <span className={styles.hypothesis}>Hypothesis</span>
              <span className={styles.mono}>{metric.sourceId}</span>
              <span>Synthetic prototype only</span>
            </div>
          ))}
        </div>
        <p className={styles.lineage}>
          Fixture {fixture.sourceId} → schema validation v1.0.0 → linear normalization
          v1.0.0 → deterministic weighted result v1.0.0 → same-cohort rank v1.0.0
        </p>
      </section>

      <section className={styles.card} id="generic-step-5">
        <SectionHeading
          number={5}
          title="Map and ranking"
          description="The map locates synthetic entities. Deterministic code owns every score and rank."
        />
        {isValidated ? (
          <div className={styles.rankLayout}>
            <div className={styles.map} aria-label="Synthetic entity map">
              <span className={styles.mapLabel}>Illustrative position only · not analysis geometry</span>
              {results.map((result) => {
                const x = ((result.entity.longitude + 125) / 59) * 100;
                const y = ((50 - result.entity.latitude) / 26) * 100;
                return (
                  <button
                    type="button"
                    key={result.entity.id}
                    className={result.entity.id === selectedResult.entity.id ? styles.selectedMarker : styles.marker}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => setSelectedEntityId(result.entity.id)}
                    aria-label={`Select synthetic ${result.entity.name}, rank ${result.rank}`}
                  >
                    {result.rank}
                  </button>
                );
              })}
            </div>
            <div className={styles.ranking}>
              {results.map((result) => (
                <button
                  type="button"
                  key={result.entity.id}
                  className={result.entity.id === selectedResult.entity.id ? styles.activeRank : ""}
                  onClick={() => setSelectedEntityId(result.entity.id)}
                >
                  <span>{result.rank}</span>
                  <div><strong>{result.entity.name}</strong><small>{result.entity.subtitle}</small></div>
                  <b>{result.score.toFixed(1)}</b>
                </button>
              ))}
              <small>Priority under fixed synthetic demo criteria; not a recommendation.</small>
            </div>
          </div>
        ) : (
          <div className={styles.locked}>Validate the interpreted question to run deterministic ranking.</div>
        )}
      </section>

      <section className={styles.card} id="generic-step-6">
        <SectionHeading
          number={6}
          title="Selected-entity detail"
          description="Inspect raw synthetic values and deterministic contributions for the selected entity."
        />
        {isValidated ? (
          <>
            <div className={styles.entityTitle}>
              <div><h3>{selectedResult.entity.name}</h3><p>{selectedResult.entity.subtitle}</p></div>
              <div><strong>{selectedResult.score.toFixed(1)}</strong><span>Rank {selectedResult.rank} of {results.length}</span></div>
            </div>
            <div className={styles.metricDetails}>
              {fixture.metrics.map((metric) => {
                const contribution = selectedResult.contributions.find((item) => item.metricId === metric.id)!.contribution;
                return (
                  <div key={metric.id}>
                    <span>{metric.label}<small>{metric.sourceId}</small></span>
                    <strong>{selectedResult.entity.metrics[metric.id]}</strong>
                    <span>{metric.weight}% weight</span>
                    <b>{contribution.toFixed(1)} pts</b>
                  </div>
                );
              })}
            </div>
          </>
        ) : <div className={styles.locked}>No selected result until validation succeeds.</div>}
      </section>

      <section className={styles.card} id="generic-step-7">
        <SectionHeading
          number={7}
          title="Findings"
          description="Findings explain structured results and preserve contrary evidence and limitations."
        />
        {isValidated ? (
          <div className={styles.findings}>
            <article><span>Derived</span><strong>Leading result under demo criteria</strong><p>{selectedResult.entity.name} is rank {selectedResult.rank} with a deterministic score of {selectedResult.score.toFixed(1)}.</p></article>
            <article><span>Derived</span><strong>Largest contribution</strong><p>{strongestMetric.label} contributes {strongestContribution.contribution.toFixed(1)} points under the fixed synthetic weight.</p></article>
            <article><span>Hypothesis</span><strong>Entity context</strong><p>{selectedResult.entity.note}</p></article>
            <article className={styles.caution}><span>Unknown</span><strong>Decision limits</strong><p>Production evidence, accountable owners, and action authority are not established by this fixture.</p></article>
          </div>
        ) : <div className={styles.locked}>Findings remain unavailable until the contract is validated.</div>}
      </section>

      <section className={styles.card} id="generic-step-8">
        <SectionHeading
          number={8}
          title="Draft action packet"
          description="The packet is source-linked and reviewable. It never becomes an automatic action or recommendation."
        />
        {actionPacket ? (
          <div className={styles.packet}>
            <header><div><span>{actionPacket.status.replaceAll("_", " ")}</span><h3>{fixture.permittedDraftAction}</h3></div><strong>DRAFT · SYNTHETIC</strong></header>
            <dl>
              <div><dt>Question</dt><dd>{proposal}</dd></div>
              <div><dt>Structured result</dt><dd>{selectedResult.entity.name} is priority under demo criteria ({selectedResult.score.toFixed(1)}; rank {selectedResult.rank}/{results.length}). This is not a recommendation.</dd></div>
              <div><dt>Evidence</dt><dd>{fixture.metricSourceIds.join(", ")} · Hypothesis · synthetic_prototype_only</dd></div>
              <div><dt>Proposed next step</dt><dd>Have the accountable reviewer verify evidence definitions, owners, and unresolved diligence before considering any separately authorized action.</dd></div>
              <div><dt>Prohibited effects</dt><dd>No targeting, spend, outreach, lease, opening, final selection, or source-system write.</dd></div>
            </dl>
          </div>
        ) : <div className={styles.locked}>A draft packet requires a validated structured result.</div>}
      </section>

      <section className={styles.card} id="generic-step-9">
        <SectionHeading
          number={9}
          title="Human approval state"
          description="Record review state separately from the system output. Review does not authorize an action."
        />
        <div className={styles.reviewState}>
          <div>
            <span>Required reviewer</span>
            <strong>{fixture.approvalRole}</strong>
            <small>Session-only prototype state · no durable approval receipt</small>
          </div>
          <div className={styles.reviewButtons}>
            <button type="button" disabled={!isValidated} className={reviewState === "changes_requested" ? styles.activeReview : ""} onClick={() => setReviewState("changes_requested")}>Request changes</button>
            <button type="button" disabled={!isValidated} className={reviewState === "reviewed" ? styles.activeReview : ""} onClick={() => setReviewState("reviewed")}>Mark draft reviewed</button>
          </div>
          <strong className={styles.reviewStatus}>
            {reviewState === "not_reviewed" && "Awaiting human review"}
            {reviewState === "changes_requested" && "Changes requested · no action authorized"}
            {reviewState === "reviewed" && "Draft reviewed · no action authorized"}
          </strong>
        </div>
      </section>
    </div>
  );
}
