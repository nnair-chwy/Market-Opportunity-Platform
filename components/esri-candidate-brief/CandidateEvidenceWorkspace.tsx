"use client";

import { useState } from "react";
import {
  buildCandidateEvidenceBrief,
  buildCandidateEvidenceComparison,
  candidateEvidenceDemoSiteIds,
  esriDemoManifest,
  esriFieldCatalog,
  esriPortfolioReadiness,
  esriSiteIdentities,
  esriSiteTradeAreaCrosswalk,
  esriTradeAreaProfiles,
  type CandidateEvidenceBrief,
  type CandidateEvidenceObservation,
  type CandidateEvidenceSection,
  type CandidateEvidenceState,
} from "@/lib/esri-demo";
import styles from "./candidate-evidence-workspace.module.css";

type CandidateEvidenceWorkspaceProps = {
  initialSiteId?: string;
  initialMode?: "brief" | "compare";
  showModeTabs?: boolean;
  showWorkspaceIntroduction?: boolean;
  heading?: string;
  onOpenReadiness?: (siteId: string) => void;
  onOpenMarket: (marketId: string) => void;
  onContinueReview?: (siteId: string) => void;
};

const STATE_LABELS: Record<CandidateEvidenceState, string> = {
  available: "Available",
  missing: "Missing",
  unknown: "Unknown",
  restricted: "Restricted",
  rejected: "Rejected",
  stale: "Stale",
  conflicting: "Conflicting",
};
const DEMO_SITE_IDS = candidateEvidenceDemoSiteIds();

function displayValue(observation: CandidateEvidenceObservation) {
  if (observation.is_redacted) return "Redacted";
  if (observation.raw_value === null) {
    return STATE_LABELS[observation.evidence_state];
  }
  if (Array.isArray(observation.raw_value)) {
    return observation.raw_value.join(", ");
  }
  if (typeof observation.raw_value === "boolean") {
    return observation.raw_value ? "Yes" : "No";
  }
  if (typeof observation.raw_value === "number") {
    if (observation.unit === "usd") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(observation.raw_value);
    }
    const formatted = new Intl.NumberFormat("en-US", {
      maximumFractionDigits:
        observation.unit === "percent" || observation.unit === "ratio" ? 1 : 0,
    }).format(observation.raw_value);
    if (observation.unit === "percent") return `${formatted}%`;
    if (observation.unit === "square_feet") return `${formatted} sq ft`;
    if (observation.unit === "square_miles") return `${formatted} sq mi`;
    if (observation.unit === "count") return formatted;
    if (observation.unit === "index") return `${formatted} index`;
    if (observation.unit === null) return `${formatted} · unit unknown`;
    return `${formatted} ${observation.unit}`;
  }
  return observation.raw_value;
}

function sourceSummary(observation: CandidateEvidenceObservation) {
  return `${observation.source_id} · ${observation.evidence_status} · ${observation.origin}`;
}

