import {
  AskAiProviderError,
  askAiRequestSchema,
  generateAskAiResponse,
} from "@/lib/ai/insights";
import { ZodError } from "zod";

const NO_STORE_HEADERS = {
  "cache-control": "no-store",
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      {
        status: "error",
        message:
          "Ask AI is not configured. Add OPENAI_API_KEY to the server environment.",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 65_536) {
    return Response.json(
      {
        status: "error",
        message: "The Ask AI request is too large.",
      },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json(
      { status: "error", message: "Enter a valid Ask AI request." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsedInput = askAiRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return Response.json(
      {
        status: "error",
        errorCode: "invalid_request",
        message: "The selected evidence or question is not valid for Ask AI.",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await generateAskAiResponse(parsedInput.data);
    return Response.json(result, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const errorCode =
      error instanceof AskAiProviderError
        ? error.code
        : error instanceof ZodError
          ? "invalid_structure"
          : "unexpected_failure";
    console.error(
      "[ask-ai]",
      JSON.stringify({
        errorCode,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
    );

    if (error instanceof AskAiProviderError) {
      const timedOut = error.code === "provider_timeout";
      return Response.json(
        {
          status: "error",
          errorCode: error.code,
          message: timedOut
            ? "Ask AI took too long to review the evidence. Try the question again."
            : "Ask AI is temporarily unavailable. Try the question again.",
        },
        { status: timedOut ? 504 : 502, headers: NO_STORE_HEADERS },
      );
    }

    if (error instanceof ZodError) {
      return Response.json(
        {
          status: "error",
          errorCode: "invalid_structure",
          message: "Ask AI returned an unsupported response structure. Try again.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json(
      {
        status: "error",
        errorCode: "unexpected_failure",
        message:
          "Ask AI could not produce a supported evidence explanation. Try again.",
      },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
