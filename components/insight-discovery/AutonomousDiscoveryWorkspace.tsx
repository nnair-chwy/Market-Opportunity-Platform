"use client";

import { useEffect, useMemo, useState } from "react";
import type { AutonomousInsight, CurrentDataDiscoveryRun } from "@/lib/insight-discovery";
import type { PerspectiveId } from "@/lib/perspectives";

const LABELS: Record<PerspectiveId, string> = { marketing: "Marketing", pricing: "Pricing", cvc: "CVC" };

export function AutonomousDiscoveryWorkspace({ onBack, onInvestigate }: {
  onBack: () => void;
  onInvestigate: (question: string) => void;
}) {
  const [run, setRun] = useState<CurrentDataDiscoveryRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState<"all" | PerspectiveId>("all");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/insight-discovery", { method: "POST" })
      .then(async (response) => {
        const payload = await response.json() as CurrentDataDiscoveryRun | { message?: string };
        if (!response.ok || !("findings" in payload)) throw new Error("message" in payload ? payload.message : "The insight scan did not complete.");
        if (!cancelled) setRun(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The insight scan did not complete.");
      });
    return () => { cancelled = true; };
  }, []);

  const primaryFindings = useMemo(() => run?.primaryFindings.filter((finding) => department === "all" || finding.department === department) ?? [], [department, run]);
  const additionalFindings = useMemo(() => run?.additionalFindings.filter((finding) => department === "all" || finding.department === department) ?? [], [department, run]);
  const warehouseTemplates = useMemo(() => {
    const templates = run?.snowflakeEscalations.flatMap((assessment) => assessment.accessRequest?.templates ?? []) ?? [];
    return [...new Map(templates.map((template) => [template.templateId, template])).values()];
  }, [run]);

  if (error) return (
    <section className="autonomous-discovery-page" aria-labelledby="autonomous-discovery-title">
      <button className="text-action" type="button" onClick={onBack}>← Back to questions</button>
      <div className="discovery-error" role="alert"><h1 id="autonomous-discovery-title">The current-data scan could not complete</h1><p>{error}</p><button className="primary-action" type="button" onClick={() => window.location.reload()}>Retry</button></div>
    </section>
  );

  if (!run) return (
    <section className="autonomous-discovery-page discovery-running" aria-labelledby="autonomous-discovery-title">
      <button className="text-action" type="button" onClick={onBack}>← Back to questions</button>
      <div className="section-label">Autonomous insight discovery</div>
      <h1 id="autonomous-discovery-title">Investigating the current data without waiting for a question</h1>
      <p>The agent is running the reviewed departmental hypothesis registry, screening regional contrasts, combining repeated market signals, challenging interpretations, and ranking the strongest leads.</p>
      <ol className="discovery-running-steps">
        <li><span />Generate Marketing, Pricing, and CVC hypotheses</li>
        <li><span />Run bounded queries across approved snapshots</li>
        <li><span />Deduplicate and cross-check repeated regional signals</li>
        <li><span />Return a five-item portfolio digest plus every additional qualified finding</li>
      </ol>
    </section>
  );

  return (
    <section className="autonomous-discovery-page" aria-labelledby="autonomous-discovery-title">
      <div className="discovery-page-nav">
        <button className="text-action" type="button" onClick={onBack}>← Back to questions</button>
        <span>Run complete · {new Date(run.completedAt).toLocaleString()}</span>
      </div>
      <header className="discovery-hero">
        <div>
          <div className="section-label">Autonomous insight discovery</div>
          <h1 id="autonomous-discovery-title">The strongest regional signals in the current data</h1>
          <p>{run.analysesRun} investigations ran automatically. The digest represents the full portfolio; every additional finding that passes evidence and validation checks remains available below it.</p>
        </div>
        <span className="discovery-method">Reviewed query registry · deterministic evidence checks</span>
      </header>

      <dl className="discovery-run-metrics">
        <div><dt>Analyses run</dt><dd>{run.analysesRun}</dd></div>
        <div><dt>Markets scanned</dt><dd>{run.marketUniverse}</dd></div>
        <div><dt>Measures examined</dt><dd>{run.measuresExamined}</dd></div>
        <div><dt>Qualified findings</dt><dd>{run.findings.length}</dd></div>
      </dl>

      <section className="discovery-data-expansion" aria-labelledby="discovery-data-expansion-title">
        <div>
          <div className="section-label">Evidence expansion</div>
          <h2 id="discovery-data-expansion-title">{run.dataAccessSummary.status === "additional_access_recommended" ? "The local scan found leads; governed warehouse evidence would make them more actionable" : "The current approved evidence is sufficient for this scan"}</h2>
          <p>{run.dataAccessSummary.status === "additional_access_recommended"
            ? `${run.dataAccessSummary.questionsNeedingWarehouseEvidence} investigations still need business outcomes or operating context that are not present in the approved local snapshots.`
            : "The run did not identify a warehouse-data requirement beyond the evidence already available."}</p>
        </div>
        {warehouseTemplates.length ? (
          <details>
            <summary>Review {warehouseTemplates.length} prepared read-only Snowflake request{warehouseTemplates.length === 1 ? "" : "s"}</summary>
            <p>The agent requests a governed aggregate semantic view—not credentials, raw identifiers, arbitrary SQL, or permission to change a business action.</p>
            <div className="discovery-access-request-grid">
              {warehouseTemplates.map((template) => (
                <article key={template.templateId}>
                  <span>{template.owningTeam}</span>
                  <h3>{template.semanticViewConcept.replace(/^governed_/, "").replaceAll("_", " ")}</h3>
                  <p>{template.purpose}</p>
                  <dl>
                    <div><dt>Metrics</dt><dd>{template.requiredMetrics.join(", ")}</dd></div>
                    <div><dt>Geography</dt><dd>{template.parameters.geographyGrains.join(", ")} · {template.parameters.geographyScope.replaceAll("_", " ")}</dd></div>
                    <div><dt>Time</dt><dd>{template.parameters.timeGrain} · {template.parameters.lookbackDays}-day lookback · finalized periods only</dd></div>
                    <div><dt>Privacy floor</dt><dd>Groups of at least {template.parameters.minimumGroupSize}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <div className="discovery-department-tabs" role="tablist" aria-label="Insight department">
        {(["all", "marketing", "pricing", "cvc"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={department === item} onClick={() => setDepartment(item)}>
            {item === "all" ? "All departments" : LABELS[item]}
            <span>{item === "all" ? run.findings.length : run.findings.filter((finding) => finding.department === item).length}</span>
          </button>
        ))}
      </div>

      <div className="discovery-results-heading">
        <div><div className="section-label">Primary digest</div><h2>Top findings to review first</h2></div>
        <span>{primaryFindings.length} shown{department === "all" ? " across the portfolio" : ` for ${LABELS[department]}`}</span>
      </div>

      <div className="autonomous-insight-grid">
        {primaryFindings.map((finding: AutonomousInsight, index) => (
          <article key={finding.insightId} className="autonomous-insight-card" data-department={finding.department}>
            <header><span>{LABELS[finding.department]}</span><small>#{index + 1} · {finding.priority}</small></header>
            <h2>{finding.headline}</h2>
            <p>{finding.whyInteresting}</p>
            <div className="discovery-applicability"><span>Best routed to</span><strong>{finding.applicability.primaryTeamLabel}</strong><small>{finding.applicability.reason}</small></div>
            <details>
              <summary>Evidence, method, and next validation</summary>
              <dl>
                <div><dt>Evidence detail</dt><dd>{finding.evidenceDetail}</dd></div>
                <div><dt>Signals combined</dt><dd>{finding.signalCount} screen{finding.signalCount === 1 ? "" : "s"}: {finding.hypothesisIds.join(", ")}</dd></div>
                <div><dt>Sources</dt><dd>{finding.sourceIds.join(", ")}</dd></div>
                <div><dt>Validate next</dt><dd>{finding.nextValidation}</dd></div>
                <div><dt>Cross-team partners</dt><dd>{finding.applicability.partnerTeams.map((team) => team.label).join(", ")}</dd></div>
                <div><dt>Decision boundary</dt><dd>{finding.applicability.approvalBoundary}</dd></div>
              </dl>
            </details>
            <button className="secondary-action" type="button" onClick={() => onInvestigate(finding.question)}>Investigate this finding →</button>
          </article>
        ))}
      </div>

      {additionalFindings.length > 0 ? (
        <details className="discovery-additional-findings">
          <summary>Show {additionalFindings.length} additional qualified finding{additionalFindings.length === 1 ? "" : "s"}</summary>
          <p>These passed the same evidence, explanation, and next-validation checks but ranked below the primary digest.</p>
          <div className="autonomous-insight-grid">
            {additionalFindings.map((finding: AutonomousInsight, index) => (
              <article key={finding.insightId} className="autonomous-insight-card" data-department={finding.department}>
                <header><span>{LABELS[finding.department]}</span><small>Additional #{index + 1} · {finding.priority}</small></header>
                <h2>{finding.headline}</h2>
                <p>{finding.whyInteresting}</p>
                <div className="discovery-applicability"><span>Best routed to</span><strong>{finding.applicability.primaryTeamLabel}</strong><small>{finding.applicability.reason}</small></div>
                <details>
                  <summary>Evidence, method, and next validation</summary>
                  <dl>
                    <div><dt>Evidence detail</dt><dd>{finding.evidenceDetail}</dd></div>
                    <div><dt>Signals combined</dt><dd>{finding.signalCount} screen{finding.signalCount === 1 ? "" : "s"}: {finding.hypothesisIds.join(", ")}</dd></div>
                    <div><dt>Sources</dt><dd>{finding.sourceIds.join(", ")}</dd></div>
                    <div><dt>Validate next</dt><dd>{finding.nextValidation}</dd></div>
                    <div><dt>Cross-team partners</dt><dd>{finding.applicability.partnerTeams.map((team) => team.label).join(", ")}</dd></div>
                    <div><dt>Decision boundary</dt><dd>{finding.applicability.approvalBoundary}</dd></div>
                  </dl>
                </details>
                <button className="secondary-action" type="button" onClick={() => onInvestigate(finding.question)}>Investigate this finding →</button>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      <details className="discovery-run-audit">
        <summary>How the autonomous run worked · {run.traces.length} executed analyses</summary>
        <ol>{run.traces.map((trace) => <li key={trace.hypothesisId}><strong>{trace.objective}</strong><span>{trace.question}</span><small>{trace.leadsFound} leads · {trace.comparisonsExamined.toLocaleString()} comparisons · {trace.sourceIds.join(", ")}</small></li>)}</ol>
        <h3>Current boundaries</h3>
        <ul>{run.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </details>
    </section>
  );
}
