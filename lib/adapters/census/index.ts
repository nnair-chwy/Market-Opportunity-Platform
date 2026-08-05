export {
  CENSUS_VARIABLE_CATALOG,
  DEFAULT_CENSUS_METRICS,
} from "./catalog.ts";
export { createCensusAdapter } from "./adapter.ts";
export {
  censusGeoId,
  geographyFips,
  geographyQuery,
  validateGeography,
} from "./geography.ts";
export {
  CENSUS_METRIC_IDS,
  type CensusAdapter,
  type CensusAdapterOptions,
  type CensusAdapterResult,
  type CensusFetch,
  type CensusGeography,
  type CensusMetricId,
  type CensusProvenance,
  type CensusRequest,
  type CensusWarning,
  type CensusWarningCode,
  type DensityAreaInput,
  type MetricObservation,
} from "./types.ts";
