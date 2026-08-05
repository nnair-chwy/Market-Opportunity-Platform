import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocationNavigationState,
  getLocationFixtures,
  reduceLocationNavigation,
} from "../lib/locations/index.ts";

const locations = getLocationFixtures();

test("selecting a marker or list row uses the same stable site selection", () => {
  const initial = createLocationNavigationState(locations, "potential");
  const target = getLocationFixtures("potential")[1];

  const markerSelection = reduceLocationNavigation(
    initial,
    { type: "select-site", siteId: target.site_id },
    locations,
  );
  const listSelection = reduceLocationNavigation(
    initial,
    { type: "select-site", siteId: target.site_id },
    locations,
  );

  assert.equal(markerSelection.selectedSiteId, target.site_id);
  assert.deepEqual(listSelection, markerSelection);
});

test("changing tabs selects a valid location in the new category", () => {
  const initial = createLocationNavigationState(locations, "potential");
  const next = reduceLocationNavigation(
    initial,
    { type: "change-category", category: "evaluated" },
    locations,
  );

  assert.equal(next.activeCategory, "evaluated");
  assert.ok(
    getLocationFixtures("evaluated").some(
      (location) => location.site_id === next.selectedSiteId,
    ),
  );
});

test("rejects a selection outside the active category", () => {
  const initial = createLocationNavigationState(locations, "current");
  const potentialSite = getLocationFixtures("potential")[0];
  const next = reduceLocationNavigation(
    initial,
    { type: "select-site", siteId: potentialSite.site_id },
    locations,
  );

  assert.equal(next, initial);
});

test("represents an empty category with no selected site", () => {
  const currentOnly = getLocationFixtures("current");
  const state = createLocationNavigationState(currentOnly, "evaluated");

  assert.deepEqual(state, {
    activeCategory: "evaluated",
    selectedSiteId: null,
  });
});
