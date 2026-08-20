export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ status: "ok", service: "market-intelligence" }, { headers: { "cache-control": "no-store" } });
}
