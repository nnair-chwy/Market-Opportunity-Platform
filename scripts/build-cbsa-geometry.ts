import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import type { Feature } from "geojson";
import { open } from "shapefile";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { Topology } from "topojson-specification";
import {
  CBSA_BOUNDARY_SCALE,
  CBSA_BOUNDARY_VINTAGE,
  CBSA_GEOMETRY_FORMAT,
  CBSA_GEOMETRY_SOURCE_ID,
  CBSA_GEOMETRY_TRANSFORMATION_VERSION,
  CBSA_MISSING_GEOMETRY_TOLERANCE,
  transformCbsaGeometry,
  type CbsaGeometryTransformationResult,
} from "../lib/data/cbsa-geometry/index.ts";
import type { CbsaUniverseSnapshot } from "../lib/data/cbsa-universe/index.ts";

const execFileAsync = promisify(execFile);

export const CBSA_BOUNDARY_URL =
  "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_cbsa_5m.zip";
export const CBSA_BOUNDARY_DIRECTORY_URL =
  "https://www2.census.gov/geo/tiger/GENZ2024/shp/";
const EXPECTED_CONTENT_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);
const QUANTIZATION = 100_000;
const SIMPLIFICATION_QUANTILE = 0.08;

export type CbsaGeometryManifest = {
  manifest_version: "1.0.0";
  transformation_version: typeof CBSA_GEOMETRY_TRANSFORMATION_VERSION;
  source_id: typeof CBSA_GEOMETRY_SOURCE_ID;
  source_url: typeof CBSA_BOUNDARY_URL;
  source_directory_url: typeof CBSA_BOUNDARY_DIRECTORY_URL;
  source_sha256: string;
  source_content_type: string;
  retrieved_at: string;
  boundary_vintage: typeof CBSA_BOUNDARY_VINTAGE;
  scale: typeof CBSA_BOUNDARY_SCALE;
  geometry_format: typeof CBSA_GEOMETRY_FORMAT;
  quantization: number;
  simplification_quantile: number;
  missing_geometry_tolerance: number;
  market_universe: {
    vintage: string;
    source_id: string;
    sha256: string;
    market_count: number;
  };
  outputs: Array<{
    path: string;
    sha256: string;
    byte_size: number;
    record_count: number;
  }>;
  counts: CbsaGeometryTransformationResult["counts"];
};

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

function assertIsoTimestamp(value: string): void {
  if (new Date(value).toISOString() !== value) {
    throw new Error("retrieved_at must be an ISO 8601 UTC timestamp.");
  }
}

