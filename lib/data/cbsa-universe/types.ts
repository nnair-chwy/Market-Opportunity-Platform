export const CBSA_EVIDENCE_STATUS = "Confirmed" as const;
export const CBSA_SENSITIVITY = "public" as const;
export const CBSA_ALLOWED_USE = "market_context_only" as const;
export const CBSA_SCORING_ELIGIBILITY = "none" as const;
export const CBSA_DELINEATION_VINTAGE = "2023-07" as const;
export const CBSA_SOURCE_ID = "SRC-014" as const;
export const CBSA_TRANSFORMATION_VERSION = "cbsa-universe-v1" as const;

export type CbsaType = "metropolitan" | "micropolitan";

export type SourceRow = {
  row_number: number;
  values: Readonly<Record<string, unknown>>;
};

export type PrincipalCity = {
  name: string;
  state_code: string;
  state_fips: string;
  place_fips: string;
};

export type ComponentCounty = {
  county_name: string;
  county_fips: string;
  state_name: string;
  state_code: string;
  state_fips: string;
};

export type CbsaMarket = {
  market_id: string;
  cbsa_code: string;
  cbsa_name: string;
  cbsa_type: CbsaType;
  principal_cities: PrincipalCity[];
  component_counties: ComponentCounty[];
  state_codes: string[];
  delineation_vintage: typeof CBSA_DELINEATION_VINTAGE;
  source_id: typeof CBSA_SOURCE_ID;
  evidence_status: typeof CBSA_EVIDENCE_STATUS;
  sensitivity: typeof CBSA_SENSITIVITY;
  allowed_use: typeof CBSA_ALLOWED_USE;
  scoring_eligibility: typeof CBSA_SCORING_ELIGIBILITY;
};

export type RejectedCbsaRow = {
  dataset: "delineation" | "principal_cities";
  row_number: number | null;
  cbsa_code: string | null;
  reasons: string[];
  values: Readonly<Record<string, unknown>>;
};

export type ExclusionSummary = {
  market_count: number;
  delineation_row_count: number;
  principal_city_row_count: number;
  by_state_fips: Record<string, number>;
};

export type CbsaTransformationResult = {
  markets: CbsaMarket[];
  rejected_rows: RejectedCbsaRow[];
  exclusions: ExclusionSummary;
  input_counts: {
    delineation_rows: number;
    principal_city_rows: number;
  };
};

export type CbsaUniverseSnapshot = {
  schema_version: "1.0.0";
  transformation_version: typeof CBSA_TRANSFORMATION_VERSION;
  delineation_vintage: typeof CBSA_DELINEATION_VINTAGE;
  source_id: typeof CBSA_SOURCE_ID;
  evidence_status: typeof CBSA_EVIDENCE_STATUS;
  sensitivity: typeof CBSA_SENSITIVITY;
  allowed_use: typeof CBSA_ALLOWED_USE;
  scoring_eligibility: typeof CBSA_SCORING_ELIGIBILITY;
  markets: CbsaMarket[];
};

export type CbsaRejectedAudit = {
  schema_version: "1.0.0";
  transformation_version: typeof CBSA_TRANSFORMATION_VERSION;
  delineation_vintage: typeof CBSA_DELINEATION_VINTAGE;
  source_id: typeof CBSA_SOURCE_ID;
  rejected_rows: RejectedCbsaRow[];
};
