"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analysisBriefWeightTotal,
  type AnalysisBrief,
  type AnalysisConsideration,
} from "@/lib/planning/analysis-brief";
import type { AnswerContract } from "@/lib/planning/answer-contract";

type AnalysisBriefPanelProps = {
  brief: AnalysisBrief;
  answerContract: AnswerContract;
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

export function AnalysisBriefPanel({ brief, answerContract, onConfirm }: AnalysisBriefPanelProps) {
  const [editing, setEditing] = useState(brief.status !== "confirmed");
  const [draft, setDraft] = useState(brief);
  useEffect(() => {
    setDraft(brief);
    setEditing(brief.status !== "confirmed");
  }, [brief]);
  const weightTotal = useMemo(() => analysisBriefWeightTotal(draft), [draft]);
  const weightedItems = draft.considerations.filter((item) => item.weightPercent !== null);
  const hasWeights = weightedItems.length > 0;
  const weightsValid = !hasWeights || (Math.abs(weightTotal - 100) < 0.001 && weightedItems.every((item) => (item.weightPercent ?? 0) > 0));

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
          <div className="eyebrow">Analysis contract</div>
          <h2 id="analysis-brief-title">Question and evidence check</h2>
          <p>Edit anything that would change what the analyst compares or what the result is allowed to mean.</p>
        </div>
        <div className="analysis-brief-actions">
          <span className={`analysis-brief-status ${brief.status}`}>{brief.status === "confirmed" ? "Confirmed" : "Needs confirmation"}</span>
          {!editing ? <button className="secondary-action" type="button" onClick={() => setEditing(true)}>Adjust</button> : null}
        </div>
      </header>

      <div className="analysis-brief-frame">
        <section className="analysis-brief-question">
          <div className="analysis-brief-original">
            <span>Original question</span>
            <p>{brief.originalQuestion}</p>
          </div>
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
          <dl aria-label="Analysis scope">
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

        <section className="answer-contract-preview" aria-labelledby="answer-contract-title" data-answer-mode={answerContract.answerMode}>
          <header>
            <div>
              <span>Final-answer contract · {answerContract.version}</span>
              <h3 id="answer-contract-title">What a useful answer must contain</h3>
            </div>
            <b>{answerContract.answerMode.replaceAll("_", " ")}</b>
          </header>
          <div className="answer-contract-boundary">
            <strong>Strongest permitted conclusion</strong>
            <p>{answerContract.strongestPermittedConclusion}</p>
            <small>
              Decision owner: {answerContract.audience.decisionOwner}
              {" · "}Unit: {answerContract.decisionFrame.unitOfAnalysis}
              {" · "}Framing: {answerContract.framingProposal.origin.replaceAll("_", " ")}
            </small>
          </div>
          <div className="answer-contract-columns">
            <div>
              <strong>Required answer sections</strong>
              <ol>{answerContract.requiredSections.map((section) => <li key={section.sectionId}>{section.label}</li>)}</ol>
            </div>
            <div>
              <strong>{brief.perspectiveId.toUpperCase()} questions the answer must resolve</strong>
              <ul>{answerContract.domainRequirements.map((requirement) => (
                <li
                  key={requirement.requirementId}
                  data-readiness={requirement.readiness}
                  data-emphasized={answerContract.framingProposal.emphasizedRequirementIds.includes(requirement.requirementId)}
                >
                  <span>{requirement.label}</span>
                  <small>{requirement.readiness.replaceAll("_", " ")}</small>
                </li>
              ))}</ul>
            </div>
          </div>
          <details>
            <summary>Completion tests and prohibited conclusions</summary>
            <div className="answer-contract-details">
              <div><strong>Done when</strong><ul>{answerContract.completionCriteria.map((criterion) => <li key={criterion.criterionId}>{criterion.label}</li>)}</ul></div>
              <div><strong>Must not conclude</strong><ul>{answerContract.prohibitedConclusions.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><strong>Questions still to resolve</strong><ul>{answerContract.framingProposal.unresolvedQuestions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </details>
        </section>

        <section className="analysis-brief-considerations" aria-label="Analysis considerations">
          <div className="analysis-brief-current-screen">
            <strong>Method and inputs</strong>
            <div>
              <p>{brief.currentScreen.inputs.join(" · ")}</p>
              <small>{brief.currentScreen.method}</small>
            </div>
            <b>{brief.currentScreen.considerationEditsRecalculate
                ? "These weights directly control the calculation. No hidden weights are added."
                : hasWeights
                  ? "Weights define intended decision influence. Missing must-pass evidence can still block a recommendation."
                  : "This question uses gates and comparisons rather than a blended score."}</b>
          </div>
          <div className="analysis-brief-consideration-heading">
            <div><strong>Considerations</strong><span>What can influence, gate, or contextualize the conclusion</span></div>
            {hasWeights ? <span className={weightsValid ? "valid" : "invalid"}>{weightTotal}% assigned</span> : <span>No blended score</span>}
          </div>
          <div className="analysis-brief-table" role="table">
            <div className="analysis-brief-table-header" role="row">
              <span role="columnheader">Consideration</span>
              <span role="columnheader">Metric and rationale</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Evidence</span>
              <span role="columnheader">Weight</span>
            </div>
            {draft.considerations.map((item) => (
              <div className="analysis-brief-row" role="row" key={item.id}>
                <div role="cell" className="analysis-brief-name">
                  {editing
                    ? <input value={item.label} aria-label={`${item.label} name`} onChange={(event) => updateConsideration(item.id, { label: event.target.value })} />
                    : <strong>{item.label}</strong>}
                </div>
                <div role="cell" className="analysis-brief-metric">
                  {editing
                    ? <input value={item.metric} aria-label={`${item.label} metric`} title={item.metric} onChange={(event) => updateConsideration(item.id, { metric: event.target.value })} />
                    : <span title={item.metric}>{item.metric}</span>}
                </div>
                <div role="cell" className="analysis-brief-classification analysis-brief-role">
                  <span className={`role ${item.role}`}>{roleLabel(item.role)}</span>
                </div>
                <div role="cell" className="analysis-brief-classification analysis-brief-evidence">
                  <span className={`evidence ${item.evidenceStatus}`}>{evidenceLabel(item.evidenceStatus)}</span>
                </div>
                <div role="cell" className="analysis-brief-weight">
                  {item.weightPercent !== null ? (
                    editing ? <label><input type="number" min="1" max="100" value={item.weightPercent ?? 0} onChange={(event) => updateConsideration(item.id, { weightPercent: Number(event.target.value) })} /><span>%</span></label> : <strong>{item.weightPercent}%</strong>
                  ) : <span>—</span>}
                </div>
                <small className="analysis-brief-rationale" title={item.whyItMatters}>{item.whyItMatters}</small>
              </div>
            ))}
          </div>
          <p className="analysis-brief-weight-note">
            {hasWeights
              ? "The analyst proposed these weights from your question. They define intended influence and are preserved in the analysis contract. A must-pass item can still block a recommendation, and unavailable evidence is never given an invented score."
              : "These considerations guide peer selection and validity checks. Combining them into one weighted score would be misleading for this question."}
          </p>
        </section>
      </div>

      {editing ? (
        <footer className="analysis-brief-footer">
          <span>{weightsValid ? "Ready to run with these boundaries" : `Every weighted category must be above 0% and total 100%; currently ${weightTotal}%`}</span>
          <div>
            {brief.status === "confirmed" ? <button className="secondary-action" type="button" onClick={() => { setDraft(brief); setEditing(false); }}>Cancel</button> : null}
            <button className="primary-action" type="button" disabled={!weightsValid || !draft.rewrittenQuestion.trim()} onClick={confirm}>Confirm and run analysis <span aria-hidden="true">→</span></button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
