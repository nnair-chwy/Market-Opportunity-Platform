import {
  querySnapshot,
  type SnapshotQueryRequest,
} from "../evidence-snapshot/index.ts";
import {
  clinicEvidenceQuerySchema,
  clinicSiteEvidenceBundleSchema,
  clinicSiteEvidenceRequestSchema,
  retrievalResultSchema,
  type ClinicEvidenceQuery,
  type ClinicSiteEvidenceBundle,
  type ClinicSiteEvidenceRequest,
  type RetrievalResult,
} from "./contracts.ts";

export type EvidenceQueryExecutor = (request: SnapshotQueryRequest) => Promise<{
  rows: unknown[];
  sourceDatasetsLoaded?: string[];
  qualityWarnings?: string[];
}>;

const resultCache = new Map<string, RetrievalResult>();

function cacheKey(query: ClinicEvidenceQuery, request: ClinicSiteEvidenceRequest): string {
  return JSON.stringify({ query, ...request });
}

function snapshotRequest(
  query: ClinicEvidenceQuery,
  request: ClinicSiteEvidenceRequest,
): SnapshotQueryRequest {
  switch (query) {
    case "market_context_by_cbsa":
      return { query, snapshotVersion: request.snapshotVersion, cbsaCode: request.cbsaCode };
    case "clinic_market_evidence":
      return { query, snapshotVersion: request.snapshotVersion, cbsaCode: request.cbsaCode };
    case "clinic_profile_by_market":
      return { query, snapshotVersion: request.snapshotVersion, cbsaName: request.cbsaName };
    case "clinic_activity_by_market":
      return { query, snapshotVersion: request.snapshotVersion, cbsaName: request.cbsaName };
    case "regional_demand_by_cbsa_year":
      return { query, snapshotVersion: request.snapshotVersion, cbsaName: request.cbsaName, year: request.year ?? undefined };
  }
}

function sourceIdsFor(query: ClinicEvidenceQuery): string[] {
  switch (query) {
    case "market_context_by_cbsa": return ["SNOWFLAKE-CSV-MARKET-CONTEXT"];
    case "clinic_market_evidence": return ["SNOWFLAKE-CSV-CLINIC-PROFILE", "SNOWFLAKE-CSV-ZIP-MARKET"];
    case "clinic_profile_by_market": return ["SNOWFLAKE-CSV-CLINIC-PROFILE"];
    case "clinic_activity_by_market": return ["SNOWFLAKE-CSV-CLINIC-ACTIVITY", "SNOWFLAKE-CSV-ZIP-MARKET"];
    case "regional_demand_by_cbsa_year": return ["SNOWFLAKE-CSV-REGIONAL-DEMAND", "SNOWFLAKE-CSV-ZIP-MARKET"];
  }
}

export class LocalEvidenceRetriever {
  private readonly execute: EvidenceQueryExecutor;

  constructor(execute: EvidenceQueryExecutor = async (request) => querySnapshot(request)) {
    this.execute = execute;
  }

  async retrieveClinicSiteEvidence(
    input: ClinicSiteEvidenceRequest,
  ): Promise<ClinicSiteEvidenceBundle> {
    const request = clinicSiteEvidenceRequestSchema.parse(input);
    const queries = clinicEvidenceQuerySchema.options;
    const results = await Promise.all(queries.map(async (query) => {
      const key = cacheKey(query, request);
      const cached = resultCache.get(key);
      if (cached) return retrievalResultSchema.parse({ ...cached, cacheStatus: "hit" });

      try {
        const response = await this.execute(snapshotRequest(query, request));
        const rows = response.rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
        const result = retrievalResultSchema.parse({
          query,
          cacheStatus: "miss",
          rows,
          sourceIds: sourceIdsFor(query),
          warnings: response.qualityWarnings ?? [],
          snapshotVersion: request.snapshotVersion,
        });
        resultCache.set(key, result);
        return result;
      } catch (error) {
        return retrievalResultSchema.parse({
          query,
          cacheStatus: "miss",
          rows: [],
          sourceIds: sourceIdsFor(query),
          warnings: [`${query} was unavailable: ${error instanceof Error ? error.message : "unknown retrieval error"}`],
          snapshotVersion: request.snapshotVersion,
        });
      }
    }));

    const availableQueryCount = results.filter((result) => result.rows.length > 0).length;
    const missingEvidence = results
      .filter((result) => result.rows.length === 0)
      .map((result) => result.query);
    const warnings = [...new Set(results.flatMap((result) => result.warnings))];

    return clinicSiteEvidenceBundleSchema.parse({
      contractVersion: "phoenix-local-retrieval-v1",
      request,
      results,
      sourceIds: [...new Set(results.flatMap((result) => result.sourceIds))],
      availableQueryCount,
      missingEvidence,
      warnings,
      cacheHits: results.filter((result) => result.cacheStatus === "hit").length,
    });
  }
}

export function clearLocalEvidenceCache() {
  resultCache.clear();
}
