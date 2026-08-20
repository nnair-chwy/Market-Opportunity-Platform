import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCrossSourceRegionalOpportunity,
  runIterativeCrossSourceDiscovery,
  type CrossSourceHypothesisDefinition,
  type RegionalOpportunityEvidence,
} from "../lib/insight-discovery/index.ts";

const marketing: CrossSourceHypothesisDefinition = {
  hypothesisId: "marketing-regional-growth",
  department: "marketing",
  title: "Regional growth evidence in {region}",
  decisionQuestionTemplate: "Should {region} receive a bounded paid-media intervention?",
  hypothesisTemplate: "{region} may support incremental customer growth under a controlled media intervention.",
  businessOutcome: "incremental orders, new customers, and contribution",
  receivingTeamId: "growth_marketing",
  materialLever: "paid_media",
  minimumSourceFamilies: 2,
};

function evidence(overrides: Partial<RegionalOpportunityEvidence> & Pick<RegionalOpportunityEvidence, "evidenceId" | "sourceId" | "sourceFamily" | "role">): RegionalOpportunityEvidence {
  return {
    evidenceId: overrides.evidenceId,
    hypothesisId: overrides.hypothesisId ?? marketing.hypothesisId,
    regionId: overrides.regionId ?? "dma:524",
    regionName: overrides.regionName ?? "Atlanta DMA",
    sourceId: overrides.sourceId,
    sourceFamily: overrides.sourceFamily,
    metricId: overrides.metricId ?? overrides.role,
    role: overrides.role,
    stance: overrides.stance ?? "supports",
    statement: overrides.statement ?? `${overrides.role} supports the bounded regional hypothesis.`,
    qualityStatus: overrides.qualityStatus ?? "accepted",
    compatibilityStatus: overrides.compatibilityStatus ?? "compatible",
    observationStart: overrides.observationStart ?? "2026-08-03",
    observationEnd: overrides.observationEnd ?? "2026-08-09",
    value: overrides.value ?? 1,
    unit: overrides.unit ?? "count",
    authorizationScope: overrides.authorizationScope ?? null,
  };
}

test("act-now requires cross-source outcome, guardrail, causal, and action authorization evidence", () => {
  const result = buildCrossSourceRegionalOpportunity({
    definition: marketing,
    regionId: "dma:524",
    regionName: "Atlanta DMA",
    evidence: [
      evidence({ evidenceId: "signal", sourceId: "ADS", sourceFamily: "marketing", role: "signal" }),
      evidence({ evidenceId: "outcome", sourceId: "ORDERS", sourceFamily: "commerce", role: "business_outcome" }),
      evidence({ evidenceId: "guardrail", sourceId: "SCIENCE", sourceFamily: "measurement", role: "guardrail" }),
      evidence({ evidenceId: "causal", sourceId: "SCIENCE", sourceFamily: "measurement", role: "causal_validity" }),
      evidence({ evidenceId: "approval", sourceId: "GROWTH", sourceFamily: "governance", role: "approval", authorizationScope: "action" }),
    ],
  });
  assert.equal(result.recommendation.type, "act_now");
  assert.equal(result.confidence, "high");
  assert.equal(result.missingEvidence.length, 0);
  assert.match(result.recommendation.executionBoundary, /does not execute/i);
});

test("test authorization produces controlled-test rather than unrestricted action", () => {
  const result = buildCrossSourceRegionalOpportunity({
    definition: marketing,
    regionId: "dma:524",
    regionName: "Atlanta DMA",
    evidence: [
      evidence({ evidenceId: "signal", sourceId: "ADS", sourceFamily: "marketing", role: "signal" }),
      evidence({ evidenceId: "outcome", sourceId: "ORDERS", sourceFamily: "commerce", role: "business_outcome" }),
      evidence({ evidenceId: "guardrail", sourceId: "SCIENCE", sourceFamily: "measurement", role: "guardrail" }),
      evidence({ evidenceId: "approval", sourceId: "GROWTH", sourceFamily: "governance", role: "approval", authorizationScope: "test" }),
    ],
  });
  assert.equal(result.recommendation.type, "controlled_test");
  assert.ok(result.missingEvidence.some((item) => /causal/i.test(item)));
  assert.match(result.recommendation.executionBoundary, /approved reversible test/i);
});

