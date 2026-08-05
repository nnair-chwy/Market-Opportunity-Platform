import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CBSA_DELINEATION_VINTAGE,
  CBSA_SOURCE_ID,
  CBSA_TRANSFORMATION_VERSION,
  assertNoCredentialMaterial,
  createCbsaRejectedAudit,
  createCbsaUniverseSnapshot,
  readCbsaSourceWorkbooks,
  transformCbsaRows,
  type CbsaTransformationResult,
} from "../lib/data/cbsa-universe/index.ts";

export const DELINEATION_URL =
  "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx";
export const PRINCIPAL_CITY_URL =
  "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list2_2023.xlsx";
export const LANDING_PAGE_URL =
  "https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/delineation-files.html";
const EXPECTED_CONTENT_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

export type DownloadedInput = {
  role: "cbsa_delineation" | "principal_cities";
  url: string;
  path: string;
  contentType: string;
  sha256: string;
};

export type CbsaUniverseManifest = {
  manifest_version: "1.0.0";
  transformation_version: typeof CBSA_TRANSFORMATION_VERSION;
  source_vintage: typeof CBSA_DELINEATION_VINTAGE;
  source_id: typeof CBSA_SOURCE_ID;
  source_landing_page_url: string;
  retrieved_at: string;
  sources: Array<{
    role: DownloadedInput["role"];
    url: string;
    content_type: string;
    sha256: string;
  }>;
  outputs: Array<{
    path: string;
    sha256: string;
    record_count: number;
  }>;
  counts: {
    input_delineation_rows: number;
    input_principal_city_rows: number;
    output_markets: number;
    metropolitan_markets: number;
    micropolitan_markets: number;
    component_counties: number;
    principal_cities: number;
    excluded_markets: number;
    excluded_delineation_rows: number;
    excluded_principal_city_rows: number;
    rejected_rows: number;
    rejected_delineation_rows: number;
    rejected_principal_city_rows: number;
  };
  exclusions_by_state_fips: Record<string, number>;
};

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function download(
  role: DownloadedInput["role"],
  url: string,
  destination: string,
): Promise<DownloadedInput> {
  const response = await fetch(url, {
    headers: { "user-agent": "clinic-location-evaluator-public-data-build/1.0" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Download failed for ${url}: HTTP ${response.status}.`);
  }
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!EXPECTED_CONTENT_TYPES.has(contentType)) {
    throw new Error(
      `Unexpected content type for ${url}: ${contentType || "(missing)"}.`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error(`Downloaded content for ${url} is not an XLSX ZIP file.`);
  }
  const temporaryPath = `${destination}.partial`;
  await writeFile(temporaryPath, bytes);
  await rename(temporaryPath, destination);
  return {
    role,
    url,
    path: destination,
    contentType,
    sha256: sha256(bytes),
  };
}

function assertIsoTimestamp(value: string): void {
  const parsed = new Date(value);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString() !== value
  ) {
    throw new Error("retrieved_at must be an ISO 8601 UTC timestamp.");
  }
}

function assertSha256(value: string, field: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a lowercase SHA-256 hash.`);
  }
}

export function createCbsaUniverseManifest(input: {
  transformed: CbsaTransformationResult;
  retrievedAt: string;
  sources: Array<
    Pick<DownloadedInput, "role" | "url" | "contentType" | "sha256">
  >;
  outputs: Array<{
    path: string;
    sha256: string;
    record_count: number;
  }>;
}): CbsaUniverseManifest {
  assertIsoTimestamp(input.retrievedAt);
  if (
    input.sources.length !== 2 ||
    new Set(input.sources.map((source) => source.role)).size !== 2
  ) {
    throw new Error("Manifest requires one delineation and one principal-city source.");
  }
  for (const source of input.sources) {
    assertSha256(source.sha256, `sources.${source.role}.sha256`);
    if (
      source.url !== DELINEATION_URL &&
      source.url !== PRINCIPAL_CITY_URL
    ) {
      throw new Error(`Unexpected Census source URL: ${source.url}.`);
    }
    if (!EXPECTED_CONTENT_TYPES.has(source.contentType)) {
      throw new Error(`Unexpected source content type: ${source.contentType}.`);
    }
  }
  for (const output of input.outputs) {
    assertSha256(output.sha256, `outputs.${output.path}.sha256`);
    if (!Number.isSafeInteger(output.record_count) || output.record_count < 0) {
      throw new Error(`Invalid output record count for ${output.path}.`);
    }
  }

  const { transformed } = input;
  return {
    manifest_version: "1.0.0",
    transformation_version: CBSA_TRANSFORMATION_VERSION,
    source_vintage: CBSA_DELINEATION_VINTAGE,
    source_id: CBSA_SOURCE_ID,
    source_landing_page_url: LANDING_PAGE_URL,
    retrieved_at: input.retrievedAt,
    sources: input.sources
      .slice()
      .sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : 0))
      .map((source) => ({
        role: source.role,
        url: source.url,
        content_type: source.contentType,
        sha256: source.sha256,
      })),
    outputs: [...input.outputs].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    ),
    counts: {
      input_delineation_rows: transformed.input_counts.delineation_rows,
      input_principal_city_rows: transformed.input_counts.principal_city_rows,
      output_markets: transformed.markets.length,
      metropolitan_markets: transformed.markets.filter(
        (market) => market.cbsa_type === "metropolitan",
      ).length,
      micropolitan_markets: transformed.markets.filter(
        (market) => market.cbsa_type === "micropolitan",
      ).length,
      component_counties: transformed.markets.reduce(
        (sum, market) => sum + market.component_counties.length,
        0,
      ),
      principal_cities: transformed.markets.reduce(
        (sum, market) => sum + market.principal_cities.length,
        0,
      ),
      excluded_markets: transformed.exclusions.market_count,
      excluded_delineation_rows:
        transformed.exclusions.delineation_row_count,
      excluded_principal_city_rows:
        transformed.exclusions.principal_city_row_count,
      rejected_rows: transformed.rejected_rows.length,
      rejected_delineation_rows: transformed.rejected_rows.filter(
        (row) => row.dataset === "delineation",
      ).length,
      rejected_principal_city_rows: transformed.rejected_rows.filter(
        (row) => row.dataset === "principal_cities",
      ).length,
    },
    exclusions_by_state_fips: transformed.exclusions.by_state_fips,
  };
}

