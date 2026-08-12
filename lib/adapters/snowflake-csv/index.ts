import {
  ClinicIdentityRecord,
  ClinicPerformanceRecord,
  DemandRecord,
  MarketContextRecord,
  type ProvenanceRecord,
  ZipMarketRecord,
} from "../../snowflake-canonical/index.ts";
import { parseCsv, booleanOrNull, integerOrNull, normalizeZip, numberOrNull } from "./parser.ts";

export type AdapterWarning = {
  code: string;
  message: string;
  row?: number;
  value?: string;
};

export type AdapterResult<T> = {
  records: T[];
  warnings: AdapterWarning[];
  rejectedRows: Array<{ row: number; reason: string }>;
};

const SOURCE_IDS = {
  market: "SNOWFLAKE-CSV-MARKET-ATTRACTIVENESS-2026-07-31",
  geography: "SNOWFLAKE-CSV-GEOGRAPHY-2026-08-10",
  demand: "SNOWFLAKE-CSV-ZIP-SALES-2026-08-10",
  clinic: "SNOWFLAKE-CSV-CLINIC-2026-08-10",
} as const;

function baseProvenance(
  sourceId: string,
  sourceFile: string,
  observedAt: string | null,
  geography: string,
  grain: string,
  qualityStatus: "accepted" | "warning" | "rejected" = "accepted",
): ProvenanceRecord {
  return {
    sourceId,
    sourceFile,
    observedAt,
    extractedAt: new Date().toISOString(),
    geography,
    grain,
    evidenceStatus: "Reported",
    qualityStatus,
    sensitivity: "internal",
    allowedUse: "pending_governance_review",
  };
}

export function adaptMarketContext(csv: string, sourceFile = "market_attractiveness.csv"): AdapterResult<MarketContextRecord> {
  const rows = parseCsv(csv);
  const records: MarketContextRecord[] = [];
  const warnings: AdapterWarning[] = [];
  const rejectedRows: AdapterResult<MarketContextRecord>["rejectedRows"] = [];
  const locationTriples = new Set<string>();
  rows.forEach((row, index) => {
    const cbsaCode = row.CBSA_CODE?.trim() || null;
    if (!cbsaCode) warnings.push({ code: "missing_cbsa_code", message: "Market cannot be joined by stable CBSA code.", row: index + 2 });
    locationTriples.add(`${row.LOCATION_MATCHED_CUSTOMER_COUNT}|${row.LOCATION_UNMATCHED_CUSTOMER_COUNT}|${row.LOCATION_MATCH_RATE}`);
    const record = {
      marketId: cbsaCode ? `cbsa:${cbsaCode}` : `unassigned:${index + 1}`,
      cbsaCode,
      cbsaName: row.CBSA_NAME,
      reportingDate: row.REPORTING_DATE,
      activeCustomerCount: integerOrNull(row.ACTIVE_CUSTOMER_COUNT),
      priorYearActiveCustomerCount: integerOrNull(row.ACTIVE_CUSTOMER_COUNT_PRIOR_YEAR),
      activeCustomerYoyGrowth: numberOrNull(row.ACTIVE_CUSTOMER_YOY_GROWTH),
      totalHouseholds: integerOrNull(row.TOTAL_HOUSEHOLDS),
      activeCustomersPer1000Households: numberOrNull(row.ACTIVE_CUSTOMERS_PER_1000_HOUSEHOLDS),
      populationEstimate: null,
      provenance: baseProvenance(
        SOURCE_IDS.market,
        sourceFile,
        row.REPORTING_DATE || null,
        "CBSA",
        "one CBSA market x reporting date",
        row.QUALITY_STATUS === "OK" ? "accepted" : "warning",
      ),
    };
    if (!row.CBSA_NAME || !row.REPORTING_DATE) rejectedRows.push({ row: index + 2, reason: "missing market name or reporting date" });
    else records.push(MarketContextRecord.parse(record));
  });
  if (locationTriples.size === 1 && rows.length > 1) {
    warnings.push({ code: "repeated_location_totals", message: "Location-match totals are identical across all market rows and are excluded from canonical market metrics." });
  }
  return { records, warnings, rejectedRows };
}

export function adaptZipMarket(csv: string, sourceFile = "zip_cbsa.csv"): AdapterResult<ZipMarketRecord> {
  const rows = parseCsv(csv);
  const records: ZipMarketRecord[] = [];
  const warnings: AdapterWarning[] = [];
  const rejectedRows: AdapterResult<ZipMarketRecord>["rejectedRows"] = [];
  rows.forEach((row, index) => {
    const zip = normalizeZip(row.ZIP_CODE);
    if (!zip || !row.CBSA_TITLE) {
      rejectedRows.push({ row: index + 2, reason: "missing normalized ZIP or CBSA title" });
      return;
    }
    records.push(ZipMarketRecord.parse({
      zip,
      cbsaName: row.CBSA_TITLE,
      statisticalAreaType: row.METRO_MICRO_STATISTICAL_AREA,
      provenance: baseProvenance(SOURCE_IDS.geography, sourceFile, null, "ZIP", "one ZIP x CBSA mapping"),
    }));
  });
  const uniqueZips = new Set(records.map((record) => record.zip));
  if (uniqueZips.size !== records.length) warnings.push({ code: "duplicate_zip_mapping", message: "More than one row maps to the same ZIP; relationship requires review." });
  return { records, warnings, rejectedRows };
}

