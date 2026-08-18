import type { EvidenceExecutionResponse, ExecutionEvidenceItem } from "@/lib/evidence-snapshot/contracts";
import type { PlannedAction } from "@/lib/planning/contracts";
import { buildEvidenceBundleView } from "@/lib/planning/evidence-bundle-view";
import type { PacketAnswer } from "@/lib/planning/reviewable-packet";
import styles from "./evidence-bundle-panel.module.css";

function value(item: ExecutionEvidenceItem) {
  if (item.rawValue === null) return "Structured evidence";
  if (item.metricId.endsWith("yoy_growth")) return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(item.rawValue);
  if (item.unit === "currency_units" && item.currency) return new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency, maximumFractionDigits: 0 }).format(item.rawValue);
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
  if (result.query === "growth_test_screening_bundle") {
    return <div className={styles.tableShell}><table><thead><tr><th>Rank</th><th>Market</th><th>Screening score</th><th>Evidence</th></tr></thead><tbody>
      {result.rows.slice(0, 10).map((row) => <tr key={String(row.cbsaCode)}><td>{String(row.rank)}</td><td><strong>{String(row.cbsaName)}</strong><small>CBSA {String(row.cbsaCode)}</small></td><td>{Number(row.score).toFixed(1)}</td><td>Hypothesis</td></tr>)}
    </tbody></table></div>;
  }
  if (result.query === "multi_market_comparison_bundle") {
    return <div className={styles.tableShell}><table><thead><tr><th>Market</th><th>Measure</th><th>Value</th><th>Period</th><th>Status</th></tr></thead><tbody>
      {result.rows.map((row, index) => <tr key={`${String(row.cbsaCode)}:${String(row.metricId)}:${index}`}><td><strong>{String(row.cbsaName)}</strong><small>CBSA {String(row.cbsaCode)}</small></td><td>{String(row.metricId).replaceAll("_", " ")}</td><td>{typeof row.value === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(row.value) : "Unavailable"}</td><td>{typeof row.period === "object" && row.period && "label" in row.period ? String(row.period.label) : "Not supplied"}</td><td>{String(row.evidenceStatus)}</td></tr>)}
    </tbody></table></div>;
  }
  if (result.query === "source_coverage_bundle") {
    return <div className={styles.tableShell}><table><thead><tr><th>Market</th><th>Census</th><th>Regional</th><th>Clinic</th><th>Google Ads</th></tr></thead><tbody>
      {result.rows.slice(0, 25).map((row) => <tr key={String(row.cbsaCode)}><td><strong>{String(row.cbsaName)}</strong><small>CBSA {String(row.cbsaCode)}</small></td><td>{row.hasCensus ? "Available" : "Missing"}</td><td>{row.hasMarketContext && row.hasRegionalDemand ? "Available" : row.hasMarketContext || row.hasRegionalDemand ? "Partial" : "Missing"}</td><td>{row.hasClinicProfile && row.hasClinicActivity ? "Available" : row.hasClinicProfile || row.hasClinicActivity ? "Partial" : "Missing"}</td><td>{row.hasGoogleAds ? "Available" : "Missing"}</td></tr>)}
    </tbody></table></div>;
  }
  if (result.componentQueries.length === 1 && result.componentQueries[0] === "google_ads_context_by_cbsa") {
    return <div className={styles.tableShell}><table><thead><tr><th>Report scope</th><th>Market</th><th>Measure</th><th>Value</th><th>Period</th></tr></thead><tbody>
      {result.evidenceBundle.map((item) => <tr key={item.evidenceId}><td>{item.reportScope ?? "Not supplied"}</td><td><strong>{item.geographyLabel}</strong></td><td>{label(item.metricId)}</td><td>{value(item)}{item.currency ? ` ${item.currency}` : ""}</td><td>{item.period.label}</td></tr>)}
    </tbody></table></div>;
  }
  const display = result.evidenceBundle.filter((item) => item.rawValue !== null);
  return <div className={styles.metrics}>{display.map((item) => <article key={item.evidenceId}><span>{label(item.metricId)}</span><strong>{value(item)}</strong><small>{item.geographyLabel} · {item.period.label}{item.reportScope ? ` · ${item.reportScope}` : ""}</small></article>)}</div>;
}

export function EvidenceBundlePanel({ result, action, answer }: { result: EvidenceExecutionResponse; action?: PlannedAction; answer?: PacketAnswer }) {
  const view = buildEvidenceBundleView(result, action);
  const geographyScope = result.geographyIds.length
    ? result.geographyIds.join(", ")
    : result.query === "growth_test_screening_bundle" || result.query === "source_coverage_bundle"
      ? "Eligible national CBSA cohort"
      : "No resolved geography";
  return <section className={styles.panel} aria-labelledby="evidence-bundle-title" data-query={result.query} data-execution-mode={result.executionMode}>
    <div className={styles.question}><span>Original question</span><strong>{result.originalQuestion}</strong></div>
    <header><div><span className={styles.status}>{view.statusLabel}</span><h2 id="evidence-bundle-title">Evidence-backed answer</h2><p>{answer?.directAnswer ?? view.headline}</p><small>{geographyScope}</small></div><div className={styles.mode}><strong>{result.executionMode.replaceAll("_", " ")}</strong><small>{result.snapshotVersion}</small><small>{result.calculationVersion}</small></div></header>
    <div className={styles.section}><h3>Calculation or comparison</h3><Calculation result={result} /></div>
    <div className={styles.section}><h3>Evidence used</h3><div className={styles.evidenceGrid}>{result.evidenceBundle.map((item) => <article key={item.evidenceId}>
      <div><strong>{label(item.metricId)}</strong><span data-status={item.evidenceStatus}>{item.evidenceStatus}</span></div>
      <dl><div><dt>Value</dt><dd>{value(item)}</dd></div><div><dt>Quality</dt><dd>{item.qualityStatus}</dd></div><div><dt>Source ID</dt><dd>{item.sourceId}</dd></div><div><dt>Snapshot ID</dt><dd>{item.snapshotId}</dd></div><div><dt>Period</dt><dd>{item.period.label}</dd></div><div><dt>Report scope</dt><dd>{item.reportScope ?? "Not applicable"}</dd></div><div><dt>Currency</dt><dd>{item.currency ?? "Not applicable"}</dd></div><div><dt>Allowed use</dt><dd>{item.allowedUse.replaceAll("_", " ")}</dd></div></dl>
      {item.warning ? <p>{item.warning}</p> : null}
    </article>)}</div></div>
    <div className={styles.reviewGrid}>
      <section><h3>Reliability</h3><p>{view.reliability}</p>{result.qualityWarnings.length ? <ul>{result.qualityWarnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>
      <section><h3>Unknowns</h3><ul>{[...result.missingEvidence, ...result.unknowns].map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h3>Limitations</h3><ul>{result.guardrails.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h3>Required approvals</h3>{result.missingApprovals.length ? <ul>{result.missingApprovals.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No additional approval is required to review this descriptive bundle.</p>}</section>
    </div>
    <div className={styles.nextAction}><span>Proposed next action</span><strong>{view.nextAction}</strong><small>Draft for accountable human review. No action was launched, approved, or sent.</small></div>
  </section>;
}
