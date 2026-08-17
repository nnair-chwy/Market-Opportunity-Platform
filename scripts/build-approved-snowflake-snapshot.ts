import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCsv, integerOrNull, normalizeZip, numberOrNull } from "../lib/adapters/snowflake-csv/parser.ts";

function requiredInputDirectory(): string {
  const value = process.env.SNOWFLAKE_EXPORT_DIR?.trim();
  if (!value) throw new Error("Set SNOWFLAKE_EXPORT_DIR to the directory containing the approved CSV exports.");
  return value;
}
const inputDir = requiredInputDirectory();
const outputDir = resolve(process.env.SNOWFLAKE_SNAPSHOT_DIR ?? "data/approved/snowflake/latest");
const acsPath = resolve("data/public/census/cbsa-acs/2024/market-context.json");
const siteIdentitiesPath = resolve("data/sample/esri/2026-07-30/site-identities.json");

const inputFiles = {
  marketAttractiveness: process.env.SNOWFLAKE_MARKET_FILE ?? "cbsa_market_attractiveness_2026-07-31-1246 (1).csv",
  clinicProfile: process.env.SNOWFLAKE_CLINIC_PROFILE_FILE ?? "clinic_market_profile_ownership_demographics.csv",
  clinicActivity: process.env.SNOWFLAKE_CLINIC_ACTIVITY_FILE ?? "clinic_level_pre_post_ph_orders_prescriptions_sales.csv",
  zipMarket: process.env.SNOWFLAKE_ZIP_CBSA_FILE ?? "zip_code_to_cbsa_csa_statistical_area_mapping.csv",
  cbsaPopulation: process.env.SNOWFLAKE_CBSA_POPULATION_FILE ?? "cbsa_population_estimates.csv",
  zipContext: process.env.SNOWFLAKE_ZIP_CONTEXT_FILE ?? "zcta5_household_income_and_family_estimates_2026-08-10.csv",
  regionalDemand: process.env.SNOWFLAKE_ZIP_SALES_FILE ?? "annual_net_sales_by_customer_zip.csv",
  zipMetro: process.env.SNOWFLAKE_ZIP_METRO_FILE ?? "customer_zip_to_metro_state_mapping.csv",
  retention: process.env.SNOWFLAKE_RETENTION_FILE ?? "weekly_customer_lifecycle_retention_metrics_by_channel.csv",
  appointments: process.env.SNOWFLAKE_APPOINTMENTS_FILE ?? "monthly_appointment_counts_by_geography_type_state_reason.csv",
};

type OutputFile = { path: string; rowCount: number; sha256: string; grain: string; allowedUse: string };

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function source(file: string, grain: string, sensitivity = "internal") {
  return {
    sourceId: `SNOWFLAKE-APPROVED-${file.replace(/[^A-Z0-9]+/gi, "-").toUpperCase()}`,
    sourceFile: file,
    extractedAt: "2026-08-11",
    evidenceStatus: "Reported",
    qualityStatus: "warning",
    sensitivity,
    allowedUse: "approved_internal_decision_support",
    grain,
  };
}

