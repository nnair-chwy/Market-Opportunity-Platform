import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CBSA_ACS_METRICS,
  CBSA_ACS_SOURCE_ID,
  CBSA_ACS_TRANSFORMATION_VERSION,
  CBSA_ACS_VINTAGE,
  transformCbsaAcs,
  type CbsaAcsTransformationResult,
} from "../lib/data/cbsa-acs/index.ts";
import type { CbsaUniverseSnapshot } from "../lib/data/cbsa-universe/index.ts";

export const ACS_BASE_URL = "https://api.census.gov/data/2024/acs/acs5";
export const ACS_FOR_VALUE =
  "metropolitan statistical area/micropolitan statistical area:*";

export type CbsaAcsManifest = {
  manifest_version: "1.0.0";
  transformation_version: typeof CBSA_ACS_TRANSFORMATION_VERSION;
  source_id: typeof CBSA_ACS_SOURCE_ID;
  dataset: "acs/acs5";
  dataset_vintage: typeof CBSA_ACS_VINTAGE;
  estimate_period: "2020–2024 ACS 5-year estimate";
  observed_at: "2024-12-31";
  retrieved_at: string;
  source_url: string;
  variables: string[];
  market_universe: { path: string; sha256: string; record_count: number };
  boundary_geometry: { path: string; sha256: string; record_count: number };
  outputs: Array<{ path: string; sha256: string; record_count: number }>;
  counts: CbsaAcsTransformationResult["counts"];
  sensitivity: "public";
  allowed_use: "market_context_only";
  scoring_weight: "none";
};

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildAcsSourceUrl(): URL {
  const url = new URL(ACS_BASE_URL);
  const variables = Object.values(CBSA_ACS_METRICS).flatMap(
    ({ variable, annotation }) => [variable, annotation],
  );
  url.searchParams.set("get", ["NAME", "GEO_ID", ...variables].join(","));
  url.searchParams.set("for", ACS_FOR_VALUE);
  return url;
}

function readLandAreas(topology: unknown): Map<string, number> {
  const geometries = (
    topology as {
      objects?: { markets?: { geometries?: Array<{ properties?: Record<string, unknown> }> } };
    }
  ).objects?.markets?.geometries;
  if (!Array.isArray(geometries)) throw new Error("Phase 2 topology is invalid.");
  const areas = new Map<string, number>();
  for (const geometry of geometries) {
    const code = geometry.properties?.cbsa_code;
    const aland = geometry.properties?.aland;
    if (
      typeof code !== "string" ||
      !/^\d{5}$/.test(code) ||
      typeof aland !== "number" ||
      !Number.isSafeInteger(aland) ||
      aland <= 0 ||
      areas.has(code)
    ) {
      throw new Error("Phase 2 topology contains invalid or duplicate CBSA ALAND.");
    }
    areas.set(code, aland);
  }
  return areas;
}

export function createCbsaAcsManifest(input: {
  transformed: CbsaAcsTransformationResult;
  retrievedAt: string;
  sourceUrl: string;
  universePath: string;
  universeHash: string;
  universeCount: number;
  geometryPath: string;
  geometryHash: string;
  geometryCount: number;
  outputs: CbsaAcsManifest["outputs"];
}): CbsaAcsManifest {
  if (input.sourceUrl.includes("key=")) {
    throw new Error("Persisted ACS source URL must not contain a key.");
  }
  if (new Date(input.retrievedAt).toISOString() !== input.retrievedAt) {
    throw new Error("retrieved_at must be an ISO 8601 UTC timestamp.");
  }
  return {
    manifest_version: "1.0.0",
    transformation_version: CBSA_ACS_TRANSFORMATION_VERSION,
    source_id: CBSA_ACS_SOURCE_ID,
    dataset: "acs/acs5",
    dataset_vintage: CBSA_ACS_VINTAGE,
    estimate_period: "2020–2024 ACS 5-year estimate",
    observed_at: "2024-12-31",
    retrieved_at: input.retrievedAt,
    source_url: input.sourceUrl,
    variables: Object.values(CBSA_ACS_METRICS)
      .flatMap(({ variable, annotation }) => [variable, annotation])
      .sort(),
    market_universe: {
      path: input.universePath,
      sha256: input.universeHash,
      record_count: input.universeCount,
    },
    boundary_geometry: {
      path: input.geometryPath,
      sha256: input.geometryHash,
      record_count: input.geometryCount,
    },
    outputs: [...input.outputs].sort((a, b) => a.path.localeCompare(b.path)),
    counts: input.transformed.counts,
    sensitivity: "public",
    allowed_use: "market_context_only",
    scoring_weight: "none",
  };
}

