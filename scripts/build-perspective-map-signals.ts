import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { geoBounds, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology, Objects } from "topojson-specification";
import { workspaceSnapshotBundleSchema } from "../lib/perspectives/workspace-snapshot.ts";

type CsvRow = Record<string, string>;
type MarketProperties = { cbsa_code: string; cbsa_name: string; cbsa_type: string };

const marketingPath = resolve(requiredEnv("MARKETING_POSTAL_EXPORT"));
const pricingPath = resolve(requiredEnv("PRICING_COMPETITOR_CATEGORY_EXPORT"));
const zctaPath = resolve(requiredEnv("ZCTA_GAZETTEER_FILE"));
const topologyPath = resolve("data/public/census/cbsa-geometry/2024/markets.topo.json");
const outputPath = resolve(
  process.env.PERSPECTIVE_MAP_SNAPSHOT_PATH?.trim()
    ?? "data/approved/derived-map-signals/current.json",
);

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before building perspective map signals.`);
  return value;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(Boolean)) rows.push(row);
  }
  const headerIndex = rows.findIndex((candidate) =>
    candidate.includes("Matched location") || candidate.includes("ZIP_CODE"),
  );
  if (headerIndex < 0) throw new Error("CSV header could not be identified.");
  const headers = rows[headerIndex];
  return rows.slice(headerIndex + 1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function numberValue(value: string | undefined) {
  const parsed = Number((value ?? "").replaceAll(",", "").replace(/[$%]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeZip(value: string | undefined) {
  const match = (value ?? "").match(/^\s*(\d{5})/);
  return match?.[1] ?? null;
}

function readZctaCentroids(text: string) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const delimiter = headerLine.includes("|") ? "|" : "\t";
  const headers = headerLine.split(delimiter).map((value) => value.trim());
  const zipColumn = headers.findIndex((value) => /GEOID|ZCTA5/i.test(value));
  const latitudeColumn = headers.findIndex((value) => /INTPTLAT/i.test(value));
  const longitudeColumn = headers.findIndex((value) => /INTPTLONG/i.test(value));
  if ([zipColumn, latitudeColumn, longitudeColumn].some((index) => index < 0)) {
    throw new Error("The ZCTA Gazetteer file is missing GEOID/INTPTLAT/INTPTLONG columns.");
  }
  return new Map(lines.flatMap((line) => {
    const values = line.split(delimiter).map((value) => value.trim());
    const zip = values[zipColumn];
    const latitude = Number(values[latitudeColumn]);
    const longitude = Number(values[longitudeColumn]);
    return /^\d{5}$/.test(zip) && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [[zip, [longitude, latitude] as [number, number]] as const]
      : [];
  }));
}

function marketFeatures(topology: Topology<Objects<MarketProperties>>) {
  const collection = feature(topology, topology.objects.markets) as unknown as FeatureCollection<Geometry, MarketProperties>;
  return collection.features.map((market) => ({
    market,
    bounds: geoBounds(market),
  }));
}

function assignZipsToMarkets(
  zips: Set<string>,
  centroids: Map<string, [number, number]>,
  markets: Array<{ market: Feature<Geometry, MarketProperties>; bounds: [[number, number], [number, number]] }>,
) {
  const assignments = new Map<string, string>();
  for (const zip of zips) {
    const point = centroids.get(zip);
    if (!point) continue;
    const match = markets.find(({ market, bounds }) =>
      point[0] >= bounds[0][0] && point[0] <= bounds[1][0]
      && point[1] >= bounds[0][1] && point[1] <= bounds[1][1]
      && geoContains(market, point),
    );
    if (match) assignments.set(zip, match.market.properties.cbsa_code);
  }
  return assignments;
}

const [marketingText, pricingText, zctaText, topologyText] = await Promise.all([
  readFile(marketingPath, "utf8"),
  readFile(pricingPath, "utf8"),
  readFile(zctaPath, "utf8"),
  readFile(topologyPath, "utf8"),
]);

const marketingRows = parseCsv(marketingText);
const pricingRows = parseCsv(pricingText);
const marketingZipSet = new Set(marketingRows.flatMap((row) => normalizeZip(row["Matched location"]) ?? []));
const pricingZipSet = new Set(pricingRows.flatMap((row) => normalizeZip(row.ZIP_CODE) ?? []));
const centroids = readZctaCentroids(zctaText);
const markets = marketFeatures(JSON.parse(topologyText) as Topology<Objects<MarketProperties>>);
const inputZips = new Set([
  ...marketingZipSet,
  ...pricingZipSet,
]);
const assignments = assignZipsToMarkets(inputZips, centroids, markets);

const marketingByCbsa = new Map<string, { clicks: number; impressions: number; cost: number; conversions: number; zips: Set<string> }>();
let totalMarketingClicks = 0;
let mappedMarketingClicks = 0;
let totalMarketingImpressions = 0;
let mappedMarketingImpressions = 0;
let totalMarketingCost = 0;
let mappedMarketingCost = 0;
let totalMarketingConversions = 0;
let mappedMarketingConversions = 0;
for (const row of marketingRows) {
  const zip = normalizeZip(row["Matched location"]);
  const clicks = numberValue(row.Clicks);
  const impressions = numberValue(row["Impr."]);
  const cost = numberValue(row.Cost);
  const conversions = numberValue(row.Conversions);
  if (!zip) continue;
  totalMarketingClicks += clicks;
  totalMarketingImpressions += impressions;
  totalMarketingCost += cost;
  totalMarketingConversions += conversions;
  const cbsaCode = assignments.get(zip);
  if (!cbsaCode) continue;
  mappedMarketingClicks += clicks;
  mappedMarketingImpressions += impressions;
  mappedMarketingCost += cost;
  mappedMarketingConversions += conversions;
  const aggregate = marketingByCbsa.get(cbsaCode) ?? { clicks: 0, impressions: 0, cost: 0, conversions: 0, zips: new Set<string>() };
  aggregate.clicks += clicks;
  aggregate.impressions += impressions;
  aggregate.cost += cost;
  aggregate.conversions += conversions;
  aggregate.zips.add(zip);
  marketingByCbsa.set(cbsaCode, aggregate);
}

const pricingByCbsa = new Map<string, { offerRows: number; availableRows: number; priceWeight: number; weightedPrice: number; distinctSkus: number; zips: Set<string> }>();
let totalPricingOffers = 0;
let mappedPricingOffers = 0;
let totalPricingPriceWeight = 0;
let mappedPricingPriceWeight = 0;
let totalPricingSkus = 0;
let mappedPricingSkus = 0;
for (const row of pricingRows) {
  const zip = normalizeZip(row.ZIP_CODE);
  const offerRows = numberValue(row.OFFER_ROWS);
  const availableRows = numberValue(row.DOCUMENTED_AVAILABLE_ROWS);
  const equalizedPrice = numberValue(row.AVG_EQUALIZED_PRICE);
  const priceWeight = equalizedPrice > 0 ? offerRows : 0;
  const distinctSkus = numberValue(row.DISTINCT_SKUS);
  totalPricingOffers += offerRows;
  totalPricingPriceWeight += priceWeight;
  totalPricingSkus += distinctSkus;
  const cbsaCode = zip ? assignments.get(zip) : null;
  if (!zip || !cbsaCode) continue;
  mappedPricingOffers += offerRows;
  mappedPricingPriceWeight += priceWeight;
  mappedPricingSkus += distinctSkus;
  const aggregate = pricingByCbsa.get(cbsaCode) ?? { offerRows: 0, availableRows: 0, priceWeight: 0, weightedPrice: 0, distinctSkus: 0, zips: new Set<string>() };
  aggregate.offerRows += offerRows;
  aggregate.availableRows += availableRows;
  aggregate.priceWeight += priceWeight;
  aggregate.weightedPrice += equalizedPrice * priceWeight;
  aggregate.distinctSkus += distinctSkus;
  aggregate.zips.add(zip);
  pricingByCbsa.set(cbsaCode, aggregate);
}

const pricingCoverage = (mappedValueShare: number) => ({
  inputRows: pricingRows.length,
  inputGeographies: pricingZipSet.size,
  mappedGeographies: [...assignments.keys()].filter((zip) => pricingZipSet.has(zip)).length,
  mappedCbsaCount: pricingByCbsa.size,
  mappedValueShare,
});

const marketingCoverage = (mappedValueShare: number) => ({
  inputRows: marketingRows.length,
  inputGeographies: marketingZipSet.size,
  mappedGeographies: [...assignments.keys()].filter((zip) => marketingZipSet.has(zip)).length,
  mappedCbsaCount: marketingByCbsa.size,
  mappedValueShare,
});

const bundle = workspaceSnapshotBundleSchema.parse({
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  datasets: {
    pricing_competitor_availability: {
      datasetId: "pricing_competitor_availability",
      snapshotId: "snowflake-pricing-2026-08-17",
      label: "Observed competitor availability",
      valueLabel: "Documented availability rate",
      valueFormat: "percent",
      sourceIds: ["SRC-025", "SRC-028", "SRC-030"],
      inputGrain: "ZIP × competitor × merchandise category over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "USPS ZIP treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: pricingCoverage(totalPricingOffers ? mappedPricingOffers / totalPricingOffers : 0),
      values: [...pricingByCbsa.entries()].map(([cbsaCode, aggregate]) => ({
        cbsaCode,
        rawValue: aggregate.offerRows ? aggregate.availableRows / aggregate.offerRows * 100 : 0,
        contributingGeographies: aggregate.zips.size,
      })).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Monitoring coverage is not comprehensive or representative of every competitor, ZIP, category, or SKU.",
        "ZIP-to-ZCTA equivalence and centroid assignment are an explicit approximation, not an approved operational crosswalk.",
        "Availability rate does not measure Chewy demand, price elasticity, margin, or causal response.",
      ],
    },
    pricing_observed_equalized_price: {
      datasetId: "pricing_observed_equalized_price",
      snapshotId: "snowflake-pricing-2026-08-17",
      label: "Observed equalized offer price",
      valueLabel: "Offer-row-weighted equalized price",
      valueFormat: "currency",
      sourceIds: ["SRC-025", "SRC-028"],
      inputGrain: "ZIP × competitor × merchandise category over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "USPS ZIP treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: pricingCoverage(totalPricingPriceWeight ? mappedPricingPriceWeight / totalPricingPriceWeight : 0),
      values: [...pricingByCbsa.entries()].flatMap(([cbsaCode, aggregate]) => aggregate.priceWeight ? [{
        cbsaCode,
        rawValue: aggregate.weightedPrice / aggregate.priceWeight,
        contributingGeographies: aggregate.zips.size,
      }] : []).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "The average is weighted by monitored offer rows and is sensitive to the observed competitor, category, SKU, and package mix.",
        "It is not a matched-basket price index or a Chewy-versus-competitor price gap.",
        "ZIP-to-ZCTA equivalence and centroid assignment are an explicit approximation, not an approved operational crosswalk.",
      ],
    },
    pricing_offer_observation_volume: {
      datasetId: "pricing_offer_observation_volume",
      snapshotId: "snowflake-pricing-2026-08-17",
      label: "Monitored competitor offer volume",
      valueLabel: "Monitored offer rows",
      valueFormat: "number",
      sourceIds: ["SRC-025", "SRC-028"],
      inputGrain: "ZIP × competitor × merchandise category over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "USPS ZIP treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: pricingCoverage(totalPricingOffers ? mappedPricingOffers / totalPricingOffers : 0),
      values: [...pricingByCbsa.entries()].flatMap(([cbsaCode, aggregate]) => aggregate.offerRows ? [{
        cbsaCode,
        rawValue: aggregate.offerRows,
        contributingGeographies: aggregate.zips.size,
      }] : []).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Offer-row volume measures monitoring depth and is affected by crawl frequency, observed assortment, competitor coverage, category mix, and source availability.",
        "The monitored competitor and assortment sample is not a complete local market census or competitor market-share measure.",
        "This measure does not establish customer demand, price response, or opportunity.",
      ],
    },
    pricing_assortment_breadth: {
      datasetId: "pricing_assortment_breadth",
      snapshotId: "snowflake-pricing-2026-08-17",
      label: "Observed competitor assortment breadth",
      valueLabel: "Summed distinct-SKU observations",
      valueFormat: "number",
      sourceIds: ["SRC-025", "SRC-028"],
      inputGrain: "ZIP × competitor × merchandise category over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "USPS ZIP treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: pricingCoverage(totalPricingSkus ? mappedPricingSkus / totalPricingSkus : 0),
      values: [...pricingByCbsa.entries()].map(([cbsaCode, aggregate]) => ({
        cbsaCode,
        rawValue: aggregate.distinctSkus,
        contributingGeographies: aggregate.zips.size,
      })).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Distinct-SKU counts are summed across ZIP, competitor, and category rows, so the same SKU can contribute in more than one geography.",
        "The result measures observed monitoring breadth, not complete local assortment or unique market-level SKU count.",
        "Assortment breadth alone does not measure customer demand, substitution, availability quality, or price opportunity.",
      ],
    },
    marketing_paid_search_response: {
      datasetId: "marketing_paid_search_response",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search response",
      valueLabel: "Matched-postal clicks",
      valueFormat: "number",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingClicks ? mappedMarketingClicks / totalMarketingClicks : 0),
      values: [...marketingByCbsa.entries()].map(([cbsaCode, aggregate]) => ({
        cbsaCode,
        rawValue: aggregate.clicks,
        contributingGeographies: aggregate.zips.size,
      })).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Clicks are conditioned on campaign setup, bids, budgets, creative, inventory, and Google location semantics.",
        "ZIP-to-ZCTA equivalence and centroid assignment are an explicit approximation, not an approved operational crosswalk.",
        "This snapshot does not establish total demand, unique reach, conversion quality, incrementality, or optimal spend.",
      ],
    },
    marketing_paid_search_impressions: {
      datasetId: "marketing_paid_search_impressions",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search impressions",
      valueLabel: "Matched-postal impressions",
      valueFormat: "number",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingImpressions ? mappedMarketingImpressions / totalMarketingImpressions : 0),
      values: [...marketingByCbsa.entries()].map(([cbsaCode, aggregate]) => ({
        cbsaCode,
        rawValue: aggregate.impressions,
        contributingGeographies: aggregate.zips.size,
      })).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Impressions are conditioned on campaign setup, bids, budgets, creative, inventory, and Google location semantics.",
        "Impressions are not unique reach, addressable demand, awareness lift, or incrementality.",
        "ZIP-to-ZCTA equivalence and centroid assignment are an explicit approximation, not an approved operational crosswalk.",
      ],
    },
    marketing_paid_search_ctr: {
      datasetId: "marketing_paid_search_ctr",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search click-through rate",
      valueLabel: "Clicks divided by impressions",
      valueFormat: "percent",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingImpressions ? mappedMarketingImpressions / totalMarketingImpressions : 0),
      values: [...marketingByCbsa.entries()].flatMap(([cbsaCode, aggregate]) => aggregate.impressions ? [{
        cbsaCode,
        rawValue: aggregate.clicks / aggregate.impressions * 100,
        contributingGeographies: aggregate.zips.size,
      }] : []).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Click-through rate is conditioned on campaign, bid, creative, query, device, inventory, and platform geography mix.",
        "It does not establish conversion quality, customer demand, incrementality, or optimal spend.",
        "The rate is recomputed from aggregate clicks and impressions rather than averaging postal rates.",
      ],
    },
    marketing_paid_search_cpc: {
      datasetId: "marketing_paid_search_cpc",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search average cost per click",
      valueLabel: "Cost divided by clicks",
      valueFormat: "currency",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingCost ? mappedMarketingCost / totalMarketingCost : 0),
      values: [...marketingByCbsa.entries()].flatMap(([cbsaCode, aggregate]) => aggregate.clicks ? [{
        cbsaCode,
        rawValue: aggregate.cost / aggregate.clicks,
        contributingGeographies: aggregate.zips.size,
      }] : []).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Average cost per click is conditioned on campaign setup, auction mix, bids, budgets, creative, and platform geography semantics.",
        "It does not measure acquisition cost, contribution, incrementality, or optimal budget.",
        "The rate is recomputed from aggregate cost and clicks rather than averaging postal CPC values.",
      ],
    },
    marketing_paid_search_cost: {
      datasetId: "marketing_paid_search_cost",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search cost",
      valueLabel: "Matched-postal cost",
      valueFormat: "currency",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingCost ? mappedMarketingCost / totalMarketingCost : 0),
      values: [...marketingByCbsa.entries()].map(([cbsaCode, aggregate]) => ({
        cbsaCode,
        rawValue: aggregate.cost,
        contributingGeographies: aggregate.zips.size,
      })).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Cost is platform-attributed spend for the selected retail account and 30-day export window.",
        "Regional cost alone does not establish efficiency, incrementality, contribution, or optimal budget.",
        "ZIP-to-ZCTA equivalence and centroid assignment are an explicit approximation, not an approved operational crosswalk.",
      ],
    },
    marketing_paid_search_conversions: {
      datasetId: "marketing_paid_search_conversions",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search attributed conversions",
      valueLabel: "Platform-attributed conversions",
      valueFormat: "number",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingConversions ? mappedMarketingConversions / totalMarketingConversions : 0),
      values: [...marketingByCbsa.entries()].map(([cbsaCode, aggregate]) => ({
        cbsaCode,
        rawValue: aggregate.conversions,
        contributingGeographies: aggregate.zips.size,
      })).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Conversions use the account export's configured conversion semantics and can be fractional.",
        "The aggregate combines configured conversion actions and is not yet a governed order, new-customer, or incremental outcome.",
        "ZIP-to-ZCTA equivalence and centroid assignment are an explicit approximation, not an approved operational crosswalk.",
      ],
    },
    marketing_paid_search_conversion_rate: {
      datasetId: "marketing_paid_search_conversion_rate",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search attributed conversion rate",
      valueLabel: "Conversions divided by clicks",
      valueFormat: "percent",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingClicks ? mappedMarketingClicks / totalMarketingClicks : 0),
      values: [...marketingByCbsa.entries()].flatMap(([cbsaCode, aggregate]) => aggregate.clicks ? [{
        cbsaCode,
        rawValue: aggregate.conversions / aggregate.clicks * 100,
        contributingGeographies: aggregate.zips.size,
      }] : []).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Conversion rate uses the account export's configured conversion semantics and is not an incrementality estimate.",
        "The rate is recomputed from aggregate conversions and clicks rather than averaging postal rates.",
        "Campaign, query, device, audience, and conversion-action mix can explain regional differences.",
      ],
    },
    marketing_paid_search_cost_per_conversion: {
      datasetId: "marketing_paid_search_cost_per_conversion",
      snapshotId: "google-ads-2026-07-14_2026-08-12",
      label: "Paid search cost per attributed conversion",
      valueLabel: "Cost divided by attributed conversions",
      valueFormat: "currency",
      sourceIds: ["SRC-018"],
      inputGrain: "matched postal geography for the retail account over 30 days",
      outputGrain: "cbsa",
      geographyMethod: "Google matched postal prefix treated as matching 2025 Census ZCTA; ZCTA internal point assigned to 2024 CBSA polygon",
      transformationVersion: "zip-zcta-centroid-cbsa-v1",
      allowedUse: "internal_shadow_evaluation_only",
      scoringEligibility: "none",
      coverage: marketingCoverage(totalMarketingCost ? mappedMarketingCost / totalMarketingCost : 0),
      values: [...marketingByCbsa.entries()].flatMap(([cbsaCode, aggregate]) => aggregate.conversions > 0 ? [{
        cbsaCode,
        rawValue: aggregate.cost / aggregate.conversions,
        contributingGeographies: aggregate.zips.size,
      }] : []).sort((left, right) => left.cbsaCode.localeCompare(right.cbsaCode)),
      limitations: [
        "Cost per conversion uses configured platform conversion semantics and is not customer acquisition cost or contribution economics.",
        "The rate is recomputed from aggregate cost and conversions rather than averaging postal values.",
        "Campaign, query, device, audience, and conversion-action mix can explain regional differences.",
      ],
    },
  },
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Built ${bundle.datasets.pricing_competitor_availability.values.length} Pricing and ${bundle.datasets.marketing_paid_search_response.values.length} Marketing CBSA values at ${outputPath}.`);
