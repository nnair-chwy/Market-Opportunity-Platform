import type { InsightActionPlan } from "@/lib/planning/insight-action-plan";
import { actionReadinessLabel } from "@/lib/planning/result-language";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function InsightActionPlanPanel({ actionPlan }: { actionPlan: InsightActionPlan }) {
  return (
    <section className="insight-action-plan" aria-labelledby="insight-action-title">
      <header>
        <div>
          <div className="section-label">Decision handoff</div>
          <h2 id="insight-action-title">{actionPlan.recommendation}</h2>
          <p>{actionPlan.whyNow}</p>
          <p><strong>{actionReadinessLabel(actionPlan.actionReadiness)} · {actionPlan.confidence} confidence</strong></p>
        </div>
        <div className="insight-action-decision-date">
          <span>Decision review</span>
          <strong>{formatDate(actionPlan.decisionDueDate)}</strong>
          <small>{actionPlan.decisionOwner}</small>
        </div>
      </header>

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
        </div>
      </details>
    </section>
  );
}
