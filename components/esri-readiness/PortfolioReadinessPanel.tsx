"use client";

import { useMemo, useState } from "react";
import {
  esriDemoManifest,
  esriPortfolioReadiness,
  candidateEvidenceDemoSiteIds,
  type PortfolioSiteReadiness,
  type ReadinessIssueState,
  type ReadinessState,
  type WorkflowStage,
} from "@/lib/esri-demo";
import styles from "./portfolio-readiness.module.css";

type PortfolioReadinessPanelProps = {
  onOpenMarket: (cbsaId: string) => void;
  onOpenBrief?: (siteId: string) => void;
  onPrepareReview?: (siteId: string) => void;
  initialSiteId?: string;
};

const readinessLabels: Record<ReadinessState, string> = {
  ready_for_research: "Ready for research",
  needs_review: "Needs review",
  blocked: "Blocked",
};

const stageLabels: Record<WorkflowStage, string> = {
  market_research: "Market research",
  candidate_review: "Candidate review",
  current_location: "Current location",
  comparison_location: "Comparison location",
  unknown: "Unknown",
};

function issueCount(
  site: PortfolioSiteReadiness,
  issueState: ReadinessIssueState | "all",
) {
  return issueState === "all"
    ? site.issues.length
    : site.issues.filter((issue) => issue.state === issueState).length;
}

