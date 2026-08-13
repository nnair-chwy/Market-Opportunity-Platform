"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analysisBriefWeightTotal,
  type AnalysisBrief,
  type AnalysisConsideration,
} from "@/lib/planning/analysis-brief";

type AnalysisBriefPanelProps = {
  brief: AnalysisBrief;
  onConfirm: (brief: AnalysisBrief) => void;
};

function roleLabel(role: AnalysisConsideration["role"]) {
  if (role === "weighted_preference") return "Weighted";
  if (role === "validity_gate") return "Must pass";
  return "Context only";
}

function evidenceLabel(status: AnalysisConsideration["evidenceStatus"]) {
  if (status === "connected") return "Connected";
  if (status === "partial") return "Partial";
  return "Needed";
}

export function AnalysisBriefPanel({ brief, onConfirm }: AnalysisBriefPanelProps) {
  const [editing, setEditing] = useState(brief.status !== "confirmed");
  const [draft, setDraft] = useState(brief);
  useEffect(() => {
    setDraft(brief);
    setEditing(brief.status !== "confirmed");
  }, [brief]);
  const weightTotal = useMemo(() => analysisBriefWeightTotal(draft), [draft]);
  const hasWeights = draft.considerations.some((item) => item.role === "weighted_preference");
  const weightsValid = !hasWeights || Math.abs(weightTotal - 100) < 0.001;

  function updateConsideration(id: string, patch: Partial<AnalysisConsideration>) {
    setDraft((current) => ({
      ...current,
      status: "proposed",
      confirmedAt: null,
      considerations: current.considerations.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  }

  function confirm() {
    if (!draft.rewrittenQuestion.trim() || !weightsValid) return;
    const confirmed: AnalysisBrief = {
      ...draft,
      rewrittenQuestion: draft.rewrittenQuestion.trim(),
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
    };
    onConfirm(confirmed);
    setEditing(false);
  }

  return (
    <section className="analysis-brief-panel" aria-labelledby="analysis-brief-title" data-status={brief.status}>
      <header className="analysis-brief-header">
        <div>
          <div className="eyebrow">Question and consideration check</div>
          <h2 id="analysis-brief-title">How this analysis is framed</h2>
          <p>Read this alongside the visualization. Edit anything the analyst should interpret differently.</p>
        </div>
        <div className="analysis-brief-actions">
          <span className={`analysis-brief-status ${brief.status}`}>{brief.status === "confirmed" ? "Confirmed" : "Needs confirmation"}</span>
          {!editing ? <button className="secondary-action" type="button" onClick={() => setEditing(true)}>Adjust</button> : null}
        </div>
      </header>

      <div className="analysis-brief-frame">
        <section className="analysis-brief-question">
          <span>Original question</span>
          <p>{brief.originalQuestion}</p>
          <label>
            <strong>Question the analyst used</strong>
            {editing ? (
              <textarea
                value={draft.rewrittenQuestion}
                onChange={(event) => setDraft((current) => ({ ...current, rewrittenQuestion: event.target.value, status: "proposed", confirmedAt: null }))}
                rows={3}
              />
            ) : <p className="analysis-brief-rewrite">{brief.rewrittenQuestion}</p>}
          </label>
          <dl>
            <div><dt>Perspective</dt><dd>{brief.perspectiveId.toUpperCase()}</dd></div>
            <div><dt>Geography</dt><dd>{brief.geography}</dd></div>
            <div><dt>Data period</dt><dd>{brief.timeframe}</dd></div>
          </dl>
          <div className="analysis-brief-assumptions">
            <strong>Working assumptions</strong>
            {editing ? (
              <textarea
                value={draft.assumptions.join("\n")}
                onChange={(event) => setDraft((current) => ({ ...current, assumptions: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean), status: "proposed", confirmedAt: null }))}
                rows={4}
              />
            ) : <ul>{brief.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>}
          </div>
        </section>

        <section className="analysis-brief-considerations" aria-label="Analysis considerations">
          <div className="analysis-brief-consideration-heading">
            <div><strong>Considerations</strong><span>What can influence, gate, or contextualize the conclusion</span></div>
            {hasWeights ? <span className={weightsValid ? "valid" : "invalid"}>{weightTotal}% assigned</span> : <span>No blended score</span>}
          </div>
          <div className="analysis-brief-table" role="table">
            {draft.considerations.map((item) => (
              <div className="analysis-brief-row" role="row" key={item.id}>
                <div role="cell">
                  {editing ? (
                    <>
                      <input value={item.label} aria-label={`${item.label} name`} onChange={(event) => updateConsideration(item.id, { label: event.target.value })} />
                      <textarea value={item.metric} aria-label={`${item.label} metric`} onChange={(event) => updateConsideration(item.id, { metric: event.target.value })} rows={2} />
                    </>
                  ) : <><strong>{item.label}</strong><span>{item.metric}</span></>}
                  <small>{item.whyItMatters}</small>
                </div>
                <div role="cell" className="analysis-brief-classification">
                  <span className={`role ${item.role}`}>{roleLabel(item.role)}</span>
                  <span className={`evidence ${item.evidenceStatus}`}>{evidenceLabel(item.evidenceStatus)}</span>
                </div>
                <div role="cell" className="analysis-brief-weight">
                  {item.role === "weighted_preference" ? (
                    editing ? <label><input type="number" min="0" max="100" value={item.weightPercent ?? 0} onChange={(event) => updateConsideration(item.id, { weightPercent: Number(event.target.value) })} /><span>%</span></label> : <strong>{item.weightPercent}%</strong>
                  ) : <span>—</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="analysis-brief-weight-note">
            {hasWeights
              ? "Weights describe a proposed future preference model. The current public-data screen does not calculate or hide a recommendation score."
              : "These considerations guide peer selection and validity checks. Combining them into one weighted score would be misleading for this question."}
          </p>
        </section>
      </div>

      {editing ? (
        <footer className="analysis-brief-footer">
          <span>{weightsValid ? "Ready to confirm" : `Weights must total 100%; currently ${weightTotal}%`}</span>
          <div>
            {brief.status === "confirmed" ? <button className="secondary-action" type="button" onClick={() => { setDraft(brief); setEditing(false); }}>Cancel</button> : null}
            <button className="primary-action" type="button" disabled={!weightsValid || !draft.rewrittenQuestion.trim()} onClick={confirm}>Confirm analysis framing</button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
