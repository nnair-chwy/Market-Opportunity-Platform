export type LocationCategory = "current" | "potential" | "evaluated";

export type EvidenceStatus =
  | "Confirmed"
  | "Reported"
  | "Derived"
  | "Hypothesis"
  | "Unknown";

export type LocationStatus =
  | "Open"
  | "Candidate"
  | "Previously evaluated"
  | "Unknown";

export type EvaluationState =
  | "Not applicable"
  | "Not evaluated"
  | "Ready"
  | "Needs data"
  | "In review"
  | "Evaluated"
  | "Unknown";

/**
 * A deliberately imprecise position in the static US-map coordinate space.
 * It is not a customer coordinate or a map-vendor geometry.
 */
export interface LocationMapPosition {
  x_percent: number;
  y_percent: number;
  evidence_status: EvidenceStatus;
  is_synthetic: boolean;
}

export interface LocationScore {
  value: number;
  max_value: number;
  version: string;
}

/**
 * Provider-neutral display data consumed by the national location navigator.
 * Future adapters should convert their source data into this shape.
 */
export interface LocationDisplay {
  site_id: string;
  site_name: string;
  market: string;
  region_code: string | null;
  category: LocationCategory;
  location_status: LocationStatus;
  evidence_status: EvidenceStatus;
  evaluation_state: EvaluationState;
  is_synthetic: boolean;
  source_ids: readonly string[];
  map_position: LocationMapPosition | null;
  score: LocationScore | null;
  data_notes: readonly string[];
}

export type LocationDataState =
  | "ready"
  | "loading"
  | "unavailable"
  | "partial";

export interface LocationFixtureResult {
  locations: readonly LocationDisplay[];
  state: LocationDataState;
  message: string | null;
}
