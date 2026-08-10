import type { GeometryCollection, Topology } from "topojson-specification";
import topologyJson from "../../data/public/census/cbsa-geometry/2024/markets.topo.json" with { type: "json" };
import marketUniverseJson from "../../data/public/census/cbsa-universe/2023-07/markets.json" with { type: "json" };
import acsSnapshotJson from "../../data/public/census/cbsa-acs/2024/market-context.json" with { type: "json" };
import {
  createPublicMarketRecords,
  type PublicMarketRecord,
} from "./cbsa-market-context.ts";
import {
  createPublicMarketMapGeoJson,
  type PublicMarketMapFeatureCollection,
} from "./cbsa-market-map.ts";
import type { CbsaAcsMetricKey, CbsaAcsSnapshot } from "./cbsa-acs/index.ts";
import type { CbsaBoundaryProperties } from "./cbsa-geometry/index.ts";
import type { CbsaUniverseSnapshot } from "./cbsa-universe/index.ts";

type MarketTopology = Topology<{
  markets: GeometryCollection<CbsaBoundaryProperties>;
}>;

const marketTopology = topologyJson as unknown as MarketTopology;
const marketUniverse = marketUniverseJson as CbsaUniverseSnapshot;
const acsSnapshot = acsSnapshotJson as CbsaAcsSnapshot;
const geometryCodes = new Set(
  marketTopology.objects.markets.geometries.map(
    (item) =>
      (item.properties as CbsaBoundaryProperties | undefined)?.cbsa_code ?? "",
  ),
);

export const PUBLIC_MARKET_METRICS: ReadonlyArray<{
  key: CbsaAcsMetricKey;
  label: string;
  unit: string;
}> = [
  { key: "total_population", label: "Population", unit: "people" },
  { key: "household_count", label: "Households", unit: "households" },
  {
    key: "median_household_income",
    label: "Median household income",
    unit: "USD",
  },
  {
    key: "housing_unit_count",
    label: "Housing units",
    unit: "housing units",
  },
  {
    key: "population_density",
    label: "Population density",
    unit: "people per square mile",
  },
];

export const publicMarkets: readonly PublicMarketRecord[] =
  createPublicMarketRecords(
    marketUniverse.markets,
    geometryCodes,
    new Map(acsSnapshot.markets.map((market) => [market.cbsa_code, market])),
  );

export const publicMarketMapGeoJson: PublicMarketMapFeatureCollection =
  createPublicMarketMapGeoJson(marketTopology, publicMarkets);

export function publicMarketMetricOption(metric: CbsaAcsMetricKey) {
  return (
    PUBLIC_MARKET_METRICS.find((option) => option.key === metric) ??
    PUBLIC_MARKET_METRICS[0]
  );
}
