import { z } from "zod";

export const DECISION_FRAMING_PROPOSAL_VERSION = "decision-framing-proposal-v1" as const;

const framingTextSchema = z.string().trim().min(1).max(400);

export const modelDecisionFramingProposalSchema = z.object({
  decisionRestatement: z.string().trim().min(1).max(240),
  emphasizedRequirementIds: z.array(z.string().trim().min(1).max(120)).max(8),
  unresolvedQuestions: z.array(framingTextSchema).max(6),
}).strict();

export const decisionFramingProposalSchema = modelDecisionFramingProposalSchema.extend({
  version: z.literal(DECISION_FRAMING_PROPOSAL_VERSION),
  origin: z.enum(["ai_proposed", "deterministic_fallback"]),
  modelVersion: z.string().trim().min(1).nullable(),
}).strict();

export type ModelDecisionFramingProposal = z.infer<typeof modelDecisionFramingProposalSchema>;
export type DecisionFramingProposal = z.infer<typeof decisionFramingProposalSchema>;

export function deterministicDecisionFramingProposal(input: {
  decisionRestatement: string;
  requirementIds: readonly string[];
  unresolvedQuestions: readonly string[];
}): DecisionFramingProposal {
  return decisionFramingProposalSchema.parse({
    version: DECISION_FRAMING_PROPOSAL_VERSION,
    origin: "deterministic_fallback",
    modelVersion: null,
    decisionRestatement: input.decisionRestatement,
    emphasizedRequirementIds: [...input.requirementIds],
    unresolvedQuestions: [...input.unresolvedQuestions].slice(0, 6),
  });
}

export function validateAiDecisionFramingProposal(input: {
  proposal: ModelDecisionFramingProposal;
  modelVersion: string;
  allowedRequirementIds: readonly string[];
  deterministicDecisionRestatement: string;
}): DecisionFramingProposal {
  const proposal = modelDecisionFramingProposalSchema.parse(input.proposal);
  const allowed = new Set(input.allowedRequirementIds);
  const emphasizedRequirementIds = proposal.emphasizedRequirementIds.filter((id) => allowed.has(id));
  return decisionFramingProposalSchema.parse({
    version: DECISION_FRAMING_PROPOSAL_VERSION,
    origin: "ai_proposed",
    modelVersion: input.modelVersion,
    // Preserve the deterministic interpretation as the contract decision. The model
    // restatement remains advisory until a future human-editable framing workflow exists.
    decisionRestatement: input.deterministicDecisionRestatement,
    emphasizedRequirementIds: emphasizedRequirementIds.length
      ? emphasizedRequirementIds
      : [...input.allowedRequirementIds],
    unresolvedQuestions: proposal.unresolvedQuestions,
  });
}
