import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { closeDuckDb, openDuckDb } from "../evidence-snapshot/duckdb.ts";
import {
  NORMALIZED_CALCULATION_VERSION,
  NORMALIZED_QUERY_VERSION,
  normalizedQueryRequestSchema,
  normalizedQueryResponseSchema,
  normalizedSnapshotManifestSchema,
  type NormalizedQueryRequest,
  type NormalizedQueryResponse,
  type NormalizedSnapshotManifest,
} from "./contracts.ts";
import {
  GROWTH_TEST_SCREENING_FINGERPRINT,
  GROWTH_TEST_SCREENING_VERSION,
  GROWTH_TEST_SCREENING_WEIGHTS,
  calculateGrowthTestScreening,
  type GrowthScreeningInput,
} from "./growth-screening.ts";

function decodeLocalPath(value: string): string {
  let decoded = value;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function resolveLocalPath(value: string): string {
  const decoded = decodeLocalPath(value);
  return decoded.startsWith("/") ? decoded : resolve(decoded);
}

function localFile(snapshotDir: string, relativePath: string): string {
  return `${decodeLocalPath(snapshotDir).replace(/\/+$/, "")}/${decodeLocalPath(relativePath).replace(/^\/+/, "")}`;
}

export function normalizedSnapshotDirectory(): string {
  const configured = process.env.NORMALIZED_MARKET_DATA_DIR?.trim();
  return resolveLocalPath(configured ?? ".local-data/normalized-market-data");
}

function hash(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function validateNormalizedSnapshot(snapshotDir = normalizedSnapshotDirectory(), requestedVersion?: string): Promise<NormalizedSnapshotManifest> {
  const manifest = normalizedSnapshotManifestSchema.parse(JSON.parse(await readFile(pathToFileURL(localFile(snapshotDir, "manifest.json")), "utf8")));
  if (requestedVersion && manifest.snapshotVersion !== requestedVersion) throw new Error(`Normalized snapshot ${requestedVersion} is unavailable.`);
  for (const output of manifest.outputs) {
    const content = await readFile(pathToFileURL(localFile(snapshotDir, output.path)));
    if (content.byteLength !== output.bytes) throw new Error(`Normalized output byte count changed for ${output.path}.`);
    if (hash(content) !== output.sha256) throw new Error(`Normalized output hash changed for ${output.path}.`);
  }
  return manifest;
}

function sourceIds(rows: Array<Record<string, unknown>>): string[] {
  return [...new Set(rows.flatMap((row) => {
    const direct = typeof row.sourceId === "string" ? [row.sourceId] : [];
    const nested = typeof row.sourceIds === "string" ? row.sourceIds.split(",").map((item) => item.trim()).filter(Boolean) : [];
    return [...direct, ...nested];
  }))].sort();
}

export async function queryNormalizedMarketData(input: NormalizedQueryRequest, options: { snapshotDir?: string } = {}): Promise<NormalizedQueryResponse> {
  const request = normalizedQueryRequestSchema.parse(input);
  const snapshotDir = options.snapshotDir ? resolveLocalPath(options.snapshotDir) : normalizedSnapshotDirectory();
  const manifest = await validateNormalizedSnapshot(snapshotDir, request.snapshotVersion);
  const databaseOutput = manifest.outputs.find((output) => output.tableName === "normalized_database");
  if (!databaseOutput) throw new Error("The normalized DuckDB output is unavailable.");
  const handle = await openDuckDb(localFile(snapshotDir, databaseOutput.path), true);
  const rows: Array<Record<string, unknown>> = [];
  // Query responses carry only warnings that apply to the selected query and
  // rows. Snapshot-wide build warnings remain available in the manifest.
  const warnings: string[] = [];
  let metadata: Record<string, unknown> = {};
  const run = async (sql: string, values: Array<string | number | null> = []) => {
    const reader = await handle.connection.runAndReadAll(sql, values);
    return reader.getRowObjectsJson() as Array<Record<string, unknown>>;
  };
  try {
    switch (request.query) {
      case "supported_regions": {
        rows.push(...await run(`
          SELECT g.cbsaCode, g.cbsaName, g.cbsaType,
            EXISTS (SELECT 1 FROM normalized_census_market_context c WHERE c.cbsaCode = g.cbsaCode) AS hasCensus,
            EXISTS (SELECT 1 FROM normalized_market_context m WHERE m.cbsaCode = g.cbsaCode) AS hasMarketContext,
            EXISTS (SELECT 1 FROM normalized_regional_demand_by_cbsa_year d WHERE d.cbsaCode = g.cbsaCode) AS hasRegionalDemand,
            EXISTS (SELECT 1 FROM normalized_clinic_profile_by_cbsa p WHERE p.cbsaCode = g.cbsaCode) AS hasClinicProfile,
            EXISTS (SELECT 1 FROM normalized_clinic_activity_by_cbsa a WHERE a.cbsaCode = g.cbsaCode) AS hasClinicActivity,
            EXISTS (SELECT 1 FROM normalized_google_ads_by_cbsa ads WHERE ads.cbsaCode = g.cbsaCode) AS hasGoogleAds,
            (SELECT string_agg(sourceId, ',' ORDER BY sourceId) FROM normalized_source_registry) AS sourceIds
          FROM normalized_geography_registry g
          ORDER BY g.cbsaName, g.cbsaCode
        `));
        break;
      }
      case "regional_context_by_cbsa": {
        const code = request.cbsaCode!;
        const [census, market, population, zipContext, demand] = await Promise.all([
          run("SELECT 'census_market_context' AS evidenceType, * FROM normalized_census_market_context WHERE cbsaCode = ?", [code]),
          run("SELECT 'market_context' AS evidenceType, * FROM normalized_market_context WHERE cbsaCode = ? ORDER BY reportingDate", [code]),
          run("SELECT 'cbsa_population' AS evidenceType, * FROM normalized_cbsa_population WHERE cbsaCode = ?", [code]),
          run("SELECT 'zip_context' AS evidenceType, * FROM normalized_zip_context_by_cbsa WHERE cbsaCode = ?", [code]),
          run("SELECT 'regional_demand' AS evidenceType, * FROM normalized_regional_demand_by_cbsa_year WHERE cbsaCode = ? ORDER BY year", [code]),
        ]);
        rows.push(...census, ...market, ...population, ...zipContext, ...demand);
        if (!rows.length) warnings.push(`No normalized regional evidence is available for CBSA ${code}.`);
        break;
      }
      case "clinic_context_by_cbsa": {
        const code = request.cbsaCode!;
        const [profile, activity] = await Promise.all([
          run("SELECT 'clinic_profile' AS evidenceType, * FROM normalized_clinic_profile_by_cbsa WHERE cbsaCode = ?", [code]),
          run("SELECT 'clinic_activity' AS evidenceType, * FROM normalized_clinic_activity_by_cbsa WHERE cbsaCode = ? ORDER BY timeframe", [code]),
        ]);
        rows.push(...profile, ...activity);
        warnings.push("These are aggregate clinic context and activity measures. The supplied files do not contain completed appointments by clinic at a shared 38-week maturity window.");
        if (!rows.length) warnings.push(`No normalized clinic evidence is available for CBSA ${code}.`);
        break;
      }
      case "google_ads_context_by_cbsa": {
        rows.push(...await run("SELECT * FROM normalized_google_ads_by_cbsa WHERE cbsaCode = ? ORDER BY reportScope", [request.cbsaCode!]));
        warnings.push("Google Ads CBSA assignments are intuitive demo mappings from display labels, not provider-stable geography joins.");
        if (!rows.length) warnings.push(`No normalized Google Ads context is available for CBSA ${request.cbsaCode}.`);
        break;
      }
      case "normalization_coverage": {
        rows.push(...await run("SELECT * FROM normalized_coverage ORDER BY sourceFamily, datasetId"));
        break;
      }
      case "growth_test_screening": {
        const rawInputs = await run(`
          WITH demand AS (
            SELECT cbsaCode,
              max(CASE WHEN year = 2024 THEN netSalesExcludingRefunds END) AS demand2024,
              max(CASE WHEN year = 2025 THEN netSalesExcludingRefunds END) AS demand2025,
              max(sourceId) AS sourceId
            FROM normalized_regional_demand_by_cbsa_year
            GROUP BY cbsaCode
          ), market AS (
            SELECT cbsaCode,
              max(activeCustomersPer1000Households) AS activeCustomersPer1000Households,
              max(activeCustomerYoyGrowth) AS activeCustomerYoyGrowth,
              max(sourceId) AS sourceId
            FROM normalized_market_context
            GROUP BY cbsaCode
          ), ads AS (
            SELECT cbsaCode, sum(conversions) AS veterinarySearchConversions, max(sourceId) AS sourceId
            FROM normalized_google_ads_by_cbsa
            WHERE lower(reportScope) LIKE '%vet%clinic%'
            GROUP BY cbsaCode
          )
          SELECT g.cbsaCode, g.cbsaName,
            d.demand2024, d.demand2025,
            m.activeCustomersPer1000Households, m.activeCustomerYoyGrowth,
            ads.veterinarySearchConversions, c.householdCount,
            concat_ws(',', d.sourceId, m.sourceId, ads.sourceId, c.sourceId) AS sourceIds
          FROM normalized_geography_registry g
          LEFT JOIN demand d ON d.cbsaCode = g.cbsaCode
          LEFT JOIN market m ON m.cbsaCode = g.cbsaCode
          LEFT JOIN ads ON ads.cbsaCode = g.cbsaCode
          LEFT JOIN normalized_census_market_context c ON c.cbsaCode = g.cbsaCode
          ORDER BY g.cbsaCode
        `);
        const numeric = (value: unknown) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
        const inputs: GrowthScreeningInput[] = rawInputs.map((row) => ({
          cbsaCode: String(row.cbsaCode), cbsaName: String(row.cbsaName),
          demand2024: numeric(row.demand2024), demand2025: numeric(row.demand2025),
          activeCustomersPer1000Households: numeric(row.activeCustomersPer1000Households),
          activeCustomerYoyGrowth: numeric(row.activeCustomerYoyGrowth),
          veterinarySearchConversions: numeric(row.veterinarySearchConversions),
          householdCount: numeric(row.householdCount), sourceIds: String(row.sourceIds ?? ""),
        }));
        const screening = calculateGrowthTestScreening(inputs);
        rows.push(...screening.included);
        metadata = {
          screeningVersion: GROWTH_TEST_SCREENING_VERSION,
          configurationFingerprint: GROWTH_TEST_SCREENING_FINGERPRINT,
          weights: GROWTH_TEST_SCREENING_WEIGHTS,
          eligibleMarketCount: screening.included.length,
          excludedMarketCount: screening.excluded.length,
          exclusions: screening.excluded,
          tieBreak: "cbsa_code_ascending",
          missingDataRule: "Exclude markets missing any configured input; do not renormalize weights.",
        };
        warnings.push("The growth-test screening rank is Hypothesis evidence for the local demo only. It does not recommend a market, launch, campaign, or spend decision.");
        warnings.push(`${screening.excluded.length} markets were excluded because at least one configured metric was missing.`);
        break;
      }
    }
  } finally {
    await closeDuckDb(handle);
  }
  return normalizedQueryResponseSchema.parse({
    requestId: request.requestId,
    snapshotVersion: manifest.snapshotVersion,
    queryVersion: NORMALIZED_QUERY_VERSION,
    calculationVersion: NORMALIZED_CALCULATION_VERSION,
    query: request.query,
    cbsaCode: request.cbsaCode ?? null,
    rows,
    sourceIds: sourceIds(rows),
    warnings: [...new Set(warnings)],
    metadata,
    allowedUse: "local_demo_aggregate_decision_support",
    scoringEligibility: "none",
  });
}
