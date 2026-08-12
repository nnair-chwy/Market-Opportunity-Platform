import assert from "node:assert/strict";
import test from "node:test";
import {
  currentClinics,
  fulfillmentCenters,
} from "../lib/locations/map-data.ts";

test("maps every confirmed public clinic with an address-based coordinate", () => {
  assert.equal(currentClinics.length, 24);
  assert.equal(new Set(currentClinics.map((clinic) => clinic.id)).size, 24);

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

test("keeps fulfillment centers as separate address-backed context points", () => {
  assert.equal(fulfillmentCenters.length, 16);
  assert.equal(
    new Set(fulfillmentCenters.map((center) => center.id)).size,
    fulfillmentCenters.length,
  );

  for (const center of fulfillmentCenters) {
    assert.match(center.address, /, (?:[A-Z]{2} \d{5}|Canada L7C 2X3)$/);
    assert.ok(center.latitude >= 24 && center.latitude <= 50);
    assert.ok(center.longitude >= -125 && center.longitude <= -66);
    assert.equal(center.coordinateStatus, "Derived address geocode");
    assert.ok(center.sourceUrls.length > 0);
  }
});
