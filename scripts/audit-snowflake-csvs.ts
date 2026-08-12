import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

type Row = Record<string, string>;

const inputDir = process.env.SNOWFLAKE_EXPORT_DIR?.trim();
if (!inputDir) {
  throw new Error("Set SNOWFLAKE_EXPORT_DIR to the directory containing the approved CSV exports.");
}

const inputNames: Record<string, string> = {
  market_attractiveness: process.env.SNOWFLAKE_MARKET_FILE ?? "cbsa_market_attractiveness.csv",
  clinic_profile: process.env.SNOWFLAKE_CLINIC_PROFILE_FILE ?? "clinic_profile.csv",
  clinic_activity: process.env.SNOWFLAKE_CLINIC_ACTIVITY_FILE ?? "clinic_activity.csv",
  zip_cbsa: process.env.SNOWFLAKE_ZIP_CBSA_FILE ?? "zip_cbsa.csv",
  cbsa_population: process.env.SNOWFLAKE_CBSA_POPULATION_FILE ?? "cbsa_population.csv",
  zip_context: process.env.SNOWFLAKE_ZIP_CONTEXT_FILE ?? "zip_context.csv",
  zip_sales: process.env.SNOWFLAKE_ZIP_SALES_FILE ?? "zip_sales.csv",
  zip_metro: process.env.SNOWFLAKE_ZIP_METRO_FILE ?? "zip_metro.csv",
  retention: process.env.SNOWFLAKE_RETENTION_FILE ?? "retention.csv",
  appointments: process.env.SNOWFLAKE_APPOINTMENTS_FILE ?? "appointments.csv",
};
const inputs = Object.fromEntries(
  Object.entries(inputNames).map(([name, file]) => [name, resolve(inputDir, file)]),
);

const outputDir = resolve(process.env.SNOWFLAKE_REPORT_DIR ?? "reports/snowflake-latest");

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  const [headers, ...data] = rows;
  return data.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function duplicateCount(rows: Row[], keys: string[]): { duplicateKeys: number; duplicateRows: number } {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keys.map((column) => row[column] ?? "").join("\u001f");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = [...counts.values()].filter((count) => count > 1);
  return {
    duplicateKeys: duplicates.length,
    duplicateRows: duplicates.reduce((sum, count) => sum + count, 0),
  };
}

function profile(name: string, path: string, rows: Row[]) {
  const columns = Object.keys(rows[0] ?? {});
  const nullRates = Object.fromEntries(
    columns.map((column) => {
      const empty = rows.filter((row) => (row[column] ?? "").trim() === "").length;
      return [column, { empty, rate: rows.length ? empty / rows.length : 0 }];
    }),
  );
  const keys: string[][] = [];
  if (columns.includes("CBSA_CODE")) keys.push(["CBSA_CODE"]);
  if (columns.includes("CBSA")) keys.push(["CBSA"]);
  if (columns.includes("ZIP_CODE")) keys.push(["ZIP_CODE"]);
  if (columns.includes("GEO_ZIPCODE")) keys.push(["GEO_ZIPCODE"]);
  if (columns.includes("CLINIC_ID")) keys.push(["CLINIC_ID"]);
  if (columns.includes("YEAR") && columns.includes("CUSTOMER_ADDRESS_ZIP")) {
    keys.push(["YEAR", "CUSTOMER_ADDRESS_ZIP"]);
  }
  if (columns.includes("WEEK_START_DATE") && columns.includes("BUSINESS_CHANNEL")) {
    keys.push(["WEEK_START_DATE", "AGGREGATION_LEVEL", "BUSINESS_CHANNEL"]);
  }
  if (columns.includes("REPORTING_MONTH") && columns.includes("GEOGRAPHY")) {
    keys.push([
      "GEOGRAPHY",
      "REPORTING_MONTH",
      "APPOINTMENT_TYPE",
      "APPOINTMENT_STATE",
      "REASON",
    ]);
  }
  return {
    name,
    file: basename(path),
    path,
    sha256: createHash("sha256").update(requireBuffer(rows)).digest("hex"),
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    nullRates,
    duplicateChecks: Object.fromEntries(keys.map((key) => [key.join(" x "), duplicateCount(rows, key)])),
    sensitiveFieldFlags: columns.filter((column) =>
      /(customer|sales|prescription|rx|address|clinic_id|order|vet)/i.test(column),
    ),
  };
}