function normalizeMarketName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function jsonRows(rows: unknown[]): string {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

async function readInput(name: keyof typeof inputFiles) {
  const file = inputFiles[name];
  const text = await readFile(resolve(inputDir, file), "utf8");
  return { file, text, rows: parseCsv(text) };
}

async function writeOutput(name: string, content: string, rowCount: number, grain: string, allowedUse = "approved_internal_decision_support"): Promise<OutputFile> {
  const path = resolve(outputDir, name);
  await writeFile(path, content);
  return { path: name, rowCount, sha256: sha256(content), grain, allowedUse };
}

const market = await readInput("marketAttractiveness");
const clinicProfile = await readInput("clinicProfile");
const clinicActivity = await readInput("clinicActivity");
const zipMarket = await readInput("zipMarket");
const cbsaPopulation = await readInput("cbsaPopulation");
const zipContext = await readInput("zipContext");
const regionalDemand = await readInput("regionalDemand");
const zipMetro = await readInput("zipMetro");
const retention = await readInput("retention");
const appointments = await readInput("appointments");
const acs = JSON.parse(await readFile(acsPath, "utf8")) as {
  markets: Array<{
    market_id: string;
    cbsa_code: string;
    cbsa_name: string;
    metrics: Record<string, { raw_value: number | null }>;
  }>;
};
const siteIdentities = JSON.parse(await readFile(siteIdentitiesPath, "utf8")) as Array<{
  site_id: string;
  site_name: string;
  brand: string;
  latitude: number;
  longitude: number;
  state: string | null;
  market_name: string | null;
  cbsa_id: string | null;
  cbsa_name: string | null;
  workflow_stage: string;
  source_id: string;
  evidence_status: string;
  sensitivity: string;
  allowed_use: string;
  scoring_eligibility: string;
}>;
const acsByMarketId = new Map(acs.markets.map((item) => [item.market_id, item]));
const universeByName = new Map<string, string>();
for (const item of acs.markets) {
  const key = normalizeMarketName(item.cbsa_name);
  if (!universeByName.has(key)) universeByName.set(key, item.market_id);
  else universeByName.set(key, "");
}

function censusForMarket(marketId: string | null) {
  if (!marketId) return null;
  const item = acsByMarketId.get(marketId);
  if (!item) return null;
  return {
    populationEstimate: item.metrics.total_population?.raw_value ?? null,
    householdCount: item.metrics.household_count?.raw_value ?? null,
    medianHouseholdIncome: item.metrics.median_household_income?.raw_value ?? null,
    populationDensity: item.metrics.population_density?.raw_value ?? null,
    sourceId: "SRC-016",
    sourceVintage: "2024 ACS 5-year",
    allowedUse: "market_context_only",
  };
}

const marketRows = market.rows.map((row) => ({
  marketId: row.CBSA_CODE ? `cbsa:${row.CBSA_CODE}` : universeByName.get(normalizeMarketName(row.CBSA_NAME)) || null,
  cbsaCode: row.CBSA_CODE || universeByName.get(normalizeMarketName(row.CBSA_NAME))?.replace("cbsa:", "") || null,
  cbsaName: row.CBSA_NAME,
  reportingDate: row.REPORTING_DATE,
  priorYearReportingDate: row.PRIOR_YEAR_REPORTING_DATE,
  activeCustomerCount: integerOrNull(row.ACTIVE_CUSTOMER_COUNT),
  priorYearActiveCustomerCount: integerOrNull(row.ACTIVE_CUSTOMER_COUNT_PRIOR_YEAR),
  activeCustomerYoyGrowth: numberOrNull(row.ACTIVE_CUSTOMER_YOY_GROWTH),
  totalHouseholds: integerOrNull(row.TOTAL_HOUSEHOLDS),
  activeCustomersPer1000Households: numberOrNull(row.ACTIVE_CUSTOMERS_PER_1000_HOUSEHOLDS),
  qualityStatus: row.QUALITY_STATUS || "UNKNOWN",
  censusContext: censusForMarket(row.CBSA_CODE ? `cbsa:${row.CBSA_CODE}` : universeByName.get(normalizeMarketName(row.CBSA_NAME)) || null),
  source: source(market.file, "one CBSA market x reporting date"),
}));

const zipMarketRows = zipMarket.rows.map((row) => ({
  zip: normalizeZip(row.ZIP_CODE),
  cbsaName: row.CBSA_TITLE,
  csaName: row.CSA_TITLE,
  statisticalAreaType: row.METRO_MICRO_STATISTICAL_AREA,
  source: source(zipMarket.file, "one ZIP x CBSA mapping"),
}));

const cbsaPopulationRows = cbsaPopulation.rows.map((row) => ({
  cbsaCode: row.CBSA ? `cbsa:${row.CBSA}` : null,
  statisticalAreaType: row.LSAD,
  populationEstimate: integerOrNull(row.POP_ESTIMATE),
  source: source(cbsaPopulation.file, "one CBSA x population estimate"),
}));

const zipContextRows = zipContext.rows.map((row) => ({
  zip: normalizeZip(row.GEO_ZIPCODE),
  households: integerOrNull(row.ESTIMATED_HOUSEHOLDS),
  medianHouseholdIncome: numberOrNull(row.ESTIMATED_MEDIAN_HOUSEHOLD_INCOME),
  families: integerOrNull(row.ESTIMATED_NUMBER_OF_FAMILIES),
  source: source(zipContext.file, "one ZIP x household context"),
}));

const demandRows = regionalDemand.rows.map((row) => ({
  zip: normalizeZip(row.CUSTOMER_ADDRESS_ZIP),
  year: integerOrNull(row.YEAR),
  netSalesExcludingRefunds: numberOrNull(row.NET_SALES_EXCLUDING_REFUNDS),
  netSales: numberOrNull(row.NET_SALES),
  source: source(regionalDemand.file, "one customer-address ZIP x year", "confidential"),
}));

const clinicByMarket = new Map<string, {
  cbsaName: string;
  marketId: string | null;
  clinicCount: number;
  totalOrders: number;
  totalVetsCapped: number;
  corporateClinicCount: number;
  practiceHubClinicCount: number;
  pharmacyBusinessClinicCount: number;
  rowsWithHouseholdContext: number;
}>();
for (const row of clinicProfile.rows) {
  const key = row.CBSA_NAME || "Unknown market";
  const marketId = universeByName.get(normalizeMarketName(key)) || null;
  const current = clinicByMarket.get(key) ?? {
    cbsaName: key,
    marketId,
    clinicCount: 0,
    totalOrders: 0,
    totalVetsCapped: 0,
    corporateClinicCount: 0,
    practiceHubClinicCount: 0,
    pharmacyBusinessClinicCount: 0,
    rowsWithHouseholdContext: 0,
  };
  current.clinicCount += 1;
  current.totalOrders += numberOrNull(row.TOTAL_ORDERS) ?? 0;
  current.totalVetsCapped += numberOrNull(row.TOTAL_VETS_CAPPED) ?? 0;
  current.corporateClinicCount += row.CORPORATE_CLINIC_FLAG === "TRUE" ? 1 : 0;
  current.practiceHubClinicCount += row.PH_CLINIC_FLAG === "TRUE" ? 1 : 0;
  current.pharmacyBusinessClinicCount += row.PBC_CLINIC_FLAG === "TRUE" ? 1 : 0;
  current.rowsWithHouseholdContext += row.ESTIMATED_HOUSEHOLDS ? 1 : 0;
  current.marketId = marketId;
  clinicByMarket.set(key, current);
}
const clinicMarketRows = [...clinicByMarket.values()].map((row) => ({
  ...row,
  cbsaCode: row.marketId?.replace("cbsa:", "") ?? null,
  censusHouseholdCount: row.marketId ? censusForMarket(row.marketId)?.householdCount ?? null : null,
  clinicDensityPer10000Households: row.marketId && censusForMarket(row.marketId)?.householdCount
    ? (row.clinicCount / (censusForMarket(row.marketId)?.householdCount ?? 1)) * 10000
    : null,
  clinicDensityStatus: "Derived · clinic profile row count; physical-location identity rule still required",
  source: source(clinicProfile.file, "one CBSA name x clinic aggregate", "confidential"),
  status: "Reported · approved internal extract · physical-location rule still required",
}));

const clinicPerformanceByMarket = new Map<string, {
  cbsaName: string;
  marketId: string | null;
  clinicCount: number;
  totalCustomers: number;
  totalOrders: number;
  rxOrders: number;
  netSales: number;
  rxNetSales: number;
  netSalesChange: number;
  timeframes: Set<string>;
}>();
const clinicIdToMarket = new Map(
  clinicProfile.rows
    .filter((row) => row.CLINIC_ID)
    .map((row) => [row.CLINIC_ID, row.CBSA_NAME || "Unknown market"] as const),
);
for (const row of clinicActivity.rows) {
  const key = clinicIdToMarket.get(row.CLINIC_ID) ?? row.CBSA_NAME ?? "Unknown market";
  const current = clinicPerformanceByMarket.get(key) ?? {
    cbsaName: key,
    marketId: clinicIdToMarket.get(row.CLINIC_ID) ? universeByName.get(normalizeMarketName(clinicIdToMarket.get(row.CLINIC_ID) ?? "")) || null : null,
    clinicCount: 0,
    totalCustomers: 0,
    totalOrders: 0,
    rxOrders: 0,
    netSales: 0,
    rxNetSales: 0,
    netSalesChange: 0,
    timeframes: new Set<string>(),
  };
  current.clinicCount += 1;
  current.totalCustomers += numberOrNull(row.TOTAL_CUSTOMER) ?? 0;
  current.totalOrders += numberOrNull(row.TOTAL_ORDERS) ?? 0;
  current.rxOrders += numberOrNull(row.RX_ORDERS) ?? 0;
  current.netSales += numberOrNull(row.NET_SALES) ?? 0;
  current.rxNetSales += numberOrNull(row.RX_NET_SALES) ?? 0;
  current.netSalesChange += numberOrNull(row.NET_SALES_CHANGE) ?? 0;
  if (row.TIMEFRAME) current.timeframes.add(row.TIMEFRAME);
  clinicPerformanceByMarket.set(key, current);
}
const clinicPerformanceRows = [...clinicPerformanceByMarket.values()].map((row) => ({
  ...row,
  cbsaCode: row.marketId?.replace("cbsa:", "") ?? null,
  timeframes: [...row.timeframes].sort(),
  source: source(clinicActivity.file, "one CBSA name x clinic performance aggregate", "confidential"),
  status: "Reported · approved internal extract · outcome and maturity configuration required",
}));

const candidateSiteRows = siteIdentities.map((site) => ({
  siteId: site.site_id,
  siteName: site.site_name,
  brand: site.brand,
  latitude: site.latitude,
  longitude: site.longitude,
  state: site.state,
  marketName: site.market_name,
  marketId: site.cbsa_id ? `cbsa:${site.cbsa_id}` : null,
  cbsaName: site.cbsa_name,
  workflowStage: site.workflow_stage,
  sourceId: site.source_id,
  evidenceStatus: site.evidence_status,
  sensitivity: site.sensitivity,
  allowedUse: site.allowed_use,
  scoringEligibility: site.scoring_eligibility,
}));

const appointmentRows = appointments.rows.map((row) => ({
  geography: row.GEOGRAPHY || null,
  reportingMonth: row.REPORTING_MONTH,
  appointmentType: row.APPOINTMENT_TYPE,
  appointmentState: row.APPOINTMENT_STATE,
  reason: row.REASON,
  appointmentCount: integerOrNull(row.APPOINTMENT_COUNT),
  source: source(appointments.file, "one state x month x appointment type x state x reason"),
}));

const retentionRows = retention.rows.map((row) => ({
  loadDate: row.LOAD_DATE,
  reportingYear: integerOrNull(row.FINANCIAL_CALENDAR_REPORTING_YEAR),
  reportingPeriod: row.FINANCIAL_CALENDAR_REPORTING_PERIOD,
  reportingWeek: row.FINANCIAL_CALENDAR_REPORTING_WEEK,
  weekStartDate: row.WEEK_START_DATE,
  weekEndDate: row.WEEK_END_DATE,
  aggregationLevel: row.AGGREGATION_LEVEL,
  businessChannel: row.BUSINESS_CHANNEL,
  totalCustomers: integerOrNull(row.TOTAL_CUSTOMERS),
  potentialCount: integerOrNull(row.POTENTIAL_COUNT),
  recentCount: integerOrNull(row.RECENT_COUNT),
  lapsedCount: integerOrNull(row.LAPSED_COUNT),
  inactiveCount: integerOrNull(row.INACTIVE_COUNT),
  churnedCount: integerOrNull(row.CHURNED_COUNT),
  newlyAcquired: integerOrNull(row.NEWLY_ACQUIRED),
  source: source(retention.file, "one week x aggregation level x business channel"),
}));

await mkdir(outputDir, { recursive: true });
const outputs: OutputFile[] = [];
outputs.push(await writeOutput("market-context.json", jsonRows(marketRows), marketRows.length, "one CBSA market x reporting date"));
outputs.push(await writeOutput("zip-market.json", jsonRows(zipMarketRows), zipMarketRows.length, "one ZIP x CBSA mapping"));
outputs.push(await writeOutput("cbsa-population.json", jsonRows(cbsaPopulationRows), cbsaPopulationRows.length, "one CBSA x population estimate"));
outputs.push(await writeOutput("zip-context.json", jsonRows(zipContextRows), zipContextRows.length, "one ZIP x household context"));
outputs.push(await writeOutput("regional-demand.json", jsonRows(demandRows), demandRows.length, "one customer-address ZIP x year"));
outputs.push(await writeOutput("clinic-market-summary.json", jsonRows(clinicMarketRows), clinicMarketRows.length, "one CBSA name x clinic aggregate", "approved_internal_decision_support_pending_identity_rule"));
outputs.push(await writeOutput("clinic-performance-market-summary.json", jsonRows(clinicPerformanceRows), clinicPerformanceRows.length, "one CBSA name x clinic performance aggregate", "approved_internal_decision_support"));
outputs.push(await writeOutput("candidate-sites.json", jsonRows(candidateSiteRows), candidateSiteRows.length, "one approved internal candidate site", "internal_demo_evidence_only"));
outputs.push(await writeOutput("appointment-context.json", jsonRows(appointmentRows), appointmentRows.length, "one state x month x appointment dimensions"));
outputs.push(await writeOutput("retention-baseline.json", jsonRows(retentionRows), retentionRows.length, "one week x aggregation level x business channel"));
outputs.push(await writeOutput("zip-metro.json", jsonRows(zipMetro.rows.map((row) => ({ zip: normalizeZip(row.CUSTOMER_ADDRESS_ZIP), metro: row.METRO, state: row.STATE.trim(), source: source(zipMetro.file, "one ZIP x metro x state") }))), zipMetro.rows.length, "one ZIP x metro x state"));

const manifest = {
  manifestVersion: "1.0.0",
  snapshotVersion: process.env.SNOWFLAKE_SNAPSHOT_VERSION ?? "approved-snowflake-2026-08-11-v1",
  builtAt: new Date().toISOString(),
  sourceType: "approved_internal_snowflake_exports",
  rawExportsCopied: false,
  evidenceStatus: "Reported",
  allowedUse: "approved_internal_decision_support",
  scoringStatus: "available only through playbook-specific configuration and validation",
  inputFiles: [market, clinicProfile, clinicActivity, zipMarket, cbsaPopulation, zipContext, regionalDemand, zipMetro, retention, appointments].map((input) => ({
    file: input.file,
    rowCount: input.rows.length,
    sha256: sha256(input.text),
    ingestionStatus: "loaded",
  })),
  outputs,
  exclusions: [
    "Raw clinic IDs and row-level clinic activity are not stored in the snapshot.",
    "Customer-address ZIP sales remain aggregate but confidential.",
    "Prescription-level and customer-level fields are excluded.",
    "Market and clinic records retain quality warnings and are not silently repaired.",
  ],
  knownIssues: [
    "Market CBSA codes are repaired by unique normalized exact match to the checked-in 2024 ACS CBSA context; unmatched names remain null.",
    "Location-match totals repeat across the supplied market rows.",
    "ZIP bridge and ZIP context coverage do not fully reconcile.",
    "Clinic-market summary uses the profile CBSA_NAME to attach a market ID when the normalized match is unique; physical-location identity remains a required rule.",
    "Clinic performance outcome and maturity rules remain playbook configuration requirements.",
    "No market-attractiveness score is written. Approved weights and scoring eligibility remain playbook configuration requirements.",
  ],
  derivations: {
    marketIdentifier: "Unique normalized exact market-name join to SRC-016 2024 ACS CBSA context; no fuzzy matching.",
    marketIncome: "Uses SRC-016 CBSA median household income rather than an unapproved ZIP rollup.",
    populationDensity: "Uses the existing SRC-016 compatible population-density derivation.",
    clinicDensity: "Clinic profile row count divided by SRC-016 household count x 10,000; not scoring eligible until physical-location identity is approved.",
    candidateSites: "Minimized existing SRC-017 site identity snapshot, including coordinates and internal-demo-only scoring eligibility.",
  },
};
await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, outputs: outputs.length, rows: outputs.reduce((sum, item) => sum + item.rowCount, 0) }, null, 2));
