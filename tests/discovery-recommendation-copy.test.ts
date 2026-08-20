import assert from "node:assert/strict";
import test from "node:test";
import { runCurrentDataInsightDiscovery } from "../lib/insight-discovery/index.ts";
import { findingPresentation } from "../lib/insight-discovery/finding-presentation.ts";

test("strong Marketing findings name an owner, immediate action, and launch gate", () => {
  const run = runCurrentDataInsightDiscovery({ now: () => "2026-08-20T12:00:00.000Z" });
  const finding = run.findings.find((item) => item.department === "marketing" && /McAllen/i.test(item.marketName));
  assert.ok(finding);
  const recommendation = findingPresentation(finding).analystRecommendation;

  assert.match(recommendation, /^Growth Marketing should build/i);
  assert.match(recommendation, /next planning cycle/i);
  assert.match(recommendation, /Keep total national spend flat/i);
  assert.match(recommendation, /matched control/i);
  assert.match(recommendation, /launch only after/i);
  assert.doesNotMatch(recommendation, /^Prioritize/i);
});
