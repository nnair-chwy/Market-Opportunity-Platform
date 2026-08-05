import type {
  EvidenceStatus,
  QualityStatus,
  Sensitivity,
} from "@/lib/data/types";

export const ESRI_DEMO_SOURCE_ID = "SRC-017";
export const ESRI_DEMO_SYNTHETIC_SOURCE_ID = "SYN-ESRI-FALLBACK-001";
export const ESRI_DEMO_TRANSFORMATION_VERSION = "esri-demo-2026-07-30-v1";

export type ScoringEligibility = "none";
export type AllowedUse = "internal_demo_evidence_only";
export type DefinitionStatus = "defined" | "partial" | "unknown";
export type WorkflowStage =
  | "market_research"
  | "candidate_review"
  | "current_location"
  | "comparison_location"
  | "unknown";
export type ReadinessState =
  | "ready_for_research"
  | "needs_review"
  | "blocked";
export type ReadinessIssueState =
  | "unavailable"
  | "missing"
  | "not_required"
  | "warning"
  | "rejected"
  | "restricted"
  | "stale"
  | "unresolved_link";
export type ReadinessEvidenceState =
  | "available"
  | "unavailable"
  | "missing"
  | "not_required"
  | "rejected"
  | "restricted"
  | "stale"
  | "unresolved_link";
export type LinkState =
  | "source_provided"
  | "needs_review"
  | "synthetic_fallback"
  | "unassigned";

export type EsriSourceFileRecord = {
  filename: string;
  role:
    | "clinic_full"
    | "clinic_demo"
    | "master_full"
    | "master_demo"
    | "trade_areas";
  sha256: string;
  row_count: number;
  field_count: number;
};

export type EsriOutputRecord = {
  path: string;
  sha256: string;
  record_count: number;
};

export type EsriDemoManifest = {
  schema_version: "1.0.0";
  snapshot_id: string;
  source_id: typeof ESRI_DEMO_SOURCE_ID;
  synthetic_source_id: typeof ESRI_DEMO_SYNTHETIC_SOURCE_ID;
  receipt_date: "2026-07-30";
  built_at: string;
  transformation_version: typeof ESRI_DEMO_TRANSFORMATION_VERSION;
  sources: EsriSourceFileRecord[];
  outputs: EsriOutputRecord[];
  counts: {
    source_sites: number;
    source_trade_areas: number;
    retained_trade_areas: number;
    source_linked_sites: number;
    synthetic_fallback_sites: number;
    one_to_many_site_links: number;
    clinic_repeated_coordinate_groups: number;
    review_records: number;
  };
  retained_field_ids: string[];
  excluded_field_names: string[];
  sensitivity: "internal";
  allowed_use: AllowedUse;
  scoring_eligibility: ScoringEligibility;
  limitations: string[];
  unresolved_prerequisites: string[];
};

export type EsriFieldCatalogRecord = {
  field_id: string;
  dataset: "clinic" | "master_site" | "trade_area";
  source_field: string;
  business_label: string;
  definition_status: DefinitionStatus;
  unit: string | null;
  observed_at: string | null;
  geography: "point" | "trade_area" | "other" | "unknown";
  geography_method: string | null;
  workflow_stages: WorkflowStage[];
  sensitivity: Sensitivity;
  allowed_use: AllowedUse;
  evidence_status: EvidenceStatus;
  quality_rules: string[];
  retained_in_fixture: boolean;
  exclusion_reason: string | null;
  scoring_eligibility: ScoringEligibility;
};

export type EsriSiteIdentity = {
  site_id: string;
  source_global_id: string;
  source_esri_id: string | null;
  source_site_code: string | null;
  site_name: string;
  brand: string;
  latitude: number;
  longitude: number;
  state: string | null;
  market_name: string | null;
  cbsa_id: string | null;
  cbsa_name: string | null;
  workflow_stage: WorkflowStage;
  source_open_status: string;
  source_open_year: number | null;
  source_open_quarter: string | null;
  physical_evidence: Record<string, string | number | boolean | null>;
  source_id: typeof ESRI_DEMO_SOURCE_ID;
  evidence_status: "Reported";
  sensitivity: "internal";
  allowed_use: AllowedUse;
  scoring_eligibility: ScoringEligibility;
};

