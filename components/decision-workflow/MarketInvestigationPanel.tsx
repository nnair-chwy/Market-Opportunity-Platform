"use client";

import { useState } from "react";
import type { InvestigationFollowUp, InvestigationLead, MarketInvestigation } from "@/lib/planning/market-investigation";

type MarketInvestigationPanelProps = {
  investigation: MarketInvestigation;
  selectedLeadId: string | null;
  onSelectLead: (lead: InvestigationLead) => void;
  followUps: InvestigationFollowUp[];
  onAskFollowUp: (question: string) => void;
};

export function MarketInvestigationPanel({
  investigation,
  selectedLeadId,
  onSelectLead,
  followUps,
  onAskFollowUp,
}: MarketInvestigationPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const visibleLeads = showAll ? investigation.leads : investigation.leads.slice(0, 3);

  return (
    <section className="market-investigation" aria-labelledby="market-investigation-title">
      <header className="market-investigation-heading">
        <div>
          <div className="eyebrow">Question-specific screening</div>
          <h2 id="market-investigation-title">What the analyst loop found</h2>
          <p>{investigation.readiness.summary}</p>
        </div>
        <div className="market-investigation-counts" aria-label="Screening coverage">
          <strong>{investigation.comparisonsExamined.toLocaleString()}</strong>
          <span>comparisons screened</span>
          <strong>{investigation.leads.length}</strong>
          <span>review leads kept</span>
        </div>
      </header>

      <div className="market-investigation-method">
        <div><strong>Looked at</strong><span>{investigation.measuresExamined.join(" · ")}</span></div>
        <div><strong>How</strong><span>{investigation.toolsRun.join(" → ")}</span></div>
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

      {investigation.leads.length > 3 ? (
        <button className="secondary-action market-investigation-more" type="button" onClick={() => setShowAll((open) => !open)}>
          {showAll ? "Show strongest 3" : `Show all ${investigation.leads.length} leads`}
        </button>
      ) : null}

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
