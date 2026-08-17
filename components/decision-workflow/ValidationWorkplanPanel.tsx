import type { ValidationWorkplan } from "@/lib/planning/validation-workplan";

export function ValidationWorkplanPanel({ workplan }: { workplan: ValidationWorkplan }) {
  return (
    <section className="validation-workplan" aria-labelledby="validation-workplan-title">
      <header>
        <div>
          <div className="section-label">Market validation</div>
          <h2 id="validation-workplan-title">{workplan.proposedAction}</h2>
          <p>{workplan.objective}</p>
        </div>
        <div className="validation-workplan-owner">
          <span>Accountable owner</span>
          <strong>{workplan.accountableOwner}</strong>
        </div>
      </header>

      <section className="validation-workplan-next" aria-label="Next validation step">
        <span>Do this next</span>
        <strong>{workplan.workstreams[0].title}</strong>
        <p>{workplan.workstreams[0].action}</p>
        <small>{workplan.workstreams[0].owner} · {workplan.workstreams[0].completionCriteria}</small>
      </section>

      <div className="validation-workplan-workstreams" aria-label="Validation workstreams">
        {workplan.workstreams.map((workstream) => (
          <article key={workstream.id} data-status={workstream.status}>
            <span>{workstream.sequence}</span>
            <div>
              <strong>{workstream.title}</strong>
              <p>{workstream.deliverable}</p>
              <small>{workstream.owner}</small>
            </div>
          </article>
        ))}
      </div>

      <details className="validation-workplan-context">
        <summary>Evidence status and what this informs</summary>
        <div>
          <section>
            <strong>Evidence status</strong>
            <ul>
              {workplan.evidence.map((item) => (
                <li key={item.id}><b>{item.label}:</b> {item.status.replaceAll("_", " ")}. {item.whyNeeded}</li>
              ))}
            </ul>
          </section>
          <section>
            <strong>This work informs</strong>
            <ul>{workplan.whatThisInforms.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </details>
    </section>
  );
}
