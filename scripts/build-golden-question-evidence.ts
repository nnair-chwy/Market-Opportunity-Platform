import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type NumericValue = {
  cbsaCode: string;
  rawValue: number;
  contributingGeographies: number;
};

const root = process.cwd();
const generatedAt = process.env.GOLDEN_QUESTION_EVIDENCE_GENERATED_AT ?? new Date().toISOString();
const outputPath = process.env.GOLDEN_QUESTION_EVIDENCE_OUTPUT
  ? path.resolve(process.env.GOLDEN_QUESTION_EVIDENCE_OUTPUT)
  : path.join(root, "data/approved/golden-question-evidence/current.json");

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8")) as T;
}

function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const midpoint = Math.floor(finite.length / 2);
  return finite.length % 2 === 0
    ? (finite[midpoint - 1] + finite[midpoint]) / 2
    : finite[midpoint];
}

function percentile(values: number[], probability: number): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const index = (finite.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return finite[lower];
  return finite[lower] + (finite[upper] - finite[lower]) * (index - lower);
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

const mapSignals = await readJson<{
  generatedAt: string;
  datasets: Record<string, {
    snapshotId: string;
    inputGrain: string;
    outputGrain: string;
    transformationVersion: string;
    allowedUse: string;
    scoringEligibility: string;
    coverage: Record<string, number>;
    values: NumericValue[];
  }>;
}>("data/approved/derived-map-signals/current.json");

const zeusManifest = await readJson<{
  snapshotDate: string;
  allowedUse: string;
  scoringEligibility: string;
  exports: Array<{
    datasetId: string;
    rows: number;
    completeness: string;
    sourceUiEntries?: number;
  }>;
}>("data/contracts/zeus-ui/export-manifest.json");
const zeusProductExport = zeusManifest.exports.find((item) => item.datasetId === "zeus_product_pricing_state_daily_v1");
const zeusExceptionExport = zeusManifest.exports.find((item) => item.datasetId === "zeus_pricing_exception_current_state_v1");
if (!zeusProductExport || !zeusExceptionExport || !zeusProductExport.sourceUiEntries) {
  throw new Error("The contracted Zeus product and exception exports are required.");
}

const universe = await readJson<{
  markets: Array<{ cbsa_code: string; cbsa_name: string; cbsa_type: string }>;
}>("data/public/census/cbsa-universe/2023-07/markets.json");

const tradeAreas = await readJson<Array<{
  trade_area_id: string;
  is_synthetic: boolean;
  metrics: Array<{ metric_id: string; raw_value: number | null }>;
}>>("data/sample/esri/2026-07-30/trade-areas.json");

const sites = await readJson<Array<{
  site_id: string;
  site_name: string;
  market_name: string | null;
  workflow_stage: string;
}>>("data/sample/esri/2026-07-30/site-identities.json");

const crosswalk = await readJson<Array<{
  site_id: string;
  trade_area_id: string;
  link_state: string;
}>>("data/sample/esri/2026-07-30/site-trade-area-crosswalk.json");

const valuesByDataset = new Map<string, Map<string, NumericValue>>();
for (const [datasetId, dataset] of Object.entries(mapSignals.datasets)) {
  valuesByDataset.set(datasetId, new Map(dataset.values.map((value) => [value.cbsaCode, value])));
}

function mapValue(datasetId: string, cbsaCode: string): NumericValue | null {
  return valuesByDataset.get(datasetId)?.get(cbsaCode) ?? null;
}

const marketingRows = universe.markets.flatMap((market) => {
  const clicks = mapValue("marketing_paid_search_response", market.cbsa_code);
  const impressions = mapValue("marketing_paid_search_impressions", market.cbsa_code);
  const ctr = mapValue("marketing_paid_search_ctr", market.cbsa_code);
  const cpc = mapValue("marketing_paid_search_cpc", market.cbsa_code);
  const conversions = mapValue("marketing_paid_search_conversions", market.cbsa_code);
  const conversionRate = mapValue("marketing_paid_search_conversion_rate", market.cbsa_code);
  const cost = mapValue("marketing_paid_search_cost", market.cbsa_code);
  if (!clicks || !impressions || !ctr || !cpc || !conversions || !conversionRate || !cost) return [];
  return [{
    cbsaCode: market.cbsa_code,
    cbsaName: market.cbsa_name,
    cbsaType: market.cbsa_type,
    postalGeographies: clicks.contributingGeographies,
    clicks: clicks.rawValue,
    impressions: impressions.rawValue,
    ctr: ctr.rawValue,
    cpc: cpc.rawValue,
    conversions: conversions.rawValue,
    conversionRate: conversionRate.rawValue,
    cost: cost.rawValue,
  }];
});

const marketingEligible = marketingRows.filter((row) =>
  row.cbsaType === "metropolitan" &&
  row.clicks >= 10_000 &&
  row.conversions >= 500 &&
  row.postalGeographies >= 10
);
const marketingMedianCtr = median(marketingEligible.map((row) => row.ctr));
const marketingMedianCpc = median(marketingEligible.map((row) => row.cpc));
const marketingMedianConversionRate = median(marketingEligible.map((row) => row.conversionRate));
const marketingP75ConversionRate = percentile(marketingEligible.map((row) => row.conversionRate), 0.75);

const marketingCandidates = marketingEligible
  .filter((row) =>
    marketingP75ConversionRate !== null &&
    marketingMedianCpc !== null &&
    row.conversionRate >= marketingP75ConversionRate &&
    row.cpc <= marketingMedianCpc
  )
  .sort((a, b) => b.conversions - a.conversions || a.cbsaCode.localeCompare(b.cbsaCode))
  .slice(0, 5)
  .map((row) => ({
    geography: { type: "cbsa", id: row.cbsaCode, name: row.cbsaName },
    cohort: `Metropolitan CBSAs with >=10,000 clicks, >=500 configured conversions, and >=10 mapped postal geographies (${marketingEligible.length} eligible)`,
    observationWindow: "2026-07-14 through 2026-08-12",
    metrics: {
      clicks: round(row.clicks, 0),
      impressions: round(row.impressions, 0),
      ctrPercent: round(row.ctr),
      cpcUsd: round(row.cpc),
      configuredConversions: round(row.conversions, 2),
      configuredConversionRatePercent: round(row.conversionRate),
      costUsd: round(row.cost, 2),
      mappedPostalGeographies: row.postalGeographies,
    },
    comparison: {
      cohortMedianCtrPercent: round(marketingMedianCtr),
      cohortMedianCpcUsd: round(marketingMedianCpc),
      cohortMedianConfiguredConversionRatePercent: round(marketingMedianConversionRate),
      conversionRateDifferenceVsMedianPercentagePoints: round(
        marketingMedianConversionRate === null ? null : row.conversionRate - marketingMedianConversionRate,
      ),
    },
  }));

const pricingRows = universe.markets.flatMap((market) => {
  const availability = mapValue("pricing_competitor_availability", market.cbsa_code);
  const volume = mapValue("pricing_offer_observation_volume", market.cbsa_code);
  const breadth = mapValue("pricing_assortment_breadth", market.cbsa_code);
  const equalizedPrice = mapValue("pricing_observed_equalized_price", market.cbsa_code);
  if (!availability || !volume || !breadth || !equalizedPrice) return [];
  return [{
    cbsaCode: market.cbsa_code,
    cbsaName: market.cbsa_name,
    cbsaType: market.cbsa_type,
    zipGeographies: volume.contributingGeographies,
    availability: availability.rawValue,
    offerRows: volume.rawValue,
    skuBreadth: breadth.rawValue,
    equalizedPrice: equalizedPrice.rawValue,
  }];
});

const metropolitanPricing = pricingRows.filter((row) => row.cbsaType === "metropolitan");
const pricingMedianOfferRows = median(metropolitanPricing.map((row) => row.offerRows));
const pricingEligible = metropolitanPricing.filter((row) =>
  pricingMedianOfferRows !== null && row.offerRows >= pricingMedianOfferRows
);
const pricingMedianAvailability = median(pricingEligible.map((row) => row.availability));
const pricingCandidate = pricingEligible
  .sort((a, b) => a.availability - b.availability || b.offerRows - a.offerRows || a.cbsaCode.localeCompare(b.cbsaCode))[0];

const tradeById = new Map(tradeAreas.map((tradeArea) => [tradeArea.trade_area_id, tradeArea]));
const siteById = new Map(sites.map((site) => [site.site_id, site]));
const cvcRows = crosswalk.flatMap((link) => {
  if (link.link_state !== "source_provided") return [];
  const site = siteById.get(link.site_id);
  const tradeArea = tradeById.get(link.trade_area_id);
  if (!site || !site.market_name || !tradeArea || tradeArea.is_synthetic) return [];
  const metrics = new Map(tradeArea.metrics.map((metric) => [metric.metric_id, metric.raw_value]));
  const petHouseholdsPerClinic = metrics.get("pet_households_per_clinic");
  const onlineCustomers = metrics.get("chewy_online_customers");
  const clinicCount = metrics.get("veterinary_clinic_count");
  const petHouseholds = metrics.get("households_with_pets");
  if (
    typeof petHouseholdsPerClinic !== "number" ||
    typeof onlineCustomers !== "number" ||
    typeof clinicCount !== "number" ||
    typeof petHouseholds !== "number"
  ) return [];
  return [{
    siteId: site.site_id,
    siteName: site.site_name,
    marketName: site.market_name,
    workflowStage: site.workflow_stage,
    petHouseholdsPerClinic,
    onlineCustomers,
    clinicCount,
    petHouseholds,
  }];
});

const marketGroups = new Map<string, typeof cvcRows>();
for (const row of cvcRows) marketGroups.set(row.marketName, [...(marketGroups.get(row.marketName) ?? []), row]);
const cvcComparable = [...marketGroups.entries()].filter(([, rows]) => rows.length >= 3);
const cvcCandidates = cvcComparable
  .flatMap(([marketName, rows]) => {
    const cohortMedianRatio = median(rows.map((row) => row.petHouseholdsPerClinic));
    const cohortMedianCustomers = median(rows.map((row) => row.onlineCustomers));
    if (cohortMedianRatio === null || cohortMedianCustomers === null) return [];
    return rows.map((row) => ({
      ...row,
      cohortSize: rows.length,
      cohortMedianRatio,
      cohortMedianCustomers,
      contrastRatio: row.petHouseholdsPerClinic / cohortMedianRatio,
      marketName,
    }));
  })
  .filter((row) => row.petHouseholdsPerClinic > row.cohortMedianRatio && row.onlineCustomers >= row.cohortMedianCustomers)
  .sort((a, b) => b.contrastRatio - a.contrastRatio || a.siteId.localeCompare(b.siteId))
  .slice(0, 1)
  .map((row) => ({
    geography: { type: "supplied_trade_area", siteId: row.siteId, siteName: row.siteName, marketLabel: row.marketName },
    cohort: `${row.marketName} supplied source-linked trade areas with complete contrast measures (${row.cohortSize} records)`,
    observationWindow: "Unknown observation date; snapshot received 2026-07-30",
    metrics: {
      petHouseholds: round(row.petHouseholds, 0),
      reportedVeterinaryClinicCount: round(row.clinicCount, 0),
      reportedPetHouseholdsPerClinic: round(row.petHouseholdsPerClinic, 0),
      reportedChewyOnlineCustomers: round(row.onlineCustomers, 2),
    },
    comparison: {
      cohortMedianPetHouseholdsPerClinic: round(row.cohortMedianRatio, 0),
      cohortMedianChewyOnlineCustomers: round(row.cohortMedianCustomers, 2),
      petHouseholdsPerClinicMultipleVsMedian: round(row.contrastRatio),
    },
  }));

const output = {
  version: "1.0.0",
  snapshotId: "golden-question-evidence-2026-08-18-v1",
  generatedAt,
  allowedUse: "internal_shadow_evaluation_only",
  scoringEligibility: "none",
  actionAuthority: "investigation_leads_only_no_material_action",
  sourceSnapshots: {
    mapSignalsGeneratedAt: mapSignals.generatedAt,
    pricing: mapSignals.datasets.pricing_competitor_availability.snapshotId,
    marketing: mapSignals.datasets.marketing_paid_search_response.snapshotId,
    cvc: "esri-demo-2026-07-30",
    cbsaUniverse: "2023-07",
    zeus: `zeus-ui-${zeusManifest.snapshotDate}`,
  },
  operationalContext: {
    pricing: {
      snapshotDate: zeusManifest.snapshotDate,
      exportedProductSkus: zeusProductExport.rows,
      sourceUiProductEntries: zeusProductExport.sourceUiEntries,
      productExportCoveragePercent: round((zeusProductExport.rows / zeusProductExport.sourceUiEntries) * 100),
      currentRegularExceptions: zeusExceptionExport.rows,
      productExportCompleteness: zeusProductExport.completeness,
      exceptionExportCompleteness: zeusExceptionExport.completeness,
      allowedUse: zeusManifest.allowedUse,
      scoringEligibility: zeusManifest.scoringEligibility,
    },
  },
  selectionRules: {
    marketing: "Metropolitan CBSA; >=10,000 clicks; >=500 configured conversions; >=10 mapped postal geographies; conversion rate at/above eligible-cohort p75; CPC at/below eligible-cohort median; take five highest configured-conversion counts for a national signal set.",
    pricing: "Metropolitan CBSA; monitored offer volume at/above the metropolitan median; select the lowest documented availability rate. This is a coverage/anomaly screen, not a price-opportunity score.",
    cvc: "Source-provided, non-synthetic trade areas in market-label cohorts with at least three complete records; pet-households-per-clinic above the cohort median and reported Chewy online customers at/above the cohort median; select the largest ratio contrast.",
  },
  cohortDiagnostics: {
    marketing: {
      eligibleMarkets: marketingEligible.length,
      medianCtrPercent: round(marketingMedianCtr),
      medianCpcUsd: round(marketingMedianCpc),
      medianConfiguredConversionRatePercent: round(marketingMedianConversionRate),
      p75ConfiguredConversionRatePercent: round(marketingP75ConversionRate),
    },
    pricing: {
      metropolitanMarketsWithCompleteSignals: metropolitanPricing.length,
      eligibleMarkets: pricingEligible.length,
      medianOfferRowsAllMetropolitan: round(pricingMedianOfferRows, 0),
      medianAvailabilityPercentEligible: round(pricingMedianAvailability),
    },
    cvc: {
      sourceLinkedCompleteRecords: cvcRows.length,
      comparableMarketLabelCohorts: cvcComparable.length,
    },
  },
  candidates: {
    marketing: marketingCandidates,
    pricing: pricingCandidate ? [{
      geography: { type: "cbsa", id: pricingCandidate.cbsaCode, name: pricingCandidate.cbsaName },
      cohort: `Metropolitan CBSAs with monitored offer volume at/above the metropolitan median (${pricingEligible.length} eligible)`,
      observationWindow: "Competitor observations from 2026-07-18 through 2026-08-17",
      metrics: {
        documentedAvailabilityPercent: round(pricingCandidate.availability),
        monitoredOfferRows: round(pricingCandidate.offerRows, 0),
        summedDistinctSkuObservations: round(pricingCandidate.skuBreadth, 0),
        offerRowWeightedEqualizedPriceUsd: round(pricingCandidate.equalizedPrice),
        mappedZipGeographies: pricingCandidate.zipGeographies,
      },
      comparison: {
        eligibleCohortMedianAvailabilityPercent: round(pricingMedianAvailability),
        availabilityDifferenceVsMedianPercentagePoints: round(
          pricingMedianAvailability === null ? null : pricingCandidate.availability - pricingMedianAvailability,
        ),
        metropolitanMedianOfferRows: round(pricingMedianOfferRows, 0),
      },
    }] : [],
    cvc: cvcCandidates,
  },
  limitations: [
    "Every candidate is an investigation lead; none authorizes a price, campaign-spend, clinic, lease, or other material action.",
    "Pricing metrics are competitor-monitoring aggregates whose ZIP coverage rotates and whose price/availability mix varies by competitor, category, SKU, package normalization, and crawl timing.",
    "Pricing lacks a connected local Chewy outcome and a complete prior-intervention/promotion/inventory exclusion in this snapshot.",
    "Zeus adds current national SKU and exception context only; the product export is capped, the exception view is current-state only, and neither provides destination geography or historical price-decision outcomes.",
    "Marketing metrics reflect the retail account's configured Google Ads conversion semantics and campaign mix, not incrementality or first-party commercial outcomes.",
    "Postal-to-CBSA assignment uses the versioned zip-zcta-centroid-cbsa-v1 approximation and is not an approved operational crosswalk.",
    "CVC trade-area observation dates, construction method, clinic-count definition, metric units/ownership, and production reuse approval are unresolved.",
  ],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
