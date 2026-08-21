import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ASK_AI_MODEL } from "../ai/insights.ts";
import { publicMarkets } from "../data/public-market-ui.ts";
import {
  DEFAULT_NORMALIZED_SNAPSHOT_VERSION,
  type NormalizedQueryRequest,
  type NormalizedQueryResponse,
} from "../data-normalization/contracts.ts";
import { queryNormalizedMarketData } from "../data-normalization/query.ts";
import { selectPerspectiveView } from "../perspectives/index.ts";
import { planEvaluation } from "../planning/planner.ts";
import { runMarketInvestigation, type MarketInvestigation } from "../planning/market-investigation.ts";
import {
  CURRENT_DATA_HYPOTHESES,
  runCurrentDataInsightDiscovery,
  type CurrentDataDiscoveryRun,
} from "./current-data-discovery.ts";
import {
  HYBRID_DISCOVERY_PROMPT_VERSION,
  HYBRID_DISCOVERY_VERSION,
  hybridDiscoveryAuditSchema,
  hybridDiscoveryRequestSchema,
  hybridInvestigatorActionSchema,
  hybridInvestigatorResponseSchema,
  hybridInvestigatorInvocationSchema,
  type HybridDiscoveryAudit,
  type HybridDiscoveryRequest,
  type HybridInvestigationReceipt,
  type HybridSupplementalFinding,
  type HybridInvestigatorAction,
  type HybridInvestigatorInvocation,
} from "./hybrid-contracts.ts";
import {
  EXPLORATORY_TABLE_CATALOG,
  executeExploratoryQuery,
  exploratoryQuerySpecSchema,
  normalizeModelExploratoryQuerySpec,
  type ExploratoryQueryResponse,
  type ExploratoryQuerySpec,
} from "./exploratory-query.ts";

const APPROVED_MARKET_SCREENS = new Set(CURRENT_DATA_HYPOTHESES.map((item) => `${item.department}:${item.viewId}`));
const REGISTERED_QUERIES_BY_DEPARTMENT = {
  marketing: ["supported_regions", "regional_context_by_cbsa", "google_ads_context_by_cbsa", "growth_test_screening"],
  cvc: ["supported_regions", "regional_context_by_cbsa", "clinic_context_by_cbsa", "growth_test_screening"],
  pricing: ["supported_regions", "regional_context_by_cbsa", "normalization_coverage"],
} as const;
const GUARANTEES = [
  "The deterministic current-data scan always completes before optional model investigation.",
  "The model can select only registered market screens or registered aggregate queries; arbitrary SQL is not accepted.",
  "Novel queries use an application-compiled aggregate specification over at most three approved tables joined only by CBSA code.",
  "The application validates every invocation, caps steps and returned rows, and records rejected and failed attempts.",
  "A model-selected analysis becomes a finding only when deterministic execution returns a quantified result, comparison, business implication, sources, and limits.",
] as const;

export type HybridInvestigatorContext = {
  baseline: CurrentDataDiscoveryRun;
  department?: HybridDiscoveryRequest["department"];
  permittedMarketScreens: Array<{ perspectiveId: string; viewId: string }>;
  permittedRegisteredQueries: string[];
  permittedExploratoryTables: Array<{ tableId: string; grain: string; columns: string[] }>;
  candidateMarketIds: string[];
  priorReceipts: HybridInvestigationReceipt[];
  lastFailure: string | null;
  remainingSteps: number;
};

export type HybridInvestigatorCaller = (context: HybridInvestigatorContext) => Promise<HybridInvestigatorAction>;
export type RegisteredQueryExecutor = (request: NormalizedQueryRequest) => Promise<NormalizedQueryResponse>;
export type ExploratoryQueryExecutor = (spec: ExploratoryQuerySpec, options: { snapshotVersion: string }) => Promise<ExploratoryQueryResponse>;

export type HybridDiscoveryRun = CurrentDataDiscoveryRun & {
  hybridAudit: HybridDiscoveryAudit;
  supplementalInvestigations: HybridInvestigationReceipt[];
};

