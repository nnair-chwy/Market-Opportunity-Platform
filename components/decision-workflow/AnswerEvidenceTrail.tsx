import type { CompactSourceReadiness } from "@/lib/data-discovery/readiness-service";
import type { EvidenceExecutionResponse, ExecutionEvidenceItem } from "@/lib/evidence-snapshot/contracts";
import type { EvaluationPlan } from "@/lib/planning/contracts";
import { buildAdSpendEvidencePlan } from "@/lib/planning/ad-spend-evidence-plan";
import { productLabel } from "@/lib/planning/result-language";
import styles from "./answer-evidence-trail.module.css";

type AnswerEvidenceTrailProps = {
  plan: EvaluationPlan;
  result: EvidenceExecutionResponse;
  readiness?: CompactSourceReadiness | null;
};

const SOURCE_LABELS: Record<string, string> = {
  "SRC-002": "CVC reporting availability",
  "SRC-009": "Published Chewy Vet Care clinic footprint",
  "SRC-014": "U.S. Census metro geography",
  "SRC-015": "U.S. Census metro boundaries",
  "SRC-016": "U.S. Census market context",
  "SRC-017": "Aggregate clinic and market snapshot",
  "SRC-018": "Paid-search matched-location export",
  "SRC-025": "Monitored competitor offer history",
  "SRC-034": "Normalized aggregate market evidence",
  "SRC-036": "Zeus national product coverage",
};

const NEXT_DATA = {
  pricing: {
    dataset: "Regional price-response outcome aggregate",
    fields: ["approved geography key", "reporting period", "product or matched-SKU cohort", "Chewy and comparable competitor price", "orders or conversion", "contribution", "promotion or price-change flag"],
  },
  marketing: {
    dataset: "Regional campaign outcome aggregate",
    fields: ["approved geography key", "reporting period", "channel and campaign cohort", "spend and impressions", "clicks and attributed conversions", "orders or new customers", "contribution"],
  },
  cvc: {
    dataset: "Clinic demand and capacity aggregate",
    fields: ["clinic or approved service-area key", "reporting period", "appointment status or service cohort", "booked and completed appointments", "staffed or available capacity", "opening date or months open", "approved clinic outcome"],
  },
} as const;

