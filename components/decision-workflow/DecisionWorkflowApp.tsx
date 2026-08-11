"use client";

import { useEffect, useMemo, useState } from "react";
import { AskAiPanel } from "@/components/AskAiPanel";
import { QuestionMap } from "@/components/decision-workflow/QuestionMap";
import type { AskAiContext } from "@/lib/ai/insights";

type Phase = "question" | "running" | "packet" | "compare" | "saved";

type GraphStep = {
  id: string;
  label: string;
  detail: string;
  result: string;
};

type ActionOption = {
  id: string;
  title: string;
  summary: string;
  owner: string;
  timing: string;
  confidence: "High" | "Medium" | "Low";
  evidence: string[];
  tradeoffs: string[];
  nextStep: string;
};

type SavedPacket = {
  id: string;
  question: string;
  title: string;
  actionId: string;
  savedAt: string;
};

const graphSteps: GraphStep[] = [
  {
    id: "interpret",
    label: "Interpret the question",
    detail: "Clarifying the decision, geography, and time horizon.",
    result: "Decision scope identified",
  },
  {
    id: "evidence",
    label: "Assemble evidence",
    detail: "Checking available market, customer, operational, and location evidence.",
    result: "Evidence coverage mapped",
  },
  {
    id: "quality",
    label: "Check evidence quality",
    detail: "Separating confirmed inputs, derived outputs, reported context, and gaps.",
    result: "Quality risks identified",
  },
  {
    id: "compare",
    label: "Test possible paths",
    detail: "Comparing the next actions that fit the evidence and decision scope.",
    result: "Action paths prepared",
  },
  {
    id: "packet",
    label: "Prepare the action packet",
    detail: "Turning findings into a source-linked draft for accountable review.",
    result: "Draft packet ready",
  },
];

const actionOptions: ActionOption[] = [
  {
    id: "market-review",
    title: "Run a focused market review",
    summary: "Validate demand, reach, competition, and local context before narrowing the opportunity.",
    owner: "Market Insights",
    timing: "1 to 2 weeks",
    confidence: "High",
    evidence: ["Market context is available", "The question can be answered at market level", "The next review has a bounded scope"],
    tradeoffs: ["Does not establish property feasibility", "Requires agreement on the comparison cohort"],
    nextStep: "Confirm the markets, measures, and accountable reviewer for the focused review.",
  },
  {
    id: "candidate-review",
    title: "Open a candidate-location review",
    summary: "Move from market context into a structured review of candidate sites and physical constraints.",
    owner: "Real Estate Analytics",
    timing: "2 to 4 weeks",
    confidence: "Medium",
    evidence: ["A parent market can be identified", "Candidate evidence can be organized", "Physical-site diligence is a distinct decision layer"],
    tradeoffs: ["Needs approved site evidence", "Requires human review of ambiguous location relationships"],
    nextStep: "Confirm the parent market and load the required candidate evidence before evaluation.",
  },
  {
    id: "data-gap",
    title: "Resolve the evidence gaps first",
    summary: "Close the missing definitions, owners, or source approvals that currently limit the decision.",
    owner: "Decision Owner",
    timing: "Before prioritization",
    confidence: "Medium",
    evidence: ["Some inputs are not yet decision-ready", "Source ownership and approval affect the result", "Missing values should remain explicit"],
    tradeoffs: ["Delays a comparison", "Creates a stronger audit trail for the next review"],
    nextStep: "Assign owners and deadlines to each blocker, then rerun the question when resolved.",
  },
];

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function statusForStep(index: number, activeStep: number) {
  if (activeStep > index) return "complete";
  if (activeStep === index) return "active";
  return "pending";
}