export async function buildCbsaAcs(options?: {
  rootDir?: string;
  retrievedAt?: string;
  fetch?: typeof fetch;
}): Promise<CbsaAcsManifest> {
  const rootDir = options?.rootDir ?? process.cwd();
  const retrievedAt = options?.retrievedAt ?? new Date().toISOString();
  const apiKey = process.env.CENSUS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CENSUS_API_KEY is required. No snapshot was written.");
  }
  const universeRelative = "data/public/census/cbsa-universe/2023-07/markets.json";
  const geometryRelative = "data/public/census/cbsa-geometry/2024/markets.topo.json";
  const [universeBytes, geometryBytes] = await Promise.all([
    readFile(path.join(rootDir, universeRelative)),
    readFile(path.join(rootDir, geometryRelative)),
  ]);
  const universe = JSON.parse(universeBytes.toString("utf8")) as CbsaUniverseSnapshot;
  const topology = JSON.parse(geometryBytes.toString("utf8")) as unknown;
  if (universe.markets.length === 0) throw new Error("Phase 1 market universe is invalid.");
  const areas = readLandAreas(topology);
  if (areas.size !== universe.markets.length) {
    throw new Error("Phase 2 geometry does not cover the phase 1 market universe.");
  }

  const sourceUrl = buildAcsSourceUrl();
  const requestUrl = new URL(sourceUrl);
  requestUrl.searchParams.set("key", apiKey);
  let response: Response;
  try {
    response = await (options?.fetch ?? fetch)(requestUrl);
  } catch {
    throw new Error("The Census API request failed. No snapshot was written.");
  }
  if (!response.ok) {
    throw new Error(`The Census API returned HTTP ${response.status}. No snapshot was written.`);
  }
  const payload = await response.json();
  const transformed = transformCbsaAcs(payload, universe.markets, areas);
  const outputDir = path.join(rootDir, "data/public/census/cbsa-acs/2024");
  await mkdir(outputDir, { recursive: true });
  const snapshotRelative = "data/public/census/cbsa-acs/2024/market-context.json";
  const rejectedRelative = "data/public/census/cbsa-acs/2024/rejected-rows.json";
  const snapshotJson = json(transformed.snapshot);
  const rejectedJson = json({
    schema_version: "1.0.0",
    transformation_version: CBSA_ACS_TRANSFORMATION_VERSION,
    source_id: CBSA_ACS_SOURCE_ID,
    rejected_rows: transformed.rejected_rows,
  });
  const manifest = createCbsaAcsManifest({
    transformed,
    retrievedAt,
    sourceUrl: sourceUrl.toString(),
    universePath: universeRelative,
    universeHash: sha256(universeBytes),
    universeCount: universe.markets.length,
    geometryPath: geometryRelative,
    geometryHash: sha256(geometryBytes),
    geometryCount: areas.size,
    outputs: [
      { path: snapshotRelative, sha256: sha256(snapshotJson), record_count: transformed.snapshot.markets.length },
      { path: rejectedRelative, sha256: sha256(rejectedJson), record_count: transformed.rejected_rows.length },
    ],
  });
  const serialized = `${snapshotJson}${rejectedJson}${json(manifest)}`;
  if (serialized.includes(apiKey) || serialized.includes("key=")) {
    throw new Error("Credential redaction check failed. No snapshot was written.");
  }
  await Promise.all([
    writeFile(path.join(rootDir, snapshotRelative), snapshotJson, "utf8"),
    writeFile(path.join(rootDir, rejectedRelative), rejectedJson, "utf8"),
    writeFile(path.join(outputDir, "manifest.json"), json(manifest), "utf8"),
  ]);
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const result = await buildCbsaAcs();
  console.log(JSON.stringify(result, null, 2));
}
