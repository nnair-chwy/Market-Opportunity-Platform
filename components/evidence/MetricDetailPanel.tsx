import type {
  EvidenceSource,
  MetricEvidence,
  QualitativeEvidenceItem,
} from "@/lib/evidence";
import {
  formatEvidenceDate,
  formatRawValue,
  missingSourceIds,
  presentSource,
  sourcesForMetric,
} from "@/lib/evidence";
import { EvidenceStatusBadge, QualityStatusBadge } from "./EvidenceBadges";
import styles from "./evidence.module.css";

export interface MetricDetailPanelProps {
  metrics?: readonly MetricEvidence[] | null;
  sources?: readonly EvidenceSource[] | null;
  qualitativeEvidence?: readonly QualitativeEvidenceItem[] | null;
  heading?: string;
}

function formatCalculationValue(value?: number | null) {
  return value === null || value === undefined
    ? "Not applicable"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(value);
}

export function MetricDetailPanel({
  metrics,
  sources,
  qualitativeEvidence,
  heading = "Metric details",
}: MetricDetailPanelProps) {
  const metricItems = metrics ?? [];
  const qualitativeItems = qualitativeEvidence ?? [];

  return (
    <section className={styles.panel} aria-labelledby="metric-detail-heading">
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Deterministic calculation trace</p>
          <h2 id="metric-detail-heading">{heading}</h2>
        </div>
        <span className={styles.count}>{metricItems.length}</span>
      </div>

      <p className={styles.boundaryNote}>
        This view explains supplied calculation outputs. It does not calculate
        a score, alter weights, or turn qualitative evidence into a number.
      </p>

      {metricItems.length ? (
        <div className={styles.disclosureList}>
          {metricItems.map((metric) => {
            const linkedSources = sourcesForMetric(metric, sources);
            const unavailableIds = missingSourceIds(metric, sources);
            const hasRestrictedSource = linkedSources.some(
              (source) => source.sensitivity === "restricted",
            );

            return (
              <details className={styles.metricDisclosure} key={metric.metricId}>
                <summary>
                  <span>
                    <strong>{metric.metricLabel}</strong>
                    <small>{metric.metricId}</small>
                  </span>
                  <span
                    className={`${styles.disposition} ${styles[metric.disposition]}`}
                  >
                    {metric.disposition}
                  </span>
                </summary>

                <div className={styles.metricBody}>
                  {hasRestrictedSource ? (
                    <p className={styles.restrictedNotice}>
                      Input and calculation details are hidden because a linked
                      source is restricted.
                    </p>
                  ) : (
                    <dl className={styles.calculationGrid}>
                      <div>
                        <dt>Raw value</dt>
                        <dd>{formatRawValue(metric.rawValue, metric.unit)}</dd>
                      </div>
                      <div>
                        <dt>Unit</dt>
                        <dd>{metric.unit || "Unknown"}</dd>
                      </div>
                      <div>
                        <dt>Scoring role</dt>
                        <dd>{metric.scoringRole}</dd>
                      </div>
                      <div>
                        <dt>Normalized value</dt>
                        <dd>
                          {formatCalculationValue(metric.normalizedValue)}
                        </dd>
                      </div>
                      <div>
                        <dt>Weight</dt>
                        <dd>
                          {metric.weight === null ||
                          metric.weight === undefined
                            ? "Not applicable"
                            : `${formatCalculationValue(metric.weight)}%`}
                        </dd>
                      </div>
                      <div>
                        <dt>Score contribution</dt>
                        <dd>{formatCalculationValue(metric.contribution)}</dd>
                      </div>
                    </dl>
                  )}

                  {!hasRestrictedSource && metric.statusReason ? (
                    <p className={styles.statusReason}>
                      <strong>Status detail:</strong> {metric.statusReason}
                    </p>
                  ) : null}

                  {!hasRestrictedSource && metric.freshnessWarning ? (
                    <p className={styles.freshnessWarning}>
                      <strong>Freshness warning:</strong>{" "}
                      {metric.freshnessWarning}
                    </p>
                  ) : null}

                  <div className={styles.metricSources}>
                    <h3>Source metadata</h3>
                    {linkedSources.length ? (
                      <ul>
                        {linkedSources.map((rawSource, index) => {
                          const source = presentSource(rawSource);
                          return (
                            <li key={`${rawSource.sourceId}-${index}`}>
                              <span>
                                <strong>{source.sourceId}</strong>
                                {" · "}
                                {source.approvedSourceUrl ? (
                                  <a
                                    href={source.approvedSourceUrl}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    {source.sourceLabel}
                                    <span className={styles.srOnly}>
                                      {" "}
                                      (opens approved source in a new tab)
                                    </span>
                                  </a>
                                ) : (
                                  source.sourceLabel
                                )}
                              </span>
                              <span className={styles.inlineMetadata}>
                                <EvidenceStatusBadge
                                  status={source.evidenceStatus}
                                />
                                <QualityStatusBadge
                                  status={source.qualityStatus}
                                />
                                <span className={styles.sensitivity}>
                                  {source.sensitivity}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    {unavailableIds.length ? (
                      <p className={styles.unknownSource}>
                        <strong>Unavailable source metadata:</strong>{" "}
                        {unavailableIds.join(", ")}
                      </p>
                    ) : null}

                    {!linkedSources.length && !unavailableIds.length ? (
                      <p className={styles.unknownSource}>
                        No source reference was supplied.
                      </p>
                    ) : null}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyState}>
          No metric results were supplied. Calculation status remains unknown.
        </p>
      )}

      <div
        className={styles.qualitativeSection}
        aria-labelledby="qualitative-evidence-heading"
      >
        <div>
          <p className={styles.eyebrow}>Not scored</p>
          <h3 id="qualitative-evidence-heading">Qualitative evidence</h3>
        </div>
        {qualitativeItems.length ? (
          <ul>
            {qualitativeItems.map((item) => {
              const isRestricted = item.sensitivity === "restricted";

              return (
                <li key={item.evidenceId}>
                  <div className={styles.badgeRow}>
                    <EvidenceStatusBadge status={item.evidenceStatus} />
                    <QualityStatusBadge status={item.qualityStatus} />
                    <span className={styles.sensitivity}>
                      {item.sensitivity}
                    </span>
                  </div>
                  {isRestricted ? (
                    <p className={styles.restrictedNotice}>
                      Qualitative details are hidden because this record is
                      restricted.
                    </p>
                  ) : (
                    <>
                      <p>{item.summary}</p>
                      <small>
                        {item.sourceIds.length
                          ? `Sources: ${item.sourceIds.join(", ")}`
                          : "Source: Unknown"}
                        {" · "}
                        Observed: {formatEvidenceDate(item.observedAt)}
                        {" · "}
                        Geography: {item.geography || "Unknown"}
                      </small>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.emptyState}>
            No qualitative evidence was supplied.
          </p>
        )}
      </div>
    </section>
  );
}
