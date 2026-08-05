import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Feature, Geometry, MultiPolygon, Polygon } from "geojson";
import {
  CBSA_BOUNDARY_VINTAGE,
  CBSA_GEOMETRY_SOURCE_ID,
  transformCbsaGeometry,
  type RawCbsaBoundaryProperties,
} from "../lib/data/cbsa-geometry/index.ts";
import {
  CBSA_ALLOWED_USE,
  CBSA_DELINEATION_VINTAGE,
  CBSA_EVIDENCE_STATUS,
  CBSA_SCORING_ELIGIBILITY,
  CBSA_SENSITIVITY,
  CBSA_SOURCE_ID,
  type CbsaMarket,
  type CbsaUniverseSnapshot,
} from "../lib/data/cbsa-universe/index.ts";
import {
  CBSA_BOUNDARY_URL,
  createCbsaGeometryManifest,
} from "../scripts/build-cbsa-geometry.ts";

const polygon: Polygon = {
  type: "Polygon",
  coordinates: [[[-100, 35], [-99, 35], [-99, 36], [-100, 35]]],
};
const multipolygon: MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [[[[-90, 40], [-89, 40], [-89, 41], [-90, 40]]]],
};
const point: Geometry = { type: "Point", coordinates: [-100, 35] };

function market(
  code: string,
  name: string,
  type: "metropolitan" | "micropolitan",
): CbsaMarket {
  return {
    market_id: `cbsa:${code}`,
    cbsa_code: code,
    cbsa_name: name,
    cbsa_type: type,
    principal_cities: [
      { name: name.split(",")[0], state_code: "TX", state_fips: "48", place_fips: "00001" },
    ],
    component_counties: [
      {
        county_name: "Example County",
        county_fips: "48001",
        state_name: "Texas",
        state_code: "TX",
        state_fips: "48",
      },
    ],
    state_codes: ["TX"],
    delineation_vintage: CBSA_DELINEATION_VINTAGE,
    source_id: CBSA_SOURCE_ID,
    evidence_status: CBSA_EVIDENCE_STATUS,
    sensitivity: CBSA_SENSITIVITY,
    allowed_use: CBSA_ALLOWED_USE,
    scoring_eligibility: CBSA_SCORING_ELIGIBILITY,
  };
}

function boundary(
  code: unknown,
  name: string,
  type: "metropolitan" | "micropolitan",
  geometry: Geometry,
  overrides: Partial<RawCbsaBoundaryProperties> = {},
): Feature {
  return {
    type: "Feature",
    properties: {
      GEOID: code,
      NAME: name,
      NAMELSAD: `${name} ${type === "metropolitan" ? "Metro" : "Micro"} Area`,
      LSAD: type === "metropolitan" ? "M1" : "M2",
      ALAND: 123456789,
      AWATER: 0,
      ...overrides,
    },
    geometry,
  };
}

const markets = [
  market("12345", "Alpha, TX", "metropolitan"),
  market("23456", "Beta, TX", "micropolitan"),
];

test("joins unique five-digit codes and preserves Polygon, MultiPolygon, ALAND, and vintage", () => {
  const result = transformCbsaGeometry(
    [
      boundary("23456", "Beta, TX", "micropolitan", multipolygon),
      boundary("12345", "Alpha, TX", "metropolitan", polygon),
    ],
    markets,
  );

  assert.deepEqual(
    result.feature_collection.features.map((item) => item.properties.cbsa_code),
    ["12345", "23456"],
  );
  assert.deepEqual(
    result.feature_collection.features.map((item) => item.geometry.type),
    ["Polygon", "MultiPolygon"],
  );
  assert.equal(result.feature_collection.features[0].properties.aland, 123456789);
  assert.equal(result.feature_collection.features[0].properties.awater, 0);
  assert.equal(
    result.feature_collection.features[0].properties.boundary_vintage,
    CBSA_BOUNDARY_VINTAGE,
  );
  assert.equal(result.counts.missing_market_geometry, 0);
});

