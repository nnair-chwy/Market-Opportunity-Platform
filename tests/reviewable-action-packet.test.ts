import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleReviewableActionPacket,
  deterministicFindingsAndProposalSummary,
  formatReviewableActionPacketDocument,
  planEvaluation,
  proposedActionFromPlan,
  reviewableActionPacketSchema,
} from "../lib/planning/index.ts";
import { explainFindingsAndProposal } from "../lib/planning/packet-ai-summary.ts";

test("reviewable action packet preserves action fields and provenance for download", () => {
  const plan = planEvaluation("Compare Austin and Denver by population density.");
  const action = proposedActionFromPlan(plan);
  const packet = assembleReviewableActionPacket(plan, action, "2026-08-12T19:00:00.000Z");
  reviewableActionPacketSchema.parse(packet);
  assert.equal(packet.packetKind, "draft_action_packet");
  assert.equal(packet.status, "draft_for_review");
  assert.equal(packet.action.title, action.title);
  assert.equal(packet.action.owner, action.owner);
  assert.equal(packet.originalQuestion, plan.originalQuestion);
  assert.deepEqual(packet.geographicFocus.selectedCbsaCodes, ["12420", "19740"]);
  assert.match(packet.evidenceBoundary, /does not rank business opportunity/i);
  assert.match(packet.reviewDisclaimer, /does not approve/i);
  assert.match(packet.reviewDisclaimer, /was not sent by email, Slack/i);

  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Draft action packet \(reviewable\)/);
  assert.match(document, /does not approve/);
  assert.match(document, /was not sent by email, Slack/);
  assert.match(document, /Original question/);
  assert.match(document, /Geographic focus/);
  assert.match(document, /Evidence boundary/);
  assert.match(document, /Missing evidence/);
  assert.match(document, /Missing approvals/);
  assert.match(document, /Calculation and evidence versions/);
  assert.match(document, new RegExp(action.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(document, new RegExp(action.nextStep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(document, /approved for execution|message sent/i);
});

test("deterministic findings summary covers the four required review points", () => {
  const plan = planEvaluation("Why are operating clinics underperforming their peers?");
  const action = proposedActionFromPlan(plan);
  const summary = deterministicFindingsAndProposalSummary(plan, action);
  assert.equal(summary.title, "Findings and proposed action");
  assert.equal(summary.origin, "deterministic_fallback");
  assert.match(summary.draftOnlyNotice, /draft only|human review/i);
  assert.match(summary.evidenceIndicates, /interprets the question/i);
  assert.match(summary.whyActionRelevant, new RegExp(action.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(summary.ownerNextStep, new RegExp(action.owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(summary.ownerNextStep, new RegExp(action.nextStep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(summary.remainsUnknown, /Missing evidence|human review|does not approve/i);
});

test("packet AI summary falls back when the model is unavailable", async () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  const summary = await explainFindingsAndProposal(plan, proposedActionFromPlan(plan), async () => {
    throw new Error("provider down");
  });
  assert.equal(summary.origin, "deterministic_fallback");
  assert.equal(summary.state, "provider_error");
  assert.match(summary.whyActionRelevant, /Explore governed market context|Inspect the resolved market context|Compare resolved markets/i);
});
