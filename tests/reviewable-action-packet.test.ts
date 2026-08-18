import assert from "node:assert/strict";
import test from "node:test";
import {
  actionForInvestigationLead,
  assembleReviewableActionPacket,
  buildInsightActionPlan,
  deterministicFindingsAndProposalSummary,
  formatDecisionBriefDocument,
  formatReviewableActionPacketDocument,
  planEvaluation,
  proposedActionFromPlan,
  reviewableActionPacketSchema,
} from "../lib/planning/index.ts";
import { answerInvestigationFollowUp, runConfirmedMarketInvestigation, runMarketInvestigation } from "../lib/planning/market-investigation.ts";
import { buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { buildEvidencePlan, generateEvaluationDefinitionDraft } from "../lib/planning/evidence-plan.ts";
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
  assert.deepEqual(packet.answerContract, plan.answerContract);

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
  assert.match(document, /Final-answer contract/);
  assert.match(document, new RegExp(action.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(document, new RegExp(action.nextStep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(document, /approved for execution|message sent/i);
});

test("selected investigation evidence replaces the generic plan action in the decision brief", () => {
  const plan = planEvaluation("Which region are we paying more than we should for ads?", "marketing");
  const investigation = runMarketInvestigation(plan);
  const lead = investigation.leads[0];
  const action = actionForInvestigationLead(proposedActionFromPlan(plan), investigation, lead);
  const packet = assembleReviewableActionPacket(plan, action, "2026-08-18T12:00:00.000Z", investigation);
  const document = formatDecisionBriefDocument(packet);

  assert.equal(action.title, `Validate ${lead.title}`);
  assert.equal(action.nextStep, lead.nextEvidence);
  assert.match(action.evidence.join(" "), /cost per attributed conversion/i);
  assert.match(document, /higher paid-search cost with weaker attributed conversion efficiency than comparable markets/i);
  assert.match(document, /Portfolio pattern/);
  assert.match(document, /not a time trend/i);
  assert.doesNotMatch(document, /name the decision, geography or cohort, and required output, then resubmit/i);
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

test("deterministic findings summary bounds long unknowns instead of crashing review", () => {
  const plan = planEvaluation("Which region are we paying more than we should for ads?", "marketing", "paid_search_cpc");
  const longPlan = {
    ...plan,
    missingEvidence: Array.from(
      { length: 24 },
      (_, index) => `Evidence requirement ${index + 1} needs an approved owner, definition, geography, timeframe, and source lineage`,
    ),
  };
  const summary = deterministicFindingsAndProposalSummary(longPlan, proposedActionFromPlan(plan));
  assert.ok(summary.remainsUnknown.length <= 600);
  assert.match(summary.remainsUnknown, /Missing evidence/i);
  assert.match(summary.remainsUnknown, /…$/);
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

test("reviewable packet carries the exact analyst screening and lead follow-up", () => {
  const plan = planEvaluation("Which comparable markets differ most in CVC footprint—and why?", "cvc");
  const investigation = runMarketInvestigation(plan);
  const lead = investigation.leads[0];
  const followUps = [{
    id: "follow-up-1",
    leadId: lead.id,
    question: "What should I validate next?",
    answer: answerInvestigationFollowUp(lead, "What should I validate next?"),
  }];
  const packet = assembleReviewableActionPacket(plan, proposedActionFromPlan(plan), "2026-08-12T19:00:00.000Z", investigation, followUps);
  assert.equal(packet.analysisAppendix?.originalQuestion, plan.originalQuestion);
  assert.equal(packet.analysisAppendix?.leads.length, 6);
  assert.equal(packet.analysisAppendix?.followUps[0].question, followUps[0].question);
  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Analyst screening/);
  assert.match(document, /Question-specific leads/);
  assert.match(document, /Lead-scoped follow-ups/);
});

test("reviewable packet exports the human-confirmed question and considerations", () => {
  const plan = planEvaluation("Which comparable markets differ most in CVC footprint?", "cvc");
  const investigation = runMarketInvestigation(plan);
  const brief = { ...buildAnalysisBrief(plan, investigation), status: "confirmed" as const, confirmedAt: "2026-08-13T12:00:00.000Z" };
  const packet = assembleReviewableActionPacket(plan, proposedActionFromPlan(plan), "2026-08-13T12:01:00.000Z", investigation, [], brief);
  const document = formatReviewableActionPacketDocument(packet);
  assert.equal(packet.analysisBrief?.status, "confirmed");
  assert.match(document, /Confirmed analysis framing/);
  assert.match(document, /Rewritten question/);
  assert.match(document, /Demand and capacity/);
  assert.doesNotMatch(document, /weighted preference/);
  assert.match(document, /Human consideration edits recalculate this screen: no/);
});

test("reviewable packet exports evidence readiness and the generated execution plan", () => {
  const plan = planEvaluation("Which comparable markets could support a valid marketing test?", "marketing");
  const investigation = runMarketInvestigation(plan);
  const brief = buildAnalysisBrief(plan, investigation);
  const evidencePlan = buildEvidencePlan(plan);
  const definition = generateEvaluationDefinitionDraft(brief, investigation, evidencePlan);
  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-13T20:00:00.000Z",
    investigation,
    [],
    brief,
    evidencePlan,
    definition,
  );
  assert.equal(packet.evidencePlan?.items.find((item) => item.id === "media_exposure")?.availability, "partial");
  assert.equal(packet.evaluationDefinition?.status, "partially_executable");
  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Evidence readiness and generated execution plan/);
  assert.match(document, /Staged for validation \(not used\)/);
  assert.match(document, /Media delivery, cost, and campaign history/);
});

test("reviewable packet preserves the selected lead and map measure", () => {
  const plan = planEvaluation("Which comparable markets differ most in CVC footprint?", "cvc");
  const investigation = runMarketInvestigation(plan);
  const selectedLead = investigation.leads[1];
  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-13T21:00:00.000Z",
    investigation,
    [],
    undefined,
    undefined,
    undefined,
    { selectedLeadId: selectedLead.id, contextMetric: "population_density" },
  );
  assert.equal(packet.reviewContext?.selectedLeadId, selectedLead.id);
  assert.equal(packet.reviewContext?.contextMetric, "population_density");
  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Saved review context/);
  assert.match(document, new RegExp(selectedLead.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(document, /Map context measure: population density/);
});

test("download report contains connected evidence, limitations, and an actionable handoff", () => {
  const plan = planEvaluation("Where should we open the next CVC clinic?", "cvc");
  const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const brief = { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-13T22:00:00.000Z" };
  const investigation = runConfirmedMarketInvestigation(plan, brief);
  const actionPlan = buildInsightActionPlan(plan, investigation, investigation.leads[0], brief, brief.confirmedAt);
  assert.ok(actionPlan);
  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-13T22:01:00.000Z",
    investigation,
    [],
    brief,
    undefined,
    undefined,
    { selectedLeadId: investigation.leads[0].id, contextMetric: "household_count" },
    actionPlan,
  );
  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Analyst screening/);
  assert.match(document, /Confirmed formula: Current CVC footprint 15%/);
  assert.match(document, /Demand and capacity 35%/);
  assert.match(document, /published CVC clinic/i);
  assert.match(document, /public market context/i);
  assert.doesNotMatch(document, /synthetic/i);
  assert.match(document, /Decision handoff/);
  assert.match(document, /Do this next/);
  assert.match(document, /Consumer Insights Health \+ CVC Strategy/);
  assert.match(document, /Validation workplan/);
  assert.match(document, /Advance:/);
  assert.match(document, /Hold:/);
  assert.match(document, /Stop:/);
  assert.match(document, /Done when:/);
});

test("decision brief leads with the answer and leaves audit mechanics in the appendix", () => {
  const plan = planEvaluation("Where should we open the next CVC clinic?", "cvc");
  const proposed = buildAnalysisBrief(plan, runMarketInvestigation(plan));
  const brief = { ...proposed, status: "confirmed" as const, confirmedAt: "2026-08-17T18:00:00.000Z" };
  const investigation = runConfirmedMarketInvestigation(plan, brief);
  const actionPlan = buildInsightActionPlan(plan, investigation, investigation.leads[0], brief, brief.confirmedAt);
  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-17T18:01:00.000Z",
    investigation,
    [],
    brief,
    undefined,
    undefined,
    { selectedLeadId: investigation.leads[0].id, contextMetric: "household_count" },
    actionPlan,
  );
  const document = formatDecisionBriefDocument(packet);
  assert.match(document, /^# Decision brief:/);
  assert.match(document, /## Recommendation/);
  assert.match(document, /## What the evidence supports/);
  assert.match(document, /## Screening signals—not final findings/);
  assert.match(document, /## What is still unknown/);
  assert.match(document, /## Checks that could change the conclusion/);
  assert.match(document, /## Recommended next action/);
  assert.match(document, /audit appendix contains/);
  assert.doesNotMatch(document, /## Final-answer contract/);
  assert.doesNotMatch(document, /## Structured packet \(JSON\)/);
  assert.ok(document.length < formatReviewableActionPacketDocument(packet).length / 2);
});
