import { compactSourceReadiness, loadFirstPartyOutcomeReadiness } from "../../../lib/data-discovery/readiness-service.ts";

export const runtime = "nodejs";

export async function GET() {
  const report = await loadFirstPartyOutcomeReadiness();
  return Response.json(compactSourceReadiness(report), { headers: { "cache-control": "no-store" } });
}