const SYSTEM_INSTRUCTIONS = `You select the next bounded analysis for a geographic insight-discovery run.
Return only the supplied structured action. Never write SQL, invent a table, source, metric, CBSA code, result, or business fact.
Choose only from permittedMarketScreens, permittedRegisteredQueries, and permittedExploratoryTables. Use exploratory_query only when a new cross-source aggregate can add value. Never return SQL: select tables, columns, filters, aggregates, ordering, and CBSA joins through the supplied specification.
For exploratory_query, exploratorySpecJson must encode exactly this object shape: {"version":"normalized-exploratory-query-v1","tables":[approved tableId],"joins":[{"leftTableId":approved tableId,"rightTableId":approved tableId,"on":"cbsaCode"}],"groupBy":["cbsaCode","cbsaName"],"measures":[{"tableId":approved tableId,"column":approved column,"aggregation":"sum|avg|min|max|count|count_distinct"}],"filters":[],"orderBy":[{"kind":"measure","measureIndex":0,"direction":"desc"}],"limit":25}. Use the short tableId values supplied in permittedExploratoryTables, not physical normalized table names. Every selected table after the first requires one connected cbsaCode join.
Avoid repeating an invocation already represented in priorReceipts. Prefer an analysis likely to add a new market, source, measure, contradiction, or downstream business outcome.
When a registered query requires a CBSA code, select one from candidateMarketIds. Never omit a required CBSA code and never invent one.
If lastFailure is present, correct that specific issue in the next action instead of repeating the failed proposal.
Use the run as an iterative investigation, not a one-shot selector. A registered or exploratory aggregate may identify a promising market; on the next step, use its returned marketIds in a focused approved market_screen when that can produce a quantified stakeholder finding. Prefer cross-source queries first when compatible tables are available, then challenge the strongest result with a focused market analysis. Do not finish immediately after an accepted aggregate when a non-duplicate focused screen can test its decision value.
The application executes and evaluates every proposal. Choose finish when no permitted invocation is likely to add decision value.`;

async function callOpenAi(context: HybridInvestigatorContext): Promise<HybridInvestigatorAction> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 20_000 });
  const response = await client.responses.parse({
    model: process.env.OPENAI_HYBRID_DISCOVERY_MODEL?.trim() || ASK_AI_MODEL,
    reasoning: { effort: "low" },
    store: false,
    input: [
      { role: "developer", content: SYSTEM_INSTRUCTIONS },
      { role: "user", content: JSON.stringify({
        task: "Select the next approved investigation or finish.",
        baseline: {
          runId: context.baseline.runId,
          departments: context.baseline.departmentsScanned,
          primaryFindings: context.baseline.primaryFindings.map((finding) => ({
            insightId: finding.insightId,
            department: finding.department,
            marketIds: finding.marketIds,
            sourceIds: finding.sourceIds,
            importanceScore: finding.importance.score,
          })),
          sourceIds: context.baseline.sourceIds,
          limitations: context.baseline.limitations,
        },
        department: context.department ?? "all",
        permittedMarketScreens: context.permittedMarketScreens,
        permittedRegisteredQueries: context.permittedRegisteredQueries,
        permittedExploratoryTables: context.permittedExploratoryTables,
        candidateMarketIds: context.candidateMarketIds,
        priorReceipts: context.priorReceipts,
        lastFailure: context.lastFailure,
        remainingSteps: context.remainingSteps,
      }) },
    ],
    text: { format: zodTextFormat(hybridInvestigatorResponseSchema, "hybrid_discovery_next_action") },
  });
  if (!response.output_parsed) throw new Error("OpenAI returned no structured hybrid-discovery action.");
  const parsed = hybridInvestigatorResponseSchema.parse(response.output_parsed);
  if (parsed.action === "finish") {
    return hybridInvestigatorActionSchema.parse({ action: "finish", summary: parsed.summary });
  }
  if (!parsed.invocationKind) throw new Error("OpenAI returned an execute action without an invocation kind.");
  const queryNeedsCbsa = parsed.registeredQuery && ["regional_context_by_cbsa", "clinic_context_by_cbsa", "google_ads_context_by_cbsa"].includes(parsed.registeredQuery);
  const invocation: HybridInvestigatorInvocation = parsed.invocationKind === "market_screen"
    ? {
        kind: "market_screen",
        perspectiveId: parsed.perspectiveId ?? (() => { throw new Error("A market screen requires a perspective."); })(),
        viewId: parsed.viewId ?? (() => { throw new Error("A market screen requires a view."); })(),
        cbsaCodes: parsed.cbsaCodes,
      }
    : parsed.invocationKind === "registered_query"
      ? {
          kind: "registered_query",
          query: parsed.registeredQuery ?? (() => { throw new Error("A registered query name is required."); })(),
          ...(queryNeedsCbsa
            ? { cbsaCode: parsed.registeredCbsaCode ?? context.candidateMarketIds[0] ?? (() => { throw new Error("The selected registered query requires a market from candidateMarketIds."); })() }
            : {}),
        }
      : (() => {
          try {
            return {
              kind: "exploratory_query" as const,
              spec: exploratoryQuerySpecSchema.parse(normalizeModelExploratoryQuerySpec(JSON.parse(parsed.exploratorySpecJson ?? "null"))),
            };
          } catch {
            throw new Error("The AI proposed an exploratory analysis that did not match the approved table, column, and CBSA-join contract.");
          }
        })();
  return hybridInvestigatorActionSchema.parse({
    action: "execute",
    objective: parsed.objective,
    decisionValueHypothesis: parsed.decisionValueHypothesis,
    invocation,
  });
}