test("output is deterministic and contains only approved public properties", () => {
  const features = [
    boundary("12345", "Alpha, TX", "metropolitan", polygon, {
      INTERNAL_NOTE: "must not pass through",
    }),
    boundary("23456", "Beta, TX", "micropolitan", multipolygon),
  ];
  const forward = transformCbsaGeometry(features, markets);
  const reverse = transformCbsaGeometry([...features].reverse(), [...markets].reverse());

  assert.deepEqual(reverse.feature_collection, forward.feature_collection);
  for (const feature of forward.feature_collection.features) {
    assert.deepEqual(Object.keys(feature.properties).sort(), [
      "aland",
      "awater",
      "boundary_vintage",
      "cbsa_code",
      "cbsa_name",
      "cbsa_type",
      "geometry_type",
    ]);
    assert.equal(JSON.stringify(feature).includes("INTERNAL_NOTE"), false);
  }
});

test("audits unmatched, rejected, duplicate, and missing geometry separately", () => {
  const result = transformCbsaGeometry(
    [
      boundary("12345", "Alpha, TX", "metropolitan", polygon),
      boundary("12345", "Alpha, TX", "metropolitan", polygon),
      boundary("99999", "Outside, AK", "micropolitan", polygon),
      boundary("bad", "Malformed, TX", "metropolitan", point),
    ],
    markets,
  );

  assert.equal(result.audit.duplicate_features.length, 2);
  assert.equal(result.audit.unmatched_features.length, 1);
  assert.equal(result.audit.rejected_features.length, 1);
  assert.deepEqual(
    result.audit.missing_market_geometry.map((item) => item.cbsa_code),
    ["12345", "23456"],
  );
  assert.equal(result.counts.included_features, 0);
  assert.equal(result.counts.excluded_features, 4);
});

test("manifest validates the official source, hashes, counts, and phase 1 join", () => {
  const transformed = transformCbsaGeometry(
    [
      boundary("12345", "Alpha, TX", "metropolitan", polygon),
      boundary("23456", "Beta, TX", "micropolitan", multipolygon),
    ],
    markets,
  );
  const universe: CbsaUniverseSnapshot = {
    schema_version: "1.0.0",
    transformation_version: "cbsa-universe-v1",
    delineation_vintage: CBSA_DELINEATION_VINTAGE,
    source_id: CBSA_SOURCE_ID,
    evidence_status: CBSA_EVIDENCE_STATUS,
    sensitivity: CBSA_SENSITIVITY,
    allowed_use: CBSA_ALLOWED_USE,
    scoring_eligibility: CBSA_SCORING_ELIGIBILITY,
    markets,
  };
  const manifest = createCbsaGeometryManifest({
    transformed,
    retrievedAt: "2026-07-29T18:00:00.000Z",
    sourceSha256: "a".repeat(64),
    sourceContentType: "application/zip",
    marketUniverse: universe,
    marketUniverseSha256: "b".repeat(64),
    outputs: [
      {
        path: "data/public/census/cbsa-geometry/2024/markets.topo.json",
        sha256: "c".repeat(64),
        byte_size: 100,
        record_count: 2,
      },
    ],
  });

  assert.equal(manifest.source_url, CBSA_BOUNDARY_URL);
  assert.equal(manifest.source_id, CBSA_GEOMETRY_SOURCE_ID);
  assert.equal(manifest.counts.included_features, 2);
  assert.equal(manifest.market_universe.market_count, 2);
  assert.throws(
    () =>
      createCbsaGeometryManifest({
        transformed,
        retrievedAt: "2026-07-29T18:00:00.000Z",
        sourceSha256: "not-a-hash",
        sourceContentType: "application/zip",
        marketUniverse: universe,
        marketUniverseSha256: "b".repeat(64),
        outputs: [],
      }),
    /SHA-256/,
  );
});

test("checked-in geometry outputs match manifest hashes and exclude restricted fields", async () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(
    await readFile(
      new URL("../data/public/census/cbsa-geometry/2024/manifest.json", import.meta.url),
      "utf8",
    ),
  ) as {
    source_sha256: string;
    counts: Record<string, number>;
    outputs: Array<{ path: string; sha256: string; byte_size: number }>;
  };
  assert.match(manifest.source_sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.counts.included_features, 917);
  assert.equal(manifest.counts.missing_market_geometry, 0);
  assert.equal(manifest.counts.rejected_features, 0);

  for (const output of manifest.outputs) {
    const bytes = await readFile(new URL(output.path, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), output.sha256);
    assert.equal(bytes.byteLength, output.byte_size);
    const text = bytes.toString("utf8");
    assert.doesNotMatch(
      text,
      /customer|email|address|latitude|longitude|medical|internal|restricted/i,
    );
  }
});
