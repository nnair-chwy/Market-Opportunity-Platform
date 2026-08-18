import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pricingEconomicsSnapshotSchema } from "../lib/pricing-economics/contracts.ts";

type CsvRow = Record<string, string>;
type Aggregate = {
  sourceRows: number;
  skuRows: number;
  skuRowsWithCompetitorPrice: number;
  rowsWithNonZeroSales: number;
  sums: Record<string, number>;
  weights: Record<string, number>;
  unitsSold: number;
  netSales: number;
  totalDiscounts: number;
  shippingRevenue: number;
};

const inputPath = resolve(requiredEnv("PRICING_ECONOMICS_CATEGORY_EXPORT"));
const outputPath = resolve(process.env.PRICING_ECONOMICS_SNAPSHOT_PATH?.trim() ?? "data/approved/pricing-economics/current.json");
const expectedSha256 = process.env.PRICING_ECONOMICS_EXPECTED_SHA256?.trim();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before building the pricing economics snapshot.`);
  return value;
}

function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(field); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some(Boolean)) records.push(record);
      record = []; field = "";
    } else field += character;
  }
  if (field || record.length) { record.push(field); if (record.some(Boolean)) records.push(record); }
  const [headers, ...rows] = records;
  if (!headers?.includes("ACTIVITY_DATE") || !headers.includes("PRODUCT_MERCH_CLASSIFICATION1")) {
    throw new Error("The pricing economics CSV has an unexpected header.");
  }
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function numberOrNull(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value: number | null, places = 4) {
  if (value === null) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function weighted(aggregate: Aggregate, key: string, value: number | null, weight: number) {
  if (value === null || weight <= 0) return;
  aggregate.sums[key] = (aggregate.sums[key] ?? 0) + value * weight;
  aggregate.weights[key] = (aggregate.weights[key] ?? 0) + weight;
}

const input = await readFile(inputPath);
const sourceFileSha256 = createHash("sha256").update(input).digest("hex");
if (expectedSha256 && sourceFileSha256 !== expectedSha256) {
  throw new Error(`Pricing economics source checksum mismatch: expected ${expectedSha256}, received ${sourceFileSha256}.`);
}
const rows = parseCsv(input.toString("utf8"));
const activityDates = new Set(rows.map((row) => row.ACTIVITY_DATE));
if (activityDates.size !== 1) throw new Error("Pricing economics input must contain exactly one activity date.");

const groups = new Map<string, Aggregate>();
for (const row of rows) {
  const category = row.PRODUCT_MERCH_CLASSIFICATION1.trim() || "Unclassified";
  const skuRows = Math.max(0, Math.trunc(numberOrNull(row.SKU_ROWS) ?? 0));
  const competitorRows = Math.max(0, Math.trunc(numberOrNull(row.SKUS_WITH_COMPETITOR_PRICE) ?? 0));
  const aggregate = groups.get(category) ?? {
    sourceRows: 0, skuRows: 0, skuRowsWithCompetitorPrice: 0, rowsWithNonZeroSales: 0,
    sums: {}, weights: {}, unitsSold: 0, netSales: 0, totalDiscounts: 0, shippingRevenue: 0,
  };
  aggregate.sourceRows += 1;
  aggregate.skuRows += skuRows;
  aggregate.skuRowsWithCompetitorPrice += competitorRows;
  aggregate.unitsSold += numberOrNull(row.UNITS_SOLD) ?? 0;
  aggregate.netSales += numberOrNull(row.NET_SALES) ?? 0;
  aggregate.totalDiscounts += numberOrNull(row.TOTAL_DISCOUNTS) ?? 0;
  aggregate.shippingRevenue += numberOrNull(row.SHIPPING_REVENUE) ?? 0;
  if ((numberOrNull(row.NET_SALES) ?? 0) !== 0) aggregate.rowsWithNonZeroSales += 1;
  weighted(aggregate, "averageChewyPrice", numberOrNull(row.AVG_CHEWY_PRICE), skuRows);
  weighted(aggregate, "averageMinCompetitorPrice", numberOrNull(row.AVG_MIN_COMPETITOR_PRICE), competitorRows);
  weighted(aggregate, "averagePseCost", numberOrNull(row.AVG_PSE_COST), skuRows);
  weighted(aggregate, "averageRawProductCost", numberOrNull(row.AVG_RAW_PRODUCT_COST), skuRows);
  weighted(aggregate, "averageProductCost", numberOrNull(row.AVG_PRODUCT_COST), skuRows);
  weighted(aggregate, "averageElasticity", numberOrNull(row.AVG_ELASTICITY), skuRows);
  groups.set(category, aggregate);
}

const average = (aggregate: Aggregate, key: string) => aggregate.weights[key]
  ? rounded(aggregate.sums[key] / aggregate.weights[key])
  : null;
const categories = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([category, value]) => ({
  category,
  sourceRows: value.sourceRows,
  skuRows: value.skuRows,
  skuRowsWithCompetitorPrice: value.skuRowsWithCompetitorPrice,
  averageChewyPrice: average(value, "averageChewyPrice"),
  averageMinCompetitorPrice: average(value, "averageMinCompetitorPrice"),
  averagePseCost: average(value, "averagePseCost"),
  averageRawProductCost: average(value, "averageRawProductCost"),
  averageProductCost: average(value, "averageProductCost"),
  unitsSold: rounded(value.unitsSold, 2) ?? 0,
  netSales: rounded(value.netSales, 2) ?? 0,
  totalDiscounts: rounded(value.totalDiscounts, 2) ?? 0,
  shippingRevenue: rounded(value.shippingRevenue, 2) ?? 0,
  averageElasticity: average(value, "averageElasticity"),
}));

const activityDate = [...activityDates][0];
const snapshot = pricingEconomicsSnapshotSchema.parse({
  version: "1.0.0",
  datasetId: "pricing_chewy_economics_daily_v1",
  snapshotId: `pricing-chewy-economics-${activityDate}`,
  activityDate,
  generatedAt: `${activityDate}T12:00:00.000Z`,
  sourceIds: ["SRC-025", "SRC-026", "SRC-027"],
  sourceObject: "EDLDB.PRICING_ANALYTICS_MSS_SANDBOX.PRICING_SELF_SERVICE_DASHBOARD",
  sourceFileSha256,
  inputGrain: "current_date_x_merchandise_hierarchy_x_manufacturer",
  outputGrain: "current_date_x_us_top_level_merchandise_category",
  geography: "US",
  allowedUse: "internal_shadow_commercial_materiality_only",
  scoringEligibility: "none",
  privacy: {
    containsDirectIdentifiers: false,
    containsCustomerGeography: false,
    aggregationRule: "National top-level merchandise-category aggregates only; no SKU, manufacturer, customer, order, address, or postal identifier is retained.",
  },
  coverage: {
    inputRows: rows.length,
    outputCategories: categories.length,
    skuRows: categories.reduce((sum, item) => sum + item.skuRows, 0),
    skuRowsWithCompetitorPrice: categories.reduce((sum, item) => sum + item.skuRowsWithCompetitorPrice, 0),
    rowsWithNonZeroSales: [...groups.values()].reduce((sum, item) => sum + item.rowsWithNonZeroSales, 0),
  },
  categories,
  limitations: [
    "This snapshot is national and cannot answer regional demand, local profitability, or customer response.",
    "PSE cost, raw product cost, and modeled product cost remain separate fields and must not be interchanged.",
    "Current-day sales can be incomplete and must be paired with a governed observation window before materiality conclusions.",
    "This dataset can add commercial context to a compatible SKU/category investigation; it cannot authorize a price action.",
  ],
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Wrote ${categories.length} privacy-safe national category aggregates to ${outputPath}.`);
