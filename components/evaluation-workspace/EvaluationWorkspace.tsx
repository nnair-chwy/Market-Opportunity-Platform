"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { analysisPlanSchema, planAnalysisPrototype, type AnalysisPlan } from "@/lib/evaluation";
import { confirmQuestionIntent, interpretQuestionPrototype, proposedWeightTotal, questionIntentSchema, type QuestionIntent } from "@/lib/decision-agent";
import { EvidenceDropField } from "./EvidenceDropField";
import { WorkspaceOverview, type MapLayerId } from "./WorkspaceOverview";
import styles from "./evaluation-workspace.module.css";

type Props = Record<string, unknown>;

const DEFAULT_QUESTION = "Where should Chewy investigate clinic opportunity next?";
const INTERPRETATION_STAGES = ["Understanding the decision", "Checking verified internal guidance", "Defining evidence and evaluation logic", "Preparing assumptions for review"];
const PRICING_RESEARCH_URL = "https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5430739955/Ram+Shenoy+Pricing+Product+Meeting+Prep";

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

const INTENT_FIELDS: Array<{ key: keyof Pick<QuestionIntent, "stakeholder" | "entity" | "geography" | "period" | "outcome" | "denominator" | "action">; label: string }> = [
  { key: "stakeholder", label: "Decision owner" },
  { key: "entity", label: "What the agent compares" },
  { key: "geography", label: "Actionable geography" },
  { key: "period", label: "Decision period" },
  { key: "outcome", label: "Success outcome" },
  { key: "denominator", label: "Denominator" },
  { key: "action", label: "Allowed next action" },
];

const SCOPE_FIELDS = INTENT_FIELDS.filter((field) => ["stakeholder", "geography", "period", "denominator"].includes(field.key));

