import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { closeDuckDb, duckDbPath, openDuckDb, sqlString } from "../evidence-snapshot/duckdb.ts";
import { CONSUMER_INSIGHTS_QUERY_VERSION, consumerInsightsManifestSchema, consumerInsightsQuerySchema, dmaCbsaCrosswalkSchema, type ConsumerInsightsQuery } from "./contracts.ts";

export function consumerInsightsSnapshotDirectory(): string {
  return resolve(process.env.CONSUMER_INSIGHTS_SNAPSHOT_DIR?.trim() || "data/approved/consumer-insights/chewy-brand-health-2024-dma-generation-v1");
}

async function loadDmaCbsaMappings(snapshotDir: string) {
  let raw: string;
  try {
    raw = await readFile(join(snapshotDir, "dma-cbsa-crosswalk.json"), "utf8");
  } catch {
    raw = await readFile(resolve("data/contracts/consumer-insights/dma-cbsa-crosswalk.json"), "utf8");
  }
  const crosswalk = dmaCbsaCrosswalkSchema.parse(JSON.parse(raw));
  return crosswalk.mappings;
}

function dmaIdForName(name: string): string {
  return `DMA_${name.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_").replaceAll(/^_|_$/g, "")}`;
}

function parquet(dir: string, table: string): string { return sqlString(join(dir, "parquet", `${table}.parquet`)); }

