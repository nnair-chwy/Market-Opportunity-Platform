import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  ACTION_PACKET_PROMPT_VERSION,
  actionPacketExplanationSchema,
  type ActionPacket,
  type ActionPacketExplanation,
} from "./contracts.ts";
import { deterministicActionPacketExplanation } from "./action-packets.ts";

export const ACTION_PACKET_MODEL = "gpt-5.6-terra";

const modelExplanationSchema = z.object({
  headline: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(900),
  courseOfAction: z.string().trim().min(1).max(500),
  limitation: z.string().trim().min(1).max(500),
  sourceIds: z.array(z.string().trim().min(1)).min(1).max(30),
});
export type ActionPacketModelOutput = z.infer<typeof modelExplanationSchema>;
export type ActionPacketModelCaller = (packet: ActionPacket) => Promise<{
  output: unknown;
  model: string;
}>;

export class ActionPacketExplanationError extends Error {
  readonly code: "timeout" | "provider_error" | "invalid_structure" | "validation_rejected";

  constructor(
    code: "timeout" | "provider_error" | "invalid_structure" | "validation_rejected",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

function allowedNumbers(packet: ActionPacket) {
  const matches = JSON.stringify(packet).match(/-?\d+(?:\.\d+)?/g) ?? [];
  return new Set(matches.map((value) => Number(value)));
}

function introducedNumbers(value: string, packet: ActionPacket) {
  const allowed = allowedNumbers(packet);
  const matches = value.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map(Number).filter((number) => !allowed.has(number));
}

function validateModelExplanation(output: unknown, packet: ActionPacket) {
  const parsed = modelExplanationSchema.safeParse(output);
  if (!parsed.success) {
    throw new ActionPacketExplanationError("invalid_structure", "The model returned an invalid ActionPacket explanation structure.");
  }
  const value = parsed.data;
  if (value.courseOfAction !== packet.recommendedCourseOfAction) {
    throw new ActionPacketExplanationError("validation_rejected", "The model altered the deterministic course of action.");
  }
  const expectedSources = [...packet.sourceIds].sort();
  const suppliedSources = [...new Set(value.sourceIds)].sort();
  if (JSON.stringify(expectedSources) !== JSON.stringify(suppliedSources)) {
    throw new ActionPacketExplanationError("validation_rejected", "The model changed the ActionPacket source set.");
  }
  const unsupportedNumbers = introducedNumbers(
    [value.headline, value.summary, value.courseOfAction, value.limitation].join(" "),
    packet,
  );
  if (unsupportedNumbers.length) {
    throw new ActionPacketExplanationError("validation_rejected", "The model introduced a numeric value that is not present in the ActionPacket.");
  }
  return value;
}

async function callOpenAi(packet: ActionPacket) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 30_000,
  });
  try {
    const response = await client.responses.parse({
      model: ACTION_PACKET_MODEL,
      reasoning: { effort: "low" },
      store: false,
      input: [
        {
          role: "developer",
          content: [
            "Turn the validated synthetic ActionPacket into concise stakeholder language.",
            "Use only facts, values, conditions, and source IDs present in the packet.",
            "Copy recommendedCourseOfAction exactly into courseOfAction.",
            "Return every packet source ID exactly once.",
            "Do not change the system disposition, owner, deadline, conditions, outcomes, or guardrails.",
            "State clearly that the evidence is fictional and no real action was executed.",
          ].join(" "),
        },
        { role: "user", content: JSON.stringify(packet) },
      ],
      text: { format: zodTextFormat(modelExplanationSchema, "ecosystem_action_packet_explanation") },
    });
    if (!response.output_parsed) {
      throw new ActionPacketExplanationError("invalid_structure", "OpenAI returned no structured ActionPacket explanation.");
    }
    return { output: response.output_parsed, model: response.model };
  } catch (error) {
    if (error instanceof ActionPacketExplanationError) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new ActionPacketExplanationError("timeout", "The ActionPacket explanation request timed out.");
    }
    if (error instanceof OpenAI.APIError) {
      throw new ActionPacketExplanationError("provider_error", "The ActionPacket explanation provider was unavailable.");
    }
    throw new ActionPacketExplanationError("provider_error", "The ActionPacket explanation could not be generated.");
  }
}

function fallbackWithState(
  packet: ActionPacket,
  state: ActionPacketExplanation["state"],
): ActionPacketExplanation {
  return actionPacketExplanationSchema.parse({
    ...deterministicActionPacketExplanation(packet),
    state,
  });
}

export async function explainActionPacket(
  packet: ActionPacket,
  callModel: ActionPacketModelCaller = callOpenAi,
): Promise<ActionPacketExplanation> {
  if (callModel === callOpenAi && !process.env.OPENAI_API_KEY?.trim()) {
    return fallbackWithState(packet, "not_configured");
  }
  try {
    const result = await callModel(packet);
    const output = validateModelExplanation(result.output, packet);
    return actionPacketExplanationSchema.parse({
      state: "available",
      ...output,
      origin: "ai",
      modelVersion: result.model,
      promptVersion: ACTION_PACKET_PROMPT_VERSION,
    });
  } catch (error) {
    if (error instanceof ActionPacketExplanationError) return fallbackWithState(packet, error.code);
    return fallbackWithState(packet, error instanceof z.ZodError ? "invalid_structure" : "provider_error");
  }
}
