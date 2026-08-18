import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { DuckDBConnection } from "@duckdb/node-api";
import { openDuckDb, closeDuckDb, sqlString } from "../lib/evidence-snapshot/duckdb.ts";

const SNAPSHOT_VERSION = "chewy-brand-health-2024-dma-generation-v1";
const SOURCE_ID = "SRC-033";
const PYTHON_SCRIPT = resolve("scripts/extract-brand-health-ppt.py");

function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback ?? "";
}

function sha256(content: Buffer | string): string { return createHash("sha256").update(content).digest("hex"); }

async function runPython(input: string, output: string) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.env.PYTHON_BIN || "python3", [PYTHON_SCRIPT, input, output], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`PPT extraction failed with exit code ${code}`)));
  });
}

async function count(connection: DuckDBConnection, table: string): Promise<number> {
  const reader = await connection.runAndReadAll(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(reader.getRowObjectsJson()[0]?.count ?? 0);
}

async function scalar(connection: DuckDBConnection, sql: string): Promise<number> {
  const reader = await connection.runAndReadAll(sql);
  return Number(Object.values(reader.getRowObjectsJson()[0] ?? {})[0] ?? 0);
}

async function build() {
  const input = arg("--input", "/Users/nnair/Downloads/RPT_Chewy DMA Add On_Full Report_6-27-24_vf.pptx");
  const output = arg("--output", `data/approved/consumer-insights/${SNAPSHOT_VERSION}`);
  if (!input || !output) throw new Error("Both --input and --output are required.");
  await mkdir(output, { recursive: true });
  const rawDir = join(output, "_extracted");
  const parquetDir = join(output, "parquet");
  await mkdir(rawDir, { recursive: true });
  await mkdir(parquetDir, { recursive: true });
  await runPython(input, rawDir);

  const handle = await openDuckDb(":memory:");
  const { connection } = handle;
  const csv = (name: string) => sqlString(join(rawDir, name));
  const json = (name: string) => sqlString(join(rawDir, name));
  const tables: Array<{ table: string; source: string; sql: string; grain: string }> = [
    { table: "dma_reference", source: "dma-reference.csv", grain: "one source-derived DMA x snapshot", sql: `SELECT dma_id, dma_name, dma_name_raw, geography_type, reference_version, source_id, status FROM read_csv_auto(${csv("dma-reference.csv")}, header=true, all_varchar=true)` },
    { table: "dma_market_profile", source: "dma-profiles.csv", grain: "one DMA x study wave", sql: `SELECT dma_id, dma_name, dma_code_in_source, region, county_coverage, TRY_CAST(bdi AS DOUBLE) AS bdi, TRY_CAST(cdi AS DOUBLE) AS cdi, TRY_CAST(pet_owner_population_millions AS DOUBLE) AS pet_owner_population_millions, study_wave, field_start::DATE AS field_start, field_end::DATE AS field_end, source_id, source_status, evidence_status FROM read_csv_auto(${csv("dma-profiles.csv")}, header=true, all_varchar=true)` },
    { table: "dma_brand_funnel", source: "brand-funnel-observations.csv", grain: "one DMA x segment x brand x funnel metric", sql: `SELECT dma_id, dma_name, segment, brand, metric, value_raw, TRY_CAST(value AS DOUBLE) AS value, value_unit, TRY_CAST(rank AS INTEGER) AS rank, TRY_CAST(significant AS BOOLEAN) AS significant, direction, source_id, source_slide, evidence_status FROM read_csv_auto(${csv("brand-funnel-observations.csv")}, header=true, all_varchar=true)` },
    { table: "dma_brand_relevance", source: "brand-relevance-observations.csv", grain: "one DMA x segment x brand x relevance metric", sql: `SELECT dma_id, dma_name, segment, brand, metric, value_raw, TRY_CAST(value AS DOUBLE) AS value, value_unit, TRY_CAST(rank AS INTEGER) AS rank, TRY_CAST(significant AS BOOLEAN) AS significant, direction, source_id, source_slide, evidence_status FROM read_csv_auto(${csv("brand-relevance-observations.csv")}, header=true, all_varchar=true)` },
    { table: "dma_brand_driver", source: "brand-driver-observations.csv", grain: "one DMA x segment x brand x driver attribute", sql: `SELECT dma_id, dma_name, segment, brand, attribute, TRY_CAST(driver_order AS INTEGER) AS driver_order, value_raw, TRY_CAST(value AS DOUBLE) AS value, value_unit, TRY_CAST(rank AS INTEGER) AS rank, TRY_CAST(significant AS BOOLEAN) AS significant, direction, source_id, source_slide, evidence_status FROM read_csv_auto(${csv("brand-driver-observations.csv")}, header=true, all_varchar=true)` },
    { table: "dma_generation_funnel", source: "generation-funnel-observations.csv", grain: "one DMA x generation x brand x funnel metric", sql: `SELECT dma_id, dma_name, segment, brand, metric, value_raw, TRY_CAST(value AS DOUBLE) AS value, value_unit, TRY_CAST(rank AS INTEGER) AS rank, TRY_CAST(significant AS BOOLEAN) AS significant, source_id, source_slide, evidence_status, TRY_CAST(sample_size AS INTEGER) AS sample_size FROM read_csv_auto(${csv("generation-funnel-observations.csv")}, header=true, all_varchar=true)` },
    { table: "dma_generation_driver", source: "generation-driver-observations.csv", grain: "one DMA x generation x brand x driver attribute", sql: `SELECT dma_id, dma_name, segment, brand, attribute, TRY_CAST(driver_order AS INTEGER) AS driver_order, value_raw, TRY_CAST(value AS DOUBLE) AS value, value_unit, TRY_CAST(rank AS INTEGER) AS rank, TRY_CAST(significant AS BOOLEAN) AS significant, source_id, source_slide, evidence_status, TRY_CAST(sample_size AS INTEGER) AS sample_size FROM read_csv_auto(${csv("generation-driver-observations.csv")}, header=true, all_varchar=true)` },
    { table: "consumer_insights_source_cells", source: "extracted-table-cells.json", grain: "one source slide x table x row x cell", sql: `SELECT * FROM read_json_auto(${json("extracted-table-cells.json")}, records=true, format='array')` },
    { table: "consumer_insights_generation_cells", source: "generation-table-cells.json", grain: "one generation source slide x table x row x cell", sql: `SELECT * FROM read_json_auto(${json("generation-table-cells.json")}, records=true, format='array')` },
    { table: "consumer_insights_claim", source: "none", grain: "one reviewed narrative or statistical claim", sql: "SELECT CAST(NULL AS VARCHAR) AS claim_id, CAST(NULL AS VARCHAR) AS claim_type, CAST(NULL AS VARCHAR) AS claim_text, CAST(NULL AS VARCHAR) AS source_id, CAST(NULL AS INTEGER) AS source_slide, CAST(NULL AS VARCHAR) AS evidence_status WHERE FALSE" },
  ];
  const outputs: Array<Record<string, unknown>> = [];
  for (const item of tables) {
    await connection.run(`CREATE OR REPLACE TABLE ${item.table} AS ${item.sql}`);
    const parquetPath = join(parquetDir, `${item.table}.parquet`);
    await connection.run(`COPY (SELECT * FROM ${item.table}) TO ${sqlString(parquetPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
    const bytes = await readFile(parquetPath);
    outputs.push({ path: `parquet/${basename(parquetPath)}`, rowCount: await count(connection, item.table), sha256: sha256(bytes), grain: item.grain, allowedUse: "local market-context and consumer-insight review pending owner approval" });
  }
  const qualityChecks = {
    profile_duplicate_keys: await scalar(connection, "SELECT COUNT(*) - COUNT(DISTINCT dma_id) FROM dma_market_profile"),
    funnel_duplicate_keys: await scalar(connection, "SELECT COUNT(*) - COUNT(DISTINCT concat_ws('|', dma_id, segment, brand, metric, source_slide)) FROM dma_brand_funnel"),
    driver_duplicate_keys: await scalar(connection, "SELECT COUNT(*) - COUNT(DISTINCT concat_ws('|', dma_id, segment, brand, attribute, source_slide)) FROM dma_brand_driver"),
    funnel_out_of_range_values: await scalar(connection, "SELECT COUNT(*) FROM dma_brand_funnel WHERE value < 0 OR value > 100"),
    relevance_out_of_range_values: await scalar(connection, "SELECT COUNT(*) FROM dma_brand_relevance WHERE value < 0 OR value > 100"),
    funnel_null_values: await scalar(connection, "SELECT COUNT(*) FROM dma_brand_funnel WHERE value IS NULL"),
    generation_invalid_dma_rows: await scalar(connection, "SELECT COUNT(*) FROM dma_generation_funnel WHERE dma_id NOT LIKE 'DMA_%' OR dma_name IN ('Rank in', 'Unknown')"),
  };
  if (qualityChecks.profile_duplicate_keys || qualityChecks.funnel_duplicate_keys || qualityChecks.driver_duplicate_keys || qualityChecks.funnel_out_of_range_values || qualityChecks.relevance_out_of_range_values || qualityChecks.generation_invalid_dma_rows) {
    await closeDuckDb(handle);
    throw new Error(`Consumer-insights quality gate failed: ${JSON.stringify(qualityChecks)}`);
  }
  await closeDuckDb(handle);
  const extractedManifest = JSON.parse(await readFile(join(rawDir, "manifest.json"), "utf8"));
  const sourceBytes = await readFile(input);
  const manifest = {
    manifest_version: "consumer-insights-parquet-v1",
    snapshot_version: SNAPSHOT_VERSION,
    built_at: new Date().toISOString(),
    source_id: SOURCE_ID,
    source_file: basename(input),
    source_sha256: sha256(sourceBytes),
    extraction_version: extractedManifest.manifest_version,
    normalization_version: "consumer-insights-normalization-v1",
    geography_reference_version: "source-slide-derived-v1",
    source_status: "Workspace only",
    evidence_status: "Reported",
    sensitivity: "confidential",
    allowed_use: "local market-context and consumer-insight review pending owner approval",
    scoring_eligibility: "none",
    field_start: "2024-04-11",
    field_end: "2024-05-15",
    sample: extractedManifest.sample,
    outputs,
    quality_checks: qualityChecks,
    exclusions: ["No DMA-to-CBSA join", "No clinic-site scoring", "No causal interpretation", "Raw PPTX and source-cell audit tables are not browser or AI outputs"],
    known_issues: [...(extractedManifest.known_issues ?? []), "Narrative and correlation claims remain unregistered until reviewed.", `${qualityChecks.funnel_null_values} funnel observations have null values and remain visible as missing.`],
    derivations: { dma_id: "Stable snapshot-derived ID from normalized DMA name; not an external Nielsen identifier.", value: "Percentage parsed from displayed source value.", rank: "Rank parsed from parenthesized displayed source value.", significant: "True when the source cell contains the source significance marker." },
  };
  await writeFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(output, "README.md"), ["# Consumer insights snapshot", "", `Snapshot: ${SNAPSHOT_VERSION}`, "", "This confidential, workspace-only snapshot contains reported survey observations from the supplied June 2024 Brand Health Tracker deck. It is suitable for dated DMA consumer and brand context after owner approval. It has no DMA-to-CBSA join and no scoring eligibility.", "", "Parquet tables are registered through the consumer-insights DuckDB query boundary.", ""].join("\n"));
  console.log(JSON.stringify({ snapshotVersion: SNAPSHOT_VERSION, output, qualityChecks, outputs: outputs.map((item) => ({ path: item.path, rowCount: item.rowCount })) }, null, 2));
}

await build();
