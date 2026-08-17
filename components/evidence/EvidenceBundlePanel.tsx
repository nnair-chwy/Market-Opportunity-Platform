import type { EvidenceExecutionResponse, ExecutionEvidenceItem } from "@/lib/evidence-snapshot/contracts";
import type { PlannedAction } from "@/lib/planning/contracts";
import { buildEvidenceBundleView } from "@/lib/planning/evidence-bundle-view";
import styles from "./evidence-bundle-panel.module.css";

function value(item: ExecutionEvidenceItem) {
  if (item.rawValue === null) return "Structured evidence";
  if (item.metricId.endsWith("yoy_growth")) return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(item.rawValue);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(item.rawValue);
}

function label(metricId: string) {
  return metricId.replace(/^synthetic\./, "").replaceAll(/[._]/g, " ");
}

function Calculation({ result }: { result: EvidenceExecutionResponse }) {
  if (result.query === "clinic_performance_bundle") {
    return <div className={styles.tableShell}><table><thead><tr><th>Clinic</th><th>Completed appointments</th><th>Illustrative rank</th><th>Status</th></tr></thead><tbody>
      {result.rows.map((row) => <tr key={String(row.clinicId)} data-selected={row.selected === true}><td><strong>{String(row.clinicName)}</strong>{row.selected === true ? <small>Selected</small> : null}</td><td>{String(row.value)}</td><td>{String(row.rank)} of {result.rows.length}</td><td>Hypothesis</td></tr>)}
    </tbody></table></div>;
  }
  const display = result.evidenceBundle.filter((item) => item.rawValue !== null);
  return <div className={styles.metrics}>{display.map((item) => <article key={item.evidenceId}><span>{label(item.metricId)}</span><strong>{value(item)}</strong><small>{item.unit ?? "value"}</small></article>)}</div>;
}

export function EvidenceBundlePanel({ result, action }: { result: EvidenceExecutionResponse; action?: PlannedAction }) {
  const view = buildEvidenceBundleView(result, action);
  return <section className={styles.panel} aria-labelledby="evidence-bundle-title" data-query={result.query} data-execution-mode={result.executionMode}>
    <div className={styles.question}><span>Original question</span><strong>{result.originalQuestion}</strong></div>
    <header><div><span className={styles.status}>{view.statusLabel}</span><h2 id="evidence-bundle-title">Evidence bundle</h2><p>{view.headline}</p></div><div className={styles.mode}><strong>{result.executionMode.replaceAll("_", " ")}</strong><small>{result.snapshotVersion}</small><small>{result.calculationVersion}</small></div></header>
    <div className={styles.section}><h3>Evidence used</h3><div className={styles.evidenceGrid}>{result.evidenceBundle.map((item) => <article key={item.evidenceId}>
      <div><strong>{label(item.metricId)}</strong><span data-status={item.evidenceStatus}>{item.evidenceStatus}</span></div>
      <dl><div><dt>Value</dt><dd>{value(item)}</dd></div><div><dt>Quality</dt><dd>{item.qualityStatus}</dd></div><div><dt>Source ID</dt><dd>{item.sourceId}</dd></div><div><dt>Snapshot ID</dt><dd>{item.snapshotId}</dd></div><div><dt>Observation</dt><dd>{item.observationStart && item.observationEnd ? `${item.observationStart} to ${item.observationEnd}` : item.observationEnd ?? "Not supplied"}</dd></div><div><dt>Allowed use</dt><dd>{item.allowedUse.replaceAll("_", " ")}</dd></div></dl>
      {item.warning ? <p>{item.warning}</p> : null}
    </article>)}</div></div>
    <div className={styles.section}><h3>Calculation or comparison</h3><Calculation result={result} /></div>
    <div className={styles.reviewGrid}>
      <section><h3>Reliability</h3><p>{view.reliability}</p>{result.qualityWarnings.length ? <ul>{result.qualityWarnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>
      <section><h3>Unknowns</h3><ul>{[...result.missingEvidence, ...result.unknowns].map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h3>Limitations</h3><ul>{result.guardrails.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h3>Required approvals</h3>{result.missingApprovals.length ? <ul>{result.missingApprovals.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No additional approval is required to review this descriptive bundle.</p>}</section>
    </div>
    <div className={styles.nextAction}><span>Proposed next action</span><strong>{view.nextAction}</strong><small>Draft for accountable human review. No action was launched, approved, or sent.</small></div>
  </section>;
}
