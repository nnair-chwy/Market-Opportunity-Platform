import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("autonomous discovery exposes cross-team and team-specific CSV and Word downloads", async () => {
  const component = await readFile("components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", "utf8");
  const route = await readFile("app/api/insight-discovery/export/route.ts", "utf8");
  assert.match(component, /Download findings/);
  assert.match(component, /Choose brief audience/);
  assert.match(component, /downloadFindings\(briefScope, "csv"\)/);
  assert.match(component, /downloadFindings\(briefScope, "docx"\)/);
  assert.match(component, /\/api\/insight-discovery\/export/);
  assert.match(route, /text\/csv/);
  assert.match(route, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.doesNotMatch(route, /Slack|webhook|email/i);
});

test("portfolio and cross-department findings are separate, consistently counted views", async () => {
  const component = await readFile("components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", "utf8");
  assert.match(component, /All departments <span>\{allFindingCount\}<\/span>/);
  assert.match(component, /Cross-department <span>\{run\.adaptiveDiscovery\.findings\.filter/);
  assert.match(component, /department === "cross" \? crossFunctional : \[\]/);
  assert.doesNotMatch(component, /adaptivePortfolioDigest/);
  assert.match(component, /AI portfolio interpretation/);
  assert.match(component, /What the findings suggest together/);
});
