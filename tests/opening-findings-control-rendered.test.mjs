import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const findings = fs.readFileSync(new URL("../components/insight-discovery/OpeningFindingsControl.tsx", import.meta.url), "utf8");
const evaluation = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url), "utf8");

test("the opening findings inbox loads current findings and exposes a numeric badge", () => {
  assert.match(findings, /fetch\("\/api\/insight-discovery"/);
  assert.match(findings, /run\?\.findings\.length/);
  assert.match(findings, /aria-controls="adaptive-findings-panel"/);
  assert.match(findings, /aria-expanded=\{open\}/);
});

test("findings can be filtered by stakeholder team and moved into the question composer", () => {
  assert.match(findings, /\["all", "marketing", "pricing", "cvc"\]/);
  assert.match(findings, /finding\.department === team/);
  assert.match(findings, /Ask about this finding/);
  assert.match(findings, /onInvestigate\(finding\)/);
  assert.match(evaluation, /onInvestigate=\{onInvestigateFinding\}/);
});

test("help, findings, and saved work share one compact toolbar", () => {
  assert.match(market, /role="toolbar" aria-label="Map help, findings, and saved work"/);
  assert.match(evaluation, /OpeningFindingsControl/);
  assert.match(evaluation, /adaptive-opening-tool adaptive-saved-trigger/);
  assert.doesNotMatch(evaluation, /adaptive-discovery-entry/);
});

test("the header reset control resets both the map camera and selected map state", () => {
  assert.ok(evaluation.indexOf("adaptive-map-reset-trigger") > evaluation.indexOf("adaptive-layer-trigger"));
  assert.match(evaluation, /setMapResetRequest\(\(request\) => request \+ 1\)/);
  assert.match(market, /resetRequest=\{resetRequest\}/);
  assert.match(market, /showResetControl=\{!opening\}/);
  assert.match(map, /mapRef\.current\?\.fitBounds\(MAINLAND_MARKET_BOUNDS/);
  assert.match(map, /onReset\(\)/);
});
