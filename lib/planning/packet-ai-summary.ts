import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { ASK_AI_MODEL } from "../ai/insights.ts";
import type { EvaluationPlan, PlannedAction } from "./contracts.ts";
import type { EvidenceExecutionResponse } from "../evidence-snapshot/contracts.ts";
import {
  PACKET_SUMMARY_PROMPT_VERSION,
  assembleReviewableActionPacket,
  deterministicFindingsAndProposalSummary,
  packetFindingsSummarySchema,
  proposedActionFromPlan,
  type PacketFindingsSummary,
  type ReviewableActionPacket,
} from "./reviewable-packet.ts";

const modelSummarySchema = z.object({
  summary: z.string().trim().min(1).max(1400),
}).strict();

export type PacketSummaryModelCaller = (packet: ReviewableActionPacket) => Promise<{
  output: unknown;
  model: string;
}>;

export class PacketSummaryError extends Error {
  readonly code: PacketFindingsSummary["state"];

  constructor(code: PacketFindingsSummary["state"], message: string) {
    super(message);
    this.code = code;
  }
}

function allowedNumbers(packet: ReviewableActionPacket) {
  const matches = JSON.stringify(packet).match(/-?\d+(?:\.\d+)?/g) ?? [];
  return new Set(matches.map((value) => Number(value)));
}

function introducedNumbers(value: string, packet: ReviewableActionPacket) {
  const allowed = allowedNumbers(packet);
  const matches = value.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.map(Number).filter((number) => !allowed.has(number));
}

function hasSupportedExploratoryFindings(packet: ReviewableActionPacket) {
  return (packet.analysisAppendix?.leads.length ?? 0) > 0
    && packet.finalAnswer.sections.some((section) => section.sectionId === "direct_answer" && section.supportStatus === "supported");
}

function contradictsSupportedFindings(value: string) {
  return /\bno\s+(?:validated|supported|available|evidence[- ]backed|analytical)?\s*(?:answer|finding|result)s?\b|\b(?:answer|analysis|evaluation|result)\s+(?:is|remains|was)\s+(?:fully\s+)?blocked\b/i.test(value);
}