export async function queryConsumerInsights(input: ConsumerInsightsQuery, options: { snapshotDir?: string; databasePath?: string } = {}) {
  const parsed = consumerInsightsQuerySchema.parse(input);
  const snapshotDir = resolve(options.snapshotDir ?? consumerInsightsSnapshotDirectory());
  const manifest = consumerInsightsManifestSchema.parse(JSON.parse(await readFile(join(snapshotDir, "manifest.json"), "utf8")));
  if (manifest.snapshot_version !== parsed.snapshotVersion) throw new Error("The requested consumer-insights snapshot version is unavailable.");
  const crosswalk = await loadDmaCbsaMappings(snapshotDir);
  const cbsaMapping = "cbsaCode" in parsed ? crosswalk.find((item) => item.cbsa_code === parsed.cbsaCode) : undefined;
  if ("cbsaCode" in parsed && !cbsaMapping) throw new Error(`No intuitive DMA-to-CBSA mapping exists for CBSA ${parsed.cbsaCode}.`);
  const parsedDmaId = "dmaId" in parsed ? parsed.dmaId ?? null : cbsaMapping ? dmaIdForName(cbsaMapping.dma_name) : null;
  const handle = await openDuckDb(options.databasePath ?? duckDbPath());
  const { connection } = handle;
  const values: (string | null)[] = [];
  let sql = "";
  const filters = (alias: string, includeBrand = false) => {
    const clauses = [`${alias}.dma_id = ?`]; values.push(parsedDmaId);
    if ("segment" in parsed && parsed.segment) { clauses.push(`${alias}.segment = ?`); values.push(parsed.segment); }
    if (includeBrand && "brand" in parsed && parsed.brand) { clauses.push(`${alias}.brand = ?`); values.push(parsed.brand); }
    return clauses.join(" AND ");
  };
  switch (parsed.query) {
    case "consumer_insights_by_dma":
      sql = `SELECT * FROM read_parquet(${parquet(snapshotDir, "dma_market_profile")}) p WHERE (? IS NULL OR p.dma_id = ?) AND (? IS NULL OR p.dma_name = ?) LIMIT 100`; values.push(parsed.dmaId ?? null, parsed.dmaId ?? null, parsed.dmaName ?? null, parsed.dmaName ?? null); break;
    case "consumer_insights_by_cbsa":
      sql = `SELECT p.*, '${cbsaMapping!.cbsa_code}' AS mapped_cbsa_code, '${cbsaMapping!.cbsa_name.replaceAll("'", "''")}' AS mapped_cbsa_name FROM read_parquet(${parquet(snapshotDir, "dma_market_profile")}) p WHERE p.dma_id = ? LIMIT 100`; values.push(parsedDmaId); break;
    case "brand_funnel_by_dma": sql = `SELECT * FROM read_parquet(${parquet(snapshotDir, "dma_brand_funnel")}) b WHERE ${filters("b", true)} ORDER BY b.metric, b.rank`; break;
    case "brand_funnel_by_cbsa": sql = `SELECT b.*, '${cbsaMapping!.cbsa_code}' AS mapped_cbsa_code, '${cbsaMapping!.cbsa_name.replaceAll("'", "''")}' AS mapped_cbsa_name FROM read_parquet(${parquet(snapshotDir, "dma_brand_funnel")}) b WHERE ${filters("b", true)} ORDER BY b.metric, b.rank`; break;
    case "brand_relevance_drivers_by_dma": sql = `SELECT * FROM read_parquet(${parquet(snapshotDir, "dma_brand_driver")}) d WHERE ${filters("d", true)} ORDER BY d.driver_order, d.brand`; break;
    case "brand_relevance_drivers_by_cbsa": sql = `SELECT d.*, '${cbsaMapping!.cbsa_code}' AS mapped_cbsa_code, '${cbsaMapping!.cbsa_name.replaceAll("'", "''")}' AS mapped_cbsa_name FROM read_parquet(${parquet(snapshotDir, "dma_brand_driver")}) d WHERE ${filters("d", true)} ORDER BY d.driver_order, d.brand`; break;
    case "brand_health_by_generation": sql = `SELECT 'funnel' AS evidence_type, g.dma_id, g.dma_name, g.segment, g.brand, g.metric, CAST(NULL AS VARCHAR) AS attribute, g.value_raw, g.value, g.value_unit, g.rank, g.significant, g.source_id, g.source_slide, g.evidence_status, g.sample_size FROM read_parquet(${parquet(snapshotDir, "dma_generation_funnel")}) g WHERE ${filters("g", true)} UNION ALL SELECT 'driver' AS evidence_type, d.dma_id, d.dma_name, d.segment, d.brand, CAST(NULL AS VARCHAR) AS metric, d.attribute, d.value_raw, d.value, d.value_unit, d.rank, d.significant, d.source_id, d.source_slide, d.evidence_status, d.sample_size FROM read_parquet(${parquet(snapshotDir, "dma_generation_driver")}) d WHERE ${filters("d", true)} ORDER BY evidence_type, metric, attribute, rank`; break;
    case "brand_health_by_cbsa": sql = `SELECT 'funnel' AS evidence_type, g.dma_id, g.dma_name, g.segment, g.brand, g.metric, CAST(NULL AS VARCHAR) AS attribute, g.value_raw, g.value, g.value_unit, g.rank, g.significant, g.source_id, g.source_slide, g.evidence_status, g.sample_size, '${cbsaMapping!.cbsa_code}' AS mapped_cbsa_code, '${cbsaMapping!.cbsa_name.replaceAll("'", "''")}' AS mapped_cbsa_name FROM read_parquet(${parquet(snapshotDir, "dma_generation_funnel")}) g WHERE ${filters("g", true)} UNION ALL SELECT 'driver' AS evidence_type, d.dma_id, d.dma_name, d.segment, d.brand, CAST(NULL AS VARCHAR) AS metric, d.attribute, d.value_raw, d.value, d.value_unit, d.rank, d.significant, d.source_id, d.source_slide, d.evidence_status, d.sample_size, '${cbsaMapping!.cbsa_code}' AS mapped_cbsa_code, '${cbsaMapping!.cbsa_name.replaceAll("'", "''")}' AS mapped_cbsa_name FROM read_parquet(${parquet(snapshotDir, "dma_generation_driver")}) d WHERE ${filters("d", true)} ORDER BY evidence_type, metric, attribute, rank`; break;
    case "consumer_insights_source_quality": sql = `SELECT '${manifest.snapshot_version}' AS snapshot_version, '${manifest.source_id}' AS source_id, '${manifest.source_status}' AS source_status, '${manifest.evidence_status}' AS evidence_status, '${manifest.sensitivity}' AS sensitivity, '${manifest.scoring_eligibility}' AS scoring_eligibility, ${manifest.outputs.length} AS parquet_table_count, ${manifest.known_issues.length} AS known_issue_count`; break;
  }
  try {
    const reader = await connection.runAndReadAll(sql, values);
    const rows = reader.getRowObjectsJson();
    await closeDuckDb(handle);
    const qualityWarnings = manifest.known_issues.map((issue) => issue === "DMA identifiers are preserved as source labels; no DMA-to-CBSA join was performed."
      ? "DMA identifiers are preserved as source labels; the local demo uses a Derived intuitive DMA-to-CBSA alignment, not a source-native or licensed crosswalk."
      : issue);
    return { query: parsed.query, rows, snapshotVersion: manifest.snapshot_version, queryVersion: CONSUMER_INSIGHTS_QUERY_VERSION, evidenceBoundary: "Registered aggregate consumer-insights evidence only. Intuitive DMA-to-CBSA alignment is derived local-demo context and carries review metadata. No scoring, causal interpretation, or arbitrary SQL.", allowedUse: manifest.allowed_use, qualityWarnings: [...qualityWarnings, ...(cbsaMapping ? [`DMA ${cbsaMapping.dma_name} aligned to CBSA ${cbsaMapping.cbsa_code} by intuitive metro-name mapping (${cbsaMapping.confidence} confidence); owner review remains ${cbsaMapping.review_state}.`] : [])], sourceId: manifest.source_id };
  } catch (error) {
    await closeDuckDb(handle);
    throw new Error(`Consumer-insights query failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