export type EsriTradeAreaMetric = {
  metric_id: string;
  source_field: string;
  label: string;
  raw_value: number | null;
  unit: string | null;
  observed_at: string | null;
  received_at: "2026-07-30";
  geography: "trade_area";
  geography_method: string | null;
  source_id:
    | typeof ESRI_DEMO_SOURCE_ID
    | typeof ESRI_DEMO_SYNTHETIC_SOURCE_ID;
  evidence_status: "Reported" | "Hypothesis";
  quality_status: QualityStatus;
  sensitivity: "internal";
  allowed_use: AllowedUse;
  transformation_version: typeof ESRI_DEMO_TRANSFORMATION_VERSION;
  scoring_eligibility: ScoringEligibility;
  limitations: string[];
};

export type EsriTradeAreaRecord = {
  trade_area_id: string;
  source_global_id: string | null;
  source_esri_id: string | null;
  source_site_name: string;
  role: "unknown" | "synthetic_demo";
  is_synthetic: boolean;
  metrics: EsriTradeAreaMetric[];
  source_id:
    | typeof ESRI_DEMO_SOURCE_ID
    | typeof ESRI_DEMO_SYNTHETIC_SOURCE_ID;
  evidence_status: "Reported" | "Hypothesis";
  sensitivity: "internal";
  allowed_use: AllowedUse;
  scoring_eligibility: ScoringEligibility;
};

export type EsriSiteTradeAreaLink = {
  site_id: string;
  trade_area_id: string;
  source_esri_id: string | null;
  link_state: LinkState;
  role: "unknown" | "synthetic_demo";
  source_id:
    | typeof ESRI_DEMO_SOURCE_ID
    | typeof ESRI_DEMO_SYNTHETIC_SOURCE_ID;
  evidence_status: "Reported" | "Hypothesis";
  review_note: string;
  scoring_eligibility: ScoringEligibility;
};

export type ReadinessIssue = {
  issue_id: string;
  site_id: string;
  field_or_relationship: string;
  state: ReadinessIssueState;
  severity: "error" | "warning" | "info";
  reason: string;
  expected_source_or_owner: string;
  evidence_status: EvidenceStatus;
  sensitivity: Sensitivity;
  suggested_follow_up: string;
  resolution_state: "open" | "resolved";
};

export type PortfolioSiteReadiness = {
  site_id: string;
  site_name: string;
  brand: string;
  market_name: string | null;
  state: string | null;
  cbsa_id: string | null;
  latitude: number;
  longitude: number;
  workflow_stage: WorkflowStage;
  source_link_state: "available";
  trade_area_link_state: LinkState;
  expected_evidence_count: number;
  available_evidence_count: number;
  missing_count: number;
  warning_count: number;
  rejected_count: number;
  restricted_count: number;
  stale_count: number;
  unresolved_link_count: number;
  readiness_percent: number;
  readiness_state: ReadinessState;
  evidence_states: Record<string, ReadinessEvidenceState>;
  issues: ReadinessIssue[];
  follow_up_items: string[];
  source_ids: string[];
  provenance: {
    source_id: typeof ESRI_DEMO_SOURCE_ID;
    transformation_version: typeof ESRI_DEMO_TRANSFORMATION_VERSION;
    calculation: "available_required_evidence / expected_required_evidence";
  };
  evidence_status: "Derived";
  sensitivity: "internal";
  allowed_use: AllowedUse;
  scoring_eligibility: ScoringEligibility;
};

export type EsriReviewRecord = {
  review_id: string;
  dataset: "clinic" | "master_site" | "trade_area" | "crosswalk";
  record_identifier: string;
  issue_code: string;
  severity: "error" | "warning" | "info";
  reason: string;
  disposition: "quarantine" | "retain_for_review" | "excluded_from_fixture";
};

export type TradeAreaProfileSection =
  | "market_household"
  | "chewy_demand"
  | "veterinary_supply";

export type RelationshipReviewState =
  | "provisional"
  | "review_required"
  | "synthetic"
  | "unassigned";

export type TradeAreaContextObservation = {
  site_id: string;
  trade_area_id: string;
  trade_area_role: "unknown" | "synthetic_demo";
  relationship_review_state: RelationshipReviewState;
  section: TradeAreaProfileSection;
  source_field: string;
  metric_id: string;
  display_label: string;
  raw_value: number | null;
  unit: string | null;
  source_id:
    | typeof ESRI_DEMO_SOURCE_ID
    | typeof ESRI_DEMO_SYNTHETIC_SOURCE_ID;
  source_snapshot_id: string;
  observed_at: string | null;
  received_at: "2026-07-30";
  geography: "trade_area";
  geography_method: string | null;
  evidence_status: "Reported" | "Hypothesis";
  quality_status: QualityStatus;
  sensitivity: "internal";
  allowed_use: AllowedUse;
  transformation_version: typeof ESRI_DEMO_TRANSFORMATION_VERSION;
  scoring_eligibility: ScoringEligibility;
  is_synthetic: boolean;
  limitations: string[];
  warnings: string[];
};

