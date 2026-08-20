import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDuckDb, openDuckDb, sqlString } from "../lib/evidence-snapshot/duckdb.ts";

export const ADAPTIVE_DISCOVERY_VERSION = "adaptive-analyst-discovery-v1" as const;
export const ADAPTIVE_DISCOVERY_BUILDER_VERSION = "adaptive-analyst-discovery-builder-v1" as const;

const THRESHOLDS = {
  matchedDma: { minClicksPerAccount: 100, minConversionsPerAccount: 20, maxCandidatesPerClass: 10 },
  dogFoodPricing: {
    minZipCount: 100,
    minAvailabilityShare: 0.75,
    minConsistentShare: 0.75,
    minAbsolutePriceGap: 0.1,
    maxAbsolutePriceGap: 0.3,
    minPriceCostProxy: 0.1,
    maxRegionalPriceRange: 0.5,
    maxCandidatesPerClass: 10,
  },
  cvcChannelMix: { materialShareGap: 0.1 },
} as const;

type JsonRow = Record<string, unknown>;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function source(sourceId: string, file: string, grain: string, period: string) {
  return { sourceId, file, grain, period };
}

function metric(id: string, label: string, value: number, unit: string, calculation: string, benchmark?: number) {
  return { id, label, value: round(value), unit, ...(benchmark === undefined ? {} : { benchmark: round(benchmark) }), calculation };
}

function finding(input: {
  id: string;
  type: string;
  question: string;
  hypothesis: string;
  geography: { type: string; label: string };
  period: string;
  confidence: { level: "high" | "medium" | "low"; reason: string };
  metrics: ReturnType<typeof metric>[];
  evidence: string[];
  implication: string;
  proposedAction: string;
  decisionBoundary: string;
  limits: string[];
  sourceIds: string[];
  sourceFiles: string[];
}) {
  return { ...input, evidenceStatus: "Derived" as const };
}

async function queryRows(connection: Awaited<ReturnType<typeof openDuckDb>>["connection"], sql: string): Promise<JsonRow[]> {
  const reader = await connection.runAndReadAll(sql);
  return reader.getRowObjectsJson() as JsonRow[];
}

