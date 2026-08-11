import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CATEGORY_VISIBILITY,
  LOCATION_MARKER_CONTRACT,
  deduplicateEvaluatedLocations,
  locationsToGeoJson,
  unifiedLocationAriaLabel,
  visibleUnifiedLocations,
  type UnifiedMapLocation,
} from "../lib/locations/unified-map.ts";
import { resolveMapTilerConfig } from "../lib/data/cbsa-market-map.ts";

const locations: UnifiedMapLocation[] = [
  {
    id: "clinic-1",
    marketId: "12060",
    name: "Current clinic",
    market: "Atlanta",
    city: "Atlanta",
    state: "GA",
    latitude: 33.8,
    longitude: -84.4,
    category: "current",
    evidenceStatus: "Confirmed",
    sourceId: "SRC-009",
    statusLabel: "Confirmed public clinic",
  },
  {
    id: "candidate-1",
    marketId: "39580",
    name: "Potential candidate",
    market: "Raleigh",
    city: "Raleigh",
    state: "NC",
    latitude: 35.8,
    longitude: -78.6,
    category: "potential",
    evidenceStatus: "Hypothesis",
    sourceId: "SYN-1",
    statusLabel: "Synthetic proposed location",
  },
  {
    id: "candidate-1",
    marketId: "39580",
    name: "Evaluated candidate",
    market: "Raleigh",
    city: "Raleigh",
    state: "NC",
    latitude: 35.8,
    longitude: -78.6,
    category: "evaluated",
    evidenceStatus: "Hypothesis",
    sourceId: "SYN-1",
    statusLabel: "Structured evaluation completed",
    score: 77,
  },
];

test("MapTiler configuration requires an approved style and browser key", () => {
  assert.deepEqual(resolveMapTilerConfig(undefined, undefined), {
    status: "missing",
    styleUrl: null,
  });
  assert.deepEqual(
    resolveMapTilerConfig(
      "https://api.maptiler.com/maps/streets-v4/style.json",
      undefined,
    ),
    { status: "missing", styleUrl: null },
  );
  assert.deepEqual(
    resolveMapTilerConfig(
      "https://tiles.example.com/maps/streets/style.json",
      "public-test-key",
    ),
    { status: "invalid", styleUrl: null },
  );
  const configured = resolveMapTilerConfig(
    "https://api.maptiler.com/maps/streets-v4/style.json",
    "public-test-key",
  );
  assert.equal(configured.status, "configured");
  assert.match(configured.styleUrl ?? "", /streets-v4\/style\.json/);
  assert.match(configured.styleUrl ?? "", /key=public-test-key/);
  assert.equal(
    resolveMapTilerConfig(
      "https://api.maptiler.com/maps/streets-v4/style.json?key=embedded-browser-key",
      undefined,
    ).status,
    "configured",
  );
});

test("current, potential, and evaluated records stay in isolated map sources", () => {
  const current = locationsToGeoJson(locations, "current");
  const potential = locationsToGeoJson(locations, "potential");
  const evaluated = locationsToGeoJson(locations, "evaluated");
  assert.deepEqual(
    current.features.map((feature) => feature.properties.category),
    ["current"],
  );
  assert.equal(current.features[0].properties.sourceId, "SRC-009");
  assert.equal(potential.features.length, 0);
  assert.deepEqual(
    evaluated.features.map((feature) => feature.properties.category),
    ["evaluated"],
  );
  assert.equal(evaluated.features[0].properties.score, 77);
});

test("evaluated candidates replace their potential presentation exactly once", () => {
  const deduplicated = deduplicateEvaluatedLocations(locations);
  assert.equal(
    deduplicated.filter((location) => location.id === "candidate-1").length,
    1,
  );
  assert.equal(
    deduplicated.find((location) => location.id === "candidate-1")?.category,
    "evaluated",
  );
});

test("category contracts use distinct colors and shapes, not color alone", () => {
  assert.equal(
    new Set(
      Object.values(LOCATION_MARKER_CONTRACT).map((contract) => contract.color),
    ).size,
    3,
  );
  assert.deepEqual(
    Object.values(LOCATION_MARKER_CONTRACT).map((contract) => contract.shape),
    ["circle", "diamond", "square"],
  );
});

test("visibility filters retain all categories by default and support one-layer changes", () => {
  assert.deepEqual(
    visibleUnifiedLocations(locations, DEFAULT_CATEGORY_VISIBILITY).map(
      (location) => location.category,
    ),
    ["current", "evaluated"],
  );
  assert.deepEqual(
    visibleUnifiedLocations(locations, {
      ...DEFAULT_CATEGORY_VISIBILITY,
      current: false,
    }).map((location) => location.category),
    ["evaluated"],
  );
});

test("marker labels expose category shape, evidence, and evaluation authority", () => {
  const evaluated = locations.find(
    (location) => location.category === "evaluated",
  );
  assert.ok(evaluated);
  const label = unifiedLocationAriaLabel(evaluated);
  assert.match(label, /Evaluated square marker/);
  assert.match(label, /not approved or recommended/);
  assert.match(label, /Evidence Hypothesis/);
});