function assertSha256(value: string, field: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 hash.`);
  }
}

async function downloadZip(
  destination: string,
): Promise<{ contentType: string; sha256: string }> {
  const response = await fetch(CBSA_BOUNDARY_URL, {
    headers: { "user-agent": "clinic-location-evaluator-public-data-build/1.0" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(
      `Download failed for ${CBSA_BOUNDARY_URL}: HTTP ${response.status}.`,
    );
  }
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!EXPECTED_CONTENT_TYPES.has(contentType)) {
    throw new Error(
      `Unexpected content type: ${contentType || "(missing)"}.`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    ![0x03, 0x05, 0x07].includes(bytes[2]) ||
    ![0x04, 0x06, 0x08].includes(bytes[3])
  ) {
    throw new Error("Downloaded content is not a ZIP file.");
  }
  const partial = `${destination}.partial`;
  await writeFile(partial, bytes);
  await rename(partial, destination);
  return { contentType, sha256: sha256(bytes) };
}

async function extractShapefile(zipPath: string, destination: string) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await execFileAsync("/usr/bin/unzip", ["-qq", "-o", zipPath, "-d", destination]);
  const base = path.join(destination, "cb_2024_us_cbsa_5m");
  await Promise.all(
    [".shp", ".shx", ".dbf", ".prj"].map((extension) =>
      stat(`${base}${extension}`),
    ),
  );
  return { shp: `${base}.shp`, dbf: `${base}.dbf` };
}

async function readFeatures(shpPath: string, dbfPath: string): Promise<Feature[]> {
  const source = await open(shpPath, dbfPath, { encoding: "utf-8" });
  const features: Feature[] = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    features.push(result.value as Feature);
  }
  return features;
}

export function createCbsaGeometryManifest(input: {
  transformed: CbsaGeometryTransformationResult;
  retrievedAt: string;
  sourceSha256: string;
  sourceContentType: string;
  marketUniverse: CbsaUniverseSnapshot;
  marketUniverseSha256: string;
  outputs: CbsaGeometryManifest["outputs"];
}): CbsaGeometryManifest {
  assertIsoTimestamp(input.retrievedAt);
  assertSha256(input.sourceSha256, "source_sha256");
  assertSha256(input.marketUniverseSha256, "market_universe.sha256");
  if (!EXPECTED_CONTENT_TYPES.has(input.sourceContentType)) {
    throw new Error("Unexpected source content type.");
  }
  for (const output of input.outputs) {
    assertSha256(output.sha256, `outputs.${output.path}.sha256`);
    if (!Number.isSafeInteger(output.byte_size) || output.byte_size <= 0) {
      throw new Error(`Invalid byte size for ${output.path}.`);
    }
    if (!Number.isSafeInteger(output.record_count) || output.record_count < 0) {
      throw new Error(`Invalid record count for ${output.path}.`);
    }
  }
  return {
    manifest_version: "1.0.0",
    transformation_version: CBSA_GEOMETRY_TRANSFORMATION_VERSION,
    source_id: CBSA_GEOMETRY_SOURCE_ID,
    source_url: CBSA_BOUNDARY_URL,
    source_directory_url: CBSA_BOUNDARY_DIRECTORY_URL,
    source_sha256: input.sourceSha256,
    source_content_type: input.sourceContentType,
    retrieved_at: input.retrievedAt,
    boundary_vintage: CBSA_BOUNDARY_VINTAGE,
    scale: CBSA_BOUNDARY_SCALE,
    geometry_format: CBSA_GEOMETRY_FORMAT,
    quantization: QUANTIZATION,
    simplification_quantile: SIMPLIFICATION_QUANTILE,
    missing_geometry_tolerance: CBSA_MISSING_GEOMETRY_TOLERANCE,
    market_universe: {
      vintage: input.marketUniverse.delineation_vintage,
      source_id: input.marketUniverse.source_id,
      sha256: input.marketUniverseSha256,
      market_count: input.marketUniverse.markets.length,
    },
    outputs: [...input.outputs].sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
    counts: input.transformed.counts,
  };
}

export async function buildCbsaGeometry(options?: {
  rootDir?: string;
  retrievedAt?: string;
}): Promise<CbsaGeometryManifest> {
  const rootDir = options?.rootDir ?? process.cwd();
  const retrievedAt = options?.retrievedAt ?? new Date().toISOString();
  assertIsoTimestamp(retrievedAt);

  const cacheDir = path.join(
    rootDir,
    ".cache",
    "public-data",
    "census",
    "cbsa-geometry",
    CBSA_BOUNDARY_VINTAGE,
  );
  const outputDir = path.join(
    rootDir,
    "data",
    "public",
    "census",
    "cbsa-geometry",
    CBSA_BOUNDARY_VINTAGE,
  );
  const universePath = path.join(
    rootDir,
    "data",
    "public",
    "census",
    "cbsa-universe",
    "2023-07",
    "markets.json",
  );
  await Promise.all([
    mkdir(cacheDir, { recursive: true }),
    mkdir(outputDir, { recursive: true }),
  ]);

  const universeBytes = await readFile(universePath);
  const marketUniverse = JSON.parse(
    universeBytes.toString("utf8"),
  ) as CbsaUniverseSnapshot;
  if (
    marketUniverse.schema_version !== "1.0.0" ||
    marketUniverse.delineation_vintage !== "2023-07" ||
    marketUniverse.markets.length === 0
  ) {
    throw new Error("The phase 1 market-universe prerequisite is invalid.");
  }

  const zipPath = path.join(cacheDir, "cb_2024_us_cbsa_5m.zip");
  const source = await downloadZip(zipPath);
  const extracted = await extractShapefile(
    zipPath,
    path.join(cacheDir, "extracted"),
  );
  const rawFeatures = await readFeatures(extracted.shp, extracted.dbf);
  const transformed = transformCbsaGeometry(
    rawFeatures,
    marketUniverse.markets,
  );
  if (
    transformed.counts.missing_market_geometry >
    CBSA_MISSING_GEOMETRY_TOLERANCE
  ) {
    const failurePath = path.join(cacheDir, "geometry-audit.failed.json");
    await writeFile(failurePath, json(transformed.audit), "utf8");
    throw new Error(
      `${transformed.counts.missing_market_geometry} markets are missing geometry, exceeding tolerance ${CBSA_MISSING_GEOMETRY_TOLERANCE}. Audit: ${failurePath}.`,
    );
  }
  if (
    transformed.counts.rejected_features > 0 ||
    transformed.counts.duplicate_features > 0
  ) {
    const failurePath = path.join(cacheDir, "geometry-audit.failed.json");
    await writeFile(failurePath, json(transformed.audit), "utf8");
    throw new Error(
      "Boundary validation found rejected or duplicate features. No output was replaced.",
    );
  }

  const rawTopology = topology(
    { markets: transformed.feature_collection },
    QUANTIZATION,
  );
  const weighted = presimplify(rawTopology as never) as Topology;
  const threshold = quantile(weighted, SIMPLIFICATION_QUANTILE);
  const browserTopology = simplify(weighted as never, threshold) as Topology;
  const topologyJson = compactJson(browserTopology);
  const auditJson = json(transformed.audit);
  const topologyPath = path.join(outputDir, "markets.topo.json");
  const auditPath = path.join(outputDir, "geometry-audit.json");
  const manifestPath = path.join(outputDir, "manifest.json");

  const outputs: CbsaGeometryManifest["outputs"] = [
    {
      path: path.relative(rootDir, topologyPath),
      sha256: sha256(topologyJson),
      byte_size: Buffer.byteLength(topologyJson),
      record_count: transformed.counts.included_features,
    },
    {
      path: path.relative(rootDir, auditPath),
      sha256: sha256(auditJson),
      byte_size: Buffer.byteLength(auditJson),
      record_count: transformed.counts.excluded_features,
    },
  ];
  const manifest = createCbsaGeometryManifest({
    transformed,
    retrievedAt,
    sourceSha256: source.sha256,
    sourceContentType: source.contentType,
    marketUniverse,
    marketUniverseSha256: sha256(universeBytes),
    outputs,
  });
  await Promise.all([
    writeFile(topologyPath, topologyJson, "utf8"),
    writeFile(auditPath, auditJson, "utf8"),
    writeFile(manifestPath, json(manifest), "utf8"),
  ]);
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  console.log(JSON.stringify(await buildCbsaGeometry(), null, 2));
}