export function DecisionWorkflowApp() {
  const [activeView, setActiveView] = useState<"workflow" | "saved">("workflow");
  const [phase, setPhase] = useState<Phase>("question");
  const [question, setQuestion] = useState("");
  const [activeStep, setActiveStep] = useState(-1);
  const [selectedActionId, setSelectedActionId] = useState(actionOptions[0].id);
  const [savedPackets, setSavedPackets] = useState<SavedPacket[]>([]);

  const selectedAction = useMemo(
    () => actionOptions.find((action) => action.id === selectedActionId) ?? actionOptions[0],
    [selectedActionId],
  );

  const packetAiContext = useMemo<AskAiContext>(() => ({
    id: `packet-${selectedAction.id}`,
    kind: "market",
    title: selectedAction.title,
    subtitle: `${selectedAction.owner} · ${selectedAction.timing}`,
    overview: `Question: ${question}. Proposed next action: ${selectedAction.summary}`,
    insights: selectedAction.evidence.map((item) => ({
      title: "Evidence considered",
      detail: item,
      status: "Hypothesis",
      sourceIds: [],
      tone: "neutral",
    })),
    warnings: selectedAction.tradeoffs,
    limitations: [
      "This packet contains proposed next actions, not a final business decision.",
      "Answer only from the packet context and identify missing information.",
    ],
    suggestedQuestions: [
      "What should the owner verify first?",
      "What are the main risks in this path?",
      "What evidence is still missing?",
    ],
  }), [question, selectedAction]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("market-intelligence-action-packets");
      if (!stored) return;
      try {
        setSavedPackets(JSON.parse(stored) as SavedPacket[]);
      } catch {
        window.localStorage.removeItem("market-intelligence-action-packets");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        if (current >= graphSteps.length - 1) {
          window.clearInterval(timer);
          window.setTimeout(() => setPhase("packet"), 450);
          return current;
        }
        return current + 1;
      });
    }, 850);
    return () => window.clearInterval(timer);
  }, [phase]);

  function startWorkflow() {
    if (!question.trim()) return;
    setActiveStep(0);
    setPhase("running");
  }

  function restart() {
    setQuestion("");
    setActiveStep(-1);
    setSelectedActionId(actionOptions[0].id);
    setPhase("question");
  }

  function savePacket() {
    const packet: SavedPacket = {
      id: `packet-${Date.now().toString(36)}`,
      question: question.trim(),
      title: selectedAction.title,
      actionId: selectedAction.id,
      savedAt: nowLabel(),
    };
    const next = [packet, ...savedPackets.filter((item) => item.question !== packet.question)].slice(0, 10);
    setSavedPackets(next);
    window.localStorage.setItem("market-intelligence-action-packets", JSON.stringify(next));
    setPhase("saved");
  }

  function openSavedPacket(packet: SavedPacket) {
    setQuestion(packet.question);
    setSelectedActionId(packet.actionId || actionOptions[0].id);
    setActiveView("workflow");
    setPhase("saved");
  }

  return (
    <main className={`decision-app ${phase === "question" && activeView === "workflow" ? "question-page" : "workspace-mode"}`}>
      <header className="decision-header">
        <a className="decision-brand" href="#start" aria-label="Market Intelligence home">
          <span className="decision-brand-mark" aria-hidden="true">MI</span>
          <span><strong>Market Intelligence</strong><small>Decision workspace</small></span>
        </a>
        <div className="decision-header-actions">
          <span className="header-status"><i aria-hidden="true" />Workspace ready</span>
          <button className={`header-icon ${activeView === "saved" ? "active-tab" : ""}`} aria-label="Open saved packets" onClick={() => setActiveView("saved")}>Saved packets <span>{savedPackets.length}</span></button>
          <button className="header-icon" onClick={() => { setActiveView("workflow"); setPhase("question"); }}>New question</button>
          <span className="user-chip">NA</span>
        </div>
      </header>

      <div className={`decision-layout ${phase === "question" && activeView === "workflow" ? "question-layout" : "workspace-layout"}`} id="start">
        {activeView === "workflow" && phase !== "question" ? (
          <div className="workspace-map" aria-label="Geographic context map">
            <div className="map-toolbar"><span>Regional context</span><button type="button">Layers</button><button type="button">Reset view</button></div>
            <img src="/us-map.svg" alt="Illustrative United States geographic context" />
            <span className="map-marker marker-west" /><span className="map-marker marker-central" /><span className="map-marker marker-east" /><span className="map-marker marker-southeast" />
            <div className="map-legend"><span><i className="legend-demand" />Demand context</span><span><i className="legend-site" />Candidate locations</span><small>Map context updates as the question is analyzed.</small></div>
          </div>
        ) : null}
        <aside className="decision-rail" aria-label="Workflow progress">
          <div className="rail-kicker">Decision workflow</div>
          <h2>From question to action</h2>
          <p>Move from a business question to a reviewable next step.</p>
          <ol className="rail-steps">
            <li className={phase === "question" ? "current" : phase === "running" || phase === "packet" || phase === "compare" || phase === "saved" ? "complete" : ""}><span>1</span><div><strong>Ask</strong><small>State the decision</small></div></li>
            <li className={phase === "running" ? "current" : phase === "packet" || phase === "compare" || phase === "saved" ? "complete" : ""}><span>2</span><div><strong>Trace</strong><small>Follow the decision graph</small></div></li>
            <li className={phase === "packet" || phase === "compare" || phase === "saved" ? "current" : ""}><span>3</span><div><strong>Review</strong><small>Read the action packet</small></div></li>
            <li className={phase === "compare" || phase === "saved" ? "current" : ""}><span>4</span><div><strong>Compare</strong><small>Choose the next path</small></div></li>
            <li className={phase === "saved" ? "current complete" : ""}><span>5</span><div><strong>Save</strong><small>Keep the reviewable draft</small></div></li>
          </ol>
          <div className="rail-note"><strong>Decision boundary</strong><p>The workspace prepares evidence and next actions. An accountable owner makes the business decision.</p></div>
        </aside>

        <section className="decision-content">
          {activeView === "saved" ? (
            <SavedPacketsView packets={savedPackets} onOpen={openSavedPacket} onStart={() => { setActiveView("workflow"); setPhase("question"); }} />
          ) : null}
          {activeView === "workflow" ? <>
          {phase === "question" ? (
            <div className="question-split">
              <QuestionMap />
              <section className="question-view" aria-labelledby="question-title">
                <div className="eyebrow">Start with the decision</div>
                <h1 id="question-title">What do you need to decide?</h1>
                <p className="lead">Ask a business question in plain language. The workspace will map the evidence, show its reasoning path, and prepare a draft action packet.</p>
                <form className="question-card" onSubmit={(event) => { event.preventDefault(); startWorkflow(); }}>
                  <label htmlFor="decision-question">Your question</label>
                  <textarea id="decision-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Example: Which markets should we investigate for future growth?" autoFocus />
                  <div className="question-card-footer"><span>Use a question tied to a decision, owner, or next step.</span><button className="primary-action" type="submit" disabled={!question.trim()}>Run decision graph <span aria-hidden="true">→</span></button></div>
                </form>
                <div className="prompt-grid"><button onClick={() => setQuestion("Which markets should we investigate for future growth?")}>Market opportunity</button><button onClick={() => setQuestion("What evidence do we need before comparing candidate locations?")}>Evidence readiness</button><button onClick={() => setQuestion("What should the accountable team investigate next?")}>Next action</button></div>
                {savedPackets.length ? <div className="recent-packets"><div><strong>Recent action packets</strong><span>{savedPackets.length} saved</span></div>{savedPackets.slice(0, 3).map((packet) => <button key={packet.id} onClick={() => { setQuestion(packet.question); setSelectedActionId(actionOptions[0].id); setPhase("saved"); }}><span>{packet.title}</span><small>{packet.savedAt}</small></button>)}</div> : null}
              </section>
            </div>
          ) : null}

          {phase === "running" ? (
            <section className="graph-view" aria-labelledby="graph-title" aria-live="polite">
              <div className="eyebrow">Decision graph in progress</div>
              <h1 id="graph-title">Tracing the question</h1>
              <p className="lead">The workspace is making the decision path visible. Each step is bounded by the available evidence and review rules.</p>
              <div className="question-ribbon"><span>Your question</span><strong>{question}</strong></div>
              <div className="graph-canvas">
                <div className="graph-line" aria-hidden="true" />
                {graphSteps.map((step, index) => <article className={`graph-node ${statusForStep(index, activeStep)}`} key={step.id}><span className="graph-node-index">{index + 1}</span><div><strong>{step.label}</strong><p>{step.detail}</p>{activeStep > index ? <small><i aria-hidden="true" />{step.result}</small> : activeStep === index ? <small className="working"><i aria-hidden="true" />Working</small> : null}</div></article>)}
              </div>
              <div className="graph-footer"><span className="progress-pulse" aria-hidden="true" />{graphSteps[activeStep]?.label ?? "Preparing the decision graph"}</div>
            </section>
          ) : null}

          {phase === "packet" || phase === "compare" || phase === "saved" ? (
            <section className="packet-view" aria-labelledby="packet-title">
              <div className="packet-heading"><div><div className="eyebrow">{phase === "saved" ? "Saved action packet" : "Findings and next actions"}</div><h1 id="packet-title">A reviewable path forward</h1><p className="lead">The decision graph found several possible next actions. Compare them before saving the packet.</p></div><div className="packet-heading-actions"><span className="draft-pill">{phase === "saved" ? "Saved draft" : "Draft for review"}</span><button className="secondary-action" onClick={restart}>New question</button></div></div>
              <div className="packet-question"><span>Question</span><strong>{question}</strong></div>
              <div className="finding-grid"><article><span>Finding</span><strong>The question is actionable at the market and evidence level.</strong><p>A next step can be prepared, but the current result does not approve spend, a site, a lease, or a market decision.</p></article><article><span>Constraint</span><strong>Evidence and ownership still matter.</strong><p>Each action keeps its dependencies and unresolved diligence visible for the accountable reviewer.</p></article><article><span>Output</span><strong>Three governed action paths</strong><p>Choose the path that best matches the decision owner’s immediate need.</p></article></div>
              <div className="packet-body">
                <div className="action-packet-card"><div className="section-label">Proposed action packet</div><h2>{selectedAction.title}</h2><p>{selectedAction.summary}</p><dl><div><dt>Owner</dt><dd>{selectedAction.owner}</dd></div><div><dt>Timing</dt><dd>{selectedAction.timing}</dd></div><div><dt>Confidence</dt><dd><span className={`confidence ${selectedAction.confidence.toLowerCase()}`}>{selectedAction.confidence}</span></dd></div><div><dt>Next step</dt><dd>{selectedAction.nextStep}</dd></div></dl><div className="packet-evidence"><strong>Evidence considered</strong>{selectedAction.evidence.map((item) => <span key={item}><i aria-hidden="true">✓</i>{item}</span>)}</div><div className="packet-evidence tradeoffs"><strong>Tradeoffs to review</strong>{selectedAction.tradeoffs.map((item) => <span key={item}><i aria-hidden="true">!</i>{item}</span>)}</div><div className="packet-card-footer"><span>Draft status: accountable review required</span><button className="primary-action" onClick={savePacket}>{phase === "saved" ? "Saved" : "Save action packet"} <span aria-hidden="true">✓</span></button></div></div>
                <aside className="action-options"><div className="section-label">Compare possible actions</div><p>Select an action to update the packet.</p>{actionOptions.map((action) => <button className={`action-option ${selectedAction.id === action.id ? "selected" : ""}`} key={action.id} onClick={() => { setSelectedActionId(action.id); setPhase("compare"); }}><span className="action-option-radio" aria-hidden="true" /><div><strong>{action.title}</strong><small>{action.owner} · {action.timing}</small><p>{action.summary}</p></div><span className={`confidence ${action.confidence.toLowerCase()}`}>{action.confidence}</span></button>)}</aside>
              </div>
              <div className="packet-disclosure"><span>Decision record</span><p>This packet contains findings, evidence boundaries, and proposed next actions. It is not a final recommendation. Saved packets remain in this browser for this workspace.</p></div>
              <AskAiPanel className="packet-ai-panel" context={packetAiContext} emptyTitle="Ask about this packet" emptyMessage="Ask a question about the proposed actions, evidence, risks, or missing information." />
            </section>
          ) : null}
          </> : null}
        </section>
      </div>
    </main>
  );
}