function invocationFingerprint(invocation: HybridInvestigatorInvocation) {
  if (invocation.kind === "market_screen") {
    return `market_screen:${invocation.perspectiveId}:${invocation.viewId}:${[...invocation.cbsaCodes].sort().join(",") || "national"}`;
  }
  if (invocation.kind === "registered_query") return `registered_query:${invocation.query}:${invocation.cbsaCode ?? "national"}`;
  return `exploratory_query:${JSON.stringify(invocation.spec)}`;
}

function unique(values: readonly string[]) {
  return [...new Set(values)].sort();
}

function conciseError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown[] }).issues)) {
    const messages = (error as { issues: Array<{ message?: unknown }> }).issues
      .map((issue) => typeof issue.message === "string" ? issue.message : "")
      .filter(Boolean);
    if (messages.length) return unique(messages).join(" ").slice(0, 300);
  }
  return error instanceof Error ? error.message.slice(0, 300) : fallback;
}

function permittedRegisteredQueries(request: HybridDiscoveryRequest): string[] {
  if (!request.normalizedSnapshotVersion) return [];
  if (request.department) return [...REGISTERED_QUERIES_BY_DEPARTMENT[request.department]];
  return unique(Object.values(REGISTERED_QUERIES_BY_DEPARTMENT).flat());
}

function validateInvocation(invocation: HybridInvestigatorInvocation, request: HybridDiscoveryRequest) {
  hybridInvestigatorInvocationSchema.parse(invocation);
  if (invocation.kind === "market_screen") {
    if (!APPROVED_MARKET_SCREENS.has(`${invocation.perspectiveId}:${invocation.viewId}`)) {
      throw new Error("The proposed market screen is not in the approved discovery operator registry.");
    }
    if (request.department && request.department !== invocation.perspectiveId) {
      throw new Error("The proposed market screen is outside the requested department.");
    }
    const view = selectPerspectiveView(invocation.perspectiveId, invocation.viewId);
    if ("status" in view) throw new Error(view.reason);
    for (const cbsaCode of invocation.cbsaCodes) {
      if (!publicMarkets.some((market) => market.cbsa_code === cbsaCode)) throw new Error(`Unknown CBSA code ${cbsaCode}.`);
    }
  }
  if (invocation.kind === "registered_query" && !request.normalizedSnapshotVersion) {
    throw new Error("A reviewed normalized snapshot version is required for registered-query investigation.");
  }
  if (invocation.kind === "registered_query" && !permittedRegisteredQueries(request).includes(invocation.query)) {
    throw new Error("The proposed registered query is outside the requested department's approved query registry.");
  }
  if (invocation.kind === "registered_query" && invocation.cbsaCode && !publicMarkets.some((market) => market.cbsa_code === invocation.cbsaCode)) {
    throw new Error(`Unknown CBSA code ${invocation.cbsaCode}.`);
  }
  if (invocation.kind === "exploratory_query") {
    if (!request.normalizedSnapshotVersion) throw new Error("A reviewed normalized snapshot version is required for exploratory queries.");
    exploratoryQuerySpecSchema.parse(invocation.spec);
  }
}