export function PortfolioReadinessPanel({
  onOpenMarket,
  onOpenBrief,
  onPrepareReview,
  initialSiteId,
}: PortfolioReadinessPanelProps) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [stage, setStage] = useState<WorkflowStage | "all">("all");
  const [readiness, setReadiness] = useState<ReadinessState | "all">("all");
  const [issueState, setIssueState] = useState<
    ReadinessIssueState | "all"
  >("all");
  const [selectedId, setSelectedId] = useState(
    initialSiteId ?? esriPortfolioReadiness[0]?.site_id ?? "",
  );

  const brands = useMemo(
    () =>
      [...new Set(esriPortfolioReadiness.map((site) => site.brand))].sort(),
    [],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return esriPortfolioReadiness.filter((site) => {
      if (brand !== "all" && site.brand !== brand) return false;
      if (stage !== "all" && site.workflow_stage !== stage) return false;
      if (readiness !== "all" && site.readiness_state !== readiness) {
        return false;
      }
      if (issueState !== "all" && issueCount(site, issueState) === 0) {
        return false;
      }
      if (
        normalizedQuery &&
        !`${site.site_name} ${site.brand} ${site.market_name ?? ""} ${
          site.state ?? ""
        }`
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [brand, issueState, query, readiness, stage]);
  const selected =
    filtered.find((site) => site.site_id === selectedId) ??
    filtered[0] ??
    null;
  const summary = {
    ready: esriPortfolioReadiness.filter(
      (site) => site.readiness_state === "ready_for_research",
    ).length,
    review: esriPortfolioReadiness.filter(
      (site) => site.readiness_state === "needs_review",
    ).length,
    blocked: esriPortfolioReadiness.filter(
      (site) => site.readiness_state === "blocked",
    ).length,
  };
  const demoBriefSiteIds = new Set<string>(candidateEvidenceDemoSiteIds());

  return (
    <section
      className={styles.workspace}
      aria-labelledby="portfolio-readiness-title"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Esri-derived internal evidence</p>
          <h2 id="portfolio-readiness-title">Portfolio data readiness</h2>
          <p>
            Readiness measures evidence completeness and source relationships.
            It does not measure site or market attractiveness.
          </p>
        </div>
        <div className={styles.version}>
          <span>Snapshot</span>
          <strong>{esriDemoManifest.receipt_date}</strong>
          <small>{esriDemoManifest.transformation_version}</small>
        </div>
      </header>

      <div className={styles.summary} aria-label="Portfolio readiness summary">
        <div>
          <span>Source sites</span>
          <strong>{esriDemoManifest.counts.source_sites}</strong>
          <small>Real names and coordinates</small>
        </div>
        <div>
          <span>Ready for research</span>
          <strong>{summary.ready}</strong>
          <small>Descriptive evidence only</small>
        </div>
        <div>
          <span>Needs review</span>
          <strong>{summary.review}</strong>
          <small>Missing or ambiguous evidence</small>
        </div>
        <div>
          <span>Blocked</span>
          <strong>{summary.blocked}</strong>
          <small>Real-data prerequisite unresolved</small>
        </div>
      </div>

      <div className={styles.notice}>
        <strong>Non-scored evidence view</strong>
        <span>
          {esriDemoManifest.counts.source_linked_sites} sites have a supplied
          trade-area link, {esriDemoManifest.counts.synthetic_fallback_sites}{" "}
          use an explicit synthetic fallback, and{" "}
          {esriDemoManifest.counts.one_to_many_site_links} has a one-to-many
          relationship requiring review.
        </span>
      </div>

      <div className={styles.filters}>
        <label className={styles.search}>
          <span>Search portfolio</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search site, brand, market, or state"
          />
        </label>
        <label>
          <span>Brand</span>
          <select value={brand} onChange={(event) => setBrand(event.target.value)}>
            <option value="all">All brands</option>
            {brands.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Workflow stage</span>
          <select
            value={stage}
            onChange={(event) =>
              setStage(event.target.value as WorkflowStage | "all")
            }
          >
            <option value="all">All stages</option>
            {Object.entries(stageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Readiness</span>
          <select
            value={readiness}
            onChange={(event) =>
              setReadiness(event.target.value as ReadinessState | "all")
            }
          >
            <option value="all">All readiness states</option>
            {Object.entries(readinessLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Issue type</span>
          <select
            value={issueState}
            onChange={(event) =>
              setIssueState(
                event.target.value as ReadinessIssueState | "all",
              )
            }
          >
            <option value="all">All issue types</option>
            <option value="unavailable">Unavailable evidence</option>
            <option value="missing">Missing evidence</option>
            <option value="warning">Quality warning</option>
            <option value="unresolved_link">Unresolved link</option>
            <option value="rejected">Rejected</option>
            <option value="restricted">Restricted</option>
            <option value="stale">Stale</option>
          </select>
        </label>
      </div>

      <div className={styles.layout}>
        <div className={styles.listPanel}>
          <div className={styles.listHeading}>
            <strong>{filtered.length} sites</strong>
            <span>Neutral ordering by site name</span>
          </div>
          <div className={styles.siteList}>
            {filtered.map((site) => (
              <button
                key={site.site_id}
                className={
                  selected?.site_id === site.site_id
                    ? styles.selectedSite
                    : styles.site
                }
                onClick={() => setSelectedId(site.site_id)}
                aria-pressed={selected?.site_id === site.site_id}
              >
                <span>
                  <strong>{site.site_name}</strong>
                  <small>
                    {site.brand} · {site.market_name ?? "Market unknown"}
                  </small>
                </span>
                <span className={styles.siteStats}>
                  <b>{site.readiness_percent}%</b>
                  <small>{readinessLabels[site.readiness_state]}</small>
                </span>
              </button>
            ))}
            {!filtered.length ? (
              <div className={styles.empty} role="status">
                No sites match the selected filters.
              </div>
            ) : null}
          </div>
        </div>

        <article className={styles.detail} aria-live="polite">
          {selected ? (
            <>
              <div className={styles.detailHeading}>
                <div>
                  <p className={styles.eyebrow}>Selected readiness record</p>
                  <h3>{selected.site_name}</h3>
                  <p>
                    {selected.brand} ·{" "}
                    {selected.market_name ?? "Market unknown"}
                    {selected.state ? `, ${selected.state}` : ""}
                  </p>
                </div>
                <div className={styles.readinessBadge}>
                  <strong>{selected.readiness_percent}%</strong>
                  <span>{readinessLabels[selected.readiness_state]}</span>
                  <small>Data readiness, not site quality</small>
                </div>
              </div>

              <dl className={styles.metadata}>
                <div>
                  <dt>Workflow stage</dt>
                  <dd>{stageLabels[selected.workflow_stage]}</dd>
                </div>
                <div>
                  <dt>Trade-area link</dt>
                  <dd>{selected.trade_area_link_state.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Evidence available</dt>
                  <dd>
                    {selected.available_evidence_count} of{" "}
                    {selected.expected_evidence_count}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selected.source_ids.join(", ")}</dd>
                </div>
                <div>
                  <dt>Coordinates</dt>
                  <dd>
                    {selected.latitude.toFixed(4)},{" "}
                    {selected.longitude.toFixed(4)}
                  </dd>
                </div>
                <div>
                  <dt>Scoring eligibility</dt>
                  <dd>None</dd>
                </div>
              </dl>

              <div className={styles.recordActions}>
                {onPrepareReview && demoBriefSiteIds.has(selected.site_id) ? (
                  <button
                    className={styles.marketButton}
                    onClick={() => onPrepareReview(selected.site_id)}
                  >
                    Prepare candidate review
                  </button>
                ) : null}
                {onOpenBrief && demoBriefSiteIds.has(selected.site_id) ? (
                  <button
                    className={styles.marketButton}
                    onClick={() => onOpenBrief(selected.site_id)}
                  >
                    Open evidence brief
                  </button>
                ) : null}
                {selected.cbsa_id ? (
                  <button
                    className={styles.marketButton}
                    onClick={() => onOpenMarket(selected.cbsa_id!)}
                  >
                    Review public market context
                  </button>
                ) : (
                  <p className={styles.marketUnavailable}>
                    Parent-market ID is not available from the supplied source.
                  </p>
                )}
              </div>

              <section className={styles.issues}>
                <div className={styles.issueHeading}>
                  <div>
                    <p className={styles.eyebrow}>Diligence checklist</p>
                    <h4>Missing and review items</h4>
                  </div>
                  <span>{selected.issues.length}</span>
                </div>
                {selected.issues.length ? (
                  <ul>
                    {selected.issues.map((item) => (
                      <li key={item.issue_id}>
                        <span
                          className={styles[item.severity]}
                          aria-hidden="true"
                        >
                          !
                        </span>
                        <div>
                          <div className={styles.issueTitle}>
                            <strong>
                              {item.field_or_relationship.replaceAll("_", " ")}
                            </strong>
                            <small>{item.state.replaceAll("_", " ")}</small>
                          </div>
                          <p>{item.reason}</p>
                          <small>
                            Expected source or owner:{" "}
                            {item.expected_source_or_owner}
                          </small>
                          <p className={styles.followUp}>
                            Follow up: {item.suggested_follow_up}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>
                    No readiness issues were generated. This does not approve
                    the site or confirm suitability.
                  </p>
                )}
              </section>
            </>
          ) : (
            <div className={styles.empty}>Select a site to inspect readiness.</div>
          )}
        </article>
      </div>
    </section>
  );
}
