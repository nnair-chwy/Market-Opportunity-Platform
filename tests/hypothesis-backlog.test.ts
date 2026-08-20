import assert from "node:assert/strict";
import test from "node:test";
import { buildCrossSourceHypothesisBacklog, runCurrentDataInsightDiscovery } from "../lib/insight-discovery/index.ts";

test("cross-source backlog creates falsifiable same-market hypotheses", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T12:00:00.000Z" });
  const backlog = buildCrossSourceHypothesisBacklog(run);

  assert.ok(backlog.length >= 2);
  assert.ok(backlog.some((lead) => lead.marketName === "Eagle Pass, TX" && lead.departments.includes("marketing") && lead.departments.includes("pricing")));
  assert.ok(backlog.some((lead) => lead.marketName.includes("Virginia Beach") && lead.departments.includes("cvc") && lead.departments.includes("pricing")));
  for (const lead of backlog) {
    assert.match(lead.whyItEmerged, /new question to test, not proof/i);
    assert.ok(lead.nextTest.length > 80);
    assert.ok(lead.falsificationRule.length > 60);
    assert.ok(lead.requiredInputs.length >= 4);
    assert.ok(lead.sourceIds.length >= 2);
  }
});

test("cross-source backlog is stable for the same evidence", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T12:00:00.000Z" });
  assert.deepEqual(buildCrossSourceHypothesisBacklog(run), buildCrossSourceHypothesisBacklog(run));
});