function plainSourceLabel(sourceId: string) {
  if (SOURCE_LABELS[sourceId]) return SOURCE_LABELS[sourceId];
  if (sourceId.startsWith("GOOGLE-ADS")) return "Google Ads matched-location aggregate";
  if (sourceId.startsWith("SNOWFLAKE-CSV")) return productLabel(sourceId.replace("SNOWFLAKE-CSV-", ""));
  if (sourceId.startsWith("DISCOVERED-")) return "Reviewed discovered aggregate source";
  return productLabel(sourceId);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function contribution(items: ExecutionEvidenceItem[]) {
  const metrics = unique(items.map((item) => productLabel(item.metricId))).slice(0, 3);
  const geographies = unique(items.map((item) => item.geographyLabel)).slice(0, 2);
  const periods = unique(items.map((item) => item.period.label).filter((label) => label !== "Period not provided")).slice(0, 1);
  const metricCopy = metrics.length ? metrics.join(", ") : `${items.length} structured evidence item${items.length === 1 ? "" : "s"}`;
  return `${metricCopy}${geographies.length ? ` for ${geographies.join(" and ")}` : ""}${periods.length ? ` · ${periods[0]}` : ""}.`;
}

function usedSources(result: EvidenceExecutionResponse) {
  const reviewedLabels = new Map(result.sourceAdaptation?.sources
    .filter((source) => source.decision === "used")
    .flatMap((source) => source.sourceIds.map((sourceId) => [sourceId, source.label] as const)) ?? []);
  const grouped = new Map<string, ExecutionEvidenceItem[]>();
  for (const item of result.evidenceBundle) grouped.set(item.sourceId, [...(grouped.get(item.sourceId) ?? []), item]);
  return [...grouped].map(([sourceId, items]) => ({
    sourceId,
    label: reviewedLabels.get(sourceId) ?? plainSourceLabel(sourceId),
    contribution: contribution(items),
    itemCount: items.length,
    limited: items.some((item) => item.qualityStatus === "warning" || item.warning),
  }));
}

function consideredEvidence(result: EvidenceExecutionResponse) {
  const reviewedDecisions = result.sourceAdaptation?.sources
    .filter((source) => source.decision !== "used")
    .map((source) => `${source.label}: ${source.reason}`) ?? [];
  const noEvidencePasses = result.agenticLifecycle?.passes
    .filter((pass) => pass.addedEvidenceCount === 0)
    .map((pass) => `${pass.selectedQueries.map(productLabel).join(", ")} was checked but added no compatible evidence.`) ?? [];
  return unique([...reviewedDecisions, ...noEvidencePasses, ...result.missingEvidence, ...result.unknowns]);
}

function relevantOutcomeIds(plan: EvaluationPlan) {
  if (plan.perspectiveId === "cvc") return new Set(["clinic_capacity", "appointments", "mature_clinic_performance"]);
  if (plan.perspectiveId === "marketing") return new Set(["regional_orders", "new_customers", "contribution_profit"]);
  return new Set(["regional_orders", "new_customers", "contribution_profit"]);
}

function answerState(result: EvidenceExecutionResponse) {
  if (result.status === "complete") return "Supported answer";
  if (result.status === "partial") return "Answer with limits";
  if (result.status === "blocked") return "Evidence gap identified";
  return "Answer needs attention";
}

export function AnswerEvidenceTrail({ plan, result, readiness }: AnswerEvidenceTrailProps) {
  const sources = usedSources(result);
  const considered = consideredEvidence(result);
  const nextData = NEXT_DATA[plan.perspectiveId];
  const requiredFields = result.sourceAdaptation?.nextRequiredDataset.fields ?? [];
  const nextRequirementReason = result.sourceAdaptation?.nextRequiredDataset.reason;
  const relevantIds = relevantOutcomeIds(plan);
  const relevantGaps = readiness?.outcomes.filter((outcome) => relevantIds.has(outcome.outcomeId) && outcome.status === "gap") ?? [];
  const candidateSources = readiness?.adapterCandidates
    .filter((candidate) => candidate.outcomeIds.some((outcomeId) => relevantIds.has(outcomeId)))
    .map((candidate) => candidate.sourceId) ?? [];
  const crossTeamPlan = plan.perspectiveId === "marketing" && /\b(?:ads?|advertising|paid search|spend|budget)\b/i.test(plan.originalQuestion)
    ? buildAdSpendEvidencePlan({ question: plan.originalQuestion, evidence: result.evidenceBundle, missingEvidence: result.missingEvidence })
    : null;

  return (
    <section className={styles.panel} aria-labelledby="answer-evidence-trail-title" data-testid="answer-evidence-trail">
      <header className={styles.heading}>
        <div>
          <span>Evidence trail</span>
          <h2 id="answer-evidence-trail-title">How the sources support this answer</h2>
        </div>
        <small>Aggregate evidence only · no raw rows shown</small>
      </header>

      <ol className={styles.trail} aria-label="Question to evidence to answer">
        <li><span>Question</span><strong>{plan.originalQuestion}</strong></li>
        <li><span>Sources used</span><strong>{sources.length ? `${sources.length} compatible source${sources.length === 1 ? "" : "s"}` : "No compatible source returned"}</strong></li>
        <li><span>Answer</span><strong>{answerState(result)}</strong>{result.sourceAdaptation ? <small>{result.sourceAdaptation.goalCheck.explanation}</small> : null}</li>
      </ol>

      <div className={styles.contentGrid}>
        <section aria-labelledby="sources-used-title">
          <h3 id="sources-used-title">Sources used in this answer</h3>
          {sources.length ? <ul className={styles.sources}>
            {sources.map((source) => (
              <li key={source.sourceId}>
                <div><strong>{source.label}</strong><span data-limited={source.limited}>{source.limited ? "Used with limits" : "Used"}</span></div>
                <p>{source.contribution}</p>
                <small>{source.sourceId} · {source.itemCount} evidence item{source.itemCount === 1 ? "" : "s"}</small>
              </li>
            ))}
          </ul> : <p className={styles.empty}>No source contributed compatible evidence. The gaps checked by the investigation are listed next.</p>}
        </section>

        <section className={styles.considered} aria-labelledby="considered-evidence-title">
          <h3 id="considered-evidence-title">Considered but unavailable or incompatible</h3>
          {considered.length ? <ul>{considered.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p>Every evidence requirement returned for this answer was compatible. Source limits still remain visible in the audit details.</p>}
          {considered.length > 4 ? <details><summary>Show {considered.length - 4} more gap{considered.length - 4 === 1 ? "" : "s"}</summary><ul>{considered.slice(4).map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
        </section>
      </div>

      {crossTeamPlan ? <section className={styles.considered} aria-labelledby="cross-team-evidence-title">
        <h3 id="cross-team-evidence-title">How other teams affect this decision</h3>
        <p>Marketing delivery signals can nominate a test market, but a spend recommendation also needs compatible business outcomes and decision safeguards from other teams.</p>
        <ul>
          <li><strong>Recommendation drivers:</strong> {crossTeamPlan.counts.recommendationDrivers} compatible first-party outcome item{crossTeamPlan.counts.recommendationDrivers === 1 ? "" : "s"}</li>
          <li><strong>Validity gates:</strong> {crossTeamPlan.counts.validityGates} campaign, geography, attribution, experiment, or operational check{crossTeamPlan.counts.validityGates === 1 ? "" : "s"}</li>
          <li><strong>Context:</strong> {crossTeamPlan.counts.context} delivery, cost, response, or market-context item{crossTeamPlan.counts.context === 1 ? "" : "s"}</li>
          <li><strong>Contradictions or unavailable evidence:</strong> {crossTeamPlan.counts.contradictions + crossTeamPlan.counts.unavailable}</li>
        </ul>
        {crossTeamPlan.missingRequiredFields.length ? <details><summary>Show the exact cross-team data still required</summary><ul>{crossTeamPlan.missingRequiredFields.map((item) => <li key={item.field}><strong>{item.team} · {productLabel(item.field)}:</strong> {item.reason}</li>)}</ul></details> : null}
        <small>{crossTeamPlan.conclusionBoundary}</small>
      </section> : null}

      <details className={styles.addData}>
        <summary>
          <span>Add data to improve this answer</span>
          <small>{requiredFields.length ? `Next compatible fields: ${requiredFields.slice(0, 3).map((field) => field.label).join(", ")}` : `Next compatible dataset: ${nextData.dataset}`}</small>
        </summary>
        <div className={styles.addDataBody}>
          <div>
            <h3>{nextData.dataset}</h3>
            <p>Provide a privacy-safe aggregate at one approved geography and reporting period. Do not include customer, order, patient, address, or employee-level identifiers.</p>
            <strong>Fields the next source should contain</strong>
            {requiredFields.length ? <ul>{requiredFields.map((field) => <li key={`${field.requirementId}:${field.field}`}><strong>{field.label}:</strong> {field.description}</li>)}</ul>
              : <ul>{nextData.fields.map((field) => <li key={field}>{field}</li>)}</ul>}
            {nextRequirementReason ? <p>{nextRequirementReason}</p> : null}
          </div>
          <div>
            <h3>What happens next</h3>
            <ol>
              <li>Place the aggregate file in the approved local data area and refresh source discovery.</li>
              <li>Review geography, time period, metric definitions, privacy, and minimum group size.</li>
              <li>Register an aggregate-only query. The source can improve an answer only after those checks pass.</li>
            </ol>
            {candidateSources.length ? <p><strong>Candidate already found:</strong> {unique(candidateSources).join(", ")}. It is not usable until review is complete.</p> : null}
            {relevantGaps.length ? <details><summary>Why current outcome evidence is not ready</summary><ul>{relevantGaps.map((gap) => <li key={gap.outcomeId}><strong>{gap.label}:</strong> {gap.missingEvidence[0]}</li>)}</ul></details> : null}
            <small>This screen does not upload, connect, approve, or query a new file.</small>
          </div>
        </div>
      </details>
    </section>
  );
}