function statesMaterialActionBoundary(value: string) {
  return /\b(?:does not|do not|not yet|cannot|can't)\b[^.!?]{0,120}\b(?:authorize|support|establish|justify|approve|execute|change|increase|decrease|material action|spend|price|site|lease|opening)\b/i.test(value);
}

function leadsWithAvailableEvidence(value: string, packet: ReviewableActionPacket) {
  const firstSentence = value.split(/[.!?]/, 1)[0]?.toLowerCase() ?? "";
  const leadNames = (packet.analysisAppendix?.leads ?? [])
    .map((lead) => lead.title.split(":")[0]?.trim().toLowerCase())
    .filter((name): name is string => Boolean(name && name.length > 3));
  return /\b(?:descriptive answer|finding|signal|evidence|observed)\b/i.test(firstSentence)
    || leadNames.some((name) => firstSentence.includes(name));
}

function validateModelSummary(output: unknown, packet: ReviewableActionPacket) {
  const parsed = modelSummarySchema.safeParse(output);
  if (!parsed.success) {
    throw new PacketSummaryError("invalid_structure", "The model returned an invalid packet findings summary.");
  }
  const joined = Object.values(parsed.data).join(" ");
  if (/final (real-estate|business) decision|approve (the )?lease|open the clinic|sign (the )?lease/i.test(joined)) {
    throw new PacketSummaryError("validation_rejected", "The model made a prohibited final decision claim.");
  }
  if (introducedNumbers(joined, packet).length) {
    throw new PacketSummaryError("validation_rejected", "The model introduced a numeric value absent from the packet.");
  }
  const ownerToken = packet.action.owner.split(/\s+/).find((token) => token.length > 4)?.toLowerCase();
  if (ownerToken && !joined.toLowerCase().includes(ownerToken)) {
    throw new PacketSummaryError("validation_rejected", "The model omitted the accountable owner.");
  }
  if (hasSupportedExploratoryFindings(packet)) {
    if (contradictsSupportedFindings(joined)) {
      throw new PacketSummaryError("validation_rejected", "The model treated a supported descriptive answer as unavailable or blocked.");
    }
    if (!leadsWithAvailableEvidence(joined, packet)) {
      throw new PacketSummaryError("validation_rejected", "The model did not lead with the best available findings.");
    }
    if (!statesMaterialActionBoundary(joined)) {
      throw new PacketSummaryError("validation_rejected", "The model did not distinguish the available descriptive answer from unsupported material action.");
    }
  }
  return parsed.data;
}

export function packetSummaryInstructions(packet: ReviewableActionPacket) {
  const exploratoryInstruction = hasSupportedExploratoryFindings(packet)
    ? `This packet contains ${packet.analysisAppendix!.leads.length} supported exploratory finding(s). Lead with the best available findings. Explicitly say that a descriptive answer is available while the material action is not yet supported. A failed or partial action-readiness criterion does not mean the descriptive answer or investigation is blocked. Never say there is no validated answer, no supported finding, or that the analysis/evaluation is blocked.`
    : "If no supported answer is present, state the evidence gap directly without inventing a finding.";
  return [
    "Summarize only the supplied validated draft action packet.",
    exploratoryInstruction,
    "Return one concise plain-language summary paragraph, ideally two to four sentences, that explains what the evidence says, why the proposed action matters, what the accountable owner should do next, and the main limitation or unknown.",
    "Use only facts present in the packet. Do not invent markets, scores, weights, evidence, or approvals.",
    "Do not alter the proposed next step meaning. Do not make a final real-estate or business decision.",
    "State that the packet remains draft-only for human review.",
  ].join(" ");
}

async function callOpenAi(packet: ReviewableActionPacket) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 30_000,
  });
  try {
    const response = await client.responses.parse({
      model: process.env.OPENAI_PACKET_SUMMARY_MODEL?.trim() || ASK_AI_MODEL,
      reasoning: { effort: "low" },
      store: false,
      input: [
        {
          role: "developer",
          content: packetSummaryInstructions(packet),
        },
        { role: "user", content: JSON.stringify(packet) },
      ],
      text: { format: zodTextFormat(modelSummarySchema, "evaluation_packet_findings_summary") },
    });
    if (!response.output_parsed) {
      throw new PacketSummaryError("invalid_structure", "OpenAI returned no structured packet findings summary.");
    }
    return { output: response.output_parsed, model: response.model };
  } catch (error) {
    if (error instanceof PacketSummaryError) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new PacketSummaryError("timeout", "The packet findings summary request timed out.");
    }
    if (error instanceof OpenAI.APIError) {
      throw new PacketSummaryError("provider_error", "The packet findings summary provider was unavailable.");
    }
    throw new PacketSummaryError("provider_error", "The packet findings summary could not be generated.");
  }
}

function fallbackWithState(
  plan: EvaluationPlan,
  action: PlannedAction,
  evidenceExecution: EvidenceExecutionResponse | null,
  state: PacketFindingsSummary["state"],
): PacketFindingsSummary {
  return packetFindingsSummarySchema.parse({
    ...deterministicFindingsAndProposalSummary(plan, action, evidenceExecution),
    draftOnlyNotice:
      "Draft summary for human review only. It restates the validated plan and proposed action packet and is not a final real-estate or business decision.",
    state,
    origin: "deterministic_fallback",
  });
}

