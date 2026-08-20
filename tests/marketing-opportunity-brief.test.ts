import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketingOpportunityBrief, runCurrentDataInsightDiscovery } from "../lib/insight-discovery/index.ts";

test("Costa brief shares broad Marketing opportunities rather than a PetSmart or Petco project handoff", () => {
  const run = runCurrentDataInsightDiscovery({ runId: "marketing-brief:test", now: () => "2026-08-20T12:00:00.000Z" });
  const brief = buildMarketingOpportunityBrief(run);
  const text = JSON.stringify(brief);

  assert.match(brief.title, /regional Marketing opportunities/i);
  assert.match(brief.recommendation, /Louisville/i);
  assert.match(brief.recommendation, /Lubbock/i);
  assert.match(brief.recommendation, /Wilkes-Barre/i);
  assert.match(brief.recommendation, /Denver|Fort Lauderdale/i);
  assert.match(text, /32\.8% and 20\.4% lower/i);
  assert.match(text, /97\.7% above/i);
  assert.match(text, /5×/i);
  assert.match(text, /incremental new customers/i);
  assert.doesNotMatch(text, /PetSmart|Petco/i);
});

test("Marketing opportunity brief separates protect, split, scale, and stop decisions", () => {
  const brief = buildMarketingOpportunityBrief();
  assert.match(brief.decisionRules.protect, /Protect/i);
  assert.match(brief.decisionRules.split, /Split/i);
  assert.match(brief.decisionRules.scale, /Scale/i);
  assert.match(brief.decisionRules.stop, /Stop|reverse/i);
  assert.equal(brief.opportunityMoves.length, 4);
});
