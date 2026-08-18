import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { planEvaluation } from "../lib/planning/index.ts";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";
import { assembleReviewableActionPacket } from "../lib/planning/reviewable-packet.ts";

const snapshotDir = "data/approved/consumer-insights/chewy-brand-health-2024-dma-generation-v1";

test("replays a BDI/CDI question from the snapshot into a source-linked evidence bundle", async (t) => {
  try { await access(`${snapshotDir}/manifest.json`); } catch { t.skip("Local consumer-insights snapshot is not present."); return; }
  const plan = planEvaluation("What are the BDI and CDI for Boston?", "cvc");
  assert.equal(plan.status, "executable");
  const result = await executeEvaluationPlanEvidence({ requestId: "test-consumer-insights-boston", plan }, { consumerInsightsSnapshotDir: snapshotDir });
  assert.equal(result.status, "partial");
  assert.equal(result.capability, "consumer_insights");
  assert.deepEqual(result.componentQueries, ["consumer_insights_by_cbsa"]);
  assert.ok(result.evidenceBundle.some((item) => item.metricId === "consumer.bdi" && item.rawValue === 191));
  assert.ok(result.evidenceBundle.some((item) => item.metricId === "consumer.cdi" && item.rawValue === 87));
  assert.ok(result.evidenceBundle.every((item) => item.sourceId === "SRC-033"));
  assert.match(result.qualityWarnings.join(" "), /DMA-to-CBSA alignment is Derived/i);
  assert.doesNotMatch(result.qualityWarnings.join(" "), /no DMA-to-CBSA join was performed/i);
  assert.equal(result.sensitivity, "internal");
  assert.match(result.guardrails.join(" "), /licensed Nielsen crosswalk/i);
  const packet = assembleReviewableActionPacket(plan, plan.actions[0]!, "2026-08-18T00:00:00.000Z", undefined, [], undefined, undefined, undefined, undefined, undefined, undefined, undefined, result);
  assert.equal(packet.packetAnswer.state, "partial");
  assert.match(packet.packetAnswer.directAnswer, /reported survey observations/i);
  assert.ok(packet.packetAnswer.facts.some((fact) => fact.sourceId === "SRC-033"));
  assert.match(packet.reviewDisclaimer, /draft action packet for human review/i);

  const healthPlan = planEvaluation("Review Chewy brand health, funnel, and Gen Z considerations for Boston.", "cvc");
  const healthResult = await executeEvaluationPlanEvidence({ requestId: "test-consumer-insights-health", plan: healthPlan }, { consumerInsightsSnapshotDir: snapshotDir });
  assert.equal(healthResult.status, "partial");
  assert.ok(healthResult.evidenceBundle.length > 20);
  assert.equal(new Set(healthResult.evidenceBundle.map((item) => item.evidenceId)).size, healthResult.evidenceBundle.length);
  assert.ok(healthResult.evidenceBundle.some((item) => item.metricId.includes("brand_funnel")));
  assert.ok(healthResult.evidenceBundle.some((item) => item.metricId.includes("brand_health")));
});