function baselineFingerprints(request: HybridDiscoveryRequest) {
  return new Set(CURRENT_DATA_HYPOTHESES
    .filter((item) => !request.department || item.department === request.department)
    .map((item) => `market_screen:${item.department}:${item.viewId}:national`));
}

function noveltyScore(input: {
  fingerprint: string;
  priorFingerprints: Set<string>;
  baseline: CurrentDataDiscoveryRun;
  sourceIds: string[];
  marketIds: string[];
}) {
  if (input.priorFingerprints.has(input.fingerprint)) return 0;
  const newSources = input.sourceIds.filter((sourceId) => !input.baseline.sourceIds.includes(sourceId)).length;
  const baselineMarkets = new Set(input.baseline.findings.flatMap((finding) => finding.marketIds));
  const newMarkets = input.marketIds.filter((marketId) => !baselineMarkets.has(marketId)).length;
  return Math.min(100, 55 + Math.min(25, newSources * 10) + Math.min(20, newMarkets * 5));
}

function marketDecisionValue(investigation: MarketInvestigation) {
  if (!investigation.leads.length) return 10;
  const quantified = investigation.leads.filter((lead) => lead.measureValue || lead.supportingMeasures?.length).length;
  return Math.min(100, 35 + investigation.leads.length * 8 + quantified * 6 + Math.min(15, investigation.sourceIds.length * 5));
}

function queryDecisionValue(response: NormalizedQueryResponse) {
  if (!response.rows.length) return 10;
  return Math.max(0, Math.min(100, 35 + Math.min(35, response.rows.length * 3) + response.sourceIds.length * 8 - response.warnings.length * 4));
}

function rejectedReceipt(invocation: HybridInvestigatorInvocation, objective: string, reason: string): HybridInvestigationReceipt {
  return {
    kind: invocation.kind,
    fingerprint: invocationFingerprint(invocation),
    objective,
    status: "rejected",
    noveltyScore: 0,
    decisionValueScore: 0,
    reason,
    rowCount: 0,
    leadCount: 0,
    marketIds: [],
    sourceIds: [],
    measureLabels: [],
    warnings: [],
    supplementalFinding: null,
    lineage: null,
  };
}

function marketScreenFinding(input: {
  investigation: MarketInvestigation;
  objective: string;
  fingerprint: string;
}): HybridSupplementalFinding | null {
  const lead = input.investigation.leads.find((candidate) => candidate.measureValue || candidate.supportingMeasures?.length);
  if (!lead || !input.investigation.sourceIds.length) return null;
  const quantifiedEvidence = lead.measureValue
    ? `${lead.measureValue.label}: ${lead.measureValue.formattedValue} (${lead.measureValue.rangeMeaning}; percentile ${lead.measureValue.percentile.toFixed(1)}).`
    : (lead.supportingMeasures ?? []).slice(0, 3).map((measure) => `${measure.label}: ${measure.formattedValue} (${measure.rangeMeaning}; percentile ${measure.percentile.toFixed(1)})`).join(" ");
  const marketName = lead.marketIds.map((marketId) => publicMarkets.find((market) => market.cbsa_code === marketId)?.cbsa_name).filter(Boolean).join(", ") || lead.title.split(":")[0] || "This market";
  const recommendation = input.investigation.perspectiveId === "marketing"
    ? `Put ${marketName} first in the next campaign-and-outcome review; keep live spend unchanged until the observed response is joined to new-customer, sales, and contribution outcomes.`
    : input.investigation.perspectiveId === "pricing"
      ? `Put ${marketName} first in the next matched-SKU pricing review; keep live price unchanged until coverage, margin, and expected unit response are verified.`
      : `Put ${marketName} first in the next clinic demand-and-capacity review; do not change footprint or media until appointments, staffed capacity, and mature-clinic economics are joined.`;
  return {
    id: `ai:${input.fingerprint}`,
    department: input.investigation.perspectiveId,
    question: input.investigation.originalQuestion,
    headline: lead.title,
    recommendation,
    quantifiedEvidence,
    comparison: lead.observation,
    businessImplication: lead.businessMeaning,
    nextAction: lead.nextEvidence,
    marketIds: lead.marketIds,
    sourceIds: input.investigation.sourceIds,
    limitations: [lead.challenge, ...input.investigation.limitations].filter(Boolean).slice(0, 5),
  };
}

