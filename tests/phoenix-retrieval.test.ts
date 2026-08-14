import assert from "node:assert/strict";
import test from "node:test";
import { compileEvaluationPlan, inferPlanningIntent, planEvaluation } from "../lib/planning/index.ts";
import {
  clearLocalEvidenceCache,
  LocalEvidenceRetriever,
  runClinicSiteWorkflow,
} from "../lib/phoenix-retrieval/index.ts";

function executor(request: { query: string; cbsaCode?: string; cbsaName?: string }) {
  return async (input: unknown) => {
    void input;
    return {
    rows: [{ query: request.query, cbsaCode: request.cbsaCode ?? null, cbsaName: request.cbsaName ?? null }],
    qualityWarnings: [],
    };
  };
}

test("local retriever runs the registered clinic evidence bundle and caches exact requests", async () => {
  clearLocalEvidenceCache();
  let calls = 0;
  const retriever = new LocalEvidenceRetriever(async (request) => {
    calls += 1;
    return executor(request)(request);
  });
  const request = {
    cbsaCode: "38060",
    cbsaName: "Phoenix-Mesa-Chandler, AZ",
    snapshotVersion: "test-snapshot-v1",
    year: null,
  };

  const first = await retriever.retrieveClinicSiteEvidence(request);
  const second = await retriever.retrieveClinicSiteEvidence(request);

  assert.equal(first.results.length, 5);
  assert.equal(first.cacheHits, 0);
  assert.equal(second.cacheHits, 5);
  assert.equal(calls, 5);
  assert.ok(first.sourceIds.length > 0);
});

test("clinic workflow returns findings and next research steps without producing a site recommendation", async () => {
  clearLocalEvidenceCache();
  const plan = planEvaluation("Should we investigate Phoenix as a possible Chewy Vet Care clinic market?");
  const workflow = await runClinicSiteWorkflow(plan, new LocalEvidenceRetriever(async (request) => ({
    rows: request.query === "clinic_activity_by_market" ? [] : [{ query: request.query }],
    qualityWarnings: [],
  })));

  assert.equal(plan.capabilityId, "clinic_site_evaluation");
  assert.equal(workflow.status, "research_needed");
  assert.ok(workflow.supportedFindings.some((finding) => /registered evidence/i.test(finding)));
  assert.ok(workflow.missingEvidence.includes("clinic_activity_by_market"));
  assert.ok(workflow.nextResearchSteps.some((step) => /property/i.test(step.title)));
  assert.ok(workflow.contraryEvidence.some((item) => /does not establish demand/i.test(item)));
});

test("unresolved clinic geography blocks retrieval instead of inventing a CBSA", async () => {
  const plan = planEvaluation("Should we investigate Springfield as a possible clinic market?");
  const workflow = await runClinicSiteWorkflow(plan, new LocalEvidenceRetriever(async () => ({ rows: [] })));
  assert.equal(workflow.status, "blocked");
  assert.deepEqual(workflow.evidenceBundles, []);
  assert.ok(workflow.missingEvidence.some((item) => /resolve these clinic markets/i.test(item)));
});

test("state-qualified ambiguous geography resolves to one checked-in CBSA", () => {
  const question = "Should we investigate Springfield, IL as a possible clinic market?";
  const plan = planEvaluation(question);

  assert.equal(plan.geographyResolution.mode, "single");
  assert.equal(plan.geographyResolution.places[0]?.status, "resolved");
  assert.equal(plan.geographyResolution.places[0]?.cbsaCode, "44100");
  assert.deepEqual(plan.geographyResolution.places[0]?.candidates, [
    { cbsaCode: "44100", cbsaName: "Springfield, IL" },
  ]);
});

