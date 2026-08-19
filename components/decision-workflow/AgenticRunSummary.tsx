"use client";

import { DecisionGraphAnimation, type DecisionGraphAction, type DecisionGraphStep } from "@/components/decision-workflow/DecisionGraphAnimation";
import type { AgenticEvidenceLifecycle } from "@/lib/evidence-snapshot/contracts";
import { agenticResultCopy, productLabel } from "@/lib/planning/result-language";

export function lifecycleGraphSteps(lifecycle: AgenticEvidenceLifecycle): DecisionGraphStep[] {
  return [
    ...lifecycle.passes.map((pass) => ({
      id: pass.passId,
      label: `Pass ${pass.iteration}: ${pass.selectedQueries.map(productLabel).join(", ")}`,
      detail: `${pass.addedEvidenceCount} new evidence item${pass.addedEvidenceCount === 1 ? "" : "s"}; answer check: ${pass.answerStatus}.`,
      result: `${pass.sourceIds.length} source${pass.sourceIds.length === 1 ? "" : "s"} checked; ${pass.unmetCriterionIds.length} answer criterion${pass.unmetCriterionIds.length === 1 ? "" : " criteria"} remained unmet.`,
      evidenceState: pass.executionStatus === "blocked" || pass.executionStatus === "failed" ? "waiting" as const : "complete" as const,
    })),
    {
      id: "agentic-stop-check",
      label: "Check the answer against the goal",
      detail: lifecycle.stopReason,
      result: lifecycle.stopReason,
      evidenceState: lifecycle.finalAnswerStatus === "pass" ? "complete" as const : "waiting" as const,
    },
  ];
}

function lifecycleStatusLabel(status: AgenticEvidenceLifecycle["status"]) {
  if (status === "goal_satisfied") return "Goal checks passed";
  if (status === "best_available_answer") return "Best available answer produced";
  if (status === "no_useful_source") return "No additional useful registered evidence";
  if (status === "max_iterations") return "Bounded research limit reached";
  return "Evidence execution failed";
}

export function AgenticRunSummary({ lifecycle, selectedActionId, actions }: {
  lifecycle: AgenticEvidenceLifecycle;
  selectedActionId: string;
  actions: DecisionGraphAction[];
}) {
  const steps = lifecycleGraphSteps(lifecycle);
  const copy = agenticResultCopy(lifecycle);
  const dynamicSourcePassCount = lifecycle.passes.filter((pass) => pass.selectedQueries.some((query) => query.startsWith("dynamic:"))).length;
  return (
    <section className="agentic-run-summary" aria-labelledby="agentic-run-summary-title" data-agentic-status={lifecycle.status}>
      <div className="section-label">Investigation status</div>
      <div className="agentic-run-summary-heading">
        <div>
          <h2 id="agentic-run-summary-title">{lifecycleStatusLabel(lifecycle.status)}</h2>
          <p>{lifecycle.stopReason}</p>
        </div>
        <span>{copy.readiness}</span>
      </div>
      <div className="agentic-result-cards" aria-label="Investigation result summary">
        <div><strong>Answer readiness</strong><span>{copy.readiness}</span></div>
        <div><strong>Evidence added</strong><span>{copy.addedEvidenceCount} source-linked item{copy.addedEvidenceCount === 1 ? "" : "s"}</span></div>
        <div><strong>What to validate next</strong><span>{copy.unmetCount ? `${copy.unmetCount} answer check${copy.unmetCount === 1 ? "" : "s"} remain` : "Accountable review of the supported answer"}</span></div>
      </div>
      <details className="agentic-run-graph">
        <summary>
          Evidence and method details · {lifecycle.passes.length} investigation pass{lifecycle.passes.length === 1 ? "" : "es"}
          {dynamicSourcePassCount ? ` · ${dynamicSourcePassCount} newly discovered source pass${dynamicSourcePassCount === 1 ? "" : "es"}` : ""}
        </summary>
        <ol className="agentic-pass-receipts" aria-label="Executed evidence passes">
          {lifecycle.passes.map((pass) => (
            <li key={pass.passId}>
              <strong>Pass {pass.iteration}</strong>
              <span>{pass.selectedQueries.map(productLabel).join(", ")}</span>
              <small>{pass.addedEvidenceCount} new evidence item{pass.addedEvidenceCount === 1 ? "" : "s"} · answer {pass.answerStatus} · {pass.unmetCriterionIds.length} unmet check{pass.unmetCriterionIds.length === 1 ? "" : "s"}</small>
            </li>
          ))}
        </ol>
        <details>
          <summary>View the executed evidence graph</summary>
          <DecisionGraphAnimation
            activeStep={steps.length}
            phase="packet"
            question={lifecycle.goal}
            selectedActionId={selectedActionId}
            steps={steps}
            actions={actions}
          />
        </details>
      </details>
    </section>
  );
}
