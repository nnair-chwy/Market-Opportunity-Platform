import { createHash } from "node:crypto";
import { basename } from "node:path";
import { googleAdsObservationSchema, GOOGLE_ADS_CONTRACT_VERSION, GOOGLE_ADS_SOURCE_REGISTRY, type GoogleAdsObservation } from "../../evidence-snapshot/contracts.ts";
import { parseCsv } from "../snowflake-csv/parser.ts";

const MONTHS: Record<string, string> = {
  January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
  July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
};

export type GoogleAdsMatchedLocationsReport = {
  reportScope: string;
  sourceId: string;
  sourceFile: string;
  sourceSha256: string;
  observationStart: string;
  observationEnd: string;
  headerRowNumber: number;
  sourceDataRowCount: number;
  totalRowsExcluded: number;
  observations: GoogleAdsObservation[];
  findings: string[];
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function reportScopeFromFile(fileName: string): string {
  return basename(fileName)
    .replace(/\.csv$/i, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sourceIdFromScope(reportScope: string): string {
  return `${GOOGLE_ADS_SOURCE_REGISTRY.sourceIdPrefix}-${reportScope.toUpperCase()}`;
}

function isoDate(month: string, day: string, year: string): string {
  const monthNumber = MONTHS[month];
  if (!monthNumber) throw new Error(`Unsupported Google Ads report month: ${month}`);
  return `${year}-${monthNumber}-${day.padStart(2, "0")}`;
}

function reportDates(text: string): { observationStart: string; observationEnd: string } {
  const match = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\s+-\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) throw new Error("Google Ads matched-locations report is missing an explicit observation date range.");
  return { observationStart: isoDate(match[1]!, match[2]!, match[3]!), observationEnd: isoDate(match[4]!, match[5]!, match[6]!) };
}

function numberOrNull(value: string | undefined): number | null {
  const normalized = value?.trim().replace(/,/g, "");
  if (!normalized || normalized === "--") return null;
  const parsed = Number(normalized.replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function rateOrNull(value: string | undefined): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : parsed / 100;
}

function differs(reported: number | null, calculated: number | null, tolerance: number): boolean {
  return reported !== null && calculated !== null && Math.abs(reported - calculated) > tolerance;
}

function calculatedRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator === 0) return numerator === 0 ? 0 : null;
  return numerator / denominator;
}

function calculatedUnitCost(cost: number | null, volume: number | null): number | null {
  if (cost === null || volume === null) return null;
  if (volume === 0) return cost === 0 ? 0 : null;
  return cost / volume;
}

export function parseGoogleAdsMatchedLocationsReport(input: {
  text: string;
  fileName: string;
  snapshotId: string;
  reportScope?: string;
}): GoogleAdsMatchedLocationsReport {
  const lines = input.text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("Matched location,"));
  if (headerIndex < 0) throw new Error("Google Ads matched-locations report header was not found.");
  const { observationStart, observationEnd } = reportDates(input.text);
  const reportScope = input.reportScope?.trim() || reportScopeFromFile(input.fileName);
  if (!reportScope) throw new Error("Google Ads report scope is required.");
  const sourceFile = basename(input.fileName);
  const sourceSha256 = sha256(input.text);
  const sourceId = sourceIdFromScope(reportScope);
  const rows = parseCsv(lines.slice(headerIndex).join("\n"));
  const totalRowsExcluded = rows.filter((row) => row["Matched location"]?.trim().startsWith("Total:")).length;
  const locationRows = rows
    .map((row, index) => ({ row, sourceRowNumber: headerIndex + index + 2 }))
    .filter(({ row }) => {
      const label = row["Matched location"]?.trim();
      return Boolean(label && !label.startsWith("Total:") && label !== "Matched locations report" && !/^\w+ \d{1,2}, \d{4} - /.test(label));
    });
  if (!locationRows.length) throw new Error("Google Ads matched-locations report contains no location observations.");

  const labelCounts = new Map<string, number>();
  for (const { row } of locationRows) {
    const label = row["Matched location"]!.trim();
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  const observations = locationRows.map(({ row, sourceRowNumber }) => {
    const matchedLocationLabel = row["Matched location"]!.trim();
    const clicks = numberOrNull(row.Clicks);
    const impressions = numberOrNull(row["Impr."]);
    const ctr = rateOrNull(row.CTR);
    const averageCpc = numberOrNull(row["Avg. CPC"]);
    const spend = numberOrNull(row.Cost);
    const conversionRate = rateOrNull(row["Conv. rate"]);
    const conversions = numberOrNull(row.Conversions);
    const costPerConversion = numberOrNull(row["Cost / conv."]);
    const warnings: string[] = [];
    if (labelCounts.get(matchedLocationLabel)! > 1) warnings.push("Duplicate matched-location label within the same report and observation window.");
    if ([clicks, impressions, ctr, averageCpc, spend, conversionRate, conversions, costPerConversion].some((value) => value === null)) warnings.push("One or more Google Ads metrics are unavailable in the source row.");
    if (clicks !== null && !Number.isInteger(clicks)) warnings.push("Clicks is not an integer.");
    if (impressions !== null && !Number.isInteger(impressions)) warnings.push("Impressions is not an integer.");
    if (differs(ctr, calculatedRate(clicks, impressions), 0.0001)) warnings.push("Reported CTR does not reconcile to clicks divided by impressions within rounding tolerance.");
    if (differs(averageCpc, calculatedUnitCost(spend, clicks), 0.02)) warnings.push("Reported average CPC does not reconcile to cost divided by clicks within rounding tolerance.");
    if (differs(costPerConversion, calculatedUnitCost(spend, conversions), 0.05)) warnings.push("Reported cost per conversion does not reconcile to cost divided by conversions within rounding tolerance.");
    const qualityStatus = warnings.some((warning) => warning.startsWith("Duplicate") || warning.includes("not an integer")) ? "rejected" : warnings.length ? "warning" : "valid";
    return googleAdsObservationSchema.parse({
      observationId: `${sourceId}:${observationStart}:${sha256(matchedLocationLabel).slice(0, 16)}`,
      sourceId,
      snapshotId: input.snapshotId,
      reportScope,
      geographyType: "matched_location_label",
      matchedLocationLabel,
      stableGeographyId: null,
      observationStart,
      observationEnd,
      spend,
      impressions,
      clicks,
      conversions,
      ctr,
      averageCpc,
      conversionRate,
      costPerConversion,
      conversionsCoveragePresent: conversions !== null,
      currency: row["Currency code"]?.trim().toUpperCase(),
      spendUnit: "currency_units",
      sensitivity: "internal",
      allowedUse: "matched_location_descriptive_context_only",
      qualityStatus,
      evidenceStatus: "Reported",
      scoringEligibility: "none",
      rankingEligibility: "none",
      marketJoinEligibility: "blocked_missing_stable_geography_id",
      warnings,
      provenance: { sourceFile, sourceSha256, sourceRowNumber, transformationVersion: GOOGLE_ADS_CONTRACT_VERSION },
    });
  });

  const findings = [
    "Matched location is a Google Ads display label, not an approved CBSA, ZIP, DMA, or stable geography key.",
    "CBSA joins, cross-source regional comparisons, scoring, and ranking are blocked for this dataset.",
  ];
  if (observations.some((row) => row.qualityStatus !== "valid")) findings.push("One or more observations carry source-quality or metric-reconciliation warnings.");

  return {
    reportScope,
    sourceId,
    sourceFile,
    sourceSha256,
    observationStart,
    observationEnd,
    headerRowNumber: headerIndex + 1,
    sourceDataRowCount: rows.length,
    totalRowsExcluded,
    observations,
    findings,
  };
}
