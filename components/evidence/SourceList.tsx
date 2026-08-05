import type { EvidenceSource } from "@/lib/evidence";
import { formatEvidenceDate, presentSource } from "@/lib/evidence";
import { EvidenceStatusBadge, QualityStatusBadge } from "./EvidenceBadges";
import styles from "./evidence.module.css";

export interface SourceListProps {
  sources?: readonly EvidenceSource[] | null;
  heading?: string;
}

export function SourceList({
  sources,
  heading = "Sources",
}: SourceListProps) {
  const availableSources = sources ?? [];

  return (
    <section className={styles.panel} aria-labelledby="evidence-source-heading">
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Provenance</p>
          <h2 id="evidence-source-heading">{heading}</h2>
        </div>
        <span className={styles.count}>{availableSources.length}</span>
      </div>

      {availableSources.length ? (
        <ol className={styles.sourceList}>
          {availableSources.map((rawSource, index) => {
            const source = presentSource(rawSource);
            const sourceKey = `${rawSource.sourceId}-${index}`;

            return (
              <li key={sourceKey} className={styles.sourceCard}>
                <div className={styles.sourceTitle}>
                  <div>
                    <span className={styles.sourceId}>{source.sourceId}</span>
                    <h3>
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
                    </h3>
                  </div>
                  <div className={styles.badgeRow}>
                    <EvidenceStatusBadge status={source.evidenceStatus} />
                    <QualityStatusBadge status={source.qualityStatus} />
                  </div>
                </div>

                {source.isRestricted ? (
                  <p className={styles.restrictedNotice}>
                    Source details are hidden because this record is classified
                    as restricted.
                  </p>
                ) : (
                  <dl className={styles.metadataGrid}>
                    <div>
                      <dt>Observed</dt>
                      <dd>{formatEvidenceDate(source.observedAt)}</dd>
                    </div>
                    <div>
                      <dt>Extracted</dt>
                      <dd>{formatEvidenceDate(source.extractedAt)}</dd>
                    </div>
                    <div>
                      <dt>Geography</dt>
                      <dd>{source.geography || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Aggregation</dt>
                      <dd>{source.aggregation || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Sensitivity</dt>
                      <dd>{source.sensitivity}</dd>
                    </div>
                  </dl>
                )}

                {source.freshnessWarning ? (
                  <p className={styles.freshnessWarning}>
                    <strong>Freshness warning:</strong>{" "}
                    {source.freshnessWarning}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={styles.emptyState}>
          No source metadata is available. Source availability remains unknown.
        </p>
      )}
    </section>
  );
}