function QuestionIntentReview({ sourceQuestion, intent, onChange, onContinue, onStartOver }: { sourceQuestion: string; intent: QuestionIntent; onChange: (intent: QuestionIntent) => void; onContinue: () => void; onStartOver: () => void }) {
  const updateField = (key: (typeof INTENT_FIELDS)[number]["key"], value: string) => onChange({ ...intent, [key]: value, confirmation_status: "revision_requested" });
  const updateList = (key: "constraints" | "assumptions" | "ambiguities" | "ideal_evidence" | "evaluation_metrics" | "comparison_rules", value: string) => onChange({ ...intent, [key]: value.split("\n").map((item) => item.trim()).filter(Boolean), confirmation_status: "revision_requested" });
  const weightTotal = proposedWeightTotal(intent);
  const weightsValid = intent.proposed_weights.length === 0 || Math.abs(weightTotal - 100) < 0.001;
  const updateWeight = (index: number, weight: number) => onChange({ ...intent, proposed_weights: intent.proposed_weights.map((item, itemIndex) => itemIndex === index ? { ...item, weight_percent: weight } : item), confirmation_status: "revision_requested" });
  const canContinue = intent.decision.trim() && INTENT_FIELDS.every((field) => intent[field.key].trim()) && weightsValid;

  return <section className={styles.intentReview} aria-label="Confirm the decision question">
    <header className={styles.intentHeader}>
      <div><span>Decision brief · proposed</span><h1>Confirm what this evaluation should decide</h1><p>Original question: “{sourceQuestion}”</p></div>
      <button type="button" onClick={onStartOver}>Start over</button>
    </header>
    <div className={styles.mustRead} aria-label="Decision summary to review">
      <label className={styles.decisionField}><span>Decision to make</span><textarea value={intent.decision} rows={2} onChange={(event) => onChange({ ...intent, decision: event.target.value, confirmation_status: "revision_requested" })}/></label>
      <div className={styles.summaryGrid}>
        <label><span>What the agent compares</span><input value={intent.entity} onChange={(event) => updateField("entity", event.target.value)}/><small>This is the unit of analysis—not a data source.</small></label>
        <label><span>Success means</span><input value={intent.outcome} onChange={(event) => updateField("outcome", event.target.value)}/></label>
        <label><span>What happens next</span><textarea rows={2} value={intent.action} onChange={(event) => updateField("action", event.target.value)}/></label>
      </div>
    </div>
    <div className={styles.briefSections}>
      <details><summary><span>Scope and ownership</span><small>Who decides, where, when, and against what base</small></summary><div className={styles.intentGrid}>{SCOPE_FIELDS.map((field) => <label key={field.key}><span>{field.label}</span><input value={intent[field.key]} onChange={(event) => updateField(field.key, event.target.value)}/></label>)}</div></details>
      <details open><summary><span>Assumptions to confirm</span><small>{intent.assumptions.length} assumptions · {intent.ambiguities.length} open question</small></summary><div className={styles.intentLists}>
        <label><span>Assumptions</span><textarea rows={3} value={intent.assumptions.join("\n")} onChange={(event) => updateList("assumptions", event.target.value)}/><small>Edit anything the agent inferred.</small></label>
        <label><span>Still needs confirmation</span><textarea rows={3} value={intent.ambiguities.join("\n")} onChange={(event) => updateList("ambiguities", event.target.value)}/><small>These remain visible after confirmation.</small></label>
        <label><span>Decision boundaries</span><textarea rows={3} value={intent.constraints.join("\n")} onChange={(event) => updateList("constraints", event.target.value)}/><small>Rules the analysis and action must preserve.</small></label>
      </div></details>
      <details><summary><span>How the agent will evaluate this</span><small>{intent.ideal_evidence.length} evidence needs · {intent.evaluation_metrics.length} proposed metrics · {intent.comparison_rules.length} comparison rules</small></summary><div className={`${styles.intentLists} ${styles.executionBrief}`}>
        <label><span>Evidence to look for</span><textarea rows={5} value={intent.ideal_evidence.join("\n")} onChange={(event) => updateList("ideal_evidence", event.target.value)}/><small>The catalog will verify whether each source exists and can be used.</small></label>
        <label><span>Proposed metrics</span><textarea rows={5} value={intent.evaluation_metrics.join("\n")} onChange={(event) => updateList("evaluation_metrics", event.target.value)}/><small>Outcome, drivers, eligibility checks, diagnostics, and guardrails.</small></label>
        <label><span>Comparison rules</span><textarea rows={5} value={intent.comparison_rules.join("\n")} onChange={(event) => updateList("comparison_rules", event.target.value)}/><small>Cohort, baseline, compatibility, exclusions, and advancement boundary.</small></label>
      </div><section className={styles.researchPlan}><header><div><b>Research and validation plan</b><small>What the agent will verify before relying on evidence.</small></div>{/\b(price|pricing|elasticity)\b/i.test(sourceQuestion) && <a href={PRICING_RESEARCH_URL} target="_blank" rel="noreferrer">Pricing interview source ↗</a>}</header><ol>{intent.research_plan.map((item) => <li key={item}>{item}</li>)}</ol></section><div className={styles.addSource}><div><b>Add a source or business context</b><small>Stage a document or data file for the evidence review.</small></div><EvidenceDropField acceptDocuments actionLabel="Add source" dropLabel="Drop supporting evidence" initialNotice="Staged for this evaluation only"/></div></details>
      {intent.proposed_weights.length > 0 && <details open><summary><span>How much each factor can influence the result</span><small>{weightTotal}% assigned · must total 100%</small></summary><div className={styles.weightIntro}><p><b>Weight</b> is the maximum share of the preference score. After calculation, each market will show the actual points contributed by every factor.</p><span className={weightsValid ? styles.weightReady : styles.weightError}>{weightsValid ? "100% assigned" : `${weightTotal}% assigned — adjust to 100%`}</span></div><div className={styles.weightList}>
        {intent.proposed_weights.map((criterion, index) => <section key={criterion.criterion_id} className={styles.weightRow}>
          <div><b>{criterion.label}</b><p>{criterion.metric}</p><small>{criterion.why_it_matters}</small></div>
          <label><span>{criterion.label} weight</span><div><input type="range" min="0" max="100" step="5" value={criterion.weight_percent} onChange={(event) => updateWeight(index, Number(event.target.value))} aria-label={`${criterion.label} weight`}/><input type="number" min="0" max="100" step="5" value={criterion.weight_percent} onChange={(event) => updateWeight(index, Number(event.target.value))} aria-label={`${criterion.label} weight percent`}/><em>%</em></div></label>
        </section>)}
      </div><p className={styles.constraintSeparation}><b>Not weighted:</b> staffing, property, permitting, capital, data quality, and other pass/fail requirements can block advancement regardless of score.</p></details>}
    </div>
    <footer className={styles.intentFooter}><p><b>Next:</b> review which evidence is available, missing, stale, or incompatible—and inspect the proposed analysis steps before any calculation.</p><button type="button" disabled={!canContinue} onClick={onContinue}>Confirm goal and review evidence <i>→</i></button></footer>
  </section>;
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
  const [intentDraft, setIntentDraft] = useState<QuestionIntent | null>(null);
  const [intentSourceQuestion, setIntentSourceQuestion] = useState("");
  const [interpretationStage, setInterpretationStage] = useState(0);
  const prompt = question.trim();

  const composerLabel = started ? "Ask AI a follow-up" : "Evaluation question";
  const placeholder = started ? "Ask what differs, what evidence is missing, or what to inspect next…" : "Ask a market, customer, clinic, or geographic question…";
  const statusText = useMemo(() => loading ? (started ? "Matching evidence…" : `${INTERPRETATION_STAGES[interpretationStage]}…`) : notice || (started ? "The agent will reconsider the map and evidence plan." : "The map changes to fit the question—not a fixed score."), [interpretationStage, loading, notice, started]);

  useEffect(() => {
    if (!loading || started) return;
    const timer = window.setInterval(() => setInterpretationStage((stage) => Math.min(stage + 1, INTERPRETATION_STAGES.length - 1)), 2200);
    return () => window.clearInterval(timer);
  }, [loading, started]);

  async function interpret(value: string) {
    const nextQuestion = value.trim() || DEFAULT_QUESTION;
    setInterpretationStage(0);
    setLoading(true);
    setNotice("");
    setComposerOpen(false);
    let nextIntent = interpretQuestionPrototype(nextQuestion);
    try {
      const response = await fetch("/api/question-intents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: nextQuestion }), signal: AbortSignal.timeout(10_000) });
      if (response.ok) {
        const payload = await response.json() as { intent?: unknown };
        const parsed = questionIntentSchema.safeParse(payload.intent);
        if (parsed.success) nextIntent = parsed.data;
        else setNotice("Using the governed prototype interpretation.");
      } else setNotice("Using the governed prototype interpretation.");
    } catch {
      setNotice("Using the governed prototype interpretation.");
    }
    setIntentSourceQuestion(nextQuestion);
    setIntentDraft(nextIntent);
    setQuestion("");
    setLoading(false);
  }

  async function evaluate(value: string, displayValue = value) {
    const nextQuestion = value.trim() || DEFAULT_QUESTION;
    setDisplayQuestion(displayValue.trim() || nextQuestion);
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
    if (prompt) void (started ? evaluate(prompt) : interpret(prompt));
  }

  function continueWithIntent() {
    if (!intentDraft) return;
    const confirmed = confirmQuestionIntent(intentDraft);
    const weights = confirmed.proposed_weights.map((item) => `${item.label} ${item.weight_percent}% using ${item.metric}`).join("; ");
    const planningQuestion = `${confirmed.decision} Outcome: ${confirmed.outcome}. Denominator: ${confirmed.denominator}. Entity: ${confirmed.entity}. Geography: ${confirmed.geography}. Period: ${confirmed.period}. Allowed action: ${confirmed.action}.${weights ? ` Proposed human-editable weights: ${weights}.` : ""}`;
    setIntentDraft(null);
    void evaluate(planningQuestion, confirmed.decision);
  }

  function startOver() {
    setIntentDraft(null);
    setIntentSourceQuestion("");
    setNotice("");
  }

  return <main className={`${styles.shell} ${started ? styles.running : styles.landing} ${started && !progressOpen ? styles.progressClosed : ""}`}>
    <div className={styles.workspaceLayout}>
      <WorkspaceOverview activeLayer={activeLayer} onLayerChange={setActiveLayer} evaluationQuestion={started ? displayQuestion : undefined}/>
      {started && progressOpen && <ProgressRail question={displayQuestion} plan={plan} loading={loading} onClose={() => setProgressOpen(false)}/>}
    </div>
    {intentDraft && <QuestionIntentReview sourceQuestion={intentSourceQuestion} intent={intentDraft} onChange={setIntentDraft} onContinue={continueWithIntent} onStartOver={startOver}/>}
    {started && !progressOpen && <button className={styles.showProgress} type="button" onClick={() => setProgressOpen(true)} aria-label="Show evaluation progress"><span>Progress</span>‹</button>}
    {!intentDraft && <form className={styles.floatingComposer} onSubmit={submit}>
      <label htmlFor="workspace-question">{composerLabel}</label>
      <div><input id="workspace-question" value={question} onFocus={() => setComposerOpen(true)} onChange={(event) => setQuestion(event.target.value)} placeholder={placeholder} aria-label={composerLabel}/><button disabled={loading || !prompt}>{loading ? <span className={styles.spinner}/> : started ? "Ask AI" : "Evaluate"}<i>→</i></button></div>
      {composerOpen && <div className={styles.composerEvidence}><EvidenceDropField/><button type="button" onClick={() => setComposerOpen(false)} aria-label="Hide evidence upload">×</button></div>}
      {loading && !started && <div className={styles.interpretationActivity} role="status"><div>{INTERPRETATION_STAGES.map((stage, index) => <span key={stage} className={index < interpretationStage ? styles.stageDone : index === interpretationStage ? styles.stageActive : ""}>{index < interpretationStage ? "✓" : index + 1}<b>{stage}</b></span>)}</div></div>}
      <small>{statusText}</small>
    </form>}
  </main>;
}