function SavedPacketsView({
  packets,
  onOpen,
  onStart,
}: {
  packets: SavedPacket[];
  onOpen: (packet: SavedPacket) => void;
  onStart: () => void;
}) {
  return (
    <section className="saved-packets-view" aria-labelledby="saved-packets-title">
      <div className="eyebrow">Saved workspace</div>
      <div className="saved-packets-heading">
        <div>
          <h1 id="saved-packets-title">Saved action packets</h1>
          <p className="lead">Open any packet to review its findings, compare its action paths, or ask a packet-scoped question.</p>
        </div>
        <button className="primary-action" onClick={onStart}>Start a new question <span aria-hidden="true">→</span></button>
      </div>
      {packets.length ? (
        <div className="saved-packets-list">
          {packets.map((packet) => (
            <button className="saved-packet-row" key={packet.id} onClick={() => onOpen(packet)}>
              <span className="saved-packet-icon" aria-hidden="true">↗</span>
              <span className="saved-packet-copy"><strong>{packet.title}</strong><small>{packet.question}</small></span>
              <span className="saved-packet-meta"><small>{packet.savedAt}</small><b>Open review</b></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="saved-packets-empty"><strong>No saved packets yet</strong><p>Run a question, compare the available action paths, and save the packet when it is ready for review.</p><button className="secondary-action" onClick={onStart}>Ask a question</button></div>
      )}
    </section>
  );
}
