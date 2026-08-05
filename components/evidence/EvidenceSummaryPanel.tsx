import type { StructuredEvidenceResult } from "@/lib/evidence";
import { formatEvidenceDate, summarizeEvidence } from "@/lib/evidence";
import styles from "./evidence.module.css";

export interface EvidenceSummaryPanelProps {
  result: StructuredEvidenceResult;
  heading?: string;
}

export function EvidenceSummaryPanel({
  result,
  heading = "Evidence summary",
}: EvidenceSummaryPanelProps) {
  const summary = summarizeEvidence(result);

  return (
    <section className={styles.panel} aria-labelledby="evidence-summary-heading">
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Evaluation {result.evaluationId}</p>
          <h2 id="evidence-summary-heading">{heading}</h2>
          <p className={styles.panelSubtitle}>
            {result.candidateLabel} · Evaluated{" "}
            {formatEvidenceDate(result.evaluatedAt)}
          </p>
        </div>
      </div>

      <dl className={styles.summaryGrid}>
        <div>
          <dt>Scored metrics</dt>
          <dd>{summary.scoredMetrics}</dd>
        </div>
        <div>
          <dt>Missing</dt>
          <dd>{summary.missingMetrics}</dd>
        </div>
        <div>
          <dt>Excluded</dt>
          <dd>{summary.excludedMetrics}</dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd>{summary.rejectedMetrics}</dd>
        </div>
        <div>
          <dt>Unscored</dt>
          <dd>{summary.unscoredMetrics}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{summary.warningCount}</dd>
        </div>
      </dl>

      <div className={styles.coverageLine}>
        <span>
          {summary.availableSources} of {summary.totalSources} source records
          available
        </span>
        <span>{summary.staleSources} stale</span>
        <span>{summary.restrictedSources} restricted</span>
        <span>{summary.qualitativeItems} qualitative, not scored</span>
      </div>
    </section>
  );
}
