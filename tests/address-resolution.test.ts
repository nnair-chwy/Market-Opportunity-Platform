import assert from "node:assert/strict";
import test from "node:test";
import {
  CENSUS_GEOCODER_SOURCE_ID,
  parseCensusAddressResponse,
} from "../lib/address-resolution.ts";

const resolvedAt = "2026-07-27T18:00:00.000Z";

test("normalizes a complete Census geocoder match", () => {
  const result = parseCensusAddressResponse(
    {
      result: {
        input: {
          benchmark: { benchmarkName: "Public_AR_Current" },
        },
        addressMatches: [
          {
            matchedAddress: "4600 SILVER HILL RD, WASHINGTON, DC, 20233",
            coordinates: { x: -76.92743, y: 38.84599 },
            addressComponents: {
              city: "WASHINGTON",
              state: "DC",
              zip: "20233",
            },
          },
        ],
      },
    },
    "4600 Silver Hill Rd, Washington, DC 20233",
    resolvedAt,
  );

  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.match.sourceId, CENSUS_GEOCODER_SOURCE_ID);
  assert.equal(result.match.evidenceStatus, "Derived");
  assert.equal(result.match.latitude, 38.84599);
  assert.equal(result.match.longitude, -76.92743);
  assert.equal(result.match.resolvedAt, resolvedAt);
});

test("keeps an unmatched address explicit", () => {
  const result = parseCensusAddressResponse(
    { result: { addressMatches: [] } },
    "1 Missing Place, Nowhere, ZZ 00000",
    resolvedAt,
  );

  assert.deepEqual(result, {
    status: "no_match",
    message:
      "No complete Census address match was found. Check the street, city, state, and ZIP code.",
  });
});

test("rejects an incomplete provider response", () => {
  const result = parseCensusAddressResponse(
    {
      result: {
        addressMatches: [
          {
            matchedAddress: "INCOMPLETE MATCH",
            coordinates: { x: -76.9 },
          },
        ],
      },
    },
    "Incomplete",
    resolvedAt,
  );

  assert.equal(result.status, "no_match");
});