test("a partially resolved comparison blocks all clinic retrieval", async () => {
  const question = "Should we investigate Phoenix and Springfield as possible clinic markets?";
  const base = inferPlanningIntent(question);
  const plan = compileEvaluationPlan(
    question,
    { ...base, requestedPlaces: [
      { name: "Phoenix", stateHint: "AZ" },
      { name: "Springfield", stateHint: null },
    ] },
  );
  let calls = 0;
  const workflow = await runClinicSiteWorkflow(plan, new LocalEvidenceRetriever(async () => {
    calls += 1;
    return { rows: [{ ok: true }] };
  }));

  assert.equal(plan.geographyResolution.mode, "clarification");
  assert.equal(workflow.status, "blocked");
  assert.deepEqual(workflow.evidenceBundles, []);
  assert.equal(calls, 0);
  assert.ok(workflow.missingEvidence.some((item) => /Springfield/i.test(item)));
  assert.ok(workflow.warnings.some((item) => /compatible CBSA options/i.test(item)));
});

test("multiple resolved clinic markets produce one evidence bundle per market", async () => {
  clearLocalEvidenceCache();
  const plan = planEvaluation("Should we investigate Phoenix and Atlanta as possible clinic markets?");
  const workflow = await runClinicSiteWorkflow(plan, new LocalEvidenceRetriever(async (request) => ({
    rows: [{
      query: request.query,
      cbsaName: "cbsaName" in request ? request.cbsaName : null,
    }],
    qualityWarnings: [],
  })));

  assert.equal(plan.geographyResolution.mode, "compare");
  assert.equal(workflow.status, "complete");
  assert.equal(workflow.evidenceBundles.length, 2);
  assert.equal(workflow.evidenceBundles[0]?.results.length, 5);
  assert.match(workflow.supportedFindings[0] ?? "", /Phoenix-Mesa-Chandler.*Atlanta/i);
  assert.ok(workflow.contraryEvidence.some((item) => /does not establish demand/i.test(item)));
});

test("all-empty evidence is blocked and names every missing registered query", async () => {
  clearLocalEvidenceCache();
  const plan = planEvaluation("Should we investigate Phoenix as a possible Chewy Vet Care clinic market?");
  const workflow = await runClinicSiteWorkflow(plan, new LocalEvidenceRetriever(async () => ({
    rows: [],
    qualityWarnings: [],
  })));

  assert.equal(workflow.status, "blocked");
  assert.equal(workflow.evidenceBundles.length, 1);
  assert.equal(workflow.evidenceBundles[0]?.availableQueryCount, 0);
  assert.deepEqual(workflow.missingEvidence.sort(), [
    "clinic_activity_by_market",
    "clinic_market_evidence",
    "clinic_profile_by_market",
    "market_context_by_cbsa",
    "regional_demand_by_cbsa_year",
  ]);
  assert.ok(workflow.nextResearchSteps.length >= 3);
});

test("retrieval failures become warnings and research needs instead of crashing the workflow", async () => {
  clearLocalEvidenceCache();
  const plan = planEvaluation("Should we investigate Phoenix as a possible Chewy Vet Care clinic market?");
  const workflow = await runClinicSiteWorkflow(plan, new LocalEvidenceRetriever(async (request) => {
    if (request.query === "clinic_activity_by_market") throw new Error("fixture unavailable");
    return { rows: [{ query: request.query }], qualityWarnings: [] };
  }));

  assert.equal(workflow.status, "research_needed");
  assert.ok(workflow.missingEvidence.includes("clinic_activity_by_market"));
  assert.ok(workflow.warnings.some((item) => /fixture unavailable/i.test(item)));
  assert.ok(workflow.supportedFindings.length > 0);
});

test("quality warnings are preserved with the returned evidence", async () => {
  clearLocalEvidenceCache();
  const plan = planEvaluation("Should we investigate Phoenix as a possible Chewy Vet Care clinic market?");
  const workflow = await runClinicSiteWorkflow(plan, new LocalEvidenceRetriever(async (request) => ({
    rows: [{ query: request.query }],
    qualityWarnings: request.query === "clinic_profile_by_market" ? ["fixture is provisional"] : [],
  })));

  assert.equal(workflow.status, "complete");
  assert.ok(workflow.warnings.includes("fixture is provisional"));
  assert.ok(workflow.evidenceBundles[0]?.results.some((result) => result.warnings.includes("fixture is provisional")));
});
