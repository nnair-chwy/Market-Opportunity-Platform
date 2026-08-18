import { evidenceExecutionResponseSchema } from "@/lib/evidence-snapshot/contracts";
import { executeEvaluationPlanEvidence, evaluationPlanExecutionRequestSchema } from "@/lib/planning/execute-plan";

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

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ status: "error", message: "Enter a valid plan execution request." }, { status: 400, headers }); }
  const parsed = evaluationPlanExecutionRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ status: "error", message: "A valid evaluation plan and request ID are required." }, { status: 400, headers });
  try {
    const localEvidenceService = localEvidenceServiceUrl(process.env.LOCAL_EVIDENCE_SERVICE_URL);
    const executed = localEvidenceService
      ? evidenceExecutionResponseSchema.parse(await (await fetch(`${localEvidenceService}/execute`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        })).json())
      : await executeEvaluationPlanEvidence(parsed.data, {
          snapshotDir: localPath(process.env.CLINIC_MARKET_SNAPSHOT_DIR),
          databasePath: localPath(process.env.DUCKDB_PATH),
          normalizedSnapshotDir: localPath(process.env.NORMALIZED_MARKET_DATA_DIR),
          consumerInsightsSnapshotDir: localPath(process.env.CONSUMER_INSIGHTS_SNAPSHOT_DIR),
        });
    const result = evidenceExecutionResponseSchema.parse({
      ...executed,
      missingEvidence: [...new Set([...parsed.data.plan.missingEvidence, ...executed.missingEvidence])],
      missingApprovals: [...new Set([...parsed.data.plan.missingApprovals, ...executed.missingApprovals])],
    });
    return Response.json(result, { status: result.status === "failed" ? 422 : 200, headers });
  } catch {
    return Response.json({ status: "error", message: "The evidence execution service failed unexpectedly." }, { status: 500, headers });
  }
}