export async function buildCbsaUniverse(options?: {
  rootDir?: string;
  retrievedAt?: string;
}): Promise<CbsaUniverseManifest> {
  const rootDir = options?.rootDir ?? process.cwd();
  const retrievedAt = options?.retrievedAt ?? new Date().toISOString();
  assertIsoTimestamp(retrievedAt);

  const cacheDir = path.join(
    rootDir,
    ".cache",
    "public-data",
    "census",
    "cbsa-universe",
    CBSA_DELINEATION_VINTAGE,
  );
  const outputDir = path.join(
    rootDir,
    "data",
    "public",
    "census",
    "cbsa-universe",
    CBSA_DELINEATION_VINTAGE,
  );
  await Promise.all([
    mkdir(cacheDir, { recursive: true }),
    mkdir(outputDir, { recursive: true }),
  ]);

  const [delineation, principalCities] = await Promise.all([
    download(
      "cbsa_delineation",
      DELINEATION_URL,
      path.join(cacheDir, "list1_2023.xlsx"),
    ),
    download(
      "principal_cities",
      PRINCIPAL_CITY_URL,
      path.join(cacheDir, "list2_2023.xlsx"),
    ),
  ]);
  const sourceRows = await readCbsaSourceWorkbooks(
    delineation.path,
    principalCities.path,
  );
  const transformed = transformCbsaRows(
    sourceRows.delineationRows,
    sourceRows.principalCityRows,
  );
  const rejectedAudit = createCbsaRejectedAudit(transformed.rejected_rows);
  assertNoCredentialMaterial(rejectedAudit);

  if (transformed.rejected_rows.length > 0) {
    const failedAuditPath = path.join(cacheDir, "rejected-rows.failed.json");
    await writeFile(failedAuditPath, json(rejectedAudit), "utf8");
    throw new Error(
      `Build rejected ${transformed.rejected_rows.length} input rows. Details: ${failedAuditPath}. No market snapshot was replaced.`,
    );
  }

  const snapshot = createCbsaUniverseSnapshot(transformed.markets);
  assertNoCredentialMaterial(snapshot);
  const marketsJson = json(snapshot);
  const rejectedJson = json(rejectedAudit);
  const marketsPath = path.join(outputDir, "markets.json");
  const rejectedPath = path.join(outputDir, "rejected-rows.json");
  const manifestPath = path.join(outputDir, "manifest.json");
  const relativeMarketsPath = path.relative(rootDir, marketsPath);
  const relativeRejectedPath = path.relative(rootDir, rejectedPath);

  const manifest = createCbsaUniverseManifest({
    transformed,
    retrievedAt,
    sources: [delineation, principalCities],
    outputs: [
      {
        path: relativeMarketsPath,
        sha256: sha256(marketsJson),
        record_count: snapshot.markets.length,
      },
      {
        path: relativeRejectedPath,
        sha256: sha256(rejectedJson),
        record_count: rejectedAudit.rejected_rows.length,
      },
    ],
  });
  assertNoCredentialMaterial(manifest);

  await Promise.all([
    writeFile(marketsPath, marketsJson, "utf8"),
    writeFile(rejectedPath, rejectedJson, "utf8"),
    writeFile(manifestPath, json(manifest), "utf8"),
  ]);

  const writtenSnapshot = JSON.parse(await readFile(marketsPath, "utf8")) as {
    markets?: unknown[];
  };
  if (writtenSnapshot.markets?.length !== manifest.counts.output_markets) {
    throw new Error("Written market snapshot failed record-count verification.");
  }
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const manifest = await buildCbsaUniverse();
  console.log(JSON.stringify(manifest, null, 2));
}
