import vettedDynamicSourceRegistry from "@/data/contracts/vetted-dynamic-source-registry.json";
import { evidenceExecutionResponseSchema } from "@/lib/evidence-snapshot/contracts";
import { executeAgenticEvidenceLoop } from "@/lib/planning/agentic-evidence-loop";
import { evaluationPlanExecutionRequestSchema } from "@/lib/planning/execute-plan";
import { createVettedDynamicSourceRuntime } from "@/lib/planning/vetted-dynamic-source-registry";

const headers = { "cache-control": "no-store" };

function localPath(value: string | undefined): string | undefined {
  const configured = value?.trim();
  if (!configured) return undefined;
  let decoded = configured;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function localEvidenceServiceUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function failedExecution(input: typeof evaluationPlanExecutionRequestSchema._output) {
  const { requestId, plan } = input;
  const query = plan.intent.topic === "source_coverage"
    ? "source_coverage_bundle"
    : plan.intent.topic === "growth_test_screening"
      ? "growth_test_screening_bundle"
      : plan.intent.topic === "multi_market_comparison"
        ? "multi_market_comparison_bundle"
        : plan.intent.topic === "clinic_location" && plan.intent.selectedQueries.length
          ? "clinic_location_evidence_bundle"
          : plan.intent.topic === "consumer_insights"
            ? "consumer_insights_bundle"
            : plan.intent.selectedQueries.length
              ? "normalized_evidence_bundle"
              : plan.capabilityId === "clinic_performance"
                ? "clinic_performance_bundle"
                : plan.capabilityId === "clinic_site_evaluation"
                  ? "clinic_site_evidence_bundle"
                  : plan.capabilityId === "local_growth_test"
                    ? "growth_test_bundle"
                    : "market_context_bundle";
  return evidenceExecutionResponseSchema.parse({
    requestId,
    status: "failed",
    snapshotVersion: "unavailable",
    queryVersion: "evaluation-route-runtime-v1",
    calculationVersion: null,
    query,
    componentQueries: [],
    capability: plan.capabilityId,
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    geographyIds: plan.geographyResolution.selectedCbsaCodes.map((code) => `cbsa:${code}`),
    missingApprovals: [...plan.missingApprovals],
    guardrails: [plan.evidenceBoundary, "No evidence is reported when the execution runtime fails."],
    rows: [],
    evidenceBundle: [],
    sourceIds: [],
    qualityWarnings: ["The registered evidence runtime did not complete."],
    missingEvidence: [...new Set([...plan.missingEvidence, "Registered evidence execution did not complete; retry before relying on findings."])],
    unknowns: ["No execution evidence was returned."],
    allowedUse: "none",
    sensitivity: "internal",
    executionMode: "frozen_snapshot_demo",
    errorCode: "EVIDENCE_EXECUTION_RUNTIME_FAILED",
    errorMessage: "The registered evidence runtime failed. No evidence was returned.",
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ status: "error", message: "Enter a valid plan execution request." }, { status: 400, headers }); }
  const parsed = evaluationPlanExecutionRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ status: "error", message: "A valid evaluation plan and request ID are required." }, { status: 400, headers });
  try {
    const localEvidenceService = localEvidenceServiceUrl(process.env.LOCAL_EVIDENCE_SERVICE_URL);
    // Bundle the reviewed registry with the route. Worker runtimes do not
    // guarantee that process.cwd() contains the repository's data directory.
    const dynamicSources = createVettedDynamicSourceRuntime(
      vettedDynamicSourceRegistry,
      { workspaceRoot: process.cwd() },
      parsed.data.plan,
    );
    const executed = await executeAgenticEvidenceLoop(parsed.data, {
      snapshotDir: localPath(process.env.CLINIC_MARKET_SNAPSHOT_DIR),
      databasePath: localPath(process.env.DUCKDB_PATH),
      normalizedSnapshotDir: localPath(process.env.NORMALIZED_MARKET_DATA_DIR),
      consumerInsightsSnapshotDir: localPath(process.env.CONSUMER_INSIGHTS_SNAPSHOT_DIR),
      candidateResearchPasses: dynamicSources.candidateResearchPasses,
      executeCandidatePass: dynamicSources.executeCandidatePass,
      sourceConsiderations: dynamicSources.sourceConsiderations,
      dynamicRegistryVersion: dynamicSources.registryVersion,
      dynamicRegistryFingerprint: dynamicSources.registryFingerprint,
      ...(localEvidenceService ? {
        executePass: async (passRequest: typeof parsed.data) => evidenceExecutionResponseSchema.parse(await (await fetch(`${localEvidenceService}/execute`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(passRequest),
        })).json()),
      } : {}),
    });
    const result = evidenceExecutionResponseSchema.parse({
      ...executed,
      missingEvidence: [...new Set([...parsed.data.plan.missingEvidence, ...executed.missingEvidence])],
      missingApprovals: [...new Set([...parsed.data.plan.missingApprovals, ...executed.missingApprovals])],
    });
    return Response.json(result, { status: result.status === "failed" ? 422 : 200, headers });
  } catch {
    return Response.json(failedExecution(parsed.data), { status: 422, headers });
  }
}
