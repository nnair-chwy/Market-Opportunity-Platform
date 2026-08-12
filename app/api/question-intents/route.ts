import { z } from "zod";
import { proposeQuestionIntentWithAi } from "@/lib/decision-agent/ai-question-interpreter";

const requestSchema = z.object({ question: z.string().trim().min(3).max(600) });
const headers = { "cache-control": "no-store" };

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) return Response.json({ status: "error", message: "AI interpretation is not configured." }, { status: 503, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ status: "error", message: "Enter a valid evaluation question." }, { status: 400, headers }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ status: "error", message: "Enter an evaluation question between 3 and 600 characters." }, { status: 400, headers });
  try { return Response.json({ status: "ok", intent: await proposeQuestionIntentWithAi(parsed.data.question) }, { status: 200, headers }); }
  catch (error) { console.error("[question-intent]", error instanceof Error ? error.name : "UnknownError"); return Response.json({ status: "error", message: "AI interpretation is temporarily unavailable." }, { status: 502, headers }); }
}