async function buildMatchedDmaDiscovery(connection: Awaited<ReturnType<typeof openDuckDb>>["connection"], paths: ReturnType<typeof inputPaths>) {
  const numeric = (column: string) => `TRY_CAST(replace(${column}, ',', '') AS DOUBLE)`;
  const account = (file: string) => `
    SELECT "Matched location" AS dma,
      sum(${numeric("Clicks")}) AS clicks,
      sum(${numeric('"Impr."')}) AS impressions,
      sum(${numeric("Cost")}) AS spend,
      sum(${numeric("Conversions")}) AS conversions
    FROM read_csv_auto(${sqlString(file)}, header=true, skip=2, all_varchar=true, ignore_errors=false)
    WHERE "Matched location" NOT LIKE 'Total:%'
    GROUP BY 1`;
  const rows = await queryRows(connection, `
    WITH retail AS (${account(paths.retailDma)}), pharmacy AS (${account(paths.pharmacyDma)})
    SELECT retail.dma,
      retail.clicks AS retail_clicks, retail.impressions AS retail_impressions, retail.spend AS retail_spend, retail.conversions AS retail_conversions,
      pharmacy.clicks AS pharmacy_clicks, pharmacy.impressions AS pharmacy_impressions, pharmacy.spend AS pharmacy_spend, pharmacy.conversions AS pharmacy_conversions
    FROM retail INNER JOIN pharmacy USING (dma)
    ORDER BY dma`);
  const candidates = rows.map((row) => {
    const retailClicks = numberValue(row.retail_clicks);
    const retailImpressions = numberValue(row.retail_impressions);
    const retailSpend = numberValue(row.retail_spend);
    const retailConversions = numberValue(row.retail_conversions);
    const pharmacyClicks = numberValue(row.pharmacy_clicks);
    const pharmacyImpressions = numberValue(row.pharmacy_impressions);
    const pharmacySpend = numberValue(row.pharmacy_spend);
    const pharmacyConversions = numberValue(row.pharmacy_conversions);
    return {
      dma: String(row.dma), retailClicks, retailImpressions, retailSpend, retailConversions,
      pharmacyClicks, pharmacyImpressions, pharmacySpend, pharmacyConversions,
      retailCpa: retailConversions > 0 ? retailSpend / retailConversions : null,
      pharmacyCpa: pharmacyConversions > 0 ? pharmacySpend / pharmacyConversions : null,
      retailConversionRate: retailClicks > 0 ? retailConversions / retailClicks : null,
      pharmacyConversionRate: pharmacyClicks > 0 ? pharmacyConversions / pharmacyClicks : null,
    };
  });
  const eligible = candidates.filter((row) => row.retailClicks >= THRESHOLDS.matchedDma.minClicksPerAccount
    && row.pharmacyClicks >= THRESHOLDS.matchedDma.minClicksPerAccount
    && row.retailConversions >= THRESHOLDS.matchedDma.minConversionsPerAccount
    && row.pharmacyConversions >= THRESHOLDS.matchedDma.minConversionsPerAccount
    && row.retailCpa !== null && row.pharmacyCpa !== null);
  const retailMedianCpa = median(eligible.map((row) => row.retailCpa!));
  const pharmacyMedianCpa = median(eligible.map((row) => row.pharmacyCpa!));
  const retailMedianConversionRate = median(eligible.map((row) => row.retailConversionRate!));
  const pharmacyMedianConversionRate = median(eligible.map((row) => row.pharmacyConversionRate!));
  const enriched = eligible.map((row) => ({
    ...row,
    retailCpaRatio: row.retailCpa! / retailMedianCpa,
    pharmacyCpaRatio: row.pharmacyCpa! / pharmacyMedianCpa,
  }));
  const toFinding = (row: typeof enriched[number], type: "joint_opportunity" | "contradiction") => finding({
    id: `matched-dma:${type}:${row.dma.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    type,
    question: type === "joint_opportunity"
      ? `Why did both Retail and Pharmacy cost less per attributed conversion than their peer medians in ${row.dma}, and does that advantage persist on first-party outcomes?`
      : `Why do Retail and Pharmacy show opposite acquisition efficiency in ${row.dma}?`,
    hypothesis: type === "joint_opportunity"
      ? "A shared local demand, auction, customer, or operating condition may support both accounts."
      : "Account-specific query, offer, customer, auction, or conversion differences may explain the cross-account contradiction.",
    geography: { type: "google_ads_matched_dma_label", label: row.dma },
    period: "2026-07-14/2026-08-12",
    confidence: { level: "medium", reason: "Both accounts pass explicit click and conversion gates, but matched DMA labels are not approved stable geographic IDs and conversions are platform-attributed." },
    metrics: [
      metric("retail_cpa", "Retail cost per attributed conversion", row.retailCpa!, "USD", "Retail summed cost / Retail summed conversions", retailMedianCpa),
      metric("pharmacy_cpa", "Pharmacy cost per attributed conversion", row.pharmacyCpa!, "USD", "Pharmacy summed cost / Pharmacy summed conversions", pharmacyMedianCpa),
      metric("retail_conversion_rate", "Retail attributed conversion rate", row.retailConversionRate!, "ratio", "Retail summed conversions / Retail summed clicks", retailMedianConversionRate),
      metric("pharmacy_conversion_rate", "Pharmacy attributed conversion rate", row.pharmacyConversionRate!, "ratio", "Pharmacy summed conversions / Pharmacy summed clicks", pharmacyMedianConversionRate),
    ],
    evidence: [`Retail: ${Math.round(row.retailClicks).toLocaleString("en-US")} clicks and ${round(row.retailConversions, 1).toLocaleString("en-US")} attributed conversions.`, `Pharmacy: ${Math.round(row.pharmacyClicks).toLocaleString("en-US")} clicks and ${round(row.pharmacyConversions, 1).toLocaleString("en-US")} attributed conversions.`],
    implication: type === "joint_opportunity"
      ? `In ${row.dma}, Retail cost $${round(row.retailCpa!, 2).toLocaleString("en-US")} per attributed conversion versus a $${round(retailMedianCpa, 2).toLocaleString("en-US")} peer median; Pharmacy cost $${round(row.pharmacyCpa!, 2).toLocaleString("en-US")} versus $${round(pharmacyMedianCpa, 2).toLocaleString("en-US")}. That is ${round((1 - row.retailCpaRatio) * 100, 1)}% and ${round((1 - row.pharmacyCpaRatio) * 100, 1)}% lower, respectively. Preserve this efficiency signal for testing, but do not assume more spend will return at the same rate.`
      : `${row.dma} points in opposite directions by account: Retail CPA is ${round(Math.abs(1 - row.retailCpaRatio) * 100, 1)}% ${row.retailCpaRatio <= 1 ? "below" : "above"} its eligible-DMA median while Pharmacy is ${round(Math.abs(1 - row.pharmacyCpaRatio) * 100, 1)}% ${row.pharmacyCpaRatio <= 1 ? "below" : "above"}. Do not use a blended market score here.`,
    proposedAction: type === "joint_opportunity"
      ? `Keep ${row.dma} in the protected high-efficiency cohort and use it as the first candidate in the next approved paid-search incrementality test; size the test from current account budgets and judge it on incremental new customers and contribution, not platform conversions alone.`
      : `Split ${row.dma}'s next budget review by Retail and Pharmacy rather than applying one regional adjustment; preserve the efficient account and diagnose the weaker account's query, offer, and conversion mix before its next allocation cycle.`,
    decisionBoundary: "Do not change spend or infer incrementality from attributed conversions alone.",
    limits: ["Matched-location label has no approved stable DMA ID.", "Retail and Pharmacy conversion semantics may differ.", "No same-period first-party orders, new customers, contribution, or organic substitution are joined."],
    sourceIds: ["SRC-018"], sourceFiles: [paths.retailDma, paths.pharmacyDma],
  });
  const opportunities = enriched
    .filter((row) => row.retailCpaRatio <= 1 && row.pharmacyCpaRatio <= 1)
    .sort((left, right) => Math.max(left.retailCpaRatio, left.pharmacyCpaRatio) - Math.max(right.retailCpaRatio, right.pharmacyCpaRatio) || left.dma.localeCompare(right.dma))
    .slice(0, THRESHOLDS.matchedDma.maxCandidatesPerClass).map((row) => toFinding(row, "joint_opportunity"));
  const contradictions = enriched
    .filter((row) => (row.retailCpaRatio <= 1) !== (row.pharmacyCpaRatio <= 1))
    .sort((left, right) => Math.abs(right.retailCpaRatio - right.pharmacyCpaRatio) - Math.abs(left.retailCpaRatio - left.pharmacyCpaRatio) || left.dma.localeCompare(right.dma))
    .slice(0, THRESHOLDS.matchedDma.maxCandidatesPerClass).map((row) => toFinding(row, "contradiction"));
  return {
    cohort: {
      joinedDmaLabels: candidates.length, eligibleDmaLabels: eligible.length,
      retailMedianCpa: round(retailMedianCpa), pharmacyMedianCpa: round(pharmacyMedianCpa),
      retailMedianConversionRate: round(retailMedianConversionRate), pharmacyMedianConversionRate: round(pharmacyMedianConversionRate),
      eligibility: `Each account has at least ${THRESHOLDS.matchedDma.minClicksPerAccount} clicks and ${THRESHOLDS.matchedDma.minConversionsPerAccount} attributed conversions.`,
      benchmark: "Account-specific median among the jointly eligible DMA-label cohort.",
    },
    jointOpportunities: opportunities, contradictions,
    limitations: ["This is cross-account descriptive evidence, not a score or causal ranking.", "Exact label equality is used only inside the two same-window Google exports; production use requires a stable licensed DMA ID."],
  };
}

type CvcRecord = {
  metro: string; weekStartDate: string; channel: string; spend: number; impressions: number; clicks: number;
  appointments: number; completedAppointments: number; newToChewyAppointments: number; netSales: number; sourceRows: number; siteCount: number;
};

function buildCvcChannelMix(snapshot: JsonRow, path: string) {
  const records = (snapshot.records as CvcRecord[]) ?? [];
  const metros = [...new Set(records.map((row) => row.metro))].sort();
  const channels = [...new Set(records.map((row) => row.channel))].sort();
  const dates = [...new Set(records.map((row) => row.weekStartDate))].sort();
  const keyCount = new Set(records.map((row) => `${row.metro}|${row.weekStartDate}|${row.channel}`)).size;
  const invalidNumbers = records.reduce((count, row) => count + [row.spend, row.impressions, row.clicks, row.appointments, row.completedAppointments, row.newToChewyAppointments, row.netSales, row.sourceRows, row.siteCount].filter((value) => !Number.isFinite(value) || value < 0).length, 0);
  const appointmentInvariantFailures = records.filter((row) => row.completedAppointments > row.appointments || row.newToChewyAppointments > row.completedAppointments).length;
  const nonMondays = dates.filter((date) => new Date(`${date}T00:00:00Z`).getUTCDay() !== 1).length;
  const metroResults = metros.map((metro) => {
    const metroRows = records.filter((row) => row.metro === metro);
    const aggregateFields: Array<keyof Pick<CvcRecord, "spend" | "appointments" | "completedAppointments" | "newToChewyAppointments" | "netSales">> = ["spend", "appointments", "completedAppointments", "newToChewyAppointments", "netSales"];
    const totals = Object.fromEntries(aggregateFields.map((field) => [field, metroRows.reduce((sum, row) => sum + numberValue(row[field]), 0)])) as Record<(typeof aggregateFields)[number], number>;
    const channelShares = channels.map((channel) => {
      const rows = metroRows.filter((row) => row.channel === channel);
      const value = (field: keyof CvcRecord) => rows.reduce((sum, row) => sum + numberValue(row[field]), 0);
      const share = (field: keyof typeof totals) => numberValue(totals[field]) > 0 ? value(field) / numberValue(totals[field]) : 0;
      return { channel, spendShare: round(share("spend")), appointmentShare: round(share("appointments")), completedAppointmentShare: round(share("completedAppointments")), newToChewyShare: round(share("newToChewyAppointments")), netSalesShare: round(share("netSales")) };
    });
    return {
      metro, totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value)])), channelShares,
      completeness: { observedMetroDateChannelRows: metroRows.length, possibleRectangularRows: dates.length * channels.length, share: round(metroRows.length / (dates.length * channels.length)) },
    };
  });
  const questions = metroResults.flatMap((metro) => metro.channelShares.map((channel) => ({ metro, channel, gap: channel.completedAppointmentShare - channel.spendShare })))
    .filter((item) => Math.abs(item.gap) >= THRESHOLDS.cvcChannelMix.materialShareGap)
    .sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap) || left.metro.metro.localeCompare(right.metro.metro) || left.channel.channel.localeCompare(right.channel.channel))
    .slice(0, 10)
    .map((item) => finding({
      id: `cvc:channel-mix:${item.metro.metro.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${item.channel.channel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      type: "hypothesis", question: `Why does ${item.channel.channel} represent ${round(item.channel.spendShare * 100, 1)}% of spend but ${round(item.channel.completedAppointmentShare * 100, 1)}% of completed appointments in ${item.metro.metro}?`,
      hypothesis: item.gap > 0 ? "This channel may deserve incrementality and capacity validation because its completed-appointment share exceeds its spend share." : "This channel may have a funnel, targeting, measurement, maturity, or capacity constraint because its spend share exceeds its completed-appointment share.",
      geography: { type: "tableau_metro_label", label: item.metro.metro }, period: `${(snapshot.period as JsonRow).start}/${(snapshot.period as JsonRow).end}`,
      confidence: { level: "medium", reason: "The arithmetic is complete and invariant-checked, but the historical Tableau metro label lacks an approved geographic crosswalk and channel mix is observational." },
      metrics: [metric("spend_share", `${item.channel.channel} spend share`, item.channel.spendShare, "ratio", "Channel spend / metro spend"), metric("completed_appointment_share", `${item.channel.channel} completed-appointment share`, item.channel.completedAppointmentShare, "ratio", "Channel completed appointments / metro completed appointments"), metric("share_gap", "Completed-appointment share minus spend share", item.gap, "percentage_point_ratio", "Completed-appointment share - spend share")],
      evidence: [`${item.metro.metro} has ${round(numberValue(item.metro.totals.completedAppointments), 1)} completed appointments and $${round(numberValue(item.metro.totals.spend), 2).toLocaleString("en-US")} observed spend in the snapshot.`],
      implication: item.gap > 0
        ? `${item.channel.channel} produced ${round(item.channel.completedAppointmentShare / Math.max(item.channel.spendShare, 0.0001), 1)}× its proportional share of completed appointments in ${item.metro.metro}. Put this channel first in the next CVC growth test rather than spreading added budget evenly.`
        : `${item.channel.channel} consumed ${round(item.channel.spendShare / Math.max(item.channel.completedAppointmentShare, 0.0001), 1)}× its proportional share of completed appointments in ${item.metro.metro}. Do not expand this channel by default until the funnel or measurement gap is explained.`,
      proposedAction: item.gap > 0
        ? `Use ${item.channel.channel} as the treatment channel in ${item.metro.metro}'s next approved incrementality test, subject to clinic appointment capacity; hold other channel allocations stable so incremental appointments, new-to-Chewy appointments, sales, and contribution can be measured.`
        : `Hold ${item.channel.channel} flat in ${item.metro.metro} during the next allocation cycle and direct any approved test increment to a stronger channel; reverse that choice if matched-control results or clinic-capacity evidence explain the observed share gap.`,
      decisionBoundary: "Do not move spend from observed share differences alone.", limits: ["Historical four-week snapshot.", "Tableau metro labels are not mapped to approved CBSA or DMA IDs.", "Net sales and appointments are observed, not incremental or contribution outcomes."],
      sourceIds: [String(snapshot.sourceId)], sourceFiles: [path],
    }));
  const shareSumFailures = metroResults.reduce((count, metro) => count + ["spendShare", "appointmentShare", "completedAppointmentShare", "newToChewyShare", "netSalesShare"].filter((field) => Math.abs(metro.channelShares.reduce((sum, row) => sum + numberValue(row[field as keyof typeof row]), 0) - 1) > 0.001).length, 0);
  return {
    coverage: { records: records.length, metros: metros.length, channels: channels.length, distinctDates: dates.length, period: snapshot.period },
    qualityChecks: [
      { id: "unique_metro_date_channel", status: keyCount === records.length ? "pass" : "fail", observed: records.length - keyCount, expected: 0, message: "Duplicate metro × date × channel keys." },
      { id: "nonnegative_finite_metrics", status: invalidNumbers === 0 ? "pass" : "fail", observed: invalidNumbers, expected: 0, message: "Invalid or negative numeric cells." },
      { id: "appointment_funnel_invariants", status: appointmentInvariantFailures === 0 ? "pass" : "fail", observed: appointmentInvariantFailures, expected: 0, message: "Completed appointments must not exceed appointments; new-to-Chewy appointments must not exceed completed appointments." },
      { id: "channel_share_sums", status: shareSumFailures === 0 ? "pass" : "fail", observed: shareSumFailures, expected: 0, message: "Channel shares must sum to one within each metro and nonzero metric." },
      { id: "declared_week_grain", status: nonMondays === 0 ? "pass" : "fail", observed: nonMondays, expected: 0, message: "The field is named weekStartDate and the snapshot declares weekly grain, but most distinct dates are not Mondays; treat the records as daily until the source contract is corrected." },
    ], metros: metroResults, questions,
    limitations: (snapshot.limitations as string[]) ?? [],
  };
}

async function buildDogFoodPricing(connection: Awaited<ReturnType<typeof openDuckDb>>["connection"], paths: ReturnType<typeof inputPaths>) {
  const rows = await queryRows(connection, `
    WITH competitor AS (
      SELECT CAST(PRODUCT_PART_NUMBER AS VARCHAR) AS sku, CAST(ZIP_CODE AS VARCHAR) AS zip,
        TRY_CAST(COMPETITOR_ITEM_AVAILABILITY AS INTEGER) AS availability,
        TRY_CAST(EQUALIZED_PRICE AS DOUBLE) AS competitor_price
      FROM read_csv_auto(${sqlString(paths.competitorPrice)}, header=true, all_varchar=true, ignore_errors=false)
      WHERE lower(COMPETITOR_NAME) = 'walmart'
    ), pse AS (
      SELECT CAST(PRODUCT_PART_NUMBER AS VARCHAR) AS sku, PRODUCT_MERCH_CLASSIFICATION2 AS category,
        PRODUCT_MERCH_CLASSIFICATION3 AS subcategory, PRODUCT_MANUFACTURER_NAME AS manufacturer,
        TRY_CAST(CHEWY_PRICEBOT_PRICE AS DOUBLE) AS chewy_price, TRY_CAST(PSE_COST AS DOUBLE) AS pse_cost,
        TRY_CAST(ELASTICITY AS DOUBLE) AS elasticity
      FROM read_csv_auto(${sqlString(paths.pseSku)}, header=true, all_varchar=true, ignore_errors=false)
    ), products AS (
      SELECT CAST(PRODUCT_PART_NUMBER AS VARCHAR) AS sku, PRODUCT_NAME AS product_name
      FROM read_csv_auto(${sqlString(paths.productCatalog)}, header=true, all_varchar=true, ignore_errors=false)
    ), joined AS (
      SELECT competitor.*, pse.*, products.product_name, competitor_price / chewy_price - 1 AS price_gap
      FROM competitor INNER JOIN pse USING (sku) LEFT JOIN products USING (sku)
      WHERE category = 'Dog Food' AND competitor_price > 0 AND chewy_price > 0
    )
    SELECT sku, any_value(product_name) AS product_name, any_value(subcategory) AS subcategory,
      any_value(manufacturer) AS manufacturer, count(DISTINCT zip) AS zip_count,
      median(chewy_price) AS chewy_price, median(competitor_price) AS median_competitor_price,
      min(competitor_price) AS min_competitor_price, max(competitor_price) AS max_competitor_price,
      median(price_gap) AS median_price_gap,
      count_if(price_gap > ${THRESHOLDS.dogFoodPricing.minAbsolutePriceGap})::DOUBLE / count(*) AS share_above_gap,
      count_if(price_gap < -${THRESHOLDS.dogFoodPricing.minAbsolutePriceGap})::DOUBLE / count(*) AS share_below_gap,
      count_if(availability IN (0, 1))::DOUBLE / count(*) AS availability_share,
      any_value(pse_cost) AS pse_cost, any_value(elasticity) AS elasticity,
      (median(chewy_price) - any_value(pse_cost)) / median(chewy_price) AS price_cost_proxy,
      max(competitor_price) / min(competitor_price) - 1 AS regional_price_range
    FROM joined GROUP BY sku ORDER BY sku`);
  const parsed = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, ["sku", "product_name", "subcategory", "manufacturer"].includes(key) ? String(value ?? "") : nullableNumber(value)])) as Record<string, string | number | null>);
  const t = THRESHOLDS.dogFoodPricing;
  const commonGate = (row: Record<string, string | number | null>) => numberValue(row.zip_count) >= t.minZipCount
    && numberValue(row.availability_share) >= t.minAvailabilityShare
    && numberValue(row.price_cost_proxy) >= t.minPriceCostProxy
    && numberValue(row.price_cost_proxy) <= 0.8
    && numberValue(row.regional_price_range) <= t.maxRegionalPriceRange
    && numberValue(row.chewy_price) >= 1 && numberValue(row.median_competitor_price) <= 500;
  const rawDirectional = parsed.filter((row) => numberValue(row.zip_count) >= t.minZipCount
    && numberValue(row.availability_share) >= t.minAvailabilityShare
    && Math.abs(numberValue(row.median_price_gap)) >= t.minAbsolutePriceGap
    && (numberValue(row.share_above_gap) >= t.minConsistentShare || numberValue(row.share_below_gap) >= t.minConsistentShare));
  const accepted = rawDirectional.filter((row) => commonGate(row) && Math.abs(numberValue(row.median_price_gap)) <= t.maxAbsolutePriceGap);
  const toFinding = (row: Record<string, string | number | null>, type: "price_test_candidate" | "competitive_risk") => finding({
    id: `dog-food:${type}:${row.sku}`, type,
    question: type === "price_test_candidate" ? `Could ${row.product_name} support a controlled upward price test?` : `Should Chewy address the persistent Walmart price gap on ${row.product_name}?`,
    hypothesis: type === "price_test_candidate" ? "Chewy may have testable price headroom on this SKU because Walmart is consistently higher across the monitored ZIP panel." : "A broad persistent Walmart discount may create acquisition or retention risk on this SKU.",
    geography: { type: "monitored_zip_panel", label: `${Math.round(numberValue(row.zip_count))} monitored ZIPs` }, period: "latest offer in 30 days ending 2026-08-17 plus 2026-08-17 Chewy economics",
    confidence: { level: "medium", reason: "The matched-SKU price pattern passes coverage, consistency, availability, price-range, and price-cost sanity gates; sales, contribution, match-state, and causal response remain unconnected." },
    metrics: [
      metric("chewy_price", "Chewy price", numberValue(row.chewy_price), "USD", "Median CHEWY_PRICEBOT_PRICE for the SKU"),
      metric("walmart_equalized_price", "Walmart median equalized price", numberValue(row.median_competitor_price), "USD", "Median EQUALIZED_PRICE across monitored ZIPs"),
      metric("median_price_gap", "Walmart versus Chewy price gap", numberValue(row.median_price_gap), "ratio", "median(EQUALIZED_PRICE / CHEWY_PRICEBOT_PRICE - 1)"),
      metric("price_cost_proxy", "Chewy price less PSE cost as share of price", numberValue(row.price_cost_proxy), "ratio", "(CHEWY_PRICEBOT_PRICE - PSE_COST) / CHEWY_PRICEBOT_PRICE"),
      metric("elasticity", "Supplied elasticity", numberValue(row.elasticity), "elasticity", "ELASTICITY from current PSE snapshot"),
    ],
    evidence: [`${row.sku} (${row.manufacturer}; ${row.subcategory}) is observed across ${Math.round(numberValue(row.zip_count))} ZIPs.`, `${round(numberValue(row.availability_share) * 100, 1)}% of rows use a documented availability code; the competitor price range is ${round(numberValue(row.regional_price_range) * 100, 1)}%.`],
    implication: type === "price_test_candidate"
      ? `${row.product_name} is priced ${round(numberValue(row.median_price_gap) * 100, 1)}% below Walmart's median equalized price across ${Math.round(numberValue(row.zip_count))} monitored ZIPs. Do not match downward; prioritize this SKU for a bounded margin test.`
      : `${row.product_name} is priced ${round(Math.abs(numberValue(row.median_price_gap)) * 100, 1)}% above Walmart's median equalized price across ${Math.round(numberValue(row.zip_count))} monitored ZIPs. Protect conversion before considering any increase.`,
    proposedAction: type === "price_test_candidate"
      ? `Place SKU ${row.sku} in the first approved price-test cohort with control at the current price and conservative positive steps that remain below the observed Walmart median; stop if unit conversion, repeat purchase, or contribution deteriorates beyond the team's guardrail.`
      : `Exclude SKU ${row.sku} from upward price tests and review match, promotion, and assortment treatment first; measure whether closing part of the observed Walmart gap improves units, new customers, and contribution after discount cost.`,
    decisionBoundary: "Do not emit or apply a regional Chewy price. PSE cost is not contribution and elasticity is not geographic evidence.",
    limits: ["Current competitor feed is Walmart-only for the joined Dog Food slice.", "No regional Chewy demand, units, contribution, or customer response is connected.", "Representative-ZIP methodology and availability-code ownership still require approval."],
    sourceIds: ["SRC-025", "SRC-026", "SRC-027"], sourceFiles: [paths.competitorPrice, paths.pseSku, paths.productCatalog],
  });
  const raises = accepted.filter((row) => numberValue(row.median_price_gap) > 0 && numberValue(row.share_above_gap) >= t.minConsistentShare)
    .sort((left, right) => numberValue(right.median_price_gap) - numberValue(left.median_price_gap) || String(left.sku).localeCompare(String(right.sku)))
    .slice(0, t.maxCandidatesPerClass).map((row) => toFinding(row, "price_test_candidate"));
  const risks = accepted.filter((row) => numberValue(row.median_price_gap) < 0 && numberValue(row.share_below_gap) >= t.minConsistentShare)
    .sort((left, right) => numberValue(left.median_price_gap) - numberValue(right.median_price_gap) || String(left.sku).localeCompare(String(right.sku)))
    .slice(0, t.maxCandidatesPerClass).map((row) => toFinding(row, "competitive_risk"));
  const parity = await queryRows(connection, `
    WITH competitor AS (SELECT CAST(PRODUCT_PART_NUMBER AS VARCHAR) sku, CAST(ZIP_CODE AS VARCHAR) zip, TRY_CAST(EQUALIZED_PRICE AS DOUBLE) competitor_price FROM read_csv_auto(${sqlString(paths.competitorPrice)}, header=true, all_varchar=true) WHERE lower(COMPETITOR_NAME)='walmart'),
    pse AS (SELECT CAST(PRODUCT_PART_NUMBER AS VARCHAR) sku, PRODUCT_MERCH_CLASSIFICATION2 category, TRY_CAST(CHEWY_PRICEBOT_PRICE AS DOUBLE) chewy_price FROM read_csv_auto(${sqlString(paths.pseSku)}, header=true, all_varchar=true)),
    joined AS (SELECT competitor.*, chewy_price FROM competitor INNER JOIN pse USING(sku) WHERE category='Dog Food' AND competitor_price>0 AND chewy_price>0),
    sku AS (SELECT sku, count(DISTINCT zip) zip_count, count(DISTINCT competitor_price) price_count FROM joined GROUP BY sku)
    SELECT count(*) offer_rows, count(DISTINCT joined.zip) zip_count, count(DISTINCT joined.sku) sku_count,
      count_if(abs(competitor_price-chewy_price)<=0.01)::DOUBLE/count(*) exact_price_share,
      (SELECT count_if(price_count=1)::DOUBLE/count(*) FROM sku WHERE zip_count>=5) AS single_price_sku_share,
      (SELECT count(*) FROM sku WHERE zip_count>=5) AS sufficiently_observed_skus
    FROM joined`);
  const historical = await queryRows(connection, `
    WITH history AS (SELECT lower(COMPETITOR_NAME) competitor, CAST(PRODUCT_PART_NUMBER AS VARCHAR) sku, CAST(ZIP_CODE AS VARCHAR) zip, TRY_CAST(EQUALIZED_PRICE AS DOUBLE) price, TRY_CAST(COMPETITOR_OFFER_DATE AS TIMESTAMP) observed_at FROM read_csv_auto(${sqlString(paths.historicalCompetitorSample)}, header=true, all_varchar=true)),
    products AS (SELECT CAST(PRODUCT_PART_NUMBER AS VARCHAR) sku, PRODUCT_MERCH_CLASSIFICATION2 category FROM read_csv_auto(${sqlString(paths.productCatalog)}, header=true, all_varchar=true)),
    dog AS (SELECT * FROM history INNER JOIN products USING(sku) WHERE category='Dog Food' AND competitor IN ('petco_regional','petsmart_regional'))
    SELECT competitor, count(*) AS row_count, count(DISTINCT zip) AS zips, count(DISTINCT sku) AS skus, min(observed_at) AS first_observed, max(observed_at) AS last_observed FROM dog GROUP BY competitor ORDER BY competitor`);
  const petcoSkus = await queryRows(connection, `WITH h AS (SELECT lower(COMPETITOR_NAME) competitor, CAST(PRODUCT_PART_NUMBER AS VARCHAR) sku FROM read_csv_auto(${sqlString(paths.historicalCompetitorSample)}, header=true, all_varchar=true)), p AS (SELECT CAST(PRODUCT_PART_NUMBER AS VARCHAR) sku FROM read_csv_auto(${sqlString(paths.productCatalog)}, header=true, all_varchar=true) WHERE PRODUCT_MERCH_CLASSIFICATION2='Dog Food') SELECT count(*) overlap FROM (SELECT sku FROM h INNER JOIN p USING(sku) WHERE competitor='petco_regional' INTERSECT SELECT sku FROM h INNER JOIN p USING(sku) WHERE competitor='petsmart_regional')`);
  return {
    coverage: parity[0],
    paritySummary: {
      exactPriceShare: round(numberValue(parity[0]?.exact_price_share)),
      singlePriceSkuShareAmongSkusInAtLeastFiveZips: round(numberValue(parity[0]?.single_price_sku_share)),
      interpretation: "The current Walmart Dog Food price signal is predominantly national rather than a market-selection signal.",
    },
    raiseCandidates: raises, riskCandidates: risks,
    rejectedBySanity: { rawDirectionalCandidates: rawDirectional.length, acceptedCandidates: accepted.length, rejectedCandidates: rawDirectional.length - accepted.length, gates: "Reject gaps above 30%, regional price ranges above 50%, nonpositive or extreme price-cost proxies, and invalid price bounds." },
    petRetailTestContext: { rows: historical, overlappingPetcoPetsmartDogFoodSkus: numberValue(petcoSkus[0]?.overlap), interpretation: "The stale validation sample proves a join path but cannot compare Petco with PetSmart or rank Costa's test markets." },
    limitations: ["The current joined Dog Food feed contains Walmart only.", "PSE cost is a commercial proxy, not contribution or destination-specific cost-to-serve.", "Candidates are review queues for controlled analysis, not approved prices or regional actions."],
  };
}

