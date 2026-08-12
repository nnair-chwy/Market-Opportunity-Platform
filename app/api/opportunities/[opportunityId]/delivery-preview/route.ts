import { createDeliveryPreview } from "@/lib/opportunity-inbox";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ opportunityId: string }> },
) {
  try {
    const { opportunityId } = await context.params;
    const result = createDeliveryPreview(
      decodeURIComponent(opportunityId),
      await request.json(),
    );
    return Response.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Delivery preview could not be generated.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
}