function fallbackFromPacket(
  packet: ReviewableActionPacket,
  state: PacketFindingsSummary["state"],
): PacketFindingsSummary {
  const section = (id: ReviewableActionPacket["finalAnswer"]["sections"][number]["sectionId"]) =>
    packet.finalAnswer.sections.find((item) => item.sectionId === id)?.content ?? "Not available.";
  const exploratoryLeads = packet.analysisAppendix?.leads ?? [];
  const exploratorySummary = exploratoryLeads.length
    ? `A descriptive answer is available: ${exploratoryLeads.length} source-linked finding${exploratoryLeads.length === 1 ? "" : "s"} survived the registered investigation. Leading findings: ${exploratoryLeads.slice(0, 3).map((lead) => lead.title).join("; ")}. These findings support further investigation, but they do not support or authorize a material business action. ${packet.action.owner} should ${packet.action.nextStep} Supporting detail: ${boundedPacketText(exploratoryLeads[0]!.observation, 360)} This remains draft-only for human review.`
    : null;
  return packetFindingsSummarySchema.parse({
    title: "Findings and proposed action",
    draftOnlyNotice: "Draft summary for human review only. It restates the validated action packet and is not a final real-estate or business decision.",
    origin: "deterministic_fallback",
    state,
    modelVersion: null,
    promptVersion: PACKET_SUMMARY_PROMPT_VERSION,
    summary: boundedPacketText(exploratorySummary ?? [
        section("direct_answer"),
        `${packet.action.title}: ${packet.action.summary}`,
        `${packet.action.owner} should ${packet.action.nextStep} Timing: ${packet.action.timing}.`,
        `Remaining limitation: ${section("missing_evidence")}`,
      ].join(" "), 1400),
  });
}

function boundedPacketText(value: string, maximum = 600) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  const clipped = normalized.slice(0, maximum - 1);
  return `${clipped.slice(0, Math.max(1, clipped.lastIndexOf(" ")))}…`;
}

export async function explainReviewablePacket(
  packet: ReviewableActionPacket,
  callModel: PacketSummaryModelCaller = callOpenAi,
): Promise<PacketFindingsSummary> {
  if (callModel === callOpenAi && !process.env.OPENAI_API_KEY?.trim()) {
    return fallbackFromPacket(packet, "not_configured");
  }
  try {
    const result = await callModel(packet);
    const output = validateModelSummary(result.output, packet);
    return packetFindingsSummarySchema.parse({
      title: "Findings and proposed action",
      draftOnlyNotice: "AI-generated draft summary for human review only. It restates the validated action packet and is not a final real-estate or business decision.",
      origin: "ai",
      state: "available",
      modelVersion: result.model,
      promptVersion: PACKET_SUMMARY_PROMPT_VERSION,
      ...output,
    });
  } catch (error) {
    if (error instanceof PacketSummaryError) return fallbackFromPacket(packet, error.code);
    return fallbackFromPacket(packet, error instanceof z.ZodError ? "invalid_structure" : "provider_error");
  }
}

export async function explainFindingsAndProposal(
  plan: EvaluationPlan,
  action: PlannedAction = proposedActionFromPlan(plan),
  evidenceOrCaller: EvidenceExecutionResponse | PacketSummaryModelCaller | null = null,
  suppliedCaller: PacketSummaryModelCaller = callOpenAi,
): Promise<PacketFindingsSummary> {
  const evidenceExecution = typeof evidenceOrCaller === "function" ? null : evidenceOrCaller;
  const callModel = typeof evidenceOrCaller === "function" ? evidenceOrCaller : suppliedCaller;
  const packet = assembleReviewableActionPacket(plan, action, new Date().toISOString(), undefined, [], undefined, undefined, undefined, undefined, undefined, null, undefined, evidenceExecution);
  if (callModel === callOpenAi && !process.env.OPENAI_API_KEY?.trim()) {
    return fallbackWithState(plan, action, evidenceExecution, "not_configured");
  }
  try {
    const result = await callModel(packet);
    const output = validateModelSummary(result.output, packet);
    return packetFindingsSummarySchema.parse({
      title: "Findings and proposed action",
      draftOnlyNotice:
        "AI-generated draft summary for human review only. It restates the validated plan and proposed action packet and is not a final real-estate or business decision.",
      origin: "ai",
      state: "available",
      modelVersion: result.model,
      promptVersion: PACKET_SUMMARY_PROMPT_VERSION,
      summary: output.summary,
    });
  } catch (error) {
    if (error instanceof PacketSummaryError) return fallbackWithState(plan, action, evidenceExecution, error.code);
    return fallbackWithState(plan, action, evidenceExecution, error instanceof z.ZodError ? "invalid_structure" : "provider_error");
  }
}
