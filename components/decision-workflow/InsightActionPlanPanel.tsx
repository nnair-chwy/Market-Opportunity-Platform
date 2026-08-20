import { boundedActionSummary, type InsightActionPlan } from "@/lib/planning/insight-action-plan";
import { actionReadinessLabel } from "@/lib/planning/result-language";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function decisionEvidenceExplanation(actionPlan: InsightActionPlan) {
  if (actionPlan.actionReadiness === "ready_for_bounded_test") return "Connected outcomes and bounded-test gates are present";
  if (actionPlan.actionReadiness === "validation_required") return "The observed pattern is usable; the comparison design or decision threshold is incomplete";
  if (actionPlan.actionReadiness === "outcome_missing") return "A regional business outcome is still required to estimate incremental value";
  return "The current sources cannot be combined at a compatible geography, period, or definition";
}

export function InsightActionPlanPanel({ actionPlan }: { actionPlan: InsightActionPlan }) {
  const boundedAction = boundedActionSummary(actionPlan);
  return (
    <section className="insight-action-plan" aria-labelledby="insight-action-title">
      <header>
        <div>
          <div className="section-label">Decision handoff</div>
          <h2 id="insight-action-title">{boundedAction.action}</h2>
          <p><strong>{actionReadinessLabel(actionPlan.actionReadiness)}</strong><br /><span>{decisionEvidenceExplanation(actionPlan)}</span></p>
        </div>
        <div className="insight-action-decision-date">
          <span>Decision review</span>
          <strong>{formatDate(actionPlan.decisionDueDate)}</strong>
          <small>{actionPlan.decisionOwner}</small>
        </div>
      </header>

      <section className="insight-action-at-a-glance" aria-label="Proposed action and measurement plan">
        <div className="insight-action-proposal">
          <span>{boundedAction.label}</span>
          <strong>{boundedAction.evidenceNote}</strong>
        </div>
        <section className="insight-action-expected-result" data-result-status={boundedAction.resultStatus} aria-label="Expected result and calculation">
          <div>
            <span>Expected result</span>
            <strong>{boundedAction.expectedResult}</strong>
            <small>{boundedAction.resultStatus === "not_estimable" ? "Not yet a forecast" : boundedAction.resultStatus.replaceAll("_", " ")}</small>
          </div>
          <details>
            <summary>How this result is calculated</summary>
            <ol>{boundedAction.calculationSteps.map((step) => <li key={step}>{step}</li>)}</ol>
            <p><strong>Inputs still required:</strong> {boundedAction.requiredResultInputs.join(" · ")}</p>
          </details>
        </section>
        <dl>
          <div><dt>Test window</dt><dd>{boundedAction.testWindow}</dd></div>
          <div><dt>What this should prove</dt><dd>{boundedAction.expectedLearning}</dd></div>
          <div><dt>Success rule</dt><dd>{boundedAction.successRule}</dd></div>
          <div><dt>Stop / rollback</dt><dd>{boundedAction.stopOrRollbackRule}</dd></div>
        </dl>
      </section>

      <section className="insight-action-next" aria-label="Next action">
        <span>Do this next</span>
        <strong>{actionPlan.workstreams[0].title}</strong>
        <p>{actionPlan.workstreams[0].action}</p>
        <dl>
          <div><dt>Owner</dt><dd>{actionPlan.workstreams[0].owner}</dd></div>
          <div><dt>Due</dt><dd>{formatDate(actionPlan.workstreams[0].dueDate)}</dd></div>
          <div><dt>Done when</dt><dd>{actionPlan.workstreams[0].completionCriteria}</dd></div>
          <div><dt>KPI</dt><dd>{actionPlan.kpi}</dd></div>
          <div><dt>Validation threshold</dt><dd>{actionPlan.validationThreshold}</dd></div>
          <div><dt>Stop condition</dt><dd>{actionPlan.stopCondition}</dd></div>
        </dl>
      </section>

      <details className="insight-action-workstream-details">
        <summary>Review the full validation workplan</summary>
        <div className="insight-action-workstreams" aria-label="Validation workstreams">
          {actionPlan.workstreams.map((workstream) => (
            <article key={workstream.id} data-status={workstream.status}>
              <span>{workstream.sequence}</span>
              <div>
                <header><strong>{workstream.title}</strong><small>{formatDate(workstream.dueDate)}</small></header>
                <p>{workstream.deliverable}</p>
                <small>{workstream.owner}</small>
              </div>
            </article>
          ))}
        </div>
      </details>

      <section className="insight-action-rules" aria-label="Decision rules">
        <div><span>Advance</span><p>{actionPlan.decisionRules[0].rule}</p></div>
        <div><span>Hold</span><p>{actionPlan.decisionRules[1].rule}</p></div>
        <div><span>Stop</span><p>{actionPlan.decisionRules[2].rule}</p></div>
      </section>

      <details className="insight-action-context">
        <summary>What this informs and who needs to be involved</summary>
        <div>
          <section><strong>What this will inform</strong><ul>{actionPlan.whatThisInforms.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><strong>Stakeholders</strong><p>{actionPlan.stakeholders.join(" · ")}</p></section>
          <section><strong>Longer-term considerations</strong><ul>{actionPlan.longerTermConsiderations.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><strong>Baseline evidence</strong><p>{actionPlan.baseline.description}</p><small>{actionPlan.baseline.evidenceIds.join(" · ")}</small></section>
          <section><strong>Sensitivity and contrary evidence</strong><p>{actionPlan.sensitivityAndContraryEvidence}</p></section>
          <section><strong>Why this surfaced now</strong><p>{actionPlan.whyNow}</p></section>
        </div>
      </details>
    </section>
  );
}
