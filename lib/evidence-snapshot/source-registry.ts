import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { sqlString } from "./duckdb.ts";

export const sourceDatasetRegistry = {
  market_context: { tableName: "source_market_context_raw", env: "SNOWFLAKE_MARKET_FILE", defaultFile: "cbsa_market_attractiveness_2026-07-31-1246 (1).csv", sourceId: "SNOWFLAKE-CSV-MARKET-CONTEXT", grain: "one CBSA market x reporting date", allowedUse: "approved_internal_decision_support", sensitivity: "internal", aiExposure: "aggregate_only" },
  clinic_profile: { tableName: "source_clinic_profile_raw", env: "SNOWFLAKE_CLINIC_PROFILE_FILE", defaultFile: "clinic_market_profile_ownership_demographics.csv", sourceId: "SNOWFLAKE-CSV-CLINIC-PROFILE", grain: "one clinic profile row", allowedUse: "approved_internal_decision_support_pending_identity_rule", sensitivity: "confidential", aiExposure: "aggregate_only" },
  clinic_activity: { tableName: "source_clinic_activity_raw", env: "SNOWFLAKE_CLINIC_ACTIVITY_FILE", defaultFile: "clinic_level_pre_post_ph_orders_prescriptions_sales.csv", sourceId: "SNOWFLAKE-CSV-CLINIC-ACTIVITY", grain: "one clinic x timeframe activity row", allowedUse: "approved_internal_decision_support_pending_outcome_rule", sensitivity: "confidential", aiExposure: "aggregate_only" },
  zip_market: { tableName: "source_zip_market_raw", env: "SNOWFLAKE_ZIP_CBSA_FILE", defaultFile: "zip_code_to_cbsa_csa_statistical_area_mapping.csv", sourceId: "SNOWFLAKE-CSV-ZIP-MARKET", grain: "one ZIP x CBSA mapping", allowedUse: "approved_internal_decision_support", sensitivity: "internal", aiExposure: "aggregate_only" },
  cbsa_population: { tableName: "source_cbsa_population_raw", env: "SNOWFLAKE_CBSA_POPULATION_FILE", defaultFile: "cbsa_population_estimates.csv", sourceId: "SNOWFLAKE-CSV-CBSA-POPULATION", grain: "one CBSA x population estimate", allowedUse: "approved_internal_decision_support", sensitivity: "internal", aiExposure: "aggregate_only" },
  zip_context: { tableName: "source_zip_context_raw", env: "SNOWFLAKE_ZIP_CONTEXT_FILE", defaultFile: "zcta5_household_income_and_family_estimates_2026-08-10.csv", sourceId: "SNOWFLAKE-CSV-ZIP-CONTEXT", grain: "one ZIP x household context", allowedUse: "approved_internal_decision_support", sensitivity: "internal", aiExposure: "aggregate_only" },
  regional_demand: { tableName: "source_regional_demand_raw", env: "SNOWFLAKE_ZIP_SALES_FILE", defaultFile: "annual_net_sales_by_customer_zip.csv", sourceId: "SNOWFLAKE-CSV-REGIONAL-DEMAND", grain: "one customer-address ZIP x year", allowedUse: "approved_internal_decision_support", sensitivity: "confidential", aiExposure: "aggregate_only" },
  zip_metro: { tableName: "source_zip_metro_raw", env: "SNOWFLAKE_ZIP_METRO_FILE", defaultFile: "customer_zip_to_metro_state_mapping.csv", sourceId: "SNOWFLAKE-CSV-ZIP-METRO", grain: "one ZIP x metro x state", allowedUse: "approved_internal_decision_support", sensitivity: "internal", aiExposure: "aggregate_only" },
  retention: { tableName: "source_retention_raw", env: "SNOWFLAKE_RETENTION_FILE", defaultFile: "weekly_customer_lifecycle_retention_metrics_by_channel.csv", sourceId: "SNOWFLAKE-CSV-RETENTION", grain: "one week x aggregation level x business channel", allowedUse: "approved_internal_decision_support", sensitivity: "internal", aiExposure: "aggregate_only" },
  appointments: { tableName: "source_appointments_raw", env: "SNOWFLAKE_APPOINTMENTS_FILE", defaultFile: "monthly_appointment_counts_by_geography_type_state_reason.csv", sourceId: "SNOWFLAKE-CSV-APPOINTMENTS", grain: "one state x month x appointment dimensions", allowedUse: "approved_internal_decision_support", sensitivity: "internal", aiExposure: "aggregate_only" },
} as const;

export type SourceDatasetId = keyof typeof sourceDatasetRegistry;
export const sourceDatasetIds = Object.keys(sourceDatasetRegistry) as SourceDatasetId[];
export const sourceRegistryRecordSchema = z.object({
  datasetId: z.string(), tableName: z.string(), sourceId: z.string(), fileName: z.string(), filePath: z.string(), sha256: z.string(), expectedGrain: z.string(), sensitivity: z.string(), allowedUse: z.string(), aiExposure: z.enum(["none", "aggregate_only", "approved_detail"]), rowCount: z.number().int().nonnegative(), columnNames: z.array(z.string()),
});
export type SourceRegistryRecord = z.infer<typeof sourceRegistryRecordSchema>;

export function sourceDirectory(): string | null {
  const value = process.env.EVIDENCE_SOURCE_DIR?.trim() || process.env.SNOWFLAKE_EXPORT_DIR?.trim();
  return value ? resolve(value) : null;
}

export function sourceFilePath(datasetId: SourceDatasetId, directory: string): string {
  const definition = sourceDatasetRegistry[datasetId];
  return resolve(directory, process.env[definition.env]?.trim() || definition.defaultFile);
}

export async function inspectSourceFiles(directory = sourceDirectory()): Promise<SourceRegistryRecord[]> {
  if (!directory) return [];
  const records: SourceRegistryRecord[] = [];
  for (const datasetId of sourceDatasetIds) {
    const definition = sourceDatasetRegistry[datasetId];
    const filePath = sourceFilePath(datasetId, directory);
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    const header = lines[0]?.split(",").map((value) => value.trim().replace(/^"|"$/g, "")) ?? [];
    records.push(sourceRegistryRecordSchema.parse({ datasetId, tableName: definition.tableName, sourceId: definition.sourceId, fileName: basename(filePath), filePath, sha256: createHash("sha256").update(content).digest("hex"), expectedGrain: definition.grain, sensitivity: definition.sensitivity, allowedUse: definition.allowedUse, aiExposure: definition.aiExposure, rowCount: Math.max(0, lines.length - 1), columnNames: header }));
  }
  return records;
}

export function csvReadSql(path: string): string {
  return `read_csv_auto(${sqlString(path)}, header=true, all_varchar=true, ignore_errors=false, sample_size=-1)`;
}
