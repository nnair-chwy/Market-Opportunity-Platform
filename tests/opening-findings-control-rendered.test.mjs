import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const findings = fs.readFileSync(new URL("../components/insight-discovery/OpeningFindingsControl.tsx", import.meta.url), "utf8");
const evaluation = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url), "utf8");
const market = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../components/UnifiedEvaluatorMap.tsx", import.meta.url), "utf8");

test("the opening findings inbox loads current findings without an opaque opportunity score", () => {
  assert.match(findings, /fetch\("\/api\/insight-discovery"/);
  assert.match(findings, /run\?\.findings\.length/);
  assert.match(findings, /aria-controls="adaptive-findings-panel"/);
  assert.match(findings, /aria-expanded=\{open\}/);
  assert.match(findings, /presentation\.recommendationLabel/);
  assert.match(findings, /presentation\.confidence/);
  assert.doesNotMatch(findings, /finding\.importance\.score/);
});

test("findings can be filtered by stakeholder team and opened without rerunning question analysis", () => {
  assert.match(findings, /\["all", "marketing", "pricing", "cvc"\]/);
  assert.match(findings, /finding\.department === team/);
  assert.match(findings, /onOpenDiscovery\(finding\.insightId, run \?\? undefined\)/);
  assert.match(findings, /Open finding:/);
  assert.doesNotMatch(findings, /Ask about this finding/);
});

test("the inbox starts with the ranked five-item digest and can reveal the full inventory", () => {
  assert.match(findings, /run\?\.primaryFindings\.filter/);
  assert.match(findings, /Show all \{teamFindings\.length\}/);
  assert.match(findings, /Show focus/);
  assert.match(findings, /data-importance=\{finding\.importance\.tier\}/);
  assert.match(findings, /presentation\.valueStatus/);
});

test("help, findings, and saved work share one compact toolbar", () => {
  assert.match(market, /role="toolbar" aria-label="Map help, findings, and saved work"/);
  assert.match(evaluation, /OpeningFindingsControl/);
  assert.match(evaluation, /adaptive-opening-tool adaptive-saved-trigger/);
  assert.doesNotMatch(evaluation, /adaptive-discovery-entry/);
});

test("the header reset control resets both the map camera and selected map state", () => {
  assert.ok(evaluation.indexOf("adaptive-map-reset-trigger") < evaluation.indexOf("adaptive-layer-trigger"));
  assert.match(evaluation, /setMapResetRequest\(\(request\) => request \+ 1\)/);
  assert.match(market, /resetRequest=\{resetRequest\}/);
  assert.match(market, /showResetControl=\{!opening\}/);
  assert.match(map, /mapRef\.current\?\.fitBounds\(MAINLAND_MARKET_BOUNDS/);
  assert.match(map, /onReset\(\)/);
});

test("map help is the right-most control in the opening toolbar", () => {
  assert.ok(market.indexOf("{openingControls}") < market.indexOf("adaptive-map-help-trigger"));
});