function ObservationCard({
  observation,
}: {
  observation: CandidateEvidenceObservation;
}) {
  return (
    <article
      className={`${styles.observation} ${styles[observation.evidence_state]}`}
    >
      <div className={styles.observationHeading}>
        <span>{observation.label}</span>
        <small>{STATE_LABELS[observation.evidence_state]}</small>
      </div>
      <strong>{displayValue(observation)}</strong>
      <div className={styles.badgeRow}>
        <span>{observation.evidence_status}</span>
        <span>{observation.origin}</span>
        <span>{observation.quality_status}</span>
      </div>
      <small className={styles.printProvenance}>
        Source {observation.source_id} · Observed{" "}
        {observation.observed_at ?? "unknown"} · Unit{" "}
        {observation.unit ??
          (observation.unit_state === "not_applicable"
            ? "not applicable"
            : "unknown")}{" "}
        · Geography {observation.geography} · Method{" "}
        {observation.geography_method ?? "unknown"} · Sensitivity{" "}
        {observation.sensitivity} · Scoring eligibility none
      </small>
      <details>
        <summary>Source and quality details</summary>
        <dl>
          <div>
            <dt>Source</dt>
            <dd>{observation.source_id}</dd>
          </div>
          <div>
            <dt>Snapshot</dt>
            <dd>{observation.source_snapshot_id}</dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>{observation.observed_at ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{observation.received_at ?? "Not applicable"}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>
              {observation.unit ??
                (observation.unit_state === "not_applicable"
                  ? "Not applicable"
                  : "Unknown")}
            </dd>
          </div>
          <div>
            <dt>Definition</dt>
            <dd>{observation.definition_status}</dd>
          </div>
          <div>
            <dt>Geography</dt>
            <dd>{observation.geography}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{observation.geography_method ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Sensitivity</dt>
            <dd>{observation.sensitivity}</dd>
          </div>
          <div>
            <dt>Scoring eligibility</dt>
            <dd>None</dd>
          </div>
        </dl>
        {observation.limitations.length ? (
          <ul>
            {observation.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </article>
  );
}

function EvidenceSection({
  section,
}: {
  section: CandidateEvidenceSection;
}) {
  if (section.section_id === "analyst_follow_up") {
    return (
      <section
        className={styles.evidenceSection}
        aria-labelledby={`candidate-section-${section.section_id}`}
      >
        <header>
          <div>
            <span>6</span>
            <div>
              <h2 id={`candidate-section-${section.section_id}`}>
                {section.title}
              </h2>
              <p>{section.description}</p>
            </div>
          </div>
          <strong>Deterministic baseline</strong>
        </header>
        <ol className={styles.questionList}>
          {section.observations.map((item) => (
            <li key={item.observation_id}>
              <strong>{displayValue(item)}</strong>
              <span>
                Expected source or owner:{" "}
                {item.expected_source_or_owner ?? "Unknown"}
              </span>
              <small>{item.limitations.join(" ")}</small>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const index =
    [
      "identity_workflow",
      "market_trade_area",
      "clinic_landscape",
      "physical_site",
      "constraints_diligence",
    ].indexOf(section.section_id) + 1;

  return (
    <section
      className={styles.evidenceSection}
      aria-labelledby={`candidate-section-${section.section_id}`}
    >
      <header>
        <div>
          <span>{index}</span>
          <div>
            <h2 id={`candidate-section-${section.section_id}`}>
              {section.title}
            </h2>
            <p>{section.description}</p>
          </div>
        </div>
        <strong>{section.observations.length} evidence items</strong>
      </header>
      <div className={styles.observationGrid}>
        {section.observations.map((item) => (
          <ObservationCard key={item.observation_id} observation={item} />
        ))}
      </div>
    </section>
  );
}

function briefInput(siteId: string, tradeAreaId?: string | null) {
  return buildCandidateEvidenceBrief({
    siteId,
    tradeAreaId,
    manifest: esriDemoManifest,
    fieldCatalog: esriFieldCatalog,
    sites: esriSiteIdentities,
    readiness: esriPortfolioReadiness,
    links: esriSiteTradeAreaCrosswalk,
    profiles: esriTradeAreaProfiles,
  });
}

function observationForField(brief: CandidateEvidenceBrief, fieldId: string) {
  return brief.sections
    .flatMap((section) => section.observations)
    .find((item) => item.field_id === fieldId);
}

export function CandidateEvidenceWorkspace({
  initialSiteId,
  initialMode = "brief",
  showModeTabs = true,
  showWorkspaceIntroduction = true,
  heading = "Candidate evidence briefs",
  onOpenReadiness,
  onOpenMarket,
  onContinueReview,
}: CandidateEvidenceWorkspaceProps) {
  const demoSiteIds = DEMO_SITE_IDS;
  const validInitialSiteId = demoSiteIds.includes(
    initialSiteId as (typeof demoSiteIds)[number],
  )
    ? initialSiteId!
    : demoSiteIds[0];
  const [mode, setMode] = useState<"brief" | "compare">(initialMode);
  const [selectedSiteId, setSelectedSiteId] = useState(validInitialSiteId);
  const [tradeAreaIds, setTradeAreaIds] = useState<Record<string, string>>({});
  const [comparisonSiteIds, setComparisonSiteIds] = useState<string[]>(
    demoSiteIds.slice(0, 3),
  );
  const profiles = demoSiteIds
    .map((siteId) =>
      esriTradeAreaProfiles.find((profile) => profile.site_id === siteId),
    )
    .filter((profile) => profile !== undefined);
  const selectedProfile = profiles.find(
    (profile) => profile.site_id === selectedSiteId,
  );
  const selectedTradeAreaId =
    tradeAreaIds[selectedSiteId] ??
    selectedProfile?.variants[0]?.trade_area_id ??
    null;
  const brief = briefInput(selectedSiteId, selectedTradeAreaId);
  const comparison = buildCandidateEvidenceComparison({
    siteIds: comparisonSiteIds,
    tradeAreaIds,
    manifest: esriDemoManifest,
    fieldCatalog: esriFieldCatalog,
    sites: esriSiteIdentities,
    readiness: esriPortfolioReadiness,
    links: esriSiteTradeAreaCrosswalk,
    profiles: esriTradeAreaProfiles,
  });

  function toggleComparisonSite(siteId: string) {
    setComparisonSiteIds((current) => {
      if (current.includes(siteId)) {
        return current.length <= 2
          ? current
          : current.filter((item) => item !== siteId);
      }
      return current.length >= 5 ? current : [...current, siteId];
    });
  }

  return (
    <section
      className={styles.workspace}
      aria-labelledby={
        showWorkspaceIntroduction ? "candidate-evidence-title" : undefined
      }
      aria-label={showWorkspaceIntroduction ? undefined : heading}
    >
      {showWorkspaceIntroduction ? (
        <header className={styles.workspaceHeader}>
          <div>
            <p className={styles.eyebrow}>Internal analyst workspace</p>
            <h1 id="candidate-evidence-title">{heading}</h1>
            <p>
              Organize supplied, derived, and synthetic evidence without scoring,
              ranking, or recommending a site.
            </p>
          </div>
          <div className={styles.headerBoundary}>
            <strong>Non-scored · human review required</strong>
            <span>{esriDemoManifest.snapshot_id}</span>
            <span>Generated {brief.generated_at}</span>
          </div>
        </header>
      ) : null}

      {showModeTabs ? (
      <div className={styles.modeTabs} role="tablist" aria-label="Evidence brief views">
        <button
          className={mode === "brief" ? styles.activeTab : ""}
          role="tab"
          aria-selected={mode === "brief"}
          onClick={() => setMode("brief")}
        >
          Full evidence brief
        </button>
        <button
          className={mode === "compare" ? styles.activeTab : ""}
          role="tab"
          aria-selected={mode === "compare"}
          onClick={() => setMode("compare")}
        >
          Compare candidates
          <span>{comparisonSiteIds.length}</span>
        </button>
      </div>
      ) : null}

      {showWorkspaceIntroduction ? (
        <div className={styles.disclaimer} role="note">
          <strong>Decision boundary</strong>
          <span>
            Missing does not mean unfavorable. Present does not mean favorable.
            This is not an approved investment, lease, or clinic-opening
            document.
          </span>
        </div>
      ) : null}

      {mode === "brief" ? (
        <>
          <div className={styles.briefControls}>
            <label>
              <span>Demo site</span>
              <select
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.site_id} value={profile.site_id}>
                    {profile.site_name} · {profile.brand}
                  </option>
                ))}
              </select>
            </label>
            {selectedProfile && selectedProfile.variants.length > 1 ? (
              <label>
                <span>Trade-area variant</span>
                <select
                  value={selectedTradeAreaId ?? ""}
                  onChange={(event) =>
                    setTradeAreaIds((current) => ({
                      ...current,
                      [selectedSiteId]: event.target.value,
                    }))
                  }
                >
                  {selectedProfile.variants.map((variant, index) => (
                    <option
                      key={variant.trade_area_id}
                      value={variant.trade_area_id}
                    >
                      Variant {index + 1} ·{" "}
                      {variant.is_synthetic ? "Synthetic" : "Supplied"} ·{" "}
                      {variant.relationship_review_state.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className={styles.actionGroup}>
              {onContinueReview ? (
                <button onClick={() => onContinueReview(brief.site_id)}>
                  Continue review run
                </button>
              ) : null}
              {onOpenReadiness ? (
                <button onClick={() => onOpenReadiness(brief.site_id)}>
                  Open readiness
                </button>
              ) : null}
              <button
                disabled={!brief.parent_market.market_id}
                onClick={() =>
                  brief.parent_market.market_id &&
                  onOpenMarket(brief.parent_market.market_id)
                }
              >
                Open market context
              </button>
              <button onClick={() => window.print()}>Print brief</button>
            </div>
          </div>

          <article className={styles.brief}>
            <header className={styles.briefHeader}>
              <div>
                <p>Evidence brief · {brief.brief_version}</p>
                <h2>{brief.site_label}</h2>
                <span>
                  {brief.brand} ·{" "}
                  {brief.parent_market.market_label ?? "Parent market unknown"}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Readiness</dt>
                  <dd>{brief.readiness_state.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Trade-area link</dt>
                  <dd>
                    {brief.trade_area_relationship.review_state.replaceAll(
                      "_",
                      " ",
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Human review</dt>
                  <dd>{brief.human_review_state.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Scoring eligibility</dt>
                  <dd>None</dd>
                </div>
              </dl>
            </header>

            <div className={styles.stateSummary}>
              <span>{brief.missing_information.length} missing</span>
              <span>{brief.conflicting_information.length} conflicting</span>
              <span>{brief.restrictions.length} restricted or rejected</span>
              <span>
                {
                  brief.sections
                    .flatMap((item) => item.observations)
                    .filter((item) => item.evidence_state === "stale").length
                }{" "}
                stale
              </span>
            </div>

            {brief.sections.map((item) => (
              <EvidenceSection key={item.section_id} section={item} />
            ))}

            <footer className={styles.printFooter}>
              <strong>Non-scored evidence brief for human review</strong>
              <span>{brief.brief_id}</span>
              <span>{brief.source_snapshot_versions.join(" · ")}</span>
              {brief.disclaimers.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </footer>
          </article>
        </>
      ) : (
        <section className={styles.comparison} aria-labelledby="candidate-comparison-title">
          <header>
            <div>
              <p className={styles.eyebrow}>Selection-order comparison</p>
              <h2 id="candidate-comparison-title">Raw candidate evidence</h2>
              <p>
                Two to five candidates. The same fields appear in the same
                order with no composite, rank, winner, or recommendation.
              </p>
            </div>
            <strong>{comparisonSiteIds.length} of 5 selected</strong>
          </header>

          <fieldset className={styles.candidatePicker}>
            <legend>Select candidates</legend>
            {profiles.map((profile) => {
              const selected = comparisonSiteIds.includes(profile.site_id);
              return (
                <label key={profile.site_id}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={
                      (selected && comparisonSiteIds.length <= 2) ||
                      (!selected && comparisonSiteIds.length >= 5)
                    }
                    onChange={() => toggleComparisonSite(profile.site_id)}
                  />
                  <span>
                    <strong>{profile.site_name}</strong>
                    <small>
                      {profile.brand} ·{" "}
                      {profile.variants[0]?.is_synthetic
                        ? "synthetic fallback"
                        : "supplied relationship"}
                    </small>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className={styles.comparisonActions}>
            <button onClick={() => window.print()}>Print comparison</button>
          </div>

          {comparison.comparability_warnings.length ? (
            <details className={styles.comparisonWarnings}>
              <summary>
                {comparison.comparability_warnings.length} comparability
                warnings
              </summary>
              <ul>
                {comparison.comparability_warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className={styles.tableWrap}>
            <table>
              <caption>
                Raw evidence in analyst selection order. Dates, methods,
                quality, source, and missingness remain visible.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Evidence field</th>
                  {comparison.briefs.map((item) => (
                    <th scope="col" key={item.site_id}>
                      <button
                        onClick={() => {
                          setSelectedSiteId(item.site_id);
                          setMode("brief");
                        }}
                      >
                        {item.site_label}
                      </button>
                      <span>{item.readiness_state.replaceAll("_", " ")}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.field_order.map((fieldId) => {
                  const label =
                    comparison.briefs
                      .map((item) => observationForField(item, fieldId))
                      .find(Boolean)?.label ?? fieldId;
                  return (
                    <tr key={fieldId}>
                      <th scope="row">{label}</th>
                      {comparison.briefs.map((item) => {
                        const itemObservation = observationForField(
                          item,
                          fieldId,
                        );
                        return (
                          <td key={item.site_id}>
                            {itemObservation ? (
                              <>
                                <strong>{displayValue(itemObservation)}</strong>
                                <span>
                                  {STATE_LABELS[itemObservation.evidence_state]}
                                </span>
                                <small>{sourceSummary(itemObservation)}</small>
                                <small>
                                  Observed{" "}
                                  {itemObservation.observed_at ?? "unknown"} ·{" "}
                                  {itemObservation.geography_method ??
                                    "method unknown"}
                                </small>
                                <details>
                                  <summary>Source details</summary>
                                  <span>
                                    Unit:{" "}
                                    {itemObservation.unit ??
                                      (itemObservation.unit_state ===
                                      "not_applicable"
                                        ? "not applicable"
                                        : "unknown")}
                                  </span>
                                  <span>
                                    Quality: {itemObservation.quality_status}
                                  </span>
                                  <span>
                                    Sensitivity: {itemObservation.sensitivity}
                                  </span>
                                  <span>Scoring eligibility: none</span>
                                </details>
                              </>
                            ) : (
                              <>
                                <strong>Missing</strong>
                                <span>Not supplied</span>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className={styles.printFooter}>
            <strong>Non-scored comparison for human review</strong>
            <span>{comparison.comparison_version}</span>
            <span>Generated {comparison.generated_at}</span>
            <p>
              Missing does not mean unfavorable. This is not an approved
              investment, lease, or clinic-opening document.
            </p>
          </footer>
        </section>
      )}
    </section>
  );
}
