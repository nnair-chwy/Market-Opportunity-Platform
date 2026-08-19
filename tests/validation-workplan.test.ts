import assert from "node:assert/strict";
import test from "node:test";
import { assembleReviewableActionPacket, buildValidationWorkplan, formatDecisionBriefDocument, formatReviewableActionPacketDocument, planEvaluation, proposedActionFromPlan, validationWorkplanSchema } from "../lib/planning/index.ts";

test("Phoenix clinic questions produce a validation workplan without an advancement recommendation", () => {
  const plan = planEvaluation("What should we validate before considering a Phoenix clinic market for site screening?", "cvc");
  const workplan = buildValidationWorkplan(plan);
  validationWorkplanSchema.parse(workplan);

  assert.equal(plan.capabilityId, "clinic_site_evaluation");
  assert.match(workplan.title, /Phoenix/i);
  assert.match(workplan.proposedAction, /do not recommend advancement/i);
  assert.ok(workplan.workstreams.some((item) => /demand/i.test(item.title)));
  assert.ok(workplan.workstreams.some((item) => /capacity|competitive/i.test(item.title)));
  assert.ok(workplan.workstreams.some((item) => /property/i.test(item.title)));
  assert.ok(workplan.evidence.some((item) => item.status === "synthetic_placeholder" || item.status === "unknown" || item.status === "missing"));
  assert.ok(workplan.limitations.some((item) => /does not select a market, site/i.test(item)));
});

test("broader market context questions also produce explicit validation steps", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  const workplan = buildValidationWorkplan(plan);
  validationWorkplanSchema.parse(workplan);

  assert.match(workplan.title, /validation workplan/i);
  assert.ok(workplan.workstreams.length >= 3);
  assert.ok(workplan.evidence.every((item) => item.expectedGrain.length > 0));
  assert.ok(workplan.workstreams.every((item) => item.evidenceIds.length > 0));
  assert.ok(workplan.workstreams.every((item) => item.kpi && item.validationThreshold && item.stopCondition));
});

test("the three golden-question perspectives have measurable, bounded investigative actions", () => {
  const questions = [
    ["Where is paid search response concentrated, and which regions need validation?", "marketing"],
    ["Where do competitor price signals warrant validation?", "pricing"],
    ["Where should we investigate CVC footprint opportunities?", "cvc"],
  ] as const;

  for (const [question, perspective] of questions) {
    const plan = planEvaluation(question, perspective);
    const action = proposedActionFromPlan(plan);
    const workplan = buildValidationWorkplan(plan);

    assert.ok(action.kpi, `${perspective} action should name its KPI`);
    assert.ok(action.validationThreshold, `${perspective} action should name its validation threshold`);
    assert.ok(action.stopCondition, `${perspective} action should name its stop condition`);
    assert.match(action.stopCondition, /stop|before/i);
    assert.ok(workplan.workstreams.every((item) => item.kpi && item.validationThreshold && item.stopCondition));
    assert.ok(workplan.decisionRules.some((item) => item.disposition === "stop"));
  }
});

test("validation-workplan schema still accepts packets saved before measurement fields were added", () => {
  const plan = planEvaluation("Which U.S. markets have the highest population density?");
  const current = buildValidationWorkplan(plan);
  const legacy = {
    ...current,
    workstreams: current.workstreams.map((workstream) => {
      const item = { ...workstream } as Partial<typeof workstream>;
      delete item.kpi;
      delete item.validationThreshold;
      delete item.stopCondition;
      return item;
    }),
  };
  assert.doesNotThrow(() => validationWorkplanSchema.parse(legacy));
});

test("validation workplan is included in the reviewable packet and download", () => {
  const plan = planEvaluation("What should we validate before considering a Phoenix clinic market for site screening?", "cvc");
  const workplan = buildValidationWorkplan(plan);
  const packet = assembleReviewableActionPacket(plan, proposedActionFromPlan(plan), "2026-08-17T12:00:00.000Z", undefined, [], undefined, undefined, undefined, undefined, undefined, null, workplan);
  assert.deepEqual(packet.validationWorkplan, workplan);
  const document = formatReviewableActionPacketDocument(packet);
  assert.match(document, /Market-validation workplan/);
  assert.match(document, /pet_demand|Pet and customer demand/);
  assert.match(document, /do not recommend advancement/i);
  assert.match(document, /KPI:/);
  assert.match(document, /Validation threshold:/);
  assert.match(document, /Stop condition:/);
  const brief = formatDecisionBriefDocument(packet);
  assert.match(brief, /\*\*KPI:\*\*/);
  assert.match(brief, /\*\*Validation threshold:\*\*/);
  assert.match(brief, /\*\*Stop condition:\*\*/);
});