async function buildNationalDogFoodContext(connection: Awaited<ReturnType<typeof openDuckDb>>["connection"], acquisition: JsonRow, dogFoodPricing: JsonRow, paths: ReturnType<typeof inputPaths>) {
  const records = (acquisition.records as Array<{ weekStartDate: string; businessSegment: string; netNewToChewySegmentAcquisitions: number }>) ?? [];
  const dog = records.filter((row) => row.businessSegment.startsWith("Dog Food - "));
  const dates = [...new Set(dog.map((row) => row.weekStartDate))].sort();
  const latestDate = dates.at(-1) ?? "unknown";
  const latest = dog.filter((row) => row.weekStartDate === latestDate);
  const latestTotal = latest.reduce((sum, row) => sum + row.netNewToChewySegmentAcquisitions, 0);
  const priorDates = dates.slice(-5, -1);
  const priorAverage = priorDates.length ? priorDates.reduce((sum, date) => sum + dog.filter((row) => row.weekStartDate === date).reduce((subtotal, row) => subtotal + row.netNewToChewySegmentAcquisitions, 0), 0) / priorDates.length : 0;
  const seo = (await queryRows(connection, `SELECT count(*) keyword_rows, count(DISTINCT lower(trim(Keyword))) distinct_keywords, sum(TRY_CAST(replace(Volume, ',', '') AS DOUBLE)) modeled_monthly_search_volume, median(TRY_CAST("CPC (USD)" AS DOUBLE)) median_cpc FROM read_csv_auto(${sqlString(paths.dogFoodSeo)}, header=true, all_varchar=true, ignore_errors=true) WHERE TRY_CAST(replace(Volume, ',', '') AS DOUBLE) IS NOT NULL`))[0] ?? {};
  return {
    acquisition: { latestWeek: latestDate, latestSegmentAcquisitions: latestTotal, priorFourWeekAverage: round(priorAverage), changeVersusPriorFourWeekAverage: priorAverage ? round(latestTotal / priorAverage - 1) : null, segments: latest.sort((left, right) => right.netNewToChewySegmentAcquisitions - left.netNewToChewySegmentAcquisitions) },
    seo: { snapshotDate: "2026-08-14", keywordRows: numberValue(seo.keyword_rows), distinctKeywords: numberValue(seo.distinct_keywords), modeledMonthlySearchVolume: numberValue(seo.modeled_monthly_search_volume), medianCpc: round(numberValue(seo.median_cpc)), subscriptionCapReached: true },
    pricing: { raiseCandidateCountShown: (dogFoodPricing.raiseCandidates as unknown[]).length, riskCandidateCountShown: (dogFoodPricing.riskCandidates as unknown[]).length, paritySummary: dogFoodPricing.paritySummary },
    hypotheses: [finding({
      id: "national-dog-food:acquisition-search-price", type: "hypothesis",
      question: "Which Dog Food demand themes should be paired with SKU price tests without pretending national SEO or acquisition data is regional?",
      hypothesis: "National acquisition momentum and modeled search demand can prioritize categories and creative themes, while matched-SKU price gaps identify separate SKU tests; neither source identifies a regional causal opportunity.",
      geography: { type: "us_national", label: "United States" }, period: `${latestDate} acquisition; 2026-08-14 SEO; 2026-08-17 pricing`,
      confidence: { level: "low", reason: "The sources are compatible only as national context and use different periods, populations, and outcome definitions." },
      metrics: [metric("dog_food_segment_acquisitions", "Latest weekly Dog Food segment acquisitions", latestTotal, "segment_acquisitions", "Sum of latest-week Dog Food business segments"), metric("modeled_search_volume", "Modeled monthly Dog Food keyword volume", numberValue(seo.modeled_monthly_search_volume), "modeled_searches", "Sum of unique rows inside the capped Dog Food seed export")],
      evidence: [`Latest Dog Food segment acquisitions are ${latestTotal.toLocaleString("en-US")} versus a prior-four-week average of ${round(priorAverage).toLocaleString("en-US")}.`, `The capped Dog Food SEO cohort contains ${numberValue(seo.distinct_keywords).toLocaleString("en-US")} distinct keywords.`],
      implication: `Dog Food produced ${latestTotal.toLocaleString("en-US")} segment acquisitions in the latest complete week (${priorAverage ? `${round((latestTotal / priorAverage - 1) * 100, 1)}% versus the prior-four-week average` : "no prior-period comparison"}) alongside ${numberValue(seo.modeled_monthly_search_volume).toLocaleString("en-US")} modeled monthly searches. Treat it as a coordinated national growth theme, not a regional allocation signal.`,
      proposedAction: "Prioritize Dog Food in the next national SEO/content and matched-SKU pricing planning cycle: align high-demand search themes to in-stock SKU cohorts, keep marketing and pricing experiments separate, and rank the cohorts by incremental new customers and contribution.",
      decisionBoundary: "Do not allocate national acquisition or SEO demand to DMA, CBSA, ZIP, or trade area.", limits: ["One customer may acquire into multiple business segments.", "SEO volume is third-party modeled demand and the export is capped.", "Periods are not aligned and no causal or regional join exists."],
      sourceIds: [String(acquisition.sourceId), "SRC-035", "SRC-025"], sourceFiles: [paths.newCustomerAcquisition, paths.dogFoodSeo, paths.competitorPrice],
    })],
    limitations: ["National context remains separate from regional findings.", "Do not sum overlapping SEO seed cohorts or interpret segment acquisitions as deduplicated customers."],
  };
}

