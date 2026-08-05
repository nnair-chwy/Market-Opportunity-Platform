import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";
import {
  ESRI_DEMO_SOURCE_ID,
  ESRI_DEMO_SYNTHETIC_SOURCE_ID,
  ESRI_DEMO_TRANSFORMATION_VERSION,
  type EsriDemoManifest,
  type EsriFieldCatalogRecord,
  type EsriReviewRecord,
  type EsriSiteIdentity,
  type EsriSiteTradeAreaLink,
  type EsriTradeAreaMetric,
  type EsriTradeAreaRecord,
} from "../lib/esri-demo/types.ts";
import { calculatePortfolioReadiness } from "../lib/esri-demo/readiness.ts";

type CsvTable = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

function verifyProjection(
  full: CsvTable,
  demo: CsvTable,
  label: string,
): void {
  for (const header of demo.headers) {
    if (!full.headers.includes(header)) {
      throw new Error(`${label} demo field is absent from full export: ${header}`);
    }
  }
  for (let rowIndex = 0; rowIndex < demo.rows.length; rowIndex += 1) {
    for (const header of demo.headers) {
      if (demo.rows[rowIndex][header] !== full.rows[rowIndex][header]) {
        throw new Error(
          `${label} demo is not a row-for-row projection at row ${rowIndex + 2}, field ${header}.`,
        );
      }
    }
  }
}

export type BuildArguments = {
  clinicFull: string;
  clinicDemo: string;
  masterFull: string;
  masterDemo: string;
  tradeAreas: string;
  rootDir: string;
  builtAt: string;
};