async function executeInvocation(input: {
  invocation: HybridInvestigatorInvocation;
  objective: string;
  baseline: CurrentDataDiscoveryRun;
  request: HybridDiscoveryRequest;
  priorFingerprints: Set<string>;
  queryExecutor: RegisteredQueryExecutor;
  exploratoryQueryExecutor: ExploratoryQueryExecutor;
  step: number;
}): Promise<HybridInvestigationReceipt> {
  const fingerprint = invocationFingerprint(input.invocation);
  if (input.priorFingerprints.has(fingerprint)) return rejectedReceipt(input.invocation, input.objective, "This invocation duplicates an analysis already represented in the baseline or this hybrid run.");

  if (input.invocation.kind === "market_screen") {
    const invocation = input.invocation;
    const selectedGeography = invocation.cbsaCodes.map((cbsaCode) => {
      const market = publicMarkets.find((candidate) => candidate.cbsa_code === cbsaCode)!;
      return { cbsaCode: market.cbsa_code, cbsaName: market.cbsa_name };
    });
    const registered = CURRENT_DATA_HYPOTHESES.find((item) => item.department === invocation.perspectiveId && item.viewId === invocation.viewId)!;
    const plan = planEvaluation(registered.question, registered.department, selectedGeography, registered.viewId);
    const investigation = runMarketInvestigation(plan);
    const marketIds = unique(investigation.leads.flatMap((lead) => lead.marketIds));
    const sourceIds = unique(investigation.sourceIds);
    const novelty = noveltyScore({ fingerprint, priorFingerprints: input.priorFingerprints, baseline: input.baseline, sourceIds, marketIds });
    const value = marketDecisionValue(investigation);
    const supplementalFinding = marketScreenFinding({ investigation, objective: input.objective, fingerprint });
    const accepted = novelty >= 45 && value >= 35 && Boolean(supplementalFinding);
    return {
      kind: "market_screen",
      fingerprint,
      objective: input.objective,
      status: accepted ? "accepted" : "rejected",
      noveltyScore: novelty,
      decisionValueScore: value,
      reason: novelty < 45 ? "The screen did not add enough evidence beyond prior analyses." : value < 35 ? "The screen returned too little decision-relevant evidence." : !supplementalFinding ? "The screen did not return the quantified comparison required for a stakeholder finding." : "The approved screen produced a non-duplicative, quantified finding.",
      rowCount: 0,
      leadCount: investigation.leads.length,
      marketIds,
      sourceIds,
      measureLabels: unique(investigation.measuresExamined),
      warnings: unique([...investigation.limitations, ...investigation.readiness.missing]).slice(0, 8),
      supplementalFinding,
      lineage: null,
    };
  }

  if (input.invocation.kind === "exploratory_query") {
    const response = await input.exploratoryQueryExecutor(input.invocation.spec, { snapshotVersion: input.request.normalizedSnapshotVersion! });
    const cappedRows = response.rows.slice(0, input.request.maxResultRows);
    const marketIds = unique(cappedRows.flatMap((row) => typeof row.cbsaCode === "string" ? [row.cbsaCode] : []));
    const sourceIds = unique(response.lineage.tables.flatMap((table) => table.sourceIds));
    const novelty = noveltyScore({ fingerprint, priorFingerprints: input.priorFingerprints, baseline: input.baseline, sourceIds, marketIds });
    const value = Math.max(0, Math.min(100, 40 + Math.min(30, cappedRows.length * 3) + Math.min(20, response.lineage.tableIds.length * 7)));
    return {
      kind: "exploratory_query",
      fingerprint,
      objective: input.objective,
      status: novelty >= 45 && value >= 35 ? "accepted" : "rejected",
      noveltyScore: novelty,
      decisionValueScore: value,
      reason: novelty < 45 ? "The exploratory query did not add enough evidence beyond prior analyses." : "The safe cross-source aggregate added a non-duplicative evidence lead.",
      rowCount: cappedRows.length,
      leadCount: 0,
      marketIds,
      sourceIds,
      measureLabels: response.lineage.selectedColumns,
      warnings: response.rows.length > cappedRows.length ? [`Result capped at ${input.request.maxResultRows} aggregate rows.`] : [],
      supplementalFinding: null,
      lineage: response.lineage,
    };
  }

  const response = await input.queryExecutor({
    requestId: `${input.baseline.runId}:hybrid:${input.step}`,
    snapshotVersion: input.request.normalizedSnapshotVersion!,
    query: input.invocation.query,
    ...(input.invocation.cbsaCode ? { cbsaCode: input.invocation.cbsaCode } : {}),
  });
  const cappedRows = response.rows.slice(0, input.request.maxResultRows);
  const marketIds = unique(cappedRows.flatMap((row) => typeof row.cbsaCode === "string" ? [row.cbsaCode] : []));
  const sourceIds = unique(response.sourceIds);
  const novelty = noveltyScore({ fingerprint, priorFingerprints: input.priorFingerprints, baseline: input.baseline, sourceIds, marketIds });
  const value = queryDecisionValue({ ...response, rows: cappedRows });
  return {
    kind: "registered_query",
    fingerprint,
    objective: input.objective,
    status: novelty >= 45 && value >= 35 ? "accepted" : "rejected",
    noveltyScore: novelty,
    decisionValueScore: value,
    reason: novelty < 45 ? "The query did not add enough evidence beyond prior analyses." : value < 35 ? "The query returned too little decision-relevant evidence." : "The registered aggregate query added a non-duplicative evidence lead.",
    rowCount: cappedRows.length,
    leadCount: 0,
    marketIds,
    sourceIds,
    measureLabels: unique(cappedRows.flatMap((row) => Object.keys(row))).slice(0, 20),
    warnings: unique([
      ...response.warnings,
      ...(response.rows.length > cappedRows.length ? [`Result capped at ${input.request.maxResultRows} aggregate rows.`] : []),
    ]).slice(0, 8),
    supplementalFinding: null,
    lineage: null,
  };
}

