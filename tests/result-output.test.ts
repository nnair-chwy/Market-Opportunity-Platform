import assert from "node:assert/strict";
import test from "node:test";
import { buildPacketDocx } from "../lib/planning/docx-export.ts";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";
import { goldenMarketInvestigationFromEvidence } from "../lib/planning/golden-market-investigation.ts";
import { planEvaluation } from "../lib/planning/planner.ts";
import {
  assembleReviewableActionPacket,
  decisionBriefFilename,
  proposedActionFromPlan,
  reviewableActionPacketFilename,
} from "../lib/planning/reviewable-packet.ts";
import {
  buildResultOutputRows,
  defaultResultOutputColumns,
  formatResultCsv,
  inferPreferredOutputFormat,
} from "../lib/planning/result-output.ts";

async function marketingPacket() {
  const plan = planEvaluation("Give me a CSV showing where we should spend more on ads for each market", "marketing", [], "paid_search_response");
  const evidence = await executeEvaluationPlanEvidence({ requestId: "result-output-test", plan });
  const investigation = goldenMarketInvestigationFromEvidence(plan, evidence);
  assert.ok(investigation);
  return assembleReviewableActionPacket(
    plan,
    proposedActionFromPlan(plan),
    "2026-08-19T12:00:00.000Z",
    investigation,
    [],
    undefined,
    undefined,
    undefined,
    { selectedLeadId: investigation.leads[0]?.id ?? null, contextMetric: "household_count" },
    undefined,
    null,
    undefined,
    evidence,
  );
}

test("infers a market CSV structure and preserves unsupported spend values as visible gaps", async () => {
  const packet = await marketingPacket();
  assert.equal(inferPreferredOutputFormat(packet.originalQuestion), "csv_market_table");
  const columns = defaultResultOutputColumns(packet);
  assert.deepEqual(columns.slice(0, 5), ["market_id", "market_name", "current_spend", "proposed_adjustment_percent", "proposed_spend"]);
  const rows = buildResultOutputRows(packet);
  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => row.market_id && row.market_name));
  assert.ok(rows.every((row) => row.proposed_spend === "" && /approved allocation rule/i.test(row.data_gap)));
  const csv = formatResultCsv(rows, columns);
  assert.match(csv, /^market_id,market_name,current_spend,proposed_adjustment_percent,proposed_spend/);
  assert.match(csv, /Philadelphia/);
  assert.doesNotMatch(csv, /undefined|NaN/);
});

test("decision and audit downloads use genuine Word filenames", async () => {
  const packet = await marketingPacket();
  assert.match(decisionBriefFilename(packet), /\.docx$/);
  assert.match(reviewableActionPacketFilename(packet), /\.docx$/);
  const brief = await buildPacketDocx(packet, "decision_brief");
  const audit = await buildPacketDocx(packet, "audit_appendix");
  assert.deepEqual([...brief.slice(0, 2)], [0x50, 0x4b]);
  assert.deepEqual([...audit.slice(0, 2)], [0x50, 0x4b]);
  assert.ok(brief.byteLength > 5_000);
  assert.ok(audit.byteLength > brief.byteLength);
});
