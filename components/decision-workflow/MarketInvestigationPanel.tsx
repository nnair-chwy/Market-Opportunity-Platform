"use client";

import { useState, type CSSProperties } from "react";
import { publicMarkets } from "@/lib/data/public-market-ui";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import { currentClinics } from "@/lib/locations/map-data";
import { investigationLeadColor } from "@/lib/planning/lead-map";
import type { InvestigationFollowUp, InvestigationLead, MarketInvestigation } from "@/lib/planning/market-investigation";

type MarketInvestigationPanelProps = {
  investigation: MarketInvestigation;
  selectedLeadId: string | null;
  onSelectLead: (lead: InvestigationLead) => void;
  followUps: InvestigationFollowUp[];
  onAskFollowUp: (question: string) => void;
  selectedContextMetric: CbsaAcsMetricKey;
  onContextMetricChange: (metric: CbsaAcsMetricKey) => void;
};

const CVC_MARKET_TO_CBSA: Record<string, string> = {
  Atlanta: "Atlanta-Sandy Springs-Roswell, GA", Austin: "Austin-Round Rock-San Marcos, TX",
  "Colorado Springs": "Colorado Springs, CO", Dallas: "Dallas-Fort Worth-Arlington, TX",
  Denver: "Denver-Aurora-Centennial, CO", "Fort Collins": "Fort Collins-Loveland, CO",
  Houston: "Houston-Pasadena-The Woodlands, TX", Jacksonville: "Jacksonville, FL",
  Phoenix: "Phoenix-Mesa-Chandler, AZ", "South Florida": "Miami-Fort Lauderdale-West Palm Beach, FL",
  Tampa: "Tampa-St. Petersburg-Clearwater, FL",
};

const METRICS: ReadonlyArray<{ id: CbsaAcsMetricKey; label: string; source: string }> = [
  { id: "household_count", label: "Households", source: "SRC-016" },
  { id: "population_density", label: "Density", source: "SRC-016" },
  { id: "median_household_income", label: "Income", source: "SRC-016" },
];

function valueFor(code: string, metric: CbsaAcsMetricKey) {
  return publicMarkets.find((market) => market.cbsa_code === code)?.acs?.metrics[metric].raw_value ?? null;
}

function percentileFor(value: number, metric: CbsaAcsMetricKey) {
  const values = publicMarkets
    .filter((market) => market.cbsa_type === "metropolitan")
    .map((market) => market.acs?.metrics[metric].raw_value)
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    .sort((left, right) => left - right);
  const atOrBelow = values.filter((item) => item <= value).length;
  return Math.max(1, Math.round((atOrBelow / values.length) * 100));
}

