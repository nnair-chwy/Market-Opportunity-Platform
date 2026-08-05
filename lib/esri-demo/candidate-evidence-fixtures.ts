export const CANDIDATE_EVIDENCE_BRIEF_VERSION =
  "candidate-evidence-brief-v1" as const;
export const CANDIDATE_EVIDENCE_GENERATED_AT =
  "2026-07-30T00:00:00.000Z" as const;
export const SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID =
  "SYN-CLINIC-LANDSCAPE-001" as const;
export const SYNTHETIC_CLINIC_LANDSCAPE_VERSION =
  "synthetic-clinic-landscape-2025-12-31-v1" as const;

export const DEMO_CANDIDATE_SITE_IDS = [
  "esri-site-b4915178-5553-4293-aa9e-38a34cbb217b",
  "esri-site-4f55efed-9588-434e-b142-3f4f05e65c50",
  "esri-site-abdcddb6-ff1b-4983-94e6-bfd4e3a519b5",
  "esri-site-9e65cd9a-22c2-4032-aab3-4907a8bcab78",
  "esri-site-2fd65ede-8564-45b1-9f94-6ba5b6acefbf",
] as const;

export type DemoCandidateSiteId = (typeof DEMO_CANDIDATE_SITE_IDS)[number];

export type SyntheticClinicLandscapeFixture = {
  site_id: DemoCandidateSiteId;
  source_account_rows: number;
  estimated_physical_locations: number;
  corporate_locations: number;
  independent_locations: number;
  repeated_coordinate_rows_retained: number;
  lifecycle_filter: "synthetic_active_demo";
  observed_at: "2025-12-31";
  source_id: typeof SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID;
  snapshot_version: typeof SYNTHETIC_CLINIC_LANDSCAPE_VERSION;
  is_synthetic: true;
};

export const SYNTHETIC_CLINIC_LANDSCAPE_FIXTURES: readonly SyntheticClinicLandscapeFixture[] =
  [
    {
      site_id: DEMO_CANDIDATE_SITE_IDS[0],
      source_account_rows: 44,
      estimated_physical_locations: 31,
      corporate_locations: 9,
      independent_locations: 22,
      repeated_coordinate_rows_retained: 3,
      lifecycle_filter: "synthetic_active_demo",
      observed_at: "2025-12-31",
      source_id: SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID,
      snapshot_version: SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
      is_synthetic: true,
    },
    {
      site_id: DEMO_CANDIDATE_SITE_IDS[1],
      source_account_rows: 39,
      estimated_physical_locations: 28,
      corporate_locations: 8,
      independent_locations: 20,
      repeated_coordinate_rows_retained: 2,
      lifecycle_filter: "synthetic_active_demo",
      observed_at: "2025-12-31",
      source_id: SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID,
      snapshot_version: SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
      is_synthetic: true,
    },
    {
      site_id: DEMO_CANDIDATE_SITE_IDS[2],
      source_account_rows: 52,
      estimated_physical_locations: 36,
      corporate_locations: 11,
      independent_locations: 25,
      repeated_coordinate_rows_retained: 4,
      lifecycle_filter: "synthetic_active_demo",
      observed_at: "2025-12-31",
      source_id: SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID,
      snapshot_version: SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
      is_synthetic: true,
    },
    {
      site_id: DEMO_CANDIDATE_SITE_IDS[3],
      source_account_rows: 47,
      estimated_physical_locations: 34,
      corporate_locations: 10,
      independent_locations: 24,
      repeated_coordinate_rows_retained: 3,
      lifecycle_filter: "synthetic_active_demo",
      observed_at: "2025-12-31",
      source_id: SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID,
      snapshot_version: SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
      is_synthetic: true,
    },
    {
      site_id: DEMO_CANDIDATE_SITE_IDS[4],
      source_account_rows: 34,
      estimated_physical_locations: 24,
      corporate_locations: 7,
      independent_locations: 17,
      repeated_coordinate_rows_retained: 2,
      lifecycle_filter: "synthetic_active_demo",
      observed_at: "2025-12-31",
      source_id: SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID,
      snapshot_version: SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
      is_synthetic: true,
    },
  ];
