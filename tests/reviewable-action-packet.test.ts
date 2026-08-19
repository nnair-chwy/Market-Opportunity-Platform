import assert from "node:assert/strict";
import test from "node:test";
import {
  actionForInvestigationLead,
  assembleReviewableActionPacket,
  buildInsightActionPlan,
  deterministicFindingsAndProposalSummary,
  deterministicReviewablePacketSummary,
  formatDecisionBriefDocument,
  formatReviewableActionPacketDocument,
  planEvaluation,
  proposedActionFromPlan,
  reviewableActionPacketSchema,
} from "../lib/planning/index.ts";
import {
  answerInvestigationFollowUp,
  reviseMarketInvestigation,
  runConfirmedMarketInvestigation,
  runMarketInvestigation,
} from "../lib/planning/market-investigation.ts";
import { buildAnalysisBrief } from "../lib/planning/analysis-brief.ts";
import { buildEvidencePlan, generateEvaluationDefinitionDraft } from "../lib/planning/evidence-plan.ts";
import { explainFindingsAndProposal, explainReviewablePacket, packetSummaryInstructions } from "../lib/planning/packet-ai-summary.ts";
import { DEMO_QUESTIONS, planConfiguredDemoQuestion } from "../lib/demo/scenarios.ts";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";

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

test("existing packet format preserves executed evidence metadata and human-review boundaries", async () => {
  const plan = planConfiguredDemoQuestion(DEMO_QUESTIONS.clinicPerformance);
  assert.ok(plan);
  const execution = await executeEvaluationPlanEvidence({ requestId: "packet-clinic-demo", plan });
  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-17T00:00:00.000Z",
    undefined,
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    null,
    undefined,
    execution,
  );
  reviewableActionPacketSchema.parse(packet);
  assert.equal(packet.packetVersion, "reviewable-action-packet-v2");
  assert.equal(packet.packetAnswer.state, "partial");
  assert.equal(packet.packetAnswer.facts.length, 3);
  assert.ok(packet.packetAnswer.facts.every((fact) => fact.sourceId === "SRC-002" && fact.evidenceStatus === "Hypothesis"));
  assert.equal(packet.evidenceExecution?.executionMode, "synthetic_demo");
  assert.deepEqual(packet.calculationVersions.evidenceSourceIds, ["SRC-002"]);
  assert.ok(packet.calculationVersions.evidenceSnapshotIds.includes("synthetic-clinic-performance-v1"));
  assert.equal(packet.calculationVersions.evidenceCalculationVersion, "synthetic-clinic-rank-v1");
  assert.ok(packet.evidenceExecution?.evidenceBundle.every((item) => item.evidenceStatus === "Hypothesis"));
  assert.ok(packet.missingApprovals.includes("Production peer-group approval"));
  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Executed evidence bundle/);
  assert.match(document, /Evidence-backed answer/);
  assert.match(document, /Source-backed facts/);
  assert.match(document, /Source ID: SRC-002/);
  assert.match(document, /Snapshot ID: synthetic-clinic-performance-v1/);
  assert.match(document, /Evidence status: Hypothesis/);
  assert.match(document, /Quality status:/);
  assert.match(document, /synthetic demo/);
  assert.doesNotMatch(document, /approved for execution|final site recommendation|spend authorized/i);
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
  assert.match(document, /average CPC.*cost per attributed conversion.*weaker attributed conversion response/is);
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
  assert.match(summary.summary, /no registered evidence execution was supplied/i);
  assert.match(summary.summary, new RegExp(action.owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(summary.summary, new RegExp(action.nextStep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(summary.summary, /Missing evidence|human review|does not approve/i);
});

test("packet summary is grounded in executed facts before optional AI wording", async () => {
  const plan = planConfiguredDemoQuestion(DEMO_QUESTIONS.clinicPerformance);
  assert.ok(plan);
  const action = proposedActionFromPlan(plan);
  const execution = await executeEvaluationPlanEvidence({ requestId: "summary-grounding", plan });
  const fallback = deterministicFindingsAndProposalSummary(plan, action, execution);
  assert.match(fallback.summary, /Completed appointments/i);
  assert.match(fallback.summary, /SRC-002/);
  assert.match(fallback.summary, /812/);

  const ai = await explainFindingsAndProposal(plan, action, execution, async (packet) => {
    assert.equal(packet.packetAnswer.facts.some((fact) => fact.rawValue === 812), true);
    return {
      output: { summary: `The synthetic packet reports 812 completed appointments for Synthetic South Clinic. ${action.owner} should confirm the synthetic selection and review the result as a draft for human review.` },
      model: "test-model",
    };
  });
  assert.equal(ai.origin, "ai");
  assert.match(ai.summary, /812 completed appointments/i);
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
  assert.match(summary.summary, /select a measure and market|Explore governed market context|Inspect the resolved market context|Compare resolved markets/i);
});

test("partial exploratory packet tells the summarizer that findings exist even when material action is unsupported", () => {
  const plan = planEvaluation("Which regions have unusually high or low paid-search click-through response?", "marketing", [], "paid_search_ctr");
  const investigation = runMarketInvestigation(plan);
  const action = actionForInvestigationLead(proposedActionFromPlan(plan), investigation, investigation.leads[0]);
  const packet = assembleReviewableActionPacket(plan, action, "2026-08-19T00:00:00.000Z", investigation);

  assert.equal(investigation.leads.length, 5);
  assert.equal(packet.packetAnswer.state, "partial");
  assert.match(packet.packetAnswer.directAnswer, /descriptive answer is available.*5 source-linked findings/i);
  assert.doesNotMatch(packet.packetAnswer.directAnswer, /does not claim an analytical answer/i);
  assert.match(packetSummaryInstructions(packet), /Lead with the best available findings/i);
  assert.match(packetSummaryInstructions(packet), /descriptive answer is available.*material action is not yet supported/i);
  const immediateSummary = deterministicReviewablePacketSummary(packet);
  assert.match(immediateSummary.summary, /A descriptive answer is available: 5 source-linked findings/i);
  assert.doesNotMatch(immediateSummary.summary, /no validated answer|evaluation.*blocked/i);
});

test("AI summary rejecting supported findings falls back to findings-first descriptive answer", async () => {
  const plan = planEvaluation("Which regions have unusually high or low paid-search click-through response?", "marketing", [], "paid_search_ctr");
  const investigation = runMarketInvestigation(plan);
  const action = actionForInvestigationLead(proposedActionFromPlan(plan), investigation, investigation.leads[0]);
  const packet = assembleReviewableActionPacket(plan, action, "2026-08-19T00:00:00.000Z", investigation);
  const summary = await explainReviewablePacket(packet, async () => ({
    output: { summary: `There is no validated answer and the evaluation remains blocked. ${action.owner} should collect more evidence. This is draft-only for human review.` },
    model: "contradictory-test-model",
  }));

  assert.equal(summary.origin, "deterministic_fallback");
  assert.equal(summary.state, "validation_rejected");
  assert.match(summary.summary, /A descriptive answer is available: 5 source-linked findings/i);
  assert.match(summary.summary, new RegExp(investigation.leads[0]!.title.split(":")[0]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(summary.summary, /do not support or authorize a material business action/i);
  assert.doesNotMatch(summary.summary, /no validated answer|evaluation remains blocked/i);
});

test("valid exploratory AI summary leads with findings and separates answer availability from action readiness", async () => {
  const plan = planEvaluation("Which regions have unusually high or low paid-search click-through response?", "marketing", [], "paid_search_ctr");
  const investigation = runMarketInvestigation(plan);
  const action = actionForInvestigationLead(proposedActionFromPlan(plan), investigation, investigation.leads[0]);
  const packet = assembleReviewableActionPacket(plan, action, "2026-08-19T00:00:00.000Z", investigation);
  const market = investigation.leads[0]!.title.split(":")[0]!;
  const summary = await explainReviewablePacket(packet, async () => ({
    output: { summary: `The descriptive answer identifies ${market} as a source-linked paid-search response signal. These findings do not support or authorize a live spend change. ${action.owner} should ${action.nextStep} This remains draft-only for human review.` },
    model: "valid-test-model",
  }));

  assert.equal(summary.origin, "ai");
  assert.equal(summary.state, "available");
  assert.match(summary.summary, new RegExp(market.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
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

test("reviewable packet accepts and exports a refreshed analyst recommendation", () => {
  const plan = planEvaluation("Where should we spend more on ads?", "marketing");
  const investigation = runMarketInvestigation(plan);
  const revised = reviseMarketInvestigation(investigation, "Consider YouTube", 2);
  const packet = assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-19T20:46:00.000Z",
    revised,
  );
  const document = formatReviewableActionPacketDocument(packet);
  const decisionBrief = formatDecisionBriefDocument(packet);

  assert.equal(packet.analysisAppendix?.analystRevision?.draftNumber, 2);
  assert.match(packet.analysisAppendix?.analystRevision?.evidenceRequest ?? "", /YouTube regional spend/i);
  assert.match(packet.analysisAppendix?.analystRevision?.recommendationUpdate ?? "", /channel-specific/i);
  assert.match(document, /Revision summary:.*YouTube was added/is);
  assert.match(document, /Updated recommendation:.*channel-specific/is);
  assert.match(document, /New evidence request:.*YouTube regional spend/is);
  assert.match(decisionBrief, /What changed:.*YouTube was added/is);
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
  assert.match(document, /Capacity and access/);
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
  assert.doesNotMatch(document, /Confirmed formula:/);
  assert.match(document, /Capacity and access/);
  assert.doesNotMatch(document, /Which 3[–-]5 U\.S\. metro areas|rank the top/i);
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
  assert.match(document, /## Decision at a glance/);
  assert.match(document, /### Proposed action/);
  assert.match(document, /10-business-day demand-and-capacity gate review/i);
  assert.match(document, /What this should prove/);
  assert.match(document, /Expected result/);
  assert.match(document, /How the expected result is calculated/);
  assert.match(document, /Inputs still required/);
  assert.match(document, /Success rule/);
  assert.match(document, /Stop or rollback/);
  assert.match(document, /## Evidence to connect before scaling/);
  assert.doesNotMatch(document, /Virginia Beach|Charleston-North Charleston/);
  assert.match(document, /## Execution owner and immediate deliverable/);
  assert.match(document, /See the audit appendix/);
  assert.doesNotMatch(document, /## Final-answer contract/);
  assert.doesNotMatch(document, /## Structured packet \(JSON\)/);
  assert.ok(document.length < formatReviewableActionPacketDocument(packet).length / 2);
});
