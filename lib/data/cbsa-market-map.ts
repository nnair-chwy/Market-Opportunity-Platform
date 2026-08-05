import { feature } from "topojson-client";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { CbsaAcsMetricKey } from "./cbsa-acs/index.ts";
import type {
  CbsaBoundaryGeometry,
  CbsaBoundaryProperties,
} from "./cbsa-geometry/index.ts";
import type { PublicMarketRecord } from "./cbsa-market-context.ts";

export const PUBLIC_MARKET_MAX_FIT_ZOOM = 8;
export const MAINLAND_MARKET_BOUNDS: [[number, number], [number, number]] = [
  [-132, 18],
  [-60, 55],
];

export type PublicBasemapConfig =
  | { status: "configured"; styleUrl: string }
  | { status: "missing" | "invalid"; styleUrl: null };

export type PublicMarketMapProperties = CbsaBoundaryProperties & {
  source_id: "SRC-015";
  evidence_status: "Confirmed";
  sensitivity: "public";
  allowed_use: "market_context_only";
  scoring_eligibility: "none";
  total_population: number | null;
  household_count: number | null;
  median_household_income: number | null;
  housing_unit_count: number | null;
  population_density: number | null;
};

export type PublicMarketMapFeature = Feature<
  CbsaBoundaryGeometry,
  PublicMarketMapProperties
>;

export type PublicMarketMapFeatureCollection = FeatureCollection<
  CbsaBoundaryGeometry,
  PublicMarketMapProperties
>;

export type MarketTopology = Topology<{
  markets: GeometryCollection<CbsaBoundaryProperties>;
}>;

export function resolvePublicBasemapConfig(
  rawStyleUrl: string | undefined,
): PublicBasemapConfig {
  const value = rawStyleUrl?.trim();
  if (!value) return { status: "missing", styleUrl: null };

  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (
      (url.protocol !== "https:" && !isLocalHttp) ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return { status: "invalid", styleUrl: null };
    }
    return { status: "configured", styleUrl: url.toString() };
  } catch {
    return { status: "invalid", styleUrl: null };
  }
}

export function resolveMapTilerConfig(
  rawStyleUrl: string | undefined,
  rawApiKey: string | undefined,
): PublicBasemapConfig {
  const baseConfig = resolvePublicBasemapConfig(rawStyleUrl);
  if (baseConfig.status !== "configured") return baseConfig;

  try {
    const url = new URL(baseConfig.styleUrl);
    const isMapTilerStyle =
      url.protocol === "https:" &&
      url.hostname === "api.maptiler.com" &&
      /^\/maps\/[^/]+\/style\.json$/.test(url.pathname);
    if (!isMapTilerStyle) {
      return { status: "invalid", styleUrl: null };
    }

    const apiKey = rawApiKey?.trim();
    if (apiKey) url.searchParams.set("key", apiKey);
    if (!url.searchParams.get("key")) {
      return { status: "missing", styleUrl: null };
    }

    return { status: "configured", styleUrl: url.toString() };
  } catch {
    return { status: "invalid", styleUrl: null };
  }
}

function metricValue(
  market: PublicMarketRecord,
  key: CbsaAcsMetricKey,
): number | null {
  return market.acs?.metrics[key].raw_value ?? null;
}

export function createPublicMarketMapGeoJson(
  topology: MarketTopology,
  markets: readonly PublicMarketRecord[],
): PublicMarketMapFeatureCollection {
  const converted = feature(
    topology,
    topology.objects.markets,
  ) as unknown as FeatureCollection<
    CbsaBoundaryGeometry,
    CbsaBoundaryProperties
  >;
  const marketsByCode = new Map(
    markets.map((market) => [market.cbsa_code, market]),
  );

  return {
    type: "FeatureCollection",
    features: converted.features.flatMap((item) => {
      const market = marketsByCode.get(item.properties.cbsa_code);
      if (!market) return [];
      return [
        {
          ...item,
          id: market.cbsa_code,
          properties: {
            ...item.properties,
            source_id: "SRC-015",
            evidence_status: "Confirmed",
            sensitivity: "public",
            allowed_use: "market_context_only",
            scoring_eligibility: "none",
            total_population: metricValue(market, "total_population"),
            household_count: metricValue(market, "household_count"),
            median_household_income: metricValue(
              market,
              "median_household_income",
            ),
            housing_unit_count: metricValue(market, "housing_unit_count"),
            population_density: metricValue(market, "population_density"),
          },
        } satisfies PublicMarketMapFeature,
      ];
    }),
  };
}

function visitCoordinates(
  value: Position | Position[] | Position[][] | Position[][][],
  visit: (coordinate: Position) => void,
): void {
  if (
    Array.isArray(value) &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    visit(value as Position);
    return;
  }
  for (const child of value as Array<
    Position | Position[] | Position[][] | Position[][][]
  >) {
    visitCoordinates(child, visit);
  }
}

export function geometryBounds(
  geometry: Polygon | MultiPolygon | null,
): [[number, number], [number, number]] | null {
  if (!geometry) return null;
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  visitCoordinates(geometry.coordinates, ([longitude, latitude]) => {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  });

  if (![west, south, east, north].every(Number.isFinite)) return null;
  return [
    [west, south],
    [east, north],
  ];
}

export function selectedMarketBounds(
  collection: PublicMarketMapFeatureCollection,
  cbsaCode: string,
): [[number, number], [number, number]] | null {
  const selected = collection.features.find(
    (item) => item.properties.cbsa_code === cbsaCode,
  );
  return geometryBounds(selected?.geometry ?? null);
}

export function metricProperty(
  metric: CbsaAcsMetricKey,
): keyof PublicMarketMapProperties {
  return metric;
}

export function hasPublicMarketEvidenceMetadata(
  properties: GeoJsonProperties,
): boolean {
  return (
    properties?.source_id === "SRC-015" &&
    properties?.evidence_status === "Confirmed" &&
    properties?.sensitivity === "public" &&
    properties?.allowed_use === "market_context_only" &&
    properties?.scoring_eligibility === "none"
  );
}

export function isCbsaGeometry(
  geometry: Geometry,
): geometry is CbsaBoundaryGeometry {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}
