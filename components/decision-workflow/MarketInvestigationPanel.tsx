"use client";

import { useState } from "react";
import { publicMarkets } from "@/lib/data/public-market-ui";
import type { CbsaAcsMetricKey } from "@/lib/data/cbsa-acs";
import { currentClinics } from "@/lib/locations/map-data";
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
  const isConfirmedScoring = investigation.scoringEligibility === "synthetic_prototype_only";
  const visibleLeads = showAll || isConfirmedScoring ? investigation.leads : investigation.leads.slice(0, 3);

  return (
    <section className="market-investigation" aria-labelledby="market-investigation-title">
      <header className="market-investigation-heading">
        <div>
          <div className="eyebrow">{isConfirmedScoring ? "Human-confirmed synthetic scoring" : "Deterministic snapshot screening"}</div>
          <h2 id="market-investigation-title">{isConfirmedScoring ? "Confirmed market validation shortlist" : "Published footprint and public-context contrasts"}</h2>
          <p>{investigation.readiness.summary}</p>
        </div>
        <div className="market-investigation-counts" aria-label="Screening coverage">
          <strong>{investigation.comparisonsExamined.toLocaleString()}</strong>
          <span>{isConfirmedScoring ? "markets screened" : "comparisons screened"}</span>
          <strong>{investigation.leads.length}</strong>
          <span>review leads kept</span>
        </div>
      </header>

      <div className="market-investigation-method">
        <div><strong>Looked at</strong><span>{investigation.measuresExamined.join(" · ")}</span></div>
        <div><strong>How</strong><span>{investigation.toolsRun.join(" → ")}</span></div>
        <div><strong>Coverage</strong><span>{isConfirmedScoring ? investigation.screeningScope.eligibleCohort : `${investigation.screeningScope.eligibleComparisons.toLocaleString()} eligible comparisons from ${investigation.screeningScope.marketUniverse} metros; not all ${investigation.screeningScope.allMarketPairs.toLocaleString()} possible metro pairs`}</span></div>
        <div><strong>Selection</strong><span>{investigation.screeningScope.selectionRule}</span></div>
        <div><strong>Runtime</strong><span>{isConfirmedScoring ? "The analyst proposes the question-specific formula; versioned arithmetic executes only the human-confirmed weights over checked-in data. No live research or causal inference is performed." : "Fixed arithmetic over checked-in local data—no live research, external source retrieval, or autonomous causal analysis"}</span></div>
      </div>

      {visibleLeads.length ? (
        <ol className="market-investigation-leads">
          {visibleLeads.map((lead, index) => (
            <li key={lead.id}>
              <button
                type="button"
                className={selectedLeadId === lead.id ? "active" : undefined}
                aria-pressed={selectedLeadId === lead.id}
                onClick={() => onSelectLead(lead)}
              >
                <span className="market-investigation-rank">Lead {index + 1}</span>
                <strong>{lead.title}</strong>
                <p>{lead.observation}</p>
                <span className="market-investigation-meaning">Why it matters: {lead.businessMeaning}</span>
                <small>{lead.strength} · n={lead.sampleSize} · Select to focus the map</small>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="market-investigation-empty">
          <strong>No defensible market lead from the connected data</strong>
          <p>The loop suppressed generic outliers instead of returning an unrelated answer.</p>
        </div>
      )}

      {investigation.leads.length > 3 && !isConfirmedScoring ? (
        <button className="secondary-action market-investigation-more" type="button" onClick={() => setShowAll((open) => !open)}>
          {showAll ? "Show strongest 3" : `Show all ${investigation.leads.length} leads`}
        </button>
      ) : null}

      {selectedLeadId ? (() => {
        const selectedLead = investigation.leads.find((lead) => lead.id === selectedLeadId);
        if (!selectedLead) return null;
        const metric = METRICS.find((item) => item.id === selectedContextMetric) ?? METRICS[0];
        return (
          <section className="lead-evidence-snapshot" aria-label="Selected lead evidence">
            <header>
              <div><span>Selected lead evidence</span><strong>Actual fixture values behind the highlighted markets</strong></div>
              <small>Public context—not a score</small>
            </header>
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
            <p>Changing the measure updates the map context layer. The blue highlighted markets still come only from the selected lead.</p>
          </section>
        );
      })() : null}

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
          <small>Sources: {investigation.sourceIds.join(" · ")} · {investigation.allowedUse.replaceAll("_", " ")} · {isConfirmedScoring ? "synthetic validation scoring only" : "no recommendation scoring"}</small>
        </div>
      </details>
    </section>
  );
}