export function adaptZipSales(csv: string, sourceFile = "zip_sales.csv", zipToMarket = new Map<string, string>()): AdapterResult<DemandRecord> {
  const rows = parseCsv(csv);
  const records: DemandRecord[] = [];
  const warnings: AdapterWarning[] = [];
  const rejectedRows: AdapterResult<DemandRecord>["rejectedRows"] = [];
  rows.forEach((row, index) => {
    const zip = normalizeZip(row.CUSTOMER_ADDRESS_ZIP);
    const year = integerOrNull(row.YEAR);
    if (!zip || !year) {
      rejectedRows.push({ row: index + 2, reason: "missing ZIP or valid year" });
      return;
    }
    records.push(DemandRecord.parse({
      geographyId: `zip:${zip}`,
      marketId: zipToMarket.get(zip) ?? null,
      year,
      netSales: numberOrNull(row.NET_SALES),
      netSalesExcludingRefunds: numberOrNull(row.NET_SALES_EXCLUDING_REFUNDS),
      provenance: baseProvenance(SOURCE_IDS.demand, sourceFile, String(year), "ZIP", "one ZIP x year", "warning"),
    }));
  });
  if (records.some((record) => record.marketId === null)) warnings.push({ code: "unassigned_market", message: "Some demand rows lack an approved ZIP-to-market assignment." });
  warnings.push({ code: "customer_address_sales", message: "ZIP-level customer-address sales remain restricted pending governance approval." });
  return { records, warnings, rejectedRows };
}

export function adaptClinicIdentity(csv: string, sourceFile = "clinic_profile.csv"): AdapterResult<ClinicIdentityRecord> {
  const rows = parseCsv(csv);
  const records: ClinicIdentityRecord[] = [];
  const warnings: AdapterWarning[] = [];
  const rejectedRows: AdapterResult<ClinicIdentityRecord>["rejectedRows"] = [];
  rows.forEach((row, index) => {
    if (!row.CLINIC_ID) {
      rejectedRows.push({ row: index + 2, reason: "missing clinic ID" });
      return;
    }
    const zip = normalizeZip(row.ZIP_CODE);
    if (!zip) warnings.push({ code: "missing_clinic_zip", message: "Clinic has no normalized ZIP and cannot be assigned to a market.", row: index + 2 });
    records.push(ClinicIdentityRecord.parse({
      clinicId: row.CLINIC_ID,
      zip,
      marketId: null,
      businessStartDate: row.BUSINESS_START_DATE || null,
      tenure: integerOrNull(row.TENURE),
      corporateClinic: booleanOrNull(row.CORPORATE_CLINIC_FLAG),
      practiceHubClinic: booleanOrNull(row.PH_CLINIC_FLAG),
      pharmacyBusinessClinic: booleanOrNull(row.PBC_CLINIC_FLAG),
      provenance: baseProvenance(SOURCE_IDS.clinic, sourceFile, null, "clinic ZIP", "one clinic ID", "warning"),
    }));
  });
  warnings.push({ code: "clinic_identity_unknown", message: "CLINIC_ID physical-location semantics and approval status are unresolved." });
  return { records, warnings, rejectedRows };
}

export function adaptClinicPerformance(csv: string, sourceFile = "clinic_activity.csv"): AdapterResult<ClinicPerformanceRecord> {
  const rows = parseCsv(csv);
  const records: ClinicPerformanceRecord[] = [];
  const warnings: AdapterWarning[] = [];
  const rejectedRows: AdapterResult<ClinicPerformanceRecord>["rejectedRows"] = [];
  rows.forEach((row, index) => {
    if (!row.CLINIC_ID) {
      rejectedRows.push({ row: index + 2, reason: "missing clinic ID" });
      return;
    }
    records.push(ClinicPerformanceRecord.parse({
      clinicId: row.CLINIC_ID,
      metricId: "net_sales",
      rawValue: numberOrNull(row.NET_SALES),
      unit: "unknown_pending_metric_definition",
      observationWindowStart: row.LOW_RANGE_DATE || null,
      observationWindowEnd: row.UP_RANGE_DATE || null,
      maturityWeeks: null,
      provenance: baseProvenance(SOURCE_IDS.clinic, sourceFile, row.UP_RANGE_DATE || null, "clinic", "one clinic x configured observation window", "warning"),
    }));
  });
  warnings.push({ code: "performance_not_scoring_eligible", message: "Outcome definition, maturity rule, comparable cohort, and owner approval are unresolved." });
  return { records, warnings, rejectedRows };
}
