import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../components/insight-discovery/AutonomousDiscoveryWorkspace.tsx", import.meta.url), "utf8");

test("autonomous discovery retains and reopens prior investigations", () => {
  assert.match(source, /DISCOVERY_HISTORY_KEY/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /Previous investigations/);
  assert.match(source, /setRun\(item\)/);
});
