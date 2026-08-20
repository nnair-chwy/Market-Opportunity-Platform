import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiscoveryCsv,
  buildDiscoveryDocx,
  discoveryExportFilename,
  getScopedDiscoveryFindings,
  runCurrentDataInsightDiscovery,
} from "../lib/insight-discovery/index.ts";

const run = runCurrentDataInsightDiscovery({
  runId: "discovery:export-test",
  now: () => "2026-08-20T12:00:00.000Z",
});

test("discovery CSV exports the complete portfolio or one requested team", () => {
  const all = buildDiscoveryCsv(run, "all");
  const marketing = buildDiscoveryCsv(run, "marketing");

  assert.match(all, /^rank,insight_id,team,owner,market,recommendation_headline,observed_opportunity,estimated_or_scenario_value/);
  assert.match(all, /Marketing/);
  assert.match(all, /Pricing/);
  assert.match(all, /CVC/);
  assert.match(all, /Eagle Pass/);
  assert.match(all, /Inputs needed to size value|incremental|Contribution opportunity/i);
  assert.doesNotMatch(all, /,\s*\.\s*Business value/);
  assert.equal(all.trim().split("\r\n").length, run.findings.length + 1);

  assert.match(marketing, /Marketing/);
  assert.doesNotMatch(marketing, /,Pricing,/);
  assert.doesNotMatch(marketing, /,CVC,/);
  assert.equal(marketing.trim().split("\r\n").length, getScopedDiscoveryFindings(run, "marketing").length + 1);
});

test("discovery export filenames identify scope, run, and real file type", () => {
  assert.equal(discoveryExportFilename(run, "all", "csv"), "market-opportunity-findings-all-teams-run-1.csv");
  assert.equal(discoveryExportFilename(run, "cvc", "docx"), "market-opportunity-findings-cvc-run-1.docx");
});

test("discovery Word brief is a genuine DOCX for complete and team-specific findings", async () => {
  const all = await buildDiscoveryDocx(run, "all");
  const pricing = await buildDiscoveryDocx(run, "pricing");
  assert.equal(Buffer.from(all).subarray(0, 2).toString(), "PK");
  assert.equal(Buffer.from(pricing).subarray(0, 2).toString(), "PK");
  assert.ok(all.byteLength > pricing.byteLength);
  assert.ok(pricing.byteLength > 10_000);
});
