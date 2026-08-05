import type { CbsaMarket } from "./cbsa-universe/index.ts";
import type {
  CbsaAcsMarket,
  CbsaAcsMetricKey,
} from "./cbsa-acs/index.ts";

export type PublicMarketRecord = CbsaMarket & {
  geometry_status: "available" | "missing";
  acs: CbsaAcsMarket | null;
};

export type PublicMarketFilter = {
  query: string;
  includeMicropolitan: boolean;
};

export function createPublicMarketRecords(
  markets: readonly CbsaMarket[],
  geometryCodes: ReadonlySet<string>,
  acsByCode: ReadonlyMap<string, CbsaAcsMarket> = new Map(),
): PublicMarketRecord[] {
  return markets
    .map((market) => ({
      ...market,
      geometry_status: geometryCodes.has(market.cbsa_code)
        ? ("available" as const)
        : ("missing" as const),
      acs: acsByCode.get(market.cbsa_code) ?? null,
    }))
    .sort(
      (a, b) =>
        (b.acs?.metrics.total_population.raw_value ?? -1) -
          (a.acs?.metrics.total_population.raw_value ?? -1) ||
        a.cbsa_name.localeCompare(b.cbsa_name) ||
        a.cbsa_code.localeCompare(b.cbsa_code),
    );
}

export function defaultPublicMarketList(
  markets: readonly PublicMarketRecord[],
  limit = 50,
): PublicMarketRecord[] {
  return markets
    .filter((market) => market.cbsa_type === "metropolitan")
    .slice(0, limit);
}

export const CHOROPLETH_COLORS = [
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#2563eb",
] as const;
export const CHOROPLETH_MISSING_COLOR = "#e5e7eb";

export function choroplethBreaks(
  markets: readonly PublicMarketRecord[],
  metricKey: CbsaAcsMetricKey,
): number[] {
  const values = markets
    .map((market) => market.acs?.metrics[metricKey].raw_value ?? null)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (!values.length) return [];
  return [0.2, 0.4, 0.6, 0.8].map(
    (fraction) => values[Math.min(values.length - 1, Math.floor(values.length * fraction))],
  );
}

export function choroplethColor(
  value: number | null,
  breaks: readonly number[],
): string {
  if (value === null || breaks.length !== 4) return CHOROPLETH_MISSING_COLOR;
  const index = breaks.findIndex((threshold) => value <= threshold);
  return CHOROPLETH_COLORS[index === -1 ? 4 : index];
}

export function filterPublicMarkets(
  markets: readonly PublicMarketRecord[],
  filter: PublicMarketFilter,
): PublicMarketRecord[] {
  const query = filter.query.trim().toLowerCase();
  return markets.filter((market) => {
    if (!filter.includeMicropolitan && market.cbsa_type === "micropolitan") {
      return false;
    }
    if (query === "") return true;
    const searchable = [
      market.cbsa_name,
      market.cbsa_code,
      ...market.state_codes,
      ...market.principal_cities.map((city) => city.name),
      ...market.component_counties.map((county) => county.county_name),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(query);
  });
}

export function selectPublicMarket(
  markets: readonly PublicMarketRecord[],
  cbsaCode: string,
): PublicMarketRecord | null {
  return markets.find((market) => market.cbsa_code === cbsaCode) ?? null;
}

export function isKeyboardSelectionKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

export function publicMarketAriaLabel(market: PublicMarketRecord): string {
  const type =
    market.cbsa_type === "metropolitan" ? "metropolitan" : "micropolitan";
  const geometry =
    market.geometry_status === "available"
      ? "boundary available"
      : "boundary unavailable";
  return `Select ${market.cbsa_name}, CBSA ${market.cbsa_code}, ${type}, ${geometry}`;
}