function formatValue(value: number, metric: CbsaAcsMetricKey) {
  if (metric === "median_household_income") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (metric === "population_density") return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} / sq. mi.`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function clinicCountFor(code: string) {
  const name = publicMarkets.find((market) => market.cbsa_code === code)?.cbsa_name;
  if (!name) return 0;
  return currentClinics.filter((clinic) => CVC_MARKET_TO_CBSA[clinic.market] === name).length;
}

export function MarketInvestigationPanel({
  investigation,
  selectedLeadId,
  onSelectLead,
  followUps,
  onAskFollowUp,
  selectedContextMetric,
  onContextMetricChange,
}: MarketInvestigationPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const visibleLeads = showAll ? investigation.leads : investigation.leads.slice(0, 3);
  const evidenceTerm = investigation.evidenceStage === "signal" ? "Signal" : "Finding";
  const investigationTitle = investigation.perspectiveId === "cvc"
    ? "Published footprint and public-context contrasts"
    : investigation.perspectiveId === "marketing"
      ? "Regional marketing evidence contrasts"
      : "Regional pricing evidence contrasts";

  return (
    <section className="market-investigation" aria-labelledby="market-investigation-title">
      <header className="market-investigation-heading">
        <div>
          <div className="eyebrow">Connected-evidence screening</div>
          <h2 id="market-investigation-title">{investigationTitle}</h2>
          <p>{investigation.readiness.summary}</p>
        </div>
        <div className="market-investigation-counts" aria-label="Screening coverage">
          <strong>{Math.max(0, investigation.comparisonsExamined).toLocaleString()}</strong>
          <span>comparisons screened</span>
          <strong>{investigation.leads.length}</strong>
          <span>{evidenceTerm.toLowerCase()}s to review</span>
        </div>
      </header>

      <section className="investigation-question-context" aria-label="Question being investigated">
        <span>Question being answered</span>
        <strong>{investigation.originalQuestion}</strong>
      </section>

      {investigation.portfolioPattern ? (
        <section className="portfolio-pattern" aria-label="Portfolio pattern">
          <span>Portfolio pattern</span>
          <h3>{investigation.portfolioPattern.headline}</h3>
          <p>{investigation.portfolioPattern.summary}</p>
          <div>
            {investigation.portfolioPattern.segments.map((segment) => (
              <article key={segment.label}>
                <strong>{segment.label}</strong>
                <b>{segment.dualPressureMarkets} of {segment.eligibleMarkets}</b>
                <small>metros with high click and conversion cost</small>
              </article>
            ))}
          </div>
          <small>{investigation.portfolioPattern.implication}</small>
        </section>
      ) : null}

      {investigation.mediaScope ? (
        <section className="media-scope-note" aria-label="Advertising channel scope">
          <div><span>Channel scope</span><strong>{investigation.mediaScope.included}</strong></div>
          <p>{investigation.mediaScope.bundlingRule}</p>
          <small>Not included: {investigation.mediaScope.excluded.join(" · ")}</small>
        </section>
      ) : null}

      {investigation.analystRevision ? (
        <section className="analyst-revision-note" aria-label={`Draft ${investigation.analystRevision.draftNumber} analyst direction`}>
          <span>Added in Draft {investigation.analystRevision.draftNumber}</span>
          <h3>{investigation.analystRevision.summary}</h3>
          <p><strong>Human direction</strong>{investigation.analystRevision.prompt}</p>
          <p>{investigation.analystRevision.effectOnRecommendation}</p>
          <p><strong>New evidence request</strong>{investigation.analystRevision.recommendedFollowUp}</p>
        </section>
      ) : null}

      {visibleLeads.length ? (
        <ol className="market-investigation-leads">
          {visibleLeads.map((lead, index) => (
            <li key={lead.id}>
              <button
                type="button"
                className={selectedLeadId === lead.id ? "active" : undefined}
                aria-pressed={selectedLeadId === lead.id}
                onClick={() => onSelectLead(lead)}
                style={{ "--lead-color": investigationLeadColor(index) } as CSSProperties}
              >
                <span className="market-investigation-rank"><i />{evidenceTerm} {index + 1} · {lead.marketIds.length === 1 ? "individual" : "pair"}</span>
                <strong>{lead.title}</strong>
                <p>{lead.observation}</p>
                <span className="market-investigation-meaning">Why it matters: {lead.businessMeaning}</span>
                <span className="market-investigation-next"><b>Next check</b>{lead.nextEvidence}</span>
                <small>{lead.strength} · n={lead.sampleSize} · Select to focus the map</small>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="market-investigation-empty">
          <strong>No supported regional signal for this question</strong>
          <p>{investigation.readiness.summary}</p>
          <small>Needed next: {investigation.readiness.missing.join(" · ")}</small>
        </div>
      )}

      {investigation.leads.length > 3 ? (
        <button className="secondary-action market-investigation-more" type="button" onClick={() => setShowAll((open) => !open)}>
          {showAll ? "Show strongest 3" : `Show all ${investigation.leads.length} ${evidenceTerm.toLowerCase()}s`}
        </button>
      ) : null}

      {selectedLeadId ? (() => {
        const selectedLead = investigation.leads.find((lead) => lead.id === selectedLeadId);
        if (!selectedLead) return null;
        const metric = METRICS.find((item) => item.id === selectedContextMetric) ?? METRICS[0];
        return (
          <section className="lead-evidence-snapshot" aria-label="Selected lead evidence">
            <header>
              <div><span>Selected lead evidence</span><strong>Joined measures behind the highlighted market</strong></div>
              <small>Transparent measures—not a blended score</small>
            </header>
            {selectedLead.supportingMeasures?.length ? (
              <div className="lead-joined-measures" aria-label="Joined investigation measures">
                {selectedLead.supportingMeasures.map((item) => (
                  <article key={item.id} data-role={item.role}>
                    <span>{item.label}</span>
                    <strong>{item.formattedValue}</strong>
                    <small>Higher than about {Math.round(item.percentile)}% of measured regions · {item.rangeMeaning}</small>
                  </article>
                ))}
              </div>
            ) : null}
            <div className="lead-evidence-metrics" role="group" aria-label="Map evidence measure">
              {METRICS.map((item) => (
                <button key={item.id} type="button" aria-pressed={selectedContextMetric === item.id} onClick={() => onContextMetricChange(item.id)}>{item.label}</button>
              ))}
            </div>
            <div className="lead-evidence-table">
              {selectedLead.marketIds.map((code) => {
                const market = publicMarkets.find((item) => item.cbsa_code === code);
                const value = valueFor(code, metric.id);
                const percentile = value === null ? null : percentileFor(value, metric.id);
                return (
                  <article key={code}>
                    <div><strong>{market?.cbsa_name ?? code}</strong><small>CBSA {code}</small></div>
                    {investigation.perspectiveId === "cvc" ? <div><span>Published CVC clinics</span><b>{clinicCountFor(code)}</b><small>SRC-009 · snapshot footprint only</small></div> : null}
                    <div><span>{metric.label}</span><b>{value === null ? "Unavailable" : formatValue(value, metric.id)}</b><small>{value === null || percentile === null ? "No percentile" : `${percentile >= 50 ? `Top ${101 - percentile}%` : `Bottom ${percentile}%`} of metropolitan markets`} · {metric.source}</small></div>
                  </article>
                );
              })}
            </div>
            <p>Changing the measure updates the map context layer. The highlighted A/B markets still come only from the selected lead.</p>
          </section>
        );
      })() : null}

      <details className="analysis-behind-scenes">
        <summary>How the analysis worked <span>Methods, coverage, and remaining checks</span></summary>
        <div className="market-investigation-method">
          <div><strong>Looked at</strong><span>{investigation.measuresExamined.join(" · ")}</span></div>
          <div><strong>How</strong><span>{investigation.toolsRun.join(" → ")}</span></div>
          <div><strong>Coverage</strong><span>{investigation.screeningScope.eligibleCohort} · {investigation.screeningScope.eligibleComparisons.toLocaleString()} compatible pairwise comparisons examined</span></div>
          <div><strong>Selection</strong><span>{investigation.screeningScope.selectionRule}</span></div>
          <div><strong>Data</strong><span>{investigation.dataSnapshotLabel} · {investigation.dataSnapshotVersion}</span></div>
          {investigation.reconciliation ? (
            <>
              <div><strong>Compatibility</strong><span>{investigation.reconciliation.status.replaceAll("_", " ")} · {investigation.reconciliation.summary.errorCount} errors · {investigation.reconciliation.summary.warningCount} warnings</span></div>
              <div><strong>Conclusion boundary</strong><span>{investigation.reconciliation.conclusionBoundary}</span></div>
              {investigation.reconciliation.issues.length ? <div><strong>Reconciliation checks</strong><span>{investigation.reconciliation.issues.slice(0, 6).map((item) => item.message).join(" · ")}</span></div> : null}
            </>
          ) : null}
          <div><strong>Runtime</strong><span>Fixed arithmetic over the checked-in snapshot. No live research, recommendation score, or causal inference.</span></div>
        </div>
        <section className="investigation-continuation" aria-label="Continuous investigation status">
          <header>
            <div><span>Investigation continues</span><strong>{investigation.measuresExamined.length > 4
              ? "The connected measures produced a joined signal. Commercial outcomes and explanation checks decide whether it becomes a finding."
              : "One measure found a signal. Outcome evidence decides whether it becomes a finding."}</strong></div>
            <small>{investigation.nextPass.status === "waiting_for_evidence" ? "Waiting for compatible data" : "Ready for the next pass"}</small>
          </header>
          <div className="investigation-evidence-flow" aria-label="Evidence progression">
            {investigation.investigationPath.map((step) => (
              <div key={step.id} className={step.status === "completed" ? "complete" : step.status === "waiting_for_evidence" ? "current" : undefined}>
                <i />{step.label}<small>{step.status === "completed" ? "Complete" : step.status === "waiting_for_evidence" ? "Next" : "Pending"}</small>
              </div>
            ))}
          </div>
          <div className="investigation-path-explanation">
            {investigation.investigationPath.map((step) => (
              <article key={step.id}>
                <strong>{step.label}</strong>
                <p><b>Why it ran</b>{step.purpose}</p>
                <p><b>Adds to the answer</b>{step.contributionToAnswer}</p>
                <small>{step.result}</small>
              </article>
            ))}
          </div>
          <p><b>Next question</b>{investigation.nextPass.question}</p>
          <p><b>Data needed</b>{investigation.nextPass.evidenceNeeded.join(" · ")}</p>
          <small>{investigation.nextPass.completionRule}</small>
        </section>
      </details>

      {selectedLeadId ? (
        <section className="market-investigation-chat" aria-label="Lead follow-up">
          <div className="section-label">Ask about the selected lead</div>
          {followUps.length ? (
            <ol>
              {followUps.map((turn) => (
                <li key={turn.id}>
                  <p><strong>Sheila</strong>{turn.question}</p>
                  <p><strong>Analyst</strong>{turn.answer}</p>
                </li>
              ))}
            </ol>
          ) : null}
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!followUpQuestion.trim()) return;
            onAskFollowUp(followUpQuestion);
            setFollowUpQuestion("");
          }}>
            <input
              value={followUpQuestion}
              onChange={(event) => setFollowUpQuestion(event.target.value)}
              placeholder="Ask why this lead matters or what evidence would validate it..."
              aria-label="Question about selected lead"
            />
            <button className="primary-action" type="submit" disabled={!followUpQuestion.trim()}>Ask</button>
          </form>
        </section>
      ) : null}

      <details className="market-investigation-boundaries">
        <summary>Methods, rejected patterns, and limitations</summary>
        <div>
          <strong>Rejected as unhelpful</strong>
          <p>{investigation.rejectedPatterns.join("; ")}.</p>
          <strong>What still limits the answer</strong>
          <p>{investigation.limitations.join(" ")}</p>
          <strong>Evidence needed next</strong>
          <p>{investigation.readiness.missing.join("; ")}.</p>
          <small>Sources: {investigation.sourceIds.join(" · ")} · {investigation.allowedUse.replaceAll("_", " ")} · no recommendation scoring</small>
        </div>
      </details>
    </section>
  );
}