function requireBuffer(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profiles = [];
  const loaded = new Map<string, Row[]>();
  for (const [name, path] of Object.entries(inputs)) {
    const rows = parseCsv(await readFile(path, "utf8"));
    loaded.set(name, rows);
    profiles.push(profile(name, path, rows));
  }
  const market = loaded.get("market_attractiveness") ?? [];
  const zipCbsa = loaded.get("zip_cbsa") ?? [];
  const zipContext = loaded.get("zip_context") ?? [];
  const profileRows = loaded.get("clinic_profile") ?? [];
  const activityRows = loaded.get("clinic_activity") ?? [];
  const zipSales = loaded.get("zip_sales") ?? [];
  const zipMetro = loaded.get("zip_metro") ?? [];
  const normalizeZip = (value: string) => value.replace(/^8600000US/, "").padStart(5, "0");
  const bridgeZips = new Set(zipCbsa.map((row) => normalizeZip(row.ZIP_CODE)));
  const contextZips = new Set(zipContext.map((row) => normalizeZip(row.GEO_ZIPCODE)));
  const activityIds = new Set(activityRows.map((row) => row.CLINIC_ID));
  const profileIds = new Set(profileRows.map((row) => row.CLINIC_ID));
  const report = {
    generatedAt: new Date().toISOString(),
    rawFilesRemainOutsideRepository: true,
    files: profiles,
    crossFileChecks: {
      marketCbsaCodeBlankRows: market.filter((row) => !row.CBSA_CODE).length,
      marketMissingHouseholdRows: market.filter((row) => row.QUALITY_STATUS === "MISSING_HOUSEHOLD_DATA").length,
      repeatedLocationMatchTriples: new Set(
        market.map((row) => `${row.LOCATION_MATCHED_CUSTOMER_COUNT}|${row.LOCATION_UNMATCHED_CUSTOMER_COUNT}|${row.LOCATION_MATCH_RATE}`),
      ).size,
      zipBridgeRowsNotInZipContext: [...bridgeZips].filter((zip) => !contextZips.has(zip)).length,
      zipBridgeRowsMatchedToZipContext: [...bridgeZips].filter((zip) => contextZips.has(zip)).length,
      clinicActivityIdsNotInProfile: [...activityIds].filter((id) => !profileIds.has(id)).length,
      clinicProfileIdsNotInActivity: [...profileIds].filter((id) => !activityIds.has(id)).length,
      zipSalesRowsWithMissingZip: zipSales.filter((row) => !row.CUSTOMER_ADDRESS_ZIP).length,
      zipMetroRowsWithLeadingStateWhitespace: zipMetro.filter((row) => /^\s/.test(row.STATE)).length,
    },
    evidenceClassification: {
      marketContext: "Reported",
      geographyMappings: "Derived pending reconciliation",
      clinicIdentity: "Unknown pending owner definition",
      clinicPerformance: "Unknown pending outcome and maturity definition",
      zipSales: "Reported aggregate but governance approval unresolved",
      retention: "Reported national baseline",
      appointments: "Reported state-level context",
    },
  };
  await writeFile(resolve(outputDir, "data-inventory.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(outputDir, "data-inventory.md"), renderMarkdown(report));
}

type AuditReport = {
  generatedAt: string;
  files: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
    sensitiveFieldFlags: string[];
  }>;
  crossFileChecks: Record<string, number>;
  evidenceClassification: Record<string, string>;
};

function renderMarkdown(report: AuditReport): string {
  const lines = [
    "# Snowflake CSV inventory",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Raw exports remain outside the repository. This report contains metadata and quality findings only.",
    "",
    "## Files",
    "",
    "| File | Rows | Columns | Sensitive field flags |",
    "| --- | ---: | ---: | --- |",
    ...report.files.map((file) => `| ${file.name} | ${file.rowCount} | ${file.columnCount} | ${file.sensitiveFieldFlags.join(", ") || "None detected"} |`),
    "",
    "## Cross-file checks",
    "",
    ...Object.entries(report.crossFileChecks).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Evidence status",
    "",
    ...Object.entries(report.evidenceClassification).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Known limitations",
    "",
    "- The market export has blank CBSA_CODE values and cannot be safely joined by code.",
    "- Repeated location-match fields require query-level verification before market use.",
    "- Clinic identity, performance outcome, maturity window, and comparable cohort remain unresolved.",
    "- ZIP geography may mix ZIP and ZCTA concepts and requires documented reconciliation.",
    "- Customer-address sales, clinic activity, order, prescription, and sales fields remain outside Git pending governance review.",
  ];
  return `${lines.join("\n")}\n`;
}

await main();
