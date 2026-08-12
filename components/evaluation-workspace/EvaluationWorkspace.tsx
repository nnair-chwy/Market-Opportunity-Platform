"use client";

import { FormEvent, useMemo, useState } from "react";
import { analysisPlanSchema, planAnalysisPrototype, type AnalysisPlan } from "@/lib/evaluation";
import { EvidenceDropField } from "./EvidenceDropField";
import { WorkspaceOverview, type MapLayerId } from "./WorkspaceOverview";
import styles from "./evaluation-workspace.module.css";

type Props = Record<string, unknown>;

const DEFAULT_QUESTION = "Where should Chewy investigate clinic opportunity next?";

const QUESTION_TO_LAYER: Array<{ pattern: RegExp; layer: MapLayerId }> = [
  { pattern: /income|spending|afford/i, layer: "income" },
  { pattern: /pet|dog|owner/i, layer: "pet_ownership" },
  { pattern: /housing|home/i, layer: "housing" },
  { pattern: /dens/i, layer: "density" },
  { pattern: /population|people/i, layer: "population" },
  { pattern: /household|family/i, layer: "households" },
];

function suggestedLayer(question: string): MapLayerId {
  return QUESTION_TO_LAYER.find((candidate) => candidate.pattern.test(question))?.layer ?? "footprint";
}

function ProgressRail({ question, plan, loading, onClose }: { question: string; plan: AnalysisPlan; loading: boolean; onClose: () => void }) {
  const [evidenceStep, setEvidenceStep] = useState<number | null>(null);
  const evidenceReady = plan.availableMeasures.length > 0;
  const steps = [
    { label: "Understand the question", detail: plan.interpretation, status: loading ? "active" : "complete" },
    { label: "Match compatible evidence", detail: evidenceReady ? plan.availableMeasures.slice(0, 3).join(" · ") : "No compatible governed measure found", status: loading ? "pending" : evidenceReady ? "complete" : "blocked" },
    { label: "Prepare the map view", detail: `${plan.entityLabel} · ${plan.geographyLabel}`, status: loading ? "pending" : "complete" },
    { label: "Check decision boundaries", detail: plan.evidenceBoundary, status: loading ? "pending" : plan.missingMeasures.length ? "attention" : "complete" },
    { label: "Invite analyst follow-up", detail: "Ask another question or compare two evidence views.", status: loading ? "pending" : "waiting" },
  ] as const;
  const completed = steps.filter((step) => step.status === "complete").length;

  return <aside className={styles.progressRail} aria-label="Evaluation progress">
    <button className={styles.closeProgress} type="button" onClick={onClose} aria-label="Close evaluation progress">×</button>
    <header className={styles.progressHeader}>
      <div><span>Working question</span><h1>{question}</h1></div>
      <div className={styles.progressCount}><strong>{loading ? "…" : completed}</strong><small>of {steps.length}<br/>prepared</small></div>
    </header>
    <div className={styles.progressBar}><i style={{ width: `${loading ? 18 : (completed / steps.length) * 100}%` }}/></div>
    <section className={styles.agentStatus}>
      <span className={loading ? styles.pulseDot : styles.readyDot}/>
      <div><b>{loading ? "Evaluating the request" : "Map workspace prepared"}</b><small>{loading ? "Matching the question to available evidence…" : plan.calculationSummary}</small></div>
    </section>
    <ol className={styles.progressSteps}>
      {steps.map((step, index) => {
        const expanded = evidenceStep === index;
        return <li key={step.label} className={styles[step.status]}>
          <button type="button" className={styles.stepTrigger} aria-expanded={expanded} aria-controls={`step-evidence-${index}`} onClick={() => setEvidenceStep(expanded ? null : index)}>
            <span>{step.status === "complete" ? "✓" : index + 1}</span>
            <div><b>{step.label}</b><p>{step.detail}</p></div>
            <em>{step.status}</em>
          </button>
          {expanded && <section id={`step-evidence-${index}`} className={styles.stepEvidence} aria-label={`Add evidence to ${step.label}`}>
            <div className={styles.stepEvidenceHeading}><b>Add human context</b><small>Attach evidence or corrections for this step.</small></div>
            <EvidenceDropField acceptDocuments actionLabel="Add file" dropLabel="Drop a document or data file" initialNotice="Staged for this evaluation only"/>
          </section>}
        </li>;
      })}
    </ol>
    {plan.missingMeasures.length > 0 && <section className={styles.gapsCard}>
      <span>Evidence to connect next</span>
      {plan.missingMeasures.slice(0, 4).map((gap) => <p key={gap}>{gap}</p>)}
    </section>}
    <footer className={styles.boundaryNote}><b>Decision boundary</b><p>{plan.evidenceBoundary}</p></footer>
  </aside>;
}

