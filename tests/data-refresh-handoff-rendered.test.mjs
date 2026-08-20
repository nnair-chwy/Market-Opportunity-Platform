import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const control = fs.readFileSync(new URL("../components/sharing/DataRefreshControl.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/data-refresh/route.ts", import.meta.url), "utf8");

test("Tableau authentication produces visible handoff state instead of appearing inert", () => {
  assert.match(control, /recordAuthenticationHandoff\(source\.label, source\.id\)/);
  assert.match(control, /Tableau opened — complete sign-in/);
  assert.match(control, /data-refresh-auth-handoff/);
  assert.match(control, /Authentication happens in Tableau/);
});

test("already connected national context does not masquerade as a regional Tableau connection", () => {
  assert.match(control, /source\.connectionState === "context_connected"/);
  assert.match(control, /Review connected national source/);
  assert.match(control, /does not expose an approved regional key/);
});

test("the hosted site does not promise or expose an automatic browser-session refresh", () => {
  assert.match(control, /status\?\.mode === "local" \? <footer>/);
  assert.doesNotMatch(control, /disabled=\{Boolean\(busy\) \|\| status\?\.mode !== "local"\}/);
  assert.match(control, /intentionally has no automatic-download or refresh button/);
  assert.match(control, /cannot borrow your browser account/);
});

test("the supported handoff requests authentication only and preserves validated data", () => {
  assert.match(control, /no manual CSV download or upload is requested/i);
  assert.match(control, /secure data workspace—not this hosted browser—retrieves and validates/i);
  assert.match(control, /prior validated snapshot stays live/i);
  assert.match(route, /browserSessionDownload: "secure_workspace_only"/);
  assert.match(route, /publishedSnapshotPolicy: "preserve_until_validated"/);
  assert.match(route, /validated published snapshot remains unchanged/i);
});
