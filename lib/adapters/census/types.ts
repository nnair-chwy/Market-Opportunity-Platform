export const CENSUS_METRIC_IDS = [
  "census.total_population",
  "census.household_count",
  "census.median_household_income",
  "census.housing_unit_count",
  "census.population_density",
] as const;

export type CensusMetricId = (typeof CENSUS_METRIC_IDS)[number];

export type MetricObservation = {
  metric_id: string;
  raw_value: number | null;
  unit: string;
  source_id: string;
  observed_at: string;
  geography: string;
  quality_status: "accepted" | "warning" | "rejected";
  sensitivity: "public" | "internal" | "confidential" | "restricted";
};

export type CensusGeography =
  | { type: "cbsa"; cbsa: string }
  | { type: "state"; state: string }
  | { type: "county"; state: string; county: string }
  | { type: "place"; state: string; place: string }
  | { type: "tract"; state: string; county: string; tract: string }
  | {
      type: "block_group";
      state: string;
      county: string;
      tract: string;
      blockGroup: string;
    };

export type DensityAreaInput = {
  squareMeters: number;
  sourceId: string;
  observedAt: string;
  geographyType: CensusGeography["type"];
  fips: string;
  transformation: string;
};

export type CensusRequest = {
  vintage: number;
  geography: CensusGeography;
  metricIds?: readonly CensusMetricId[];
  densityArea?: DensityAreaInput;
};

export type CensusWarningCode =
  | "suppressed"
  | "missing"
  | "stale"
  | "incompatible"
  | "unavailable";

export type CensusWarning = {
  code: CensusWarningCode;
  metricId: CensusMetricId;
  variableId: string | null;
  message: string;
};

export type CensusLineageInput = {
  metricId: string;
  rawValue: number;
  unit: string;
  sourceId: string;
  observedAt: string;
  transformation: string;
};

export type CensusProvenance = {
  metricId: CensusMetricId;
  variableId: string | null;
  dataset: "acs/acs5";
  datasetVintage: number;
  geographyType: CensusGeography["type"];
  fips: string;
  censusGeoId: string;
  retrievedAt: string;
  unit: string;
  transformation: string;
  evidenceStatus: "Confirmed" | "Derived";
  sourceUrl: string;
  inputs: readonly CensusLineageInput[];
};

export type CensusAdapterResult = {
  sourceVersion: {
    provider: "United States Census Bureau";
    dataset: "acs/acs5";
    vintage: number;
  };
  refreshTime: string;
  rowCount: number;
  geographicGrain: CensusGeography["type"];
  allowedUse: {
    sensitivity: "public";
    purpose: "market_context_only";
    scoringWeight: "none";
  };
  observations: MetricObservation[];
  provenance: CensusProvenance[];
  warnings: CensusWarning[];
};

export type CensusFetchResponse = {
  ok: boolean;
  status: number;
  statusText?: string;
  json(): Promise<unknown>;
};

export type CensusFetch = (
  input: string | URL,
) => Promise<CensusFetchResponse>;

export interface CensusAdapter {
  retrieve(request: CensusRequest): Promise<CensusAdapterResult>;
}

export type CensusAdapterOptions = {
  fetch: CensusFetch;
  baseUrl?: string;
  now?: () => Date;
  maxVintageAgeYears?: number;
};