function inputPaths(root = process.cwd()) {
  const absolute = (path: string) => resolve(root, path);
  return {
    retailDma: absolute("data/approved/google-ads/2026-07-14_2026-08-12/raw/retail_matched-dma-campaign-performance_us.csv"),
    pharmacyDma: absolute("data/approved/google-ads/2026-07-14_2026-08-12/raw/pharmacy_matched-dma-campaign-performance_us.csv"),
    cvcOutcomes: absolute("data/approved/cvc-metro-outcomes/current.json"),
    competitorPrice: absolute("data/approved/snowflake/pricing/2026-08-17/raw/competitor-price-geo_latest-by-zip-competitor-sku-30d_2026-08-17.csv"),
    historicalCompetitorSample: absolute("data/approved/snowflake/pricing/2026-08-17/raw/competitor-price-geo_historical-validation-sample_2026-08-17.csv"),
    pseSku: absolute("data/approved/snowflake/pricing/2026-08-17/raw/pse-pricing-economics_by-us-sku-current-day_2026-08-17.csv"),
    productCatalog: absolute("data/approved/snowflake/pricing/2026-08-17/raw/product-catalog_active-us-product-spine_2026-08-17.csv"),
    newCustomerAcquisition: absolute("data/approved/new-customer-acquisition/current.json"),
    dogFoodSeo: absolute("data/approved/seo/2026-08-14/raw/semrush-keyword-demand_topic-dog-food_us_2026-08-14.csv"),
  };
}