export function EvaluationWorkspace(props: Props) {
  void props;
  const [started, setStarted] = useState(false);
  const [question, setQuestion] = useState("");
  const [displayQuestion, setDisplayQuestion] = useState(DEFAULT_QUESTION);
  const [plan, setPlan] = useState<AnalysisPlan>(() => planAnalysisPrototype(DEFAULT_QUESTION));
  const [loading, setLoading] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayerId>("footprint");
  const [progressOpen, setProgressOpen] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const prompt = question.trim();

  const composerLabel = started ? "Ask AI a follow-up" : "Evaluation question";
  const placeholder = started ? "Ask what differs, what evidence is missing, or what to inspect next…" : "Ask a market, customer, clinic, or geographic question…";
  const statusText = useMemo(() => loading ? "Matching evidence…" : notice || (started ? "The agent will reconsider the map and evidence plan." : "The map changes to fit the question—not a fixed score."), [loading, notice, started]);

  async function evaluate(value: string) {
    const nextQuestion = value.trim() || DEFAULT_QUESTION;
    setDisplayQuestion(nextQuestion);
    setStarted(true);
    setProgressOpen(true);
    setComposerOpen(false);
    setLoading(true);
    setNotice("");
    setActiveLayer(suggestedLayer(nextQuestion));
    let nextPlan = planAnalysisPrototype(nextQuestion);
    try {
      const response = await fetch("/api/evaluation-plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: nextQuestion }) });
      if (response.ok) {
        const payload = await response.json() as { plan?: unknown };
        const parsed = analysisPlanSchema.safeParse(payload.plan);
        if (parsed.success) nextPlan = parsed.data;
        else setNotice("Using the governed catalog interpretation.");
      } else setNotice("Using the governed catalog interpretation.");
    } catch {
      setNotice("Using the governed catalog interpretation.");
    }
    setPlan(nextPlan);
    setQuestion("");
    setLoading(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (prompt) void evaluate(prompt);
  }

  return <main className={`${styles.shell} ${started ? styles.running : styles.landing} ${started && !progressOpen ? styles.progressClosed : ""}`}>
    <div className={styles.workspaceLayout}>
      <WorkspaceOverview activeLayer={activeLayer} onLayerChange={setActiveLayer} evaluationQuestion={started ? displayQuestion : undefined}/>
      {started && progressOpen && <ProgressRail question={displayQuestion} plan={plan} loading={loading} onClose={() => setProgressOpen(false)}/>}
    </div>
    {started && !progressOpen && <button className={styles.showProgress} type="button" onClick={() => setProgressOpen(true)} aria-label="Show evaluation progress"><span>Progress</span>‹</button>}
    <form className={styles.floatingComposer} onSubmit={submit}>
      <label htmlFor="workspace-question">{composerLabel}</label>
      <div><input id="workspace-question" value={question} onFocus={() => setComposerOpen(true)} onChange={(event) => setQuestion(event.target.value)} placeholder={placeholder} aria-label={composerLabel}/><button disabled={loading || !prompt}>{loading ? <span className={styles.spinner}/> : started ? "Ask AI" : "Evaluate"}<i>→</i></button></div>
      {composerOpen && <div className={styles.composerEvidence}><EvidenceDropField/><button type="button" onClick={() => setComposerOpen(false)} aria-label="Hide evidence upload">×</button></div>}
      <small>{statusText}</small>
    </form>
  </main>;
}