export type TradeAreaProfileVariant = {
  trade_area_id: string;
  source_site_name: string;
  trade_area_role: "unknown" | "synthetic_demo";
  link_state: LinkState;
  relationship_review_state: RelationshipReviewState;
  evidence_status: "Reported" | "Hypothesis";
  is_synthetic: boolean;
  observations: TradeAreaContextObservation[];
  warnings: string[];
};

export type SiteTradeAreaProfile = {
  site_id: string;
  site_name: string;
  brand: string;
  cbsa_id: string | null;
  market_name: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  variants: TradeAreaProfileVariant[];
  unavailable_evidence: Array<{
    field_group: string;
    reason: string;
    expected_source_or_owner: string;
  }>;
  source_snapshot_id: string;
  sensitivity: "internal";
  allowed_use: AllowedUse;
  scoring_eligibility: ScoringEligibility;
};

export type CandidateEvidenceSectionId =
  | "identity_workflow"
  | "market_trade_area"
  | "clinic_landscape"
  | "physical_site"
  | "constraints_diligence"
  | "analyst_follow_up";

export type CandidateEvidenceState =
  | "available"
  | "missing"
  | "unknown"
  | "restricted"
  | "rejected"
  | "stale"
  | "conflicting";

export type CandidateEvidenceOrigin = "supplied" | "derived" | "synthetic";

export type CandidateEvidenceValue =
  | string
  | number
  | boolean
  | readonly string[]
  | null;

export type CandidateEvidenceObservation = {
  observation_id: string;
  section_id: CandidateEvidenceSectionId;
  field_id: string;
  source_field: string | null;
  label: string;
  raw_value: CandidateEvidenceValue;
  unit: string | null;
  unit_state: "known" | "not_applicable" | "unknown";
  definition_status: DefinitionStatus;
  source_id: string;
  source_snapshot_id: string;
  observed_at: string | null;
  received_at: string | null;
  geography: string;
  geography_method: string | null;
  evidence_status: EvidenceStatus;
  quality_status: QualityStatus;
  evidence_state: CandidateEvidenceState;
  origin: CandidateEvidenceOrigin;
  sensitivity: Sensitivity;
  allowed_use: AllowedUse;
  scoring_eligibility: ScoringEligibility;
  is_redacted: boolean;
  limitations: string[];
  expected_source_or_owner: string | null;
};

export type CandidateEvidenceSection = {
  section_id: CandidateEvidenceSectionId;
  title: string;
  description: string;
  observations: CandidateEvidenceObservation[];
};

export type CandidateFollowUpQuestion = {
  question_id: string;
  section_id: CandidateEvidenceSectionId;
  question: string;
  reason: string;
  expected_source_or_owner: string;
  source_observation_ids: string[];
};

export type CandidateEvidenceBrief = {
  brief_id: string;
  brief_version: "candidate-evidence-brief-v1";
  generated_at: "2026-07-30T00:00:00.000Z";
  site_id: string;
  site_label: string;
  brand: string;
  workflow_stage: WorkflowStage;
  parent_market: {
    market_id: string | null;
    market_label: string | null;
    evidence_status: EvidenceStatus;
    relationship_state: "approved" | "provisional" | "synthetic" | "unassigned";
    source_id: string;
  };
  trade_area_relationship: {
    trade_area_id: string | null;
    role: "unknown" | "synthetic_demo" | "unassigned";
    link_state: LinkState;
    review_state: RelationshipReviewState;
    source_id: string;
  };
  source_snapshot_versions: string[];
  readiness_state: ReadinessState;
  visible_limitations: string[];
  sections: CandidateEvidenceSection[];
  missing_information: CandidateEvidenceObservation[];
  conflicting_information: CandidateEvidenceObservation[];
  restrictions: CandidateEvidenceObservation[];
  follow_up_questions: CandidateFollowUpQuestion[];
  human_review_state: "not_reviewed" | "in_review" | "reviewed";
  sensitivity: "internal";
  allowed_use: AllowedUse;
  scoring_eligibility: ScoringEligibility;
  disclaimers: string[];
};

export type CandidateEvidenceComparison = {
  comparison_id: string;
  comparison_version: "candidate-evidence-comparison-v1";
  generated_at: CandidateEvidenceBrief["generated_at"];
  candidate_order: string[];
  briefs: CandidateEvidenceBrief[];
  section_order: CandidateEvidenceSectionId[];
  field_order: string[];
  comparability_warnings: string[];
  scoring_eligibility: ScoringEligibility;
};