test("weak signals monitor, cross-source incomplete signals investigate, and rejected-only evidence becomes data quality", () => {
  const monitored = buildCrossSourceRegionalOpportunity({ definition: marketing, regionId: "dma:524", regionName: "Atlanta DMA", evidence: [evidence({ evidenceId: "one", sourceId: "ADS", sourceFamily: "marketing", role: "signal" })] });
  assert.equal(monitored.recommendation.type, "monitor");
  const investigated = buildCrossSourceRegionalOpportunity({ definition: marketing, regionId: "dma:524", regionName: "Atlanta DMA", evidence: [
    evidence({ evidenceId: "one", sourceId: "ADS", sourceFamily: "marketing", role: "signal" }),
    evidence({ evidenceId: "two", sourceId: "CONTEXT", sourceFamily: "census", role: "context", stance: "supports" }),
  ] });
  assert.equal(investigated.recommendation.type, "investigate");
  const quality = buildCrossSourceRegionalOpportunity({ definition: marketing, regionId: "dma:524", regionName: "Atlanta DMA", evidence: [
    evidence({ evidenceId: "bad", sourceId: "ADS", sourceFamily: "marketing", role: "data_quality", qualityStatus: "rejected" }),
  ] });
  assert.equal(quality.recommendation.type, "data_quality");
  assert.equal(quality.evidence.excluded.length, 1);
});

test("contrary evidence is retained and prevents an act-now classification", () => {
  const items = [
    evidence({ evidenceId: "signal", sourceId: "ADS", sourceFamily: "marketing", role: "signal" }),
    evidence({ evidenceId: "outcome", sourceId: "ORDERS", sourceFamily: "commerce", role: "business_outcome" }),
    evidence({ evidenceId: "guardrail", sourceId: "SCIENCE", sourceFamily: "measurement", role: "guardrail" }),
    evidence({ evidenceId: "causal", sourceId: "SCIENCE", sourceFamily: "measurement", role: "causal_validity" }),
    evidence({ evidenceId: "approval", sourceId: "GROWTH", sourceFamily: "governance", role: "approval", authorizationScope: "action" }),
    evidence({ evidenceId: "contrary", sourceId: "FINANCE", sourceFamily: "finance", role: "business_outcome", stance: "contradicts", statement: "Contribution moved against the proposed direction." }),
  ];
  const result = buildCrossSourceRegionalOpportunity({ definition: marketing, regionId: "dma:524", regionName: "Atlanta DMA", evidence: items });
  assert.equal(result.recommendation.type, "controlled_test");
  assert.equal(result.evidence.contrary.length, 1);
  assert.ok(result.missingEvidence.some((item) => /contrary/i.test(item)));
});

test("iterative loop is input-order deterministic and preserves strengthened prior-run context", () => {
  const initialEvidence = [
    evidence({ evidenceId: "signal", sourceId: "ADS", sourceFamily: "marketing", role: "signal" }),
    evidence({ evidenceId: "context", sourceId: "CENSUS", sourceFamily: "census", role: "context", stance: "supports" }),
  ];
  const first = runIterativeCrossSourceDiscovery({ runId: "run-1", generatedAt: "2026-08-20T12:00:00.000Z", definitions: [marketing], evidence: initialEvidence });
  const reordered = runIterativeCrossSourceDiscovery({ runId: "run-1-copy", generatedAt: "2026-08-20T12:00:00.000Z", definitions: [marketing], evidence: [...initialEvidence].reverse() });
  assert.equal(first.inputFingerprint, reordered.inputFingerprint);
  assert.equal(first.opportunities[0]?.opportunityFingerprint, reordered.opportunities[0]?.opportunityFingerprint);
  assert.equal(first.opportunities[0]?.recommendation.type, "investigate");

  const expanded = [...initialEvidence,
    evidence({ evidenceId: "outcome", sourceId: "ORDERS", sourceFamily: "commerce", role: "business_outcome" }),
    evidence({ evidenceId: "guardrail", sourceId: "SCIENCE", sourceFamily: "measurement", role: "guardrail" }),
    evidence({ evidenceId: "approval", sourceId: "GROWTH", sourceFamily: "governance", role: "approval", authorizationScope: "test" }),
  ];
  const second = runIterativeCrossSourceDiscovery({ runId: "run-2", generatedAt: "2026-08-27T12:00:00.000Z", definitions: [marketing], evidence: expanded, previousRun: first });
  assert.equal(second.previousRun?.runId, "run-1");
  assert.equal(second.opportunities[0]?.recommendation.type, "controlled_test");
  assert.equal(second.opportunities[0]?.continuity.status, "strengthened");
  assert.equal(second.opportunities[0]?.continuity.previousRecommendationType, "investigate");
  assert.deepEqual(second.iterations.map((item) => item.stage), ["generate_hypotheses", "challenge_with_evidence", "classify_recommendations"]);
});

