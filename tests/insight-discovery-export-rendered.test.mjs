import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("autonomous discovery exposes cross-team and team-specific CSV and Word downloads", async () => {
  const component = await readFile("components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", "utf8");
  const route = await readFile("app/api/insight-discovery/export/route.ts", "utf8");
  assert.match(component, /Download findings/);
  assert.match(component, /Choose brief audience/);
  assert.match(component, /downloadFindings\(department, "csv"\)/);
  assert.match(component, /downloadFindings\(department, "docx"\)/);
  assert.match(component, /\/api\/insight-discovery\/export/);
  assert.match(route, /text\/csv/);
  assert.match(route, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.doesNotMatch(route, /Slack|webhook|email/i);
});