function deterministicAudit(request: HybridDiscoveryRequest, reason: "deterministic_requested" | "model_not_configured"): HybridDiscoveryAudit {
  return hybridDiscoveryAuditSchema.parse({
    version: HYBRID_DISCOVERY_VERSION,
    mode: "deterministic_only",
    modelVersion: null,
    promptVersion: HYBRID_DISCOVERY_PROMPT_VERSION,
    maxSteps: request.maxSteps,
    stepsAttempted: 0,
    acceptedInvestigationCount: 0,
    terminationReason: reason,
    fallbackReason: reason === "model_not_configured" ? "No OpenAI API key was configured; the deterministic baseline is the complete result." : null,
    receipts: [],
    guarantees: [...GUARANTEES],
  });
}

export async function runHybridInsightDiscovery(
  rawRequest: unknown = {},
  options: {
    callModel?: HybridInvestigatorCaller;
    queryExecutor?: RegisteredQueryExecutor;
    exploratoryQueryExecutor?: ExploratoryQueryExecutor;
    now?: () => string;
    runId?: string;
  } = {},
): Promise<HybridDiscoveryRun> {
  const request = hybridDiscoveryRequestSchema.parse(rawRequest);
  const baseline = runCurrentDataInsightDiscovery({
    now: options.now,
    runId: options.runId,
    previousRunId: request.previousRunId,
    previousPrimaryFindingIds: request.previousPrimaryFindingIds,
  });
  if (request.mode === "deterministic") {
    return { ...baseline, hybridAudit: deterministicAudit(request, "deterministic_requested"), supplementalInvestigations: [] };
  }
  const callModel = options.callModel ?? (process.env.OPENAI_API_KEY?.trim() ? callOpenAi : null);
  if (!callModel) {
    return { ...baseline, hybridAudit: deterministicAudit(request, "model_not_configured"), supplementalInvestigations: [] };
  }

  const receipts: HybridInvestigationReceipt[] = [];
  const priorFingerprints = baselineFingerprints(request);
  let failures = 0;
  let attempts = 0;
  let lastFailure: string | null = null;
  let terminationReason: HybridDiscoveryAudit["terminationReason"] = "step_limit";
  let fallbackReason: string | null = null;
  const permittedMarketScreens = CURRENT_DATA_HYPOTHESES
    .filter((item) => !request.department || item.department === request.department)
    .map((item) => ({ perspectiveId: item.department, viewId: item.viewId }));
  const registeredQueries = permittedRegisteredQueries(request);

  for (let step = 1; step <= request.maxSteps; step += 1) {
    attempts += 1;
    let action: HybridInvestigatorAction;
    try {
      const candidateMarketIds = unique([
        ...receipts.flatMap((receipt) => receipt.marketIds),
        ...baseline.primaryFindings.flatMap((finding) => finding.marketIds),
      ]).slice(0, 25);
      action = hybridInvestigatorActionSchema.parse(await callModel({
        baseline,
        department: request.department,
        permittedMarketScreens,
        permittedRegisteredQueries: registeredQueries,
        permittedExploratoryTables: request.normalizedSnapshotVersion ? Object.entries(EXPLORATORY_TABLE_CATALOG).map(([tableId, table]) => ({ tableId, grain: table.grain, columns: Object.keys(table.columns) })) : [],
        candidateMarketIds,
        priorReceipts: receipts,
        lastFailure,
        remainingSteps: request.maxSteps - step + 1,
      }));
    } catch (error) {
      failures += 1;
      lastFailure = conciseError(error, "The investigator returned an invalid action.");
      if (failures >= 2) {
        terminationReason = "model_error";
        fallbackReason = `The AI investigator could not produce a valid bounded action after a correction attempt: ${lastFailure}`.slice(0, 360);
        break;
      }
      continue;
    }
    if (action.action === "finish") {
      terminationReason = "model_finished";
      break;
    }
    try {
      validateInvocation(action.invocation, request);
      const receipt = await executeInvocation({
        invocation: action.invocation,
        objective: action.objective,
        baseline,
        request,
        priorFingerprints,
        queryExecutor: options.queryExecutor ?? queryNormalizedMarketData,
        exploratoryQueryExecutor: options.exploratoryQueryExecutor ?? executeExploratoryQuery,
        step,
      });
      receipts.push(receipt);
      priorFingerprints.add(receipt.fingerprint);
      if (receipt.status === "failed") {
        failures += 1;
        lastFailure = receipt.reason;
      } else {
        lastFailure = null;
      }
    } catch (error) {
      const reason = conciseError(error, "The proposed invocation failed validation.");
      const receipt = rejectedReceipt(action.invocation, action.objective, reason);
      receipt.status = "failed";
      receipts.push(receipt);
      failures += 1;
      lastFailure = reason;
    }
    if (failures >= 2) {
      terminationReason = "failure_limit";
      fallbackReason = "Two proposed investigations failed validation or execution; the deterministic baseline remains authoritative.";
      break;
    }
  }

  const accepted = receipts.filter((receipt) => receipt.status === "accepted");
  const fallback = terminationReason === "model_error" || terminationReason === "failure_limit";
  const hybridAudit = hybridDiscoveryAuditSchema.parse({
    version: HYBRID_DISCOVERY_VERSION,
    mode: fallback ? "hybrid_fallback" : "hybrid_completed",
    modelVersion: process.env.OPENAI_HYBRID_DISCOVERY_MODEL?.trim() || ASK_AI_MODEL,
    promptVersion: HYBRID_DISCOVERY_PROMPT_VERSION,
    maxSteps: request.maxSteps,
    stepsAttempted: attempts,
    acceptedInvestigationCount: accepted.length,
    terminationReason,
    fallbackReason,
    receipts,
    guarantees: [...GUARANTEES],
  });
  return { ...baseline, hybridAudit, supplementalInvestigations: accepted };
}

export { DEFAULT_NORMALIZED_SNAPSHOT_VERSION };
