import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const snapshot = JSON.parse(
  await readFile(new URL("../../data/approved/golden-question-evidence/current.json", import.meta.url), "utf8"),
);

test("golden-question snapshot stays aggregate and investigation-only", () => {
  assert.equal(snapshot.snapshotId, "golden-question-evidence-2026-08-18-v1");
  assert.equal(snapshot.allowedUse, "internal_shadow_evaluation_only");
  assert.equal(snapshot.scoringEligibility, "none");
  assert.equal(snapshot.actionAuthority, "investigation_leads_only_no_material_action");
  assert.equal(snapshot.candidates.marketing.length, 5);
  assert.equal(snapshot.candidates.pricing.length, 1);
  assert.equal(snapshot.candidates.cvc.length, 1);

  const serialized = JSON.stringify(snapshot).toLowerCase();
  for (const prohibited of [
    "customer_address_id",
    "source_key_id",
    "created_by",
    "email",
    "access_token",
  ]) {
    assert.equal(serialized.includes(prohibited), false, `snapshot must not contain ${prohibited}`);
  }
});

test("known weak leads retain their geographic caveats", () => {
  assert.equal(snapshot.candidates.pricing[0].geography.id, "28100");
  assert.equal(snapshot.candidates.pricing[0].metrics.mappedZipGeographies, 1);
  assert.match(snapshot.limitations.join(" "), /first-party|local Chewy outcome/i);
  assert.match(snapshot.limitations.join(" "), /trade-area observation dates/i);
});
