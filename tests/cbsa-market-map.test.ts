import assert from "node:assert/strict";
import test from "node:test";
import topologyJson from "../data/public/census/cbsa-geometry/2024/markets.topo.json" with { type: "json" };
import marketUniverseJson from "../data/public/census/cbsa-universe/2023-07/markets.json" with { type: "json" };
import acsSnapshotJson from "../data/public/census/cbsa-acs/2024/market-context.json" with { type: "json" };
import type { CbsaAcsSnapshot } from "../lib/data/cbsa-acs/index.ts";
import type { CbsaBoundaryProperties } from "../lib/data/cbsa-geometry/index.ts";
import {
  createPublicMarketRecords,
  selectPublicMarket,
} from "../lib/data/cbsa-market-context.ts";
import {
  MAINLAND_MARKET_BOUNDS,
  PUBLIC_MARKET_MAX_FIT_ZOOM,
  createPublicMarketMapGeoJson,
  hasPublicMarketEvidenceMetadata,
  resolvePublicBasemapConfig,
  selectedMarketBounds,
  type MarketTopology,
} from "../lib/data/cbsa-market-map.ts";
import type { CbsaUniverseSnapshot } from "../lib/data/cbsa-universe/index.ts";

const topology = topologyJson as unknown as MarketTopology;
const universe = marketUniverseJson as CbsaUniverseSnapshot;
const snapshot = acsSnapshotJson as CbsaAcsSnapshot;
const geometryCodes = new Set(
  topology.objects.markets.geometries.map(
    (item) =>
      (item.properties as CbsaBoundaryProperties | undefined)?.cbsa_code ?? "",
  ),
);
const markets = createPublicMarketRecords(
  universe.markets,
  geometryCodes,
  new Map(snapshot.markets.map((market) => [market.cbsa_code, market])),
);
const collection = createPublicMarketMapGeoJson(topology, markets);

test("basemap configuration accepts approved HTTPS or local styles and preserves the fallback", () => {
  assert.deepEqual(resolvePublicBasemapConfig(undefined), {
    status: "missing",
    styleUrl: null,
  });
  assert.deepEqual(resolvePublicBasemapConfig(""), {
    status: "missing",
    styleUrl: null,
  });
  assert.deepEqual(resolvePublicBasemapConfig("ftp://example.com/style.json"), {
    status: "invalid",
    styleUrl: null,
  });
  assert.deepEqual(
    resolvePublicBasemapConfig("https://tiles.example.com/style.json"),
    {
      status: "configured",
      styleUrl: "https://tiles.example.com/style.json",
    },
  );
  assert.equal(
    resolvePublicBasemapConfig("http://localhost:8080/style.json").status,
    "configured",
  );
});

test("TopoJSON conversion preserves Census geometry and non-scoring evidence metadata", () => {
  assert.equal(collection.features.length, topology.objects.markets.geometries.length);
  const atlanta = collection.features.find(
    (item) => item.properties.cbsa_code === "12060",
  );
  assert.ok(atlanta);
  assert.equal(atlanta.id, "12060");
  assert.equal(atlanta.properties.boundary_vintage, "2024");
  assert.equal(
    atlanta.properties.total_population,
    snapshot.markets.find((market) => market.cbsa_code === "12060")?.metrics
      .total_population.raw_value,
  );
  assert.equal(hasPublicMarketEvidenceMetadata(atlanta.properties), true);
  assert.equal(atlanta.properties.allowed_use, "market_context_only");
  assert.equal(atlanta.properties.scoring_eligibility, "none");
});

test("Atlanta selection resolves to CBSA 12060 and produces finite camera bounds", () => {
  const atlanta = selectPublicMarket(markets, "12060");
  assert.ok(atlanta);
  assert.match(atlanta.cbsa_name, /Atlanta/);
  const bounds = selectedMarketBounds(collection, "12060");
  assert.ok(bounds);
  assert.ok(bounds[0][0] < bounds[1][0]);
  assert.ok(bounds[0][1] < bounds[1][1]);
  assert.equal(PUBLIC_MARKET_MAX_FIT_ZOOM, 8);
});

test("reset and missing geometry behavior are deterministic", () => {
  assert.deepEqual(MAINLAND_MARKET_BOUNDS, [
    [-132, 18],
    [-60, 55],
  ]);
  assert.equal(selectedMarketBounds(collection, "99999"), null);
});

test("missing values remain null in the render GeoJSON instead of observed zero", () => {
  const missingMarket = markets.find((market) =>
    Object.values(market.acs?.metrics ?? {}).some(
      (metric) => metric.raw_value === null,
    ),
  );
  if (!missingMarket) return;
  const rendered = collection.features.find(
    (item) => item.properties.cbsa_code === missingMarket.cbsa_code,
  );
  assert.ok(rendered);
  const missingKeys = Object.entries(missingMarket.acs?.metrics ?? {})
    .filter(([, metric]) => metric.raw_value === null)
    .map(([key]) => key);
  for (const key of missingKeys) {
    assert.equal(
      rendered.properties[key as keyof typeof rendered.properties],
      null,
    );
  }
});
