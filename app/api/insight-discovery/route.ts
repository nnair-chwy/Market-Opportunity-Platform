import { runCurrentDataInsightDiscovery } from "@/lib/insight-discovery";

const headers = { "cache-control": "no-store" };

export async function POST() {
  try {
    return Response.json(runCurrentDataInsightDiscovery(), { status: 201, headers });
  } catch {
    return Response.json({ status: "error", message: "The current-data insight scan could not complete." }, { status: 500, headers });
  }
}
