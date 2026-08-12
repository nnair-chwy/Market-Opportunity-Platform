import { reviewOpportunity } from "@/lib/opportunity-inbox";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ opportunityId: string }> },
) {
  try {
    const { opportunityId } = await context.params;
    const opportunity = reviewOpportunity(
      decodeURIComponent(opportunityId),
      await request.json(),
    );
    return Response.json(opportunity, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Review could not be saved.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
}
