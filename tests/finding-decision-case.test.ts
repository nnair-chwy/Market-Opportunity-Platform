import assert from "node:assert/strict";
import test from "node:test";
import { runCurrentDataInsightDiscovery } from "../lib/insight-discovery/current-data-discovery.ts";
import { buildFindingDecisionCase } from "../lib/insight-discovery/decision-case.ts";

const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T00:00:00.000Z", runId: "decision-case-test" });

test("Austin becomes an explicit observed-rate scenario with calculation and decision rules", () => {
  const finding = run.findings.find((candidate) => candidate.department === "cvc" && candidate.marketName === "Austin");
  assert.ok(finding);
  const decisionCase = buildFindingDecisionCase(finding!);
  assert.equal(decisionCase.status, "observed_outcome_scenario");
  assert.match(decisionCase.scenario.summary, /each \$1,000.*0\.8 completed appointments.*\$165 net sales.*0\.7.*new-to-Chewy/i);
  assert.match(decisionCase.scenario.range ?? "", /0\.6.*0\.9.*\$132.*\$198/i);
  assert.match(decisionCase.calculation.join(" "), /0\.8 completed appointments.*\$165 net sales per \$1,000.*No larger test budget is assumed/i);
  assert.match(decisionCase.proposedAction, /minimum detectable lift.*approved risk limit/i);
  assert.match(decisionCase.whyValidationMatters.join(" "), /staffed and schedulable capacity/i);
  assert.match(decisionCase.successRule, /incremental contribution exceeds media plus staffing cost/i);
});

test("McAllen exposes a proxy scenario without calling it incremental value", () => {
  const finding = run.findings.find((candidate) => candidate.department === "marketing" && candidate.marketName === "McAllen-Edinburg-Mission, TX");
  assert.ok(finding);
  const decisionCase = buildFindingDecisionCase(finding!);
  assert.equal(decisionCase.status, "quantified_proxy_scenario");
  assert.match(decisionCase.scenario.summary, /each \$1,000.*259 platform-attributed conversions/i);
  assert.match(decisionCase.calculation.join(" "), /No larger test budget is assumed/i);
  assert.doesNotMatch(decisionCase.proposedAction, /\$10,000/);
  assert.equal(decisionCase.scenario.isIncrementalForecast, false);
  assert.match(decisionCase.scenario.basis, /not a statistical confidence interval/i);
  assert.match(decisionCase.couldReverseRecommendation.join(" "), /No incremental new-customer lift/i);
});

test("pricing coverage defects are explicit data issues rather than value opportunities", () => {
  const finding = run.findings.find((candidate) => candidate.department === "pricing" && candidate.decisionValue.flags.includes("coverage_risk"));
  assert.ok(finding);
  const decisionCase = buildFindingDecisionCase(finding!);
  assert.equal(decisionCase.status, "data_issue");
  assert.match(decisionCase.scenario.summary, /insufficient to estimate a market opportunity/i);
  assert.match(decisionCase.proposedAction, /Do not use this record for a price decision/i);
});

test("an unsized CVC market names the exact outcome connection needed", () => {
  const finding = run.findings.find((candidate) => candidate.department === "cvc" && candidate.marketName === "Phoenix-Mesa-Chandler, AZ");
  assert.ok(finding);
  const decisionCase = buildFindingDecisionCase(finding!);
  assert.equal(decisionCase.status, "inputs_required");
  assert.match(decisionCase.scenario.basis, /appointment, sales, and capacity values are not attached/i);
});
