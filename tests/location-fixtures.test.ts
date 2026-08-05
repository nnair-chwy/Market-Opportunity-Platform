import assert from "node:assert/strict";
import test from "node:test";
import {
  getLocationFixtures,
  loadLocationFixtures,
  validateLocationDisplays,
} from "../lib/locations/index.ts";

test("provides fixtures for all three navigation categories", () => {
  assert.ok(getLocationFixtures("current").length > 0);
  assert.ok(getLocationFixtures("potential").length > 0);
  assert.ok(getLocationFixtures("evaluated").length > 0);
});

test("keeps scores exclusive to evaluated locations", () => {
  const locations = getLocationFixtures();

  assert.equal(
    locations
      .filter((location) => location.category !== "evaluated")
      .some((location) => location.score !== null),
    false,
  );
  assert.ok(
    locations.some(
      (location) =>
        location.category === "evaluated" && location.score !== null,
    ),
  );
});

test("labels every candidate fixture as synthetic", () => {
  const candidates = getLocationFixtures().filter(
    (location) => location.category !== "current",
  );

  assert.ok(candidates.length > 0);
  assert.equal(
    candidates.every((location) => location.is_synthetic),
    true,
  );
});

test("represents public clinics without a performance score", () => {
  const current = getLocationFixtures("current");

  assert.equal(
    current.every(
      (location) =>
        location.evidence_status === "Confirmed" &&
        location.source_ids.includes("SRC-009") &&
        location.score === null &&
        location.data_notes.some((note) =>
          note.includes("does not indicate clinic performance"),
        ),
    ),
    true,
  );
});

test("validates stable IDs, scores, and display-map positions", () => {
  assert.deepEqual(validateLocationDisplays(getLocationFixtures()), []);
});

test("loads partial fixture data without calling a source system", async () => {
  const result = await loadLocationFixtures("evaluated");

  assert.equal(result.state, "partial");
  assert.ok(result.message?.includes("unknown or unavailable"));
  assert.ok(result.locations.some((location) => location.map_position === null));
});