function repeatedCoordinateGroupCount(
  rows: Array<Record<string, string>>,
): number {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const latitude = row.latitude?.trim();
    const longitude = row.longitude?.trim();
    if (!latitude || !longitude) continue;
    const key = `${latitude},${longitude}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

const RECEIPT_DATE = "2026-07-30";
const OUTPUT_RELATIVE = "data/sample/esri/2026-07-30";

const TRADE_METRICS = [
  ["households_with_pets", "Households with Pets", "Households with pets", "count"],
  [
    "households_with_pets_index",
    "Households with Pets Index",
    "Households with pets index",
    "index",
  ],
  ["population", "Population", "Population", "count"],
  ["population_growth", "Population Growth", "Population growth", "percent"],
  ["households", "Households", "Households", "count"],
  ["average_income", "Average Income", "Average income", "usd"],
  ["median_income", "Median Income", "Median income", "usd"],
  [
    "percent_income_over_75k",
    "Percent Income Over 75K",
    "Income over $75K",
    "percent",
  ],
  [
    "percent_income_over_100k",
    "Percent Income Over 100k",
    "Income over $100K",
    "percent",
  ],
  [
    "chewy_healthcare_sales",
    "Chewy Healthcare Sales",
    "Chewy healthcare sales",
    null,
  ],
  [
    "chewy_online_customers",
    "Chewy Online Customers",
    "Chewy online customers",
    "count",
  ],
  [
    "chewy_online_autoship_customers",
    "Chewy Online Autoship Customers",
    "Chewy online autoship customers",
    "count",
  ],
  [
    "cvc_customer_percent",
    "CVC Customer Percent",
    "CVC customer percent",
    "percent",
  ],
  ["square_miles", "Square Miles", "Square miles", "square_miles"],
  [
    "veterinary_clinic_count",
    "Veterinary Clinic Count",
    "Veterinary clinic count",
    "count",
  ],
  [
    "pet_households_per_clinic",
    "Pet Households Per Clinic",
    "Pet households per clinic",
    "ratio",
  ],
] as const;

const MASTER_RETAINED = new Map<string, string>([
  ["GlobalID", "source_global_id"],
  ["ESRI ID", "source_esri_id"],
  ["Site Code", "source_site_code"],
  ["Site Name", "site_name"],
  ["Brand", "brand"],
  ["Longitude", "longitude"],
  ["Latitude", "latitude"],
  ["State", "state"],
  ["Market Name", "market_name"],
  ["CBSA ID", "cbsa_id"],
  ["CBSA Name", "cbsa_name"],
  ["Open Status", "source_open_status"],
  ["Open Year", "source_open_year"],
  ["Open Quarter", "source_open_quarter"],
  ["Site Square Foot", "site_square_feet"],
  ["Usable Site Square Foot", "usable_site_square_feet"],
  ["Design Room Count", "design_room_count"],
  ["Center Name", "center_name"],
  ["Center Type", "center_type"],
  ["Site Front Size", "site_front_size"],
  ["Site Position", "site_position"],
  ["Dedicated Parking Spaces", "dedicated_parking_spaces"],
  ["Parking Type", "parking_type"],
  ["Main Street Visibility", "main_street_visibility"],
  ["Center Ingress Egress", "center_ingress_egress"],
  ["Green Space", "green_space"],
  ["Green Space Location", "green_space_location"],
  ["Traffic Volume", "traffic_volume"],
  ["Cotenant 1", "cotenant_1"],
  ["Cotenant 2", "cotenant_2"],
  ["Cotenant 3", "cotenant_3"],
  ["Cotenant 4", "cotenant_4"],
  ["Cotenant 5", "cotenant_5"],
  ["Multi-Story Building", "multi_story_building"],
  ["Closest Competitor", "closest_competitor"],
  ["Closest Competitor Distance", "closest_competitor_distance"],
]);

const EXCLUDED_SENSITIVE_PATTERN =
  /phone|email|account.owner|created_user|last_edited_user|landlord|lease|rent|security.deposit|tenant.allowance|operating.expense|contact.preference|prescription|customer|sales|approval.rate|response.rate|via|comments|deactivation|hin/i;
const PROHIBITED_OUTPUT_KEY_PATTERNS = [
  /phone/i,
  /email/i,
  /account_owner/i,
  /created_user/i,
  /last_edited_user/i,
  /landlord/i,
  /lease/i,
  /^rent/i,
  /security_deposit/i,
  /tenant_allowance/i,
  /operating_expense/i,
  /contact_preference/i,
  /prescription/i,
  /approval_rate/i,
  /response_rate/i,
  /^via_/i,
  /comments/i,
  /deactivation/i,
  /^hin(_|$)/i,
];

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function findProhibitedOutputKey(
  value: unknown,
  currentPath: string[] = [],
): string | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const match = findProhibitedOutputKey(item, [
        ...currentPath,
        String(index),
      ]);
      if (match) return match;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...currentPath, key];
    if (PROHIBITED_OUTPUT_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      return nextPath.join(".");
    }
    const match = findProhibitedOutputKey(child, nextPath);
    if (match) return match;
  }
  return null;
}

function normalizeHeader(value: string) {
  return value.replace(/\u00a0/g, " ").trim();
}

export function parseCsv(csv: string): CsvTable {
  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      currentRow.push(field);
      field = "";
    } else if (character === "\n") {
      currentRow.push(field);
      parsedRows.push(currentRow);
      currentRow = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV ended inside a quoted field.");
  if (field.length > 0 || currentRow.length > 0) {
    currentRow.push(field);
    parsedRows.push(currentRow);
  }

  const [rawHeaders = [], ...rawRows] = parsedRows;
  const headers = rawHeaders.map((header, index) =>
    normalizeHeader(index === 0 ? header.replace(/^\uFEFF/, "") : header),
  );
  if (!headers.length || new Set(headers).size !== headers.length) {
    throw new Error("CSV headers are empty or duplicated.");
  }
  const rows = rawRows
    .filter((row) => row.some((value) => value.trim() !== ""))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index]?.trim() ?? ""]),
      ),
    );
  return { headers, rows };
}

function excelValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
  }
  return String(value).trim();
}

export async function readXlsxTable(bytes: Buffer): Promise<CsvTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Trade-area workbook has no worksheet.");
  const rawHeaders = worksheet.getRow(1).values;
  const headers = Array.from(
    { length: worksheet.columnCount },
    (_, index) =>
      normalizeHeader(excelValue((rawHeaders as ExcelJS.CellValue[])[index + 1])),
  );
  if (!headers.length || new Set(headers).size !== headers.length) {
    throw new Error("Trade-area headers are empty or duplicated.");
  }
  const rows: Array<Record<string, string>> = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record = Object.fromEntries(
      headers.map((header, index) => [
        header,
        excelValue(row.getCell(index + 1).value),
      ]),
    );
    if (Object.values(record).some((value) => value !== "")) rows.push(record);
  }
  return { headers, rows };
}

function numberOrNull(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerText(value: string | undefined) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : String(Math.trunc(parsed));
}

function textOrNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function stableSiteId(globalId: string) {
  const normalized = globalId.replace(/[{}]/g, "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(normalized)) {
    throw new Error(`Invalid master-site GlobalID: ${globalId}`);
  }
  return `esri-site-${normalized}`;
}

function stableTradeAreaId(globalId: string) {
  const normalized = globalId.replace(/[{}]/g, "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(normalized)) {
    throw new Error(`Invalid trade-area GlobalID: ${globalId}`);
  }
  return `esri-trade-${normalized}`;
}

function workflowStage(row: Record<string, string>) {
  if (row.Brand !== "Chewy Vet Care") return "comparison_location" as const;
  if (row["Open Status"] === "Open") return "current_location" as const;
  if (["In Development", "Approved", "REC"].includes(row["Open Status"])) {
    return "candidate_review" as const;
  }
  return "unknown" as const;
}

function physicalEvidence(row: Record<string, string>) {
  const numericFields = new Set([
    "Site Square Foot",
    "Usable Site Square Foot",
    "Design Room Count",
    "Site Front Size",
    "Dedicated Parking Spaces",
    "Traffic Volume",
    "Closest Competitor Distance",
  ]);
  return Object.fromEntries(
    [...MASTER_RETAINED.entries()]
      .filter(([source]) => ![
        "GlobalID",
        "ESRI ID",
        "Site Code",
        "Site Name",
        "Brand",
        "Longitude",
        "Latitude",
        "State",
        "Market Name",
        "CBSA ID",
        "CBSA Name",
        "Open Status",
        "Open Year",
        "Open Quarter",
      ].includes(source))
      .map(([source, canonical]) => [
        canonical,
        numericFields.has(source)
          ? numberOrNull(row[source])
          : textOrNull(row[source]),
      ]),
  );
}

function tradeMetric(
  row: Record<string, string>,
  definition: (typeof TRADE_METRICS)[number],
  synthetic = false,
  syntheticValue?: number,
): EsriTradeAreaMetric {
  const [metricId, sourceField, label, unit] = definition;
  const rawValue = synthetic ? syntheticValue ?? null : numberOrNull(row[sourceField]);
  return {
    metric_id: metricId,
    source_field: sourceField,
    label,
    raw_value: rawValue,
    unit,
    observed_at: synthetic ? RECEIPT_DATE : null,
    received_at: RECEIPT_DATE,
    geography: "trade_area",
    geography_method: synthetic ? "synthetic_demo_area" : null,
    source_id: synthetic
      ? ESRI_DEMO_SYNTHETIC_SOURCE_ID
      : ESRI_DEMO_SOURCE_ID,
    evidence_status: synthetic ? "Hypothesis" : "Reported",
    quality_status: rawValue === null || (!synthetic && !unit) ? "warning" : "accepted",
    sensitivity: "internal",
    allowed_use: "internal_demo_evidence_only",
    transformation_version: ESRI_DEMO_TRANSFORMATION_VERSION,
    scoring_eligibility: "none",
    limitations: synthetic
      ? ["Synthetic fallback for workflow demonstration."]
      : [
          "Observation date is not present in the supplied export.",
          "Trade-area construction method is not present in the supplied export.",
          ...(unit ? [] : ["Unit requires source-owner confirmation."]),
        ],
  };
}

function syntheticTradeArea(
  site: EsriSiteIdentity,
  index: number,
): EsriTradeAreaRecord {
  const values: Record<string, number> = {
    households_with_pets: 68_000 + index * 1_700,
    households_with_pets_index: 84 + (index % 8),
    population: 325_000 + index * 14_000,
    population_growth: 1.1 + (index % 4) * 0.2,
    households: 132_000 + index * 4_800,
    average_income: 118_000 + index * 3_200,
    median_income: 82_000 + index * 2_400,
    percent_income_over_75k: 53 + index,
    percent_income_over_100k: 39 + index,
    chewy_healthcare_sales: 1_200_000 + index * 80_000,
    chewy_online_customers: 28_000 + index * 1_100,
    chewy_online_autoship_customers: 17_000 + index * 750,
    cvc_customer_percent: 7 + index * 0.4,
    square_miles: 115 + index * 9,
    veterinary_clinic_count: 41 + index * 3,
    pet_households_per_clinic: 1_650 + index * 25,
  };
  return {
    trade_area_id: `syn-trade-${site.site_id}`,
    source_global_id: null,
    source_esri_id: null,
    source_site_name: site.site_name,
    role: "synthetic_demo",
    is_synthetic: true,
    metrics: TRADE_METRICS.map((definition) =>
      tradeMetric({}, definition, true, values[definition[0]]),
    ),
    source_id: ESRI_DEMO_SYNTHETIC_SOURCE_ID,
    evidence_status: "Hypothesis",
    sensitivity: "internal",
    allowed_use: "internal_demo_evidence_only",
    scoring_eligibility: "none",
  };
}

function fieldCatalog(
  clinicHeaders: string[],
  masterHeaders: string[],
  tradeHeaders: string[],
): EsriFieldCatalogRecord[] {
  const tradeMap = new Map<
    string,
    { id: string; label: string; unit: string | null }
  >(
    TRADE_METRICS.map(([id, source, label, unit]) => [
      source,
      { id, label, unit },
    ]),
  );
  const catalog: EsriFieldCatalogRecord[] = [];
  const add = (
    dataset: EsriFieldCatalogRecord["dataset"],
    sourceField: string,
    retained: boolean,
    fieldId: string,
    label: string,
    unit: string | null,
    sensitivity: EsriFieldCatalogRecord["sensitivity"],
    exclusionReason: string | null,
  ) => {
    catalog.push({
      field_id: `${dataset}.${fieldId}`,
      dataset,
      source_field: sourceField,
      business_label: label,
      definition_status: retained ? "partial" : "unknown",
      unit,
      observed_at: null,
      geography:
        dataset === "master_site"
          ? "point"
          : dataset === "trade_area"
            ? "trade_area"
            : "unknown",
      geography_method: null,
      workflow_stages:
        dataset === "master_site"
          ? ["market_research", "candidate_review", "current_location"]
          : dataset === "trade_area"
            ? ["market_research", "candidate_review"]
            : ["market_research"],
      sensitivity,
      allowed_use: "internal_demo_evidence_only",
      evidence_status: "Reported",
      quality_rules: retained
        ? [
            "Preserve null as missing.",
            "Retain source field name and snapshot lineage.",
          ]
        : ["Source field is inventoried but source values are excluded."],
      retained_in_fixture: retained,
      exclusion_reason: exclusionReason,
      scoring_eligibility: "none",
    });
  };

  for (const header of clinicHeaders) {
    add(
      "clinic",
      header,
      false,
      header.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      header.replaceAll("_", " "),
      null,
      EXCLUDED_SENSITIVE_PATTERN.test(header) ? "restricted" : "internal",
      EXCLUDED_SENSITIVE_PATTERN.test(header)
        ? "Excluded by the prototype sensitive-field rule."
        : "Clinic row values are not required for portfolio readiness.",
    );
  }
  for (const header of masterHeaders) {
    const canonical = MASTER_RETAINED.get(header);
    add(
      "master_site",
      header,
      Boolean(canonical),
      canonical ?? header.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      header,
      [
        "Site Square Foot",
        "Usable Site Square Foot",
        "Site Front Size",
      ].includes(header)
        ? "square_feet"
        : ["Longitude", "Latitude"].includes(header)
          ? "decimal_degrees"
          : null,
      EXCLUDED_SENSITIVE_PATTERN.test(header) ? "confidential" : "internal",
      canonical
        ? null
        : EXCLUDED_SENSITIVE_PATTERN.test(header)
          ? "Excluded by the prototype sensitive-field rule."
          : "Not required for the approved demo capabilities.",
    );
  }
  for (const header of tradeHeaders) {
    const metric = tradeMap.get(header);
    const retained = Boolean(metric) || ["GlobalID", "ESRI_ID", "Site Name"].includes(header);
    add(
      "trade_area",
      header,
      retained,
      metric?.id ?? header.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      metric?.label ?? header,
      metric?.unit ?? null,
      /Chewy|CVC/i.test(header) ? "confidential" : "internal",
      retained ? null : "Not required for the approved demo capabilities.",
    );
  }
  return catalog.sort((left, right) =>
    `${left.dataset}.${left.field_id}`.localeCompare(
      `${right.dataset}.${right.field_id}`,
    ),
  );
}

function sourceRole(filename: string, args: BuildArguments) {
  if (filename === args.clinicFull) return "clinic_full" as const;
  if (filename === args.clinicDemo) return "clinic_demo" as const;
  if (filename === args.masterFull) return "master_full" as const;
  if (filename === args.masterDemo) return "master_demo" as const;
  return "trade_areas" as const;
}

function parseArguments(argv: string[]): BuildArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("Arguments must be provided as --name value pairs.");
    }
    values.set(key.slice(2), value);
  }
  const required = [
    "clinic-full",
    "clinic-demo",
    "master-full",
    "master-demo",
    "trade-areas",
  ];
  for (const key of required) {
    if (!values.get(key)) throw new Error(`Missing required --${key} argument.`);
  }
  const builtAt = values.get("built-at") ?? new Date().toISOString();
  if (new Date(builtAt).toISOString() !== builtAt) {
    throw new Error("--built-at must be an ISO 8601 UTC timestamp.");
  }
  return {
    clinicFull: path.resolve(values.get("clinic-full")!),
    clinicDemo: path.resolve(values.get("clinic-demo")!),
    masterFull: path.resolve(values.get("master-full")!),
    masterDemo: path.resolve(values.get("master-demo")!),
    tradeAreas: path.resolve(values.get("trade-areas")!),
    rootDir: path.resolve(values.get("root") ?? process.cwd()),
    builtAt,
  };
}

export async function buildEsriDemo(args: BuildArguments) {
  const sourcePaths = [
    args.clinicFull,
    args.clinicDemo,
    args.masterFull,
    args.masterDemo,
    args.tradeAreas,
  ];
  const sourceBytes = await Promise.all(sourcePaths.map((value) => readFile(value)));
  const [clinicFull, clinicDemo, masterFull, masterDemo, tradeAreas] =
    await Promise.all([
      Promise.resolve(parseCsv(sourceBytes[0].toString("utf8"))),
      Promise.resolve(parseCsv(sourceBytes[1].toString("utf8"))),
      Promise.resolve(parseCsv(sourceBytes[2].toString("utf8"))),
      Promise.resolve(parseCsv(sourceBytes[3].toString("utf8"))),
      readXlsxTable(sourceBytes[4]),
    ]);

  if (clinicFull.rows.length !== clinicDemo.rows.length) {
    throw new Error("Clinic full and demo row counts do not match.");
  }
  if (masterFull.rows.length !== masterDemo.rows.length) {
    throw new Error("Master full and demo row counts do not match.");
  }
  verifyProjection(clinicFull, clinicDemo, "Clinic");
  verifyProjection(masterFull, masterDemo, "Master");

  const sites: EsriSiteIdentity[] = masterFull.rows
    .map((row) => {
      const globalId = row.GlobalID;
      const latitude = numberOrNull(row.Latitude);
      const longitude = numberOrNull(row.Longitude);
      if (!globalId || !row["Site Name"] || !row.Brand) {
        throw new Error("Master source is missing a required identity field.");
      }
      if (latitude === null || longitude === null) {
        throw new Error(`Master site ${row["Site Name"]} lacks coordinates.`);
      }
      return {
        site_id: stableSiteId(globalId),
        source_global_id: globalId,
        source_esri_id: integerText(row["ESRI ID"]),
        source_site_code: textOrNull(row["Site Code"]),
        site_name: row["Site Name"],
        brand: row.Brand,
        latitude,
        longitude,
        state: textOrNull(row.State),
        market_name: textOrNull(row["Market Name"]),
        cbsa_id: integerText(row["CBSA ID"])?.padStart(5, "0") ?? null,
        cbsa_name: textOrNull(row["CBSA Name"]),
        workflow_stage: workflowStage(row),
        source_open_status: row["Open Status"],
        source_open_year: numberOrNull(row["Open Year"]),
        source_open_quarter: textOrNull(row["Open Quarter"]),
        physical_evidence: physicalEvidence(row),
        source_id: ESRI_DEMO_SOURCE_ID as typeof ESRI_DEMO_SOURCE_ID,
        evidence_status: "Reported" as const,
        sensitivity: "internal" as const,
        allowed_use: "internal_demo_evidence_only" as const,
        scoring_eligibility: "none" as const,
      };
    })
    .sort(
      (left, right) =>
        left.site_name.localeCompare(right.site_name) ||
        left.site_id.localeCompare(right.site_id),
    );
  if (new Set(sites.map((site) => site.site_id)).size !== sites.length) {
    throw new Error("Master site IDs are not unique.");
  }

  const tradeByEsriId = new Map<string, EsriTradeAreaRecord[]>();
  const reviewRecords: EsriReviewRecord[] = [];
  const sitesByName = new Map<string, EsriSiteIdentity[]>();
  const sitesByCoordinate = new Map<string, EsriSiteIdentity[]>();
  for (const site of sites) {
    const normalizedName = site.site_name.trim().toLowerCase();
    sitesByName.set(normalizedName, [
      ...(sitesByName.get(normalizedName) ?? []),
      site,
    ]);
    const coordinateKey = `${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`;
    sitesByCoordinate.set(coordinateKey, [
      ...(sitesByCoordinate.get(coordinateKey) ?? []),
      site,
    ]);
  }
  for (const [normalizedName, matchingSites] of sitesByName) {
    if (matchingSites.length < 2) continue;
    reviewRecords.push({
      review_id: `master-duplicate-name-${sha256(normalizedName).slice(0, 12)}`,
      dataset: "master_site",
      record_identifier: matchingSites.map((site) => site.site_id).join(","),
      issue_code: "duplicate_site_name",
      severity: "warning",
      reason:
        "Multiple master-site records share a display name. They remain separate and were not merged.",
      disposition: "retain_for_review",
    });
  }
  for (const [coordinateKey, matchingSites] of sitesByCoordinate) {
    if (matchingSites.length < 2) continue;
    reviewRecords.push({
      review_id: `master-repeated-coordinate-${sha256(coordinateKey).slice(0, 12)}`,
      dataset: "master_site",
      record_identifier: matchingSites.map((site) => site.site_id).join(","),
      issue_code: "repeated_site_coordinate",
      severity: "warning",
      reason:
        "Multiple master-site records share coordinates. They remain separate and were not deleted.",
      disposition: "retain_for_review",
    });
  }
  for (const [index, row] of tradeAreas.rows.entries()) {
    const siteName = textOrNull(row["Site Name"]);
    const globalId = row.GlobalID;
    const esriId = integerText(row.ESRI_ID);
    if (!siteName) {
      reviewRecords.push({
        review_id: `trade-unnamed-${index + 2}`,
        dataset: "trade_area",
        record_identifier: globalId || `row-${index + 2}`,
        issue_code: "missing_site_name",
        severity: "error",
        reason:
          "Trade-area record has no site name and cannot be linked automatically.",
        disposition: "quarantine",
      });
      continue;
    }
    if (!globalId || !esriId) continue;
    const record: EsriTradeAreaRecord = {
      trade_area_id: stableTradeAreaId(globalId),
      source_global_id: globalId,
      source_esri_id: esriId,
      source_site_name: siteName,
      role: "unknown",
      is_synthetic: false,
      metrics: TRADE_METRICS.map((definition) => tradeMetric(row, definition)),
      source_id: ESRI_DEMO_SOURCE_ID,
      evidence_status: "Reported",
      sensitivity: "internal",
      allowed_use: "internal_demo_evidence_only",
      scoring_eligibility: "none",
    };
    tradeByEsriId.set(esriId, [
      ...(tradeByEsriId.get(esriId) ?? []),
      record,
    ]);
  }

  const retainedTradeAreas: EsriTradeAreaRecord[] = [];
  const crosswalk: EsriSiteTradeAreaLink[] = [];
  let fallbackIndex = 0;
  for (const site of sites) {
    const sourceRecords = site.source_esri_id
      ? tradeByEsriId.get(site.source_esri_id) ?? []
      : [];
    if (!sourceRecords.length) {
      const fallback = syntheticTradeArea(site, fallbackIndex);
      fallbackIndex += 1;
      retainedTradeAreas.push(fallback);
      crosswalk.push({
        site_id: site.site_id,
        trade_area_id: fallback.trade_area_id,
        source_esri_id: site.source_esri_id,
        link_state: "synthetic_fallback",
        role: "synthetic_demo",
        source_id: ESRI_DEMO_SYNTHETIC_SOURCE_ID,
        evidence_status: "Hypothesis",
        review_note:
          "The supplied master site has no matching trade-area record. This link exists only to demonstrate the blocked real-data path.",
        scoring_eligibility: "none",
      });
      reviewRecords.push({
        review_id: `crosswalk-${site.site_id}`,
        dataset: "crosswalk",
        record_identifier: site.site_id,
        issue_code: "missing_source_trade_area",
        severity: "error",
        reason:
          "No supplied trade-area record matches the master-site ESRI ID.",
        disposition: "retain_for_review",
      });
      continue;
    }
    retainedTradeAreas.push(...sourceRecords);
    for (const record of sourceRecords) {
      crosswalk.push({
        site_id: site.site_id,
        trade_area_id: record.trade_area_id,
        source_esri_id: site.source_esri_id,
        link_state:
          sourceRecords.length > 1 ? "needs_review" : "source_provided",
        role: "unknown",
        source_id: ESRI_DEMO_SOURCE_ID,
        evidence_status: "Reported",
        review_note:
          sourceRecords.length > 1
            ? "Multiple trade-area records share the source ESRI ID. No primary record was selected."
            : "Exact source ESRI ID match. Trade-area role and construction method remain unconfirmed.",
        scoring_eligibility: "none",
      });
    }
    if (sourceRecords.length > 1) {
      reviewRecords.push({
        review_id: `crosswalk-multiple-${site.site_id}`,
        dataset: "crosswalk",
        record_identifier: site.site_id,
        issue_code: "multiple_source_trade_areas",
        severity: "warning",
        reason:
          "The master-site ESRI ID matches multiple trade-area records.",
        disposition: "retain_for_review",
      });
    }
  }

  const readiness = sites.map((site) =>
    calculatePortfolioReadiness({
      site,
      links: crosswalk.filter((link) => link.site_id === site.site_id),
      tradeAreas: retainedTradeAreas,
    }),
  );
  const catalog = fieldCatalog(
    clinicFull.headers,
    masterFull.headers,
    tradeAreas.headers,
  );
  const outputValues = new Map<string, string>([
    ["field-catalog.json", json(catalog)],
    ["portfolio-readiness.json", json(readiness)],
    ["site-identities.json", json(sites)],
    ["site-trade-area-crosswalk.json", json(crosswalk)],
    ["trade-areas.json", json(retainedTradeAreas)],
    ["rejected-or-review-records.json", json(reviewRecords)],
  ]);
  const sources = sourcePaths.map((sourcePath, index) => {
    const role = sourceRole(sourcePath, args);
    const table =
      role === "clinic_full"
        ? clinicFull
        : role === "clinic_demo"
          ? clinicDemo
          : role === "master_full"
            ? masterFull
            : role === "master_demo"
              ? masterDemo
              : tradeAreas;
    return {
      filename: path.basename(sourcePath),
      role,
      sha256: sha256(sourceBytes[index]),
      row_count: table.rows.length,
      field_count: table.headers.length,
    };
  });
  const excludedFieldNames = [
    ...new Set(
      catalog
        .filter((field) => !field.retained_in_fixture)
        .map((field) => field.source_field),
    ),
  ].sort();
  const manifest: EsriDemoManifest = {
    schema_version: "1.0.0",
    snapshot_id: "esri-demo-2026-07-30",
    source_id: ESRI_DEMO_SOURCE_ID,
    synthetic_source_id: ESRI_DEMO_SYNTHETIC_SOURCE_ID,
    receipt_date: RECEIPT_DATE,
    built_at: args.builtAt,
    transformation_version: ESRI_DEMO_TRANSFORMATION_VERSION,
    sources,
    outputs: [...outputValues.entries()].map(([filename, serialized]) => ({
      path: `${OUTPUT_RELATIVE}/${filename}`,
      sha256: sha256(serialized),
      record_count:
        filename === "portfolio-readiness.json"
          ? readiness.length
          : filename === "site-identities.json"
            ? sites.length
            : filename === "site-trade-area-crosswalk.json"
              ? crosswalk.length
              : filename === "trade-areas.json"
                ? retainedTradeAreas.length
                : filename === "field-catalog.json"
                  ? catalog.length
                  : reviewRecords.length,
    })),
    counts: {
      source_sites: sites.length,
      source_trade_areas: tradeAreas.rows.length,
      retained_trade_areas: retainedTradeAreas.length,
      source_linked_sites: sites.filter((site) =>
        crosswalk.some(
          (link) =>
            link.site_id === site.site_id &&
            ["source_provided", "needs_review"].includes(link.link_state),
        ),
      ).length,
      synthetic_fallback_sites: sites.filter((site) =>
        crosswalk.some(
          (link) =>
            link.site_id === site.site_id &&
            link.link_state === "synthetic_fallback",
        ),
      ).length,
      one_to_many_site_links: new Set(
        crosswalk
          .filter((link) => link.link_state === "needs_review")
          .map((link) => link.site_id),
      ).size,
      clinic_repeated_coordinate_groups: repeatedCoordinateGroupCount(
        clinicFull.rows,
      ),
      review_records: reviewRecords.length,
    },
    retained_field_ids: catalog
      .filter((field) => field.retained_in_fixture)
      .map((field) => field.field_id)
      .sort(),
    excluded_field_names: excludedFieldNames,
    sensitivity: "internal",
    allowed_use: "internal_demo_evidence_only",
    scoring_eligibility: "none",
    limitations: [
      "The user approved real site names, aggregate trade-area metrics, and real site coordinates for this internal prototype.",
      "Metric observation dates and trade-area construction methods are absent from the supplied export.",
      "Source ESRI ID relationships are reported evidence and include one unresolved one-to-many match.",
      "Clinic row values are excluded from this fixture; only clinic source metadata is retained in the field catalog.",
      "Four sites use explicit synthetic trade-area fallback records because no source match exists.",
      "The fixture supports evidence readiness and descriptive research only. It has no scoring eligibility.",
    ],
    unresolved_prerequisites: [
      "Organizational governance approval and durable ownership for the supplied exports.",
      "Trade-area construction method, role, metric definitions, units where absent, and observation vintage.",
      "Approved production access path, refresh cadence, retention policy, and data steward.",
      "Resolution of four missing source links, one one-to-many link, and the identified state conflict.",
    ],
  };
  const serializedManifest = json(manifest);
  const protectedOutput = {
    sites,
    retainedTradeAreas,
    readiness,
  };
  const prohibitedKey = findProhibitedOutputKey(protectedOutput);
  if (prohibitedKey) {
    throw new Error(
      `Sensitive-field exclusion check failed on key "${prohibitedKey}". No output was written.`,
    );
  }

  const outputDir = path.join(args.rootDir, OUTPUT_RELATIVE);
  const stagingDir = `${outputDir}.tmp-${process.pid}`;
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await Promise.all(
    [...outputValues.entries()].map(([filename, contents]) =>
      writeFile(path.join(stagingDir, filename), contents, "utf8"),
    ),
  );
  await writeFile(path.join(stagingDir, "manifest.json"), serializedManifest, "utf8");
  await rm(outputDir, { recursive: true, force: true });
  await rename(stagingDir, outputDir);
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const result = await buildEsriDemo(parseArguments(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
