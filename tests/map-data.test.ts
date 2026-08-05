import assert from "node:assert/strict";
import test from "node:test";
import { currentClinics } from "../lib/locations/map-data.ts";

test("maps every confirmed public clinic with an address-based coordinate", () => {
  assert.equal(currentClinics.length, 23);
  assert.equal(new Set(currentClinics.map((clinic) => clinic.id)).size, 23);

  for (const clinic of currentClinics) {
    assert.match(clinic.address, new RegExp(`${clinic.state} \\d{5}$`));
    assert.ok(clinic.latitude >= 24 && clinic.latitude <= 50);
    assert.ok(clinic.longitude >= -125 && clinic.longitude <= -66);
    assert.match(clinic.sourceUrl, /^https:\/\/www\.chewy\.com\/vet-care\//);
  }
});

test("keeps public clinic coordinates distinct from synthetic candidate data", () => {
  const coordinateKeys = currentClinics.map(
    (clinic) => `${clinic.latitude},${clinic.longitude}`,
  );
  assert.equal(new Set(coordinateKeys).size, currentClinics.length);
});
