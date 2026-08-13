"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  generateEvaluationDefinitionDraft,
  requestEvidenceCorrection,
  stageEvidence,
  type EvidencePlan,
  type EvaluationDefinitionDraft,
  type StagedEvidence,
} from "@/lib/planning/evidence-plan";
import type { AnalysisBrief } from "@/lib/planning/analysis-brief";
import type { MarketInvestigation } from "@/lib/planning/market-investigation";

type EvidencePlanningPanelProps = {
  analysisBrief: AnalysisBrief;
  investigation: MarketInvestigation;
  evidencePlan: EvidencePlan;
  onEvidencePlanChange: (plan: EvidencePlan) => void;
  onDefinitionChange: (definition: EvaluationDefinitionDraft) => void;
};

const statusLabel = {
  available: "Available",
  partial: "Partial",
  missing: "Missing",
  incompatible: "Incompatible",
} as const;

export function EvidencePlanningPanel({
  analysisBrief,
  investigation,
  evidencePlan,
  onEvidencePlanChange,
  onDefinitionChange,
}: EvidencePlanningPanelProps) {
  const [open, setOpen] = useState(false);
  const [targetEvidenceId, setTargetEvidenceId] = useState(evidencePlan.items[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [fileMetadata, setFileMetadata] = useState<{ fileName: string; mediaType: string; sizeBytes: number } | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const definition = useMemo(
    () => generateEvaluationDefinitionDraft(analysisBrief, investigation, evidencePlan),
    [analysisBrief, evidencePlan, investigation],
  );
  const counts = evidencePlan.items.reduce<Record<string, number>>((totals, item) => ({ ...totals, [item.availability]: (totals[item.availability] ?? 0) + 1 }), {});

  function captureFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileMetadata(file ? { fileName: file.name, mediaType: file.type || "application/octet-stream", sizeBytes: file.size } : null);
  }

  function addStagedEvidence() {
    if (!targetEvidenceId || (!fileMetadata && !note.trim())) return;
    const staged: StagedEvidence = {
      id: `staged-${Date.now().toString(36)}`,
      fileName: fileMetadata?.fileName ?? null,
      mediaType: fileMetadata?.mediaType ?? null,
      sizeBytes: fileMetadata?.sizeBytes ?? null,
      note: note.trim() || "File staged without additional context.",
      stagedAt: new Date().toISOString(),
      state: "staged_for_review",
    };
    const next = stageEvidence(evidencePlan, targetEvidenceId, staged);
    onEvidencePlanChange(next);
    onDefinitionChange(generateEvaluationDefinitionDraft(analysisBrief, investigation, next));
    setFileMetadata(null);
    setNote("");
  }

  function saveCorrection(evidenceId: string) {
    const next = requestEvidenceCorrection(evidencePlan, evidenceId, correction);
    onEvidencePlanChange(next);
    onDefinitionChange(generateEvaluationDefinitionDraft(analysisBrief, investigation, next));
    setCorrectionTarget(null);
    setCorrection("");
  }

  return (
    <section className="evidence-planning-panel" aria-labelledby="evidence-plan-title">
      <button className="evidence-plan-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <div>
          <span>Evidence and execution plan</span>
          <strong id="evidence-plan-title">What is usable now, what is missing, and what happens next</strong>
        </div>
        <div className="evidence-plan-counts">
          <span>{counts.available ?? 0} available</span>
          <span>{counts.partial ?? 0} partial</span>
          <span>{counts.missing ?? 0} missing</span>
          <b>{open ? "−" : "+"}</b>
        </div>
      </button>

      {open ? (
        <div className="evidence-plan-body">
          <div className="evidence-plan-grid">
            {evidencePlan.items.map((item) => (
              <article key={item.id} className="evidence-plan-item" data-availability={item.availability}>
                <header>
                  <div><strong>{item.label}</strong><small>{item.role.replaceAll("_", " ")}</small></div>
                  <span>{statusLabel[item.availability]}</span>
                </header>
                <p>{item.reason}</p>
                <dl>
                  <div><dt>Needed for</dt><dd>{item.requiredFor}</dd></div>
                  <div><dt>Allowed use</dt><dd>{item.allowedUse}</dd></div>
                  <div><dt>Sources</dt><dd>{item.sourceIds.join(" · ") || "No governed source connected"}</dd></div>
                </dl>
                <small className="evidence-plan-next">Next: {item.nextAction}</small>
                {item.stagedEvidence.map((staged) => (
                  <div className="evidence-plan-staged" key={staged.id}>
                    <strong>Staged for review—not used</strong>
                    <span>{staged.fileName ?? "Business context note"}{staged.fileName && staged.sizeBytes !== null ? ` · ${(staged.sizeBytes / 1024).toFixed(1)} KB` : ""}</span>
                    <small>{staged.note}</small>
                  </div>
                ))}
                {item.correctionRequest ? <p className="evidence-plan-correction"><strong>Correction requested:</strong> {item.correctionRequest}</p> : null}
                {correctionTarget === item.id ? (
                  <div className="evidence-correction-form">
                    <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} rows={2} placeholder="Explain what is wrong or where the evidence exists..." />
                    <button type="button" onClick={() => saveCorrection(item.id)} disabled={!correction.trim()}>Save correction request</button>
                  </div>
                ) : <button className="evidence-correct-button" type="button" onClick={() => { setCorrectionTarget(item.id); setCorrection(item.correctionRequest ?? ""); }}>Correct this status</button>}
              </article>
            ))}
          </div>

          <section className="evidence-stage-source" aria-label="Stage supporting evidence">
            <div><strong>Add evidence or business context</strong><p>Files and notes remain staged metadata only. They cannot enter calculations until Nik’s package and quality validation accepts them.</p></div>
            <label><span>Evidence need</span><select value={targetEvidenceId} onChange={(event) => setTargetEvidenceId(event.target.value)}>{evidencePlan.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="evidence-file-input"><span>Optional file</span><input type="file" accept=".csv,.xlsx,.xls,.json,.pdf,.doc,.docx,.txt" onChange={captureFile} />{fileMetadata ? <small>{fileMetadata.fileName}</small> : null}</label>
            <label><span>Context or correction</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Describe the source, owner, grain, period, and intended use..." /></label>
            <button className="primary-action" type="button" onClick={addStagedEvidence} disabled={!fileMetadata && !note.trim()}>Stage for validation</button>
          </section>

          <section className="evaluation-definition-draft" aria-label="Generated evaluation definition">
            <header><div><span>Generated plan · {definition.version}</span><strong>{definition.status.replaceAll("_", " ")}</strong></div><small>Staged evidence never counts as available</small></header>
            <p><strong>Question</strong>{definition.question}</p>
            <p><strong>Strongest allowed conclusion</strong>{definition.strongestAllowedConclusion}</p>
            <ol>{definition.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            {definition.blockers.length ? <details><summary>{definition.blockers.length} blockers before a stronger conclusion</summary>{definition.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}</details> : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