export async function buildAdaptiveDiscoverySnapshot(options: { root?: string; generatedAt?: string } = {}) {
  const root = options.root ?? process.cwd();
  const paths = inputPaths(root);
  const [cvc, acquisition] = await Promise.all([readFile(paths.cvcOutcomes, "utf8").then(JSON.parse), readFile(paths.newCustomerAcquisition, "utf8").then(JSON.parse)]);
  const handle = await openDuckDb(":memory:");
  try {
    const matchedDmaCrossAccount = await buildMatchedDmaDiscovery(handle.connection, paths);
    const dogFoodPricing = await buildDogFoodPricing(handle.connection, paths);
    const nationalDogFoodContext = await buildNationalDogFoodContext(handle.connection, acquisition, dogFoodPricing as unknown as JsonRow, paths);
    return {
      version: ADAPTIVE_DISCOVERY_VERSION,
      generatedAt: options.generatedAt ?? process.env.ADAPTIVE_DISCOVERY_GENERATED_AT ?? new Date().toISOString(),
      builderVersion: ADAPTIVE_DISCOVERY_BUILDER_VERSION,
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      thresholds: THRESHOLDS,
      sources: [
        source("SRC-018", paths.retailDma, "matched DMA label × campaign", "2026-07-14/2026-08-12"),
        source("SRC-018", paths.pharmacyDma, "matched DMA label × campaign", "2026-07-14/2026-08-12"),
        source(String(cvc.sourceId), paths.cvcOutcomes, String(cvc.grain), `${cvc.period.start}/${cvc.period.end}`),
        source("SRC-025", paths.competitorPrice, "latest Walmart × ZIP × SKU offer in 30 days", "ending 2026-08-17"),
        source("SRC-025", paths.historicalCompetitorSample, "bounded historical competitor validation sample", "2025-04/2025-05"),
        source("SRC-025", paths.pseSku, "current U.S. SKU", "2026-08-17"),
        source("SRC-027", paths.productCatalog, "active U.S. SKU", "2026-08-17"),
        source(String(acquisition.sourceId), paths.newCustomerAcquisition, String(acquisition.grain), `${acquisition.period.start}/${acquisition.period.end}`),
        source("SRC-035", paths.dogFoodSeo, "national keyword within Dog Food seed cohort", "2026-08-14"),
      ].map((item) => ({ ...item, file: item.file.replace(`${resolve(root)}/`, "") })),
      discoveries: {
        matchedDmaCrossAccount,
        cvcChannelMix: buildCvcChannelMix(cvc, paths.cvcOutcomes.replace(`${resolve(root)}/`, "")),
        dogFoodPricing,
        nationalDogFoodContext,
      },
      globalLimits: [
        "Findings are deterministic investigation leads, not causal conclusions, rankings, approvals, or automated actions.",
        "Cross-source evidence remains separate when geography, period, population, or metric definitions are incompatible.",
        "Raw approved files remain outside the browser response; this snapshot contains aggregate evidence only.",
      ],
    };
  } finally {
    await closeDuckDb(handle);
  }
}

async function main() {
  const output = resolve(process.cwd(), "data/approved/adaptive-discovery/current.json");
  const snapshot = await buildAdaptiveDiscoverySnapshot();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote adaptive analyst discovery snapshot to ${output}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
