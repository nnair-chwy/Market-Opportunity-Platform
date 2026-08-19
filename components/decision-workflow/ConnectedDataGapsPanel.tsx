import type { CompactSourceReadiness } from "@/lib/data-discovery/readiness-service";

export type ConnectedDataGapsPanelProps = {
  readiness: CompactSourceReadiness;
};

export function ConnectedDataGapsPanel({ readiness }: ConnectedDataGapsPanelProps) {
  const ready = readiness.outcomes.filter((outcome) => outcome.status === "ready");
  const gaps = readiness.outcomes.filter((outcome) => outcome.status === "gap");
  return (
    <details className="decision-analysis-details connected-data-gaps" data-testid="connected-data-gaps">
      <summary>
        <span>Connected data and remaining gaps</span>
        <small>{readiness.summary.readyOutcomeCount}/{readiness.outcomes.length} first-party outcome families ready</small>
      </summary>
      <div className="decision-analysis-details-body">
        <section className="packet-evidence" aria-label="Connected first-party outcomes">
          <strong>Supported outcome families</strong>
          {ready.length ? ready.map((outcome) => (
            <span key={outcome.outcomeId}><i aria-hidden="true">✓</i>{outcome.label}</span>
          )) : <span><i aria-hidden="true">·</i>No approved regional business-outcome family currently passes the adapter-readiness contract.</span>}
        </section>
        {gaps.length ? (
          <section className="packet-evidence" aria-label="Remaining first-party outcome gaps">
            <strong>Still needed</strong>
            {gaps.map((outcome) => (
              <span key={outcome.outcomeId}><i aria-hidden="true">·</i><b>{outcome.label}:</b> {outcome.missingEvidence[0]}</span>
            ))}
          </section>
        ) : null}
        <p className="action-packet-governance-note">New files become candidates after the bounded discovery refresh. A candidate is not queryable until its typed adapter, aggregation, definitions, privacy, and owner review are complete.</p>
      </div>
    </details>
  );
}
