import {
  CANDIDATE_EVIDENCE_BRIEF_VERSION,
  CANDIDATE_EVIDENCE_GENERATED_AT,
  DEMO_CANDIDATE_SITE_IDS,
  SYNTHETIC_CLINIC_LANDSCAPE_FIXTURES,
  SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID,
  SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
  type DemoCandidateSiteId,
  type SyntheticClinicLandscapeFixture,
} from "./candidate-evidence-fixtures.ts";
import type {
  CandidateEvidenceBrief,
  CandidateEvidenceComparison,
  CandidateEvidenceObservation,
  CandidateEvidenceSection,
  CandidateEvidenceSectionId,
  CandidateFollowUpQuestion,
  EsriDemoManifest,
  EsriFieldCatalogRecord,
  EsriSiteIdentity,
  EsriSiteTradeAreaLink,
  PortfolioSiteReadiness,
  SiteTradeAreaProfile,
  TradeAreaProfileVariant,
} from "./types.ts";

export const CANDIDATE_EVIDENCE_SECTION_ORDER: readonly CandidateEvidenceSectionId[] =
  [
    "identity_workflow",
    "market_trade_area",
    "clinic_landscape",
    "physical_site",
    "constraints_diligence",
    "analyst_follow_up",
  ];

const SECTION_METADATA: Record<
  CandidateEvidenceSectionId,
  { title: string; description: string }
> = {
  identity_workflow: {
    title: "Identity and workflow",
    description:
      "Source identity, workflow state, parent-market relationship, and readiness. Workflow is not site attractiveness.",
  },
  market_trade_area: {
    title: "Market and trade-area context",
    description:
      "Raw local context from the explicitly selected supplied or synthetic variant. No public CBSA equivalence is inferred.",
  },
  clinic_landscape: {
    title: "Clinic landscape",
    description:
      "Synthetic demonstration summary because supplied clinic account rows and their geography method are not approved for this fixture.",
  },
  physical_site: {
    title: "Physical-site evidence",
    description:
      "Approved minimized master-site fields with source definition, unit, quality, and sensitivity states.",
  },
  constraints_diligence: {
    title: "Constraints and diligence",
    description:
      "Missing, restricted, rejected, stale, and unresolved evidence remains visible without becoming a pass or fail.",
  },
  analyst_follow_up: {
    title: "Analyst follow-up questions",
    description:
      "Deterministic, open-ended questions generated from visible evidence gaps and conflicts.",
  },
};

const PHYSICAL_FIELD_ORDER = [
  "site_square_feet",
  "usable_site_square_feet",
  "design_room_count",
  "center_name",
  "center_type",
  "site_position",
  "site_front_size",
  "parking_type",
  "dedicated_parking_spaces",
  "main_street_visibility",
  "center_ingress_egress",
  "green_space",
  "green_space_location",
  "traffic_volume",
  "co_tenants",
  "multi_story_building",
] as const;

export const CANDIDATE_COMPARISON_FIELD_ORDER = [
  "market_trade_area.population",
  "market_trade_area.households",
  "market_trade_area.households_with_pets",
  "market_trade_area.median_income",
  "market_trade_area.veterinary_clinic_count",
  "clinic_landscape.source_account_rows",
  "clinic_landscape.estimated_physical_locations",
  "physical_site.site_square_feet",
  "physical_site.usable_site_square_feet",
  "physical_site.design_room_count",
  "physical_site.center_type",
  "physical_site.parking_type",
  "physical_site.main_street_visibility",
  "physical_site.center_ingress_egress",
] as const;

type CandidateEvidenceInput = {
  manifest: EsriDemoManifest;
  fieldCatalog: readonly EsriFieldCatalogRecord[];
  sites: readonly EsriSiteIdentity[];
  readiness: readonly PortfolioSiteReadiness[];
  links: readonly EsriSiteTradeAreaLink[];
  profiles: readonly SiteTradeAreaProfile[];
  clinicLandscape?: readonly SyntheticClinicLandscapeFixture[];
};

function observation(
  input: Omit<
    CandidateEvidenceObservation,
    "allowed_use" | "scoring_eligibility" | "is_redacted" | "limitations"
  > & {
    is_redacted?: boolean;
    limitations?: string[];
  },
): CandidateEvidenceObservation {
  return {
    ...input,
    is_redacted: input.is_redacted ?? false,
    limitations: input.limitations ?? [],
    allowed_use: "internal_demo_evidence_only",
    scoring_eligibility: "none",
  };
}

function section(
  sectionId: CandidateEvidenceSectionId,
  observations: CandidateEvidenceObservation[],
): CandidateEvidenceSection {
  return {
    section_id: sectionId,
    ...SECTION_METADATA[sectionId],
    observations,
  };
}

function relationshipReviewState(link: EsriSiteTradeAreaLink | undefined) {
  if (!link || link.link_state === "unassigned") return "unassigned" as const;
  if (link.link_state === "synthetic_fallback") return "synthetic" as const;
  if (link.link_state === "needs_review") return "review_required" as const;
  return "provisional" as const;
}

function relationshipState(site: EsriSiteIdentity) {
  if (!site.cbsa_id) return "unassigned" as const;
  return "provisional" as const;
}

function workflowLabel(site: EsriSiteIdentity) {
  if (site.workflow_stage === "candidate_review") return "potential";
  if (site.workflow_stage === "current_location") return "current";
  if (site.workflow_stage === "comparison_location") return "comparison";
  return "unknown";
}

function fieldCatalogRecord(
  fieldCatalog: readonly EsriFieldCatalogRecord[],
  fieldId: string,
) {
  return (
    fieldCatalog.find(
      (record) => record.field_id === `master_site.${fieldId}`,
    ) ?? null
  );
}

function fieldLabel(fieldId: string) {
  return fieldId
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function unitState(
  value: unknown,
  unit: string | null,
): CandidateEvidenceObservation["unit_state"] {
  if (unit) return "known";
  if (typeof value === "string" || typeof value === "boolean" || Array.isArray(value)) {
    return "not_applicable";
  }
  return "unknown";
}

function validateValue(value: unknown, fieldId: string) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`Candidate evidence field ${fieldId} is non-finite.`);
  }
  if (
    value !== null &&
    value !== undefined &&
    !["string", "number", "boolean"].includes(typeof value) &&
    !Array.isArray(value)
  ) {
    throw new Error(`Candidate evidence field ${fieldId} has an unsupported value.`);
  }
}

function identityObservations(input: {
  site: EsriSiteIdentity;
  readiness: PortfolioSiteReadiness;
  manifest: EsriDemoManifest;
  link: EsriSiteTradeAreaLink | undefined;
}) {
  const { site, readiness, manifest, link } = input;
  const base = {
    section_id: "identity_workflow" as const,
    source_id: site.source_id,
    source_snapshot_id: manifest.snapshot_id,
    observed_at: null,
    received_at: manifest.receipt_date,
    geography: "site",
    geography_method: "source coordinate",
    evidence_status: "Reported" as const,
    quality_status: "warning" as const,
    origin: "supplied" as const,
    sensitivity: "internal" as const,
    definition_status: "partial" as const,
    expected_source_or_owner: "Real Estate analytics",
  };
  return [
    observation({
      ...base,
      observation_id: `${site.site_id}-identity-site-label`,
      field_id: "identity_workflow.site_label",
      source_field: "Site Name",
      label: "Site label",
      raw_value: site.site_name,
      unit: null,
      unit_state: "not_applicable",
      evidence_state: "available",
    }),
    observation({
      ...base,
      observation_id: `${site.site_id}-identity-brand`,
      field_id: "identity_workflow.brand",
      source_field: "Brand",
      label: "Brand or entity",
      raw_value: site.brand,
      unit: null,
      unit_state: "not_applicable",
      evidence_state: "available",
    }),
    observation({
      ...base,
      observation_id: `${site.site_id}-identity-workflow`,
      field_id: "identity_workflow.workflow_state",
      source_field: "Open Status",
      label: "Source workflow state",
      raw_value: `${workflowLabel(site)} · ${site.source_open_status}`,
      unit: null,
      unit_state: "not_applicable",
      evidence_state: "unknown",
      limitations: ["Workflow status does not indicate site attractiveness."],
    }),
    observation({
      ...base,
      observation_id: `${site.site_id}-identity-market`,
      field_id: "identity_workflow.parent_market",
      source_field: "CBSA ID",
      label: "Parent market",
      raw_value: site.cbsa_id
        ? `${site.cbsa_name ?? site.market_name ?? "Market label unknown"} · CBSA ${site.cbsa_id}`
        : site.market_name,
      unit: null,
      unit_state: "not_applicable",
      evidence_status: site.cbsa_id ? "Reported" : "Unknown",
      evidence_state: site.cbsa_id ? "unknown" : "missing",
      limitations: site.cbsa_id
        ? ["The source-provided CBSA relationship is provisional, not reviewer approved."]
        : ["A stable parent-market ID is unavailable."],
      expected_source_or_owner: "GIS / data steward",
    }),
    observation({
      ...base,
      observation_id: `${site.site_id}-identity-trade-link`,
      field_id: "identity_workflow.trade_area_relationship",
      source_field: "ESRI ID",
      label: "Trade-area relationship",
      raw_value: link
        ? `${link.link_state.replaceAll("_", " ")} · role ${link.role}`
        : null,
      unit: null,
      unit_state: "not_applicable",
      evidence_status: link?.evidence_status ?? "Unknown",
      evidence_state:
        link?.link_state === "needs_review"
          ? "conflicting"
          : link?.link_state === "synthetic_fallback"
            ? "unknown"
            : link
              ? "unknown"
              : "missing",
      origin: link?.link_state === "synthetic_fallback" ? "synthetic" : "supplied",
      expected_source_or_owner: "GIS / Real Estate owner",
    }),
    observation({
      ...base,
      observation_id: `${site.site_id}-identity-coordinates`,
      field_id: "identity_workflow.coordinates",
      source_field: "Latitude / Longitude",
      label: "Approved site coordinates",
      raw_value: `${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`,
      unit: "decimal_degrees",
      unit_state: "known",
      evidence_state: "available",
    }),
    observation({
      ...base,
      observation_id: `${site.site_id}-identity-readiness`,
      field_id: "identity_workflow.data_readiness",
      source_field: null,
      label: "Data readiness",
      raw_value: `${readiness.readiness_state.replaceAll("_", " ")} · ${readiness.readiness_percent}% evidence completeness`,
      unit: "percent",
      unit_state: "known",
      evidence_status: "Derived",
      evidence_state:
        readiness.readiness_state === "blocked" ? "missing" : "unknown",
      origin: "derived",
      geography_method: "available required evidence / expected required evidence",
      limitations: ["Readiness measures data availability, not site quality."],
    }),
  ];
}

function tradeAreaObservations(
  site: EsriSiteIdentity,
  variant: TradeAreaProfileVariant | null,
) {
  if (!variant) {
    return [
      observation({
        observation_id: `${site.site_id}-trade-area-unavailable`,
        section_id: "market_trade_area",
        field_id: "market_trade_area.unavailable",
        source_field: null,
        label: "Trade-area context",
        raw_value: null,
        unit: null,
        unit_state: "unknown",
        definition_status: "unknown",
        source_id: site.source_id,
        source_snapshot_id: "unavailable",
        observed_at: null,
        received_at: null,
        geography: "trade_area",
        geography_method: null,
        evidence_status: "Unknown",
        quality_status: "rejected",
        evidence_state: "missing",
        origin: "supplied",
        sensitivity: "internal",
        expected_source_or_owner: "GIS / Real Estate owner",
        limitations: ["No linked trade-area variant is available."],
      }),
    ];
  }

  return variant.observations.map((item) =>
    observation({
      observation_id: `${site.site_id}-trade-${item.trade_area_id}-${item.metric_id}`,
      section_id: "market_trade_area",
      field_id: `market_trade_area.${item.metric_id}`,
      source_field: item.source_field,
      label: item.display_label,
      raw_value: item.raw_value,
      unit: item.unit,
      unit_state: item.unit ? "known" : "unknown",
      definition_status: item.unit ? "partial" : "unknown",
      source_id: item.source_id,
      source_snapshot_id: item.source_snapshot_id,
      observed_at: item.observed_at,
      received_at: item.received_at,
      geography: item.geography,
      geography_method: item.geography_method,
      evidence_status: item.evidence_status,
      quality_status: item.quality_status,
      evidence_state:
        item.quality_status === "rejected"
          ? "rejected"
          : item.raw_value === null
            ? "missing"
            : item.observed_at === null ||
                item.geography_method === null ||
                item.unit === null
              ? "unknown"
              : "available",
      origin: item.is_synthetic ? "synthetic" : "supplied",
      sensitivity: item.sensitivity,
      expected_source_or_owner: "GIS / data steward",
      limitations: [...item.limitations, ...item.warnings],
    }),
  );
}

function clinicLandscapeObservations(
  site: EsriSiteIdentity,
  fixture: SyntheticClinicLandscapeFixture,
) {
  const base = {
    section_id: "clinic_landscape" as const,
    source_field: null,
    source_id: fixture.source_id,
    source_snapshot_id: fixture.snapshot_version,
    observed_at: fixture.observed_at,
    received_at: null,
    geography: "synthetic demonstration area",
    geography_method: "synthetic_demo_area",
    evidence_status: "Hypothesis" as const,
    quality_status: "warning" as const,
    evidence_state: "stale" as const,
    origin: "synthetic" as const,
    sensitivity: "internal" as const,
    definition_status: "defined" as const,
    expected_source_or_owner: "GIS / data steward",
    limitations: [
      "Synthetic fallback only; it is not calculated from supplied clinic rows.",
      "The 2025-12-31 synthetic snapshot is stale for the 2026-07-30 brief.",
      "The lifecycle filter is synthetic_active_demo, not a production lifecycle rule.",
    ],
  };
  const values = [
    ["source_account_rows", "Source account rows", fixture.source_account_rows],
    [
      "estimated_physical_locations",
      "Estimated physical locations",
      fixture.estimated_physical_locations,
    ],
    ["corporate_locations", "Corporate locations", fixture.corporate_locations],
    [
      "independent_locations",
      "Independent locations",
      fixture.independent_locations,
    ],
    [
      "repeated_coordinate_rows_retained",
      "Repeated-coordinate rows retained",
      fixture.repeated_coordinate_rows_retained,
    ],
    ["lifecycle_filter", "Lifecycle filter", fixture.lifecycle_filter],
  ] as const;
  return values.map(([fieldId, label, value]) =>
    observation({
      ...base,
      observation_id: `${site.site_id}-clinic-${fieldId}`,
      field_id: `clinic_landscape.${fieldId}`,
      label,
      raw_value: value,
      unit: typeof value === "number" ? "count" : null,
      unit_state: typeof value === "number" ? "known" : "not_applicable",
    }),
  );
}

function physicalSiteObservations(
  site: EsriSiteIdentity,
  fieldCatalog: readonly EsriFieldCatalogRecord[],
  manifest: EsriDemoManifest,
) {
  const coTenants = [1, 2, 3, 4, 5]
    .map((index) => site.physical_evidence[`cotenant_${index}`])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return PHYSICAL_FIELD_ORDER.map((fieldId) => {
    const rawValue =
      fieldId === "co_tenants"
        ? coTenants.length
          ? coTenants
          : null
        : (site.physical_evidence[fieldId] ?? null);
    validateValue(rawValue, fieldId);
    const catalog =
      fieldId === "co_tenants"
        ? fieldCatalogRecord(fieldCatalog, "cotenant_1")
        : fieldCatalogRecord(fieldCatalog, fieldId);
    if (!catalog) {
      throw new Error(`Missing field catalog record for physical field ${fieldId}.`);
    }
    const unit = fieldId === "co_tenants" ? null : catalog.unit;
    const missing = rawValue === null || (Array.isArray(rawValue) && !rawValue.length);
    const unknownUnit = !missing && unitState(rawValue, unit) === "unknown";
    return observation({
      observation_id: `${site.site_id}-physical-${fieldId}`,
      section_id: "physical_site",
      field_id: `physical_site.${fieldId}`,
      source_field:
        fieldId === "co_tenants" ? "Cotenant 1 through Cotenant 5" : catalog.source_field,
      label: fieldId === "co_tenants" ? "Co-tenants" : catalog.business_label,
      raw_value: rawValue,
      unit,
      unit_state: unitState(rawValue, unit),
      definition_status: catalog.definition_status,
      source_id: site.source_id,
      source_snapshot_id: manifest.snapshot_id,
      observed_at: catalog.observed_at,
      received_at: manifest.receipt_date,
      geography: catalog.geography,
      geography_method: catalog.geography_method,
      evidence_status: catalog.evidence_status,
      quality_status: missing || unknownUnit || catalog.definition_status !== "defined"
        ? "warning"
        : "accepted",
      evidence_state: missing ? "missing" : unknownUnit ? "unknown" : "available",
      origin: "supplied",
      sensitivity: catalog.sensitivity,
      expected_source_or_owner: "Real Estate analytics",
      limitations: [
        ...(catalog.definition_status !== "defined"
          ? ["Source definition is partial and requires owner confirmation."]
          : []),
        ...(unknownUnit ? ["Unit is unknown in the supplied field catalog."] : []),
      ],
    });
  });
}

function constraintsObservations(input: {
  site: EsriSiteIdentity;
  readiness: PortfolioSiteReadiness;
  manifest: EsriDemoManifest;
  hasMultipleTradeAreas: boolean;
}) {
  const { site, readiness, manifest, hasMultipleTradeAreas } = input;
  const observations = readiness.issues.map((item) =>
    observation({
      observation_id: `${site.site_id}-constraint-${item.issue_id}`,
      section_id: "constraints_diligence",
      field_id: `constraints_diligence.${item.field_or_relationship}`,
      source_field: item.field_or_relationship,
      label: fieldLabel(item.field_or_relationship),
      raw_value: null,
      unit: null,
      unit_state: "unknown",
      definition_status: "unknown",
      source_id: item.evidence_status === "Hypothesis"
        ? "SYN-ESRI-FALLBACK-001"
        : site.source_id,
      source_snapshot_id: manifest.snapshot_id,
      observed_at: null,
      received_at: manifest.receipt_date,
      geography: "site or linked evidence",
      geography_method: null,
      evidence_status: item.evidence_status,
      quality_status:
        item.state === "rejected" || item.state === "restricted"
          ? "rejected"
          : "warning",
      evidence_state:
        item.state === "unresolved_link" || hasMultipleTradeAreas
          ? "conflicting"
          : item.state === "restricted"
            ? "restricted"
            : item.state === "rejected"
              ? "rejected"
              : item.state === "stale"
                ? "stale"
                : item.state === "missing"
                  ? "missing"
                  : "unknown",
      origin: item.evidence_status === "Hypothesis" ? "synthetic" : "supplied",
      sensitivity: item.sensitivity,
      expected_source_or_owner: item.expected_source_or_owner,
      limitations: [item.reason, `Follow up: ${item.suggested_follow_up}`],
    }),
  );

  observations.push(
    observation({
      observation_id: `${site.site_id}-constraint-restricted-commercial`,
      section_id: "constraints_diligence",
      field_id: "constraints_diligence.lease_landlord_commercial",
      source_field: null,
      label: "Lease, landlord, and commercial evidence",
      raw_value: null,
      unit: null,
      unit_state: "unknown",
      definition_status: "unknown",
      source_id: site.source_id,
      source_snapshot_id: manifest.snapshot_id,
      observed_at: null,
      received_at: manifest.receipt_date,
      geography: "site",
      geography_method: null,
      evidence_status: "Reported",
      quality_status: "rejected",
      evidence_state: "restricted",
      origin: "supplied",
      sensitivity: "restricted",
      is_redacted: true,
      expected_source_or_owner: "Real Estate and data governance",
      limitations: [
        "Restricted values were excluded before fixture creation and are not present in this brief.",
      ],
    }),
    observation({
      observation_id: `${site.site_id}-constraint-clinic-rows`,
      section_id: "constraints_diligence",
      field_id: "constraints_diligence.supplied_clinic_rows",
      source_field: null,
      label: "Supplied clinic account rows",
      raw_value: null,
      unit: null,
      unit_state: "unknown",
      definition_status: "unknown",
      source_id: site.source_id,
      source_snapshot_id: manifest.snapshot_id,
      observed_at: null,
      received_at: manifest.receipt_date,
      geography: "source account row",
      geography_method: null,
      evidence_status: "Reported",
      quality_status: "rejected",
      evidence_state: "rejected",
      origin: "supplied",
      sensitivity: "restricted",
      is_redacted: true,
      expected_source_or_owner: "GIS / data governance",
      limitations: [
        "Clinic row values are excluded. Account rows are not treated as physical locations.",
      ],
    }),
    observation({
      observation_id: `${site.site_id}-constraint-competitor-distance`,
      section_id: "constraints_diligence",
      field_id: "constraints_diligence.closest_competitor_distance",
      source_field: "Closest Competitor / Closest Competitor Distance",
      label: "Closest competitor and stated distance",
      raw_value: null,
      unit: null,
      unit_state: "unknown",
      definition_status: "unknown",
      source_id: site.source_id,
      source_snapshot_id: manifest.snapshot_id,
      observed_at: null,
      received_at: manifest.receipt_date,
      geography: "site",
      geography_method: null,
      evidence_status: "Unknown",
      quality_status: "warning",
      evidence_state: "unknown",
      origin: "supplied",
      sensitivity: "internal",
      expected_source_or_owner: "Real Estate analytics",
      limitations: [
        "The source unit, calculation method, and competitor classification are not confirmed, so the values are not displayed.",
      ],
    }),
    observation({
      observation_id: `${site.site_id}-constraint-physical-inspection`,
      section_id: "constraints_diligence",
      field_id: "constraints_diligence.physical_inspection",
      source_field: null,
      label: "Physical inspection evidence",
      raw_value: null,
      unit: null,
      unit_state: "not_applicable",
      definition_status: "defined",
      source_id: SYNTHETIC_CLINIC_LANDSCAPE_SOURCE_ID,
      source_snapshot_id: SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
      observed_at: "2025-12-31",
      received_at: null,
      geography: "site",
      geography_method: "synthetic demonstration placeholder",
      evidence_status: "Hypothesis",
      quality_status: "warning",
      evidence_state: "stale",
      origin: "synthetic",
      sensitivity: "internal",
      expected_source_or_owner: "Real Estate field reviewer",
      limitations: [
        "No approved qualitative field note is included. The synthetic placeholder is stale and has no observation detail.",
      ],
    }),
  );
  return observations;
}

function followUpQuestions(input: {
  site: EsriSiteIdentity;
  observations: readonly CandidateEvidenceObservation[];
  hasMultipleTradeAreas: boolean;
  usesSyntheticTradeArea: boolean;
}) {
  const { site, observations, hasMultipleTradeAreas, usesSyntheticTradeArea } =
    input;
  const byField = (field: string) =>
    observations.filter((item) => item.field_id.includes(field));
  const questions: CandidateFollowUpQuestion[] = [];
  const add = (
    id: string,
    sectionId: CandidateEvidenceSectionId,
    question: string,
    reason: string,
    owner: string,
    sourceObservations: readonly CandidateEvidenceObservation[],
  ) => {
    questions.push({
      question_id: `${site.site_id}-question-${id}`,
      section_id: sectionId,
      question,
      reason,
      expected_source_or_owner: owner,
      source_observation_ids: sourceObservations.map(
        (item) => item.observation_id,
      ),
    });
  };

  const trade = observations.filter(
    (item) => item.section_id === "market_trade_area",
  );
  if (trade.some((item) => item.observed_at === null)) {
    add(
      "trade-date",
      "market_trade_area",
      "What observation period applies to the supplied trade-area metrics, and which fields share that period?",
      "The supplied metric observation date is unknown.",
      "GIS / data steward",
      trade.filter((item) => item.observed_at === null),
    );
  }
  if (trade.some((item) => item.geography_method === null)) {
    add(
      "trade-method",
      "market_trade_area",
      "How was the selected trade area constructed, and what role was it intended to serve?",
      "The geography method and role are unconfirmed.",
      "GIS / Real Estate owner",
      trade.filter((item) => item.geography_method === null),
    );
  }
  if (hasMultipleTradeAreas) {
    add(
      "trade-conflict",
      "market_trade_area",
      "How should each linked trade-area variant be labeled, and which one should analysts use for this review?",
      "Multiple supplied variants share the site relationship and no primary is approved.",
      "GIS / Real Estate owner",
      byField("trade_area_relationship"),
    );
  }
  if (usesSyntheticTradeArea) {
    add(
      "real-trade-link",
      "market_trade_area",
      "What governed source record should replace the synthetic trade-area fallback for this site?",
      "The real source relationship is blocked.",
      "GIS / Real Estate owner",
      trade,
    );
  }
  if (!site.cbsa_id) {
    add(
      "parent-market",
      "identity_workflow",
      "Which approved market geography should be assigned to this site, and who will review that relationship?",
      "A stable parent-market ID is unavailable.",
      "GIS / data steward",
      byField("parent_market"),
    );
  }
  const missingPhysical = observations.filter(
    (item) =>
      item.section_id === "physical_site" && item.evidence_state === "missing",
  );
  if (missingPhysical.length) {
    add(
      "physical-missing",
      "physical_site",
      `What current source can confirm the missing physical-site fields: ${missingPhysical
        .map((item) => item.label)
        .join(", ")}?`,
      "One or more physical-site fields are missing.",
      "Real Estate analytics",
      missingPhysical,
    );
  }
  const undefinedPhysical = observations.filter(
    (item) =>
      item.section_id === "physical_site" &&
      (item.definition_status !== "defined" || item.unit_state === "unknown"),
  );
  if (undefinedPhysical.length) {
    add(
      "physical-definition",
      "physical_site",
      "How should the displayed physical-site fields be defined, measured, and refreshed before comparison use?",
      "Definitions, units, or observation dates remain unconfirmed.",
      "Real Estate analytics",
      undefinedPhysical,
    );
  }
  add(
    "clinic-landscape",
    "clinic_landscape",
    "What approved lifecycle rule and geography method should produce separate source-account and physical-clinic counts?",
    "The displayed clinic landscape is synthetic and stale.",
    "GIS / data steward",
    observations.filter((item) => item.section_id === "clinic_landscape"),
  );
  add(
    "restricted-diligence",
    "constraints_diligence",
    "Which authorized reviewer can confirm that restricted lease and landlord evidence satisfies diligence without exposing the values here?",
    "Restricted commercial evidence is intentionally redacted.",
    "Real Estate and data governance",
    byField("lease_landlord_commercial"),
  );
  add(
    "physical-review",
    "constraints_diligence",
    "What should the next physical inspection verify about access, visibility, parking, usable space, and functional constraints?",
    "Physical diligence requires human inspection and the current placeholder is stale.",
    "Real Estate field reviewer",
    byField("physical_inspection"),
  );

  return questions;
}

function validateInput(input: CandidateEvidenceInput) {
  const duplicate = (values: readonly string[]) =>
    values.find((value, index) => values.indexOf(value) !== index);
  const duplicateSite = duplicate(input.sites.map((site) => site.site_id));
  if (duplicateSite) throw new Error(`Duplicate site identity: ${duplicateSite}`);
  const duplicateReadiness = duplicate(
    input.readiness.map((record) => record.site_id),
  );
  if (duplicateReadiness) {
    throw new Error(`Duplicate readiness record: ${duplicateReadiness}`);
  }
}

export function buildCandidateEvidenceBrief(
  input: CandidateEvidenceInput & {
    siteId: string;
    tradeAreaId?: string | null;
  },
): CandidateEvidenceBrief {
  validateInput(input);
  const site = input.sites.find((item) => item.site_id === input.siteId);
  if (!site) throw new Error(`Unknown candidate evidence site: ${input.siteId}`);
  const readiness = input.readiness.find(
    (item) => item.site_id === input.siteId,
  );
  if (!readiness) {
    throw new Error(`Missing readiness record for ${input.siteId}.`);
  }
  const profile = input.profiles.find((item) => item.site_id === input.siteId);
  if (!profile) throw new Error(`Missing trade-area profile for ${input.siteId}.`);
  const links = input.links.filter((item) => item.site_id === input.siteId);
  const selectedVariant =
    profile.variants.find(
      (item) => item.trade_area_id === input.tradeAreaId,
    ) ??
    profile.variants[0] ??
    null;
  if (
    input.tradeAreaId &&
    selectedVariant?.trade_area_id !== input.tradeAreaId
  ) {
    throw new Error(
      `Trade-area variant ${input.tradeAreaId} is not linked to ${input.siteId}.`,
    );
  }
  const selectedLink = links.find(
    (item) => item.trade_area_id === selectedVariant?.trade_area_id,
  );
  const clinicFixture = (
    input.clinicLandscape ?? SYNTHETIC_CLINIC_LANDSCAPE_FIXTURES
  ).find((item) => item.site_id === input.siteId);
  if (!clinicFixture) {
    throw new Error(
      `No approved synthetic clinic-landscape fallback exists for ${input.siteId}.`,
    );
  }

  const identity = identityObservations({
    site,
    readiness,
    manifest: input.manifest,
    link: selectedLink,
  });
  const trade = tradeAreaObservations(site, selectedVariant);
  const clinic = clinicLandscapeObservations(site, clinicFixture);
  const physical = physicalSiteObservations(
    site,
    input.fieldCatalog,
    input.manifest,
  );
  const constraints = constraintsObservations({
    site,
    readiness,
    manifest: input.manifest,
    hasMultipleTradeAreas: profile.variants.length > 1,
  });
  const allForQuestions = [
    ...identity,
    ...trade,
    ...clinic,
    ...physical,
    ...constraints,
  ];
  const questions = followUpQuestions({
    site,
    observations: allForQuestions,
    hasMultipleTradeAreas: profile.variants.length > 1,
    usesSyntheticTradeArea: selectedVariant?.is_synthetic ?? false,
  });
  const questionObservations = questions.map((item) =>
    observation({
      observation_id: `${item.question_id}-observation`,
      section_id: "analyst_follow_up",
      field_id: `analyst_follow_up.${item.question_id}`,
      source_field: null,
      label: "Analyst question",
      raw_value: item.question,
      unit: null,
      unit_state: "not_applicable",
      definition_status: "defined",
      source_id: "DERIVED-DETERMINISTIC-RULES",
      source_snapshot_id: CANDIDATE_EVIDENCE_BRIEF_VERSION,
      observed_at: null,
      received_at: input.manifest.receipt_date,
      geography: "brief",
      geography_method: "deterministic evidence-gap rule",
      evidence_status: "Derived",
      quality_status: "accepted",
      evidence_state: "available",
      origin: "derived",
      sensitivity: "internal",
      expected_source_or_owner: item.expected_source_or_owner,
      limitations: [item.reason],
    }),
  );
  const sections = [
    section("identity_workflow", identity),
    section("market_trade_area", trade),
    section("clinic_landscape", clinic),
    section("physical_site", physical),
    section("constraints_diligence", constraints),
    section("analyst_follow_up", questionObservations),
  ];
  const observations = sections.flatMap((item) => item.observations);
  const limitations = [
    ...new Set(
      observations.flatMap((item) => item.limitations).filter(Boolean),
    ),
  ];

  return {
    brief_id: `brief-${site.site_id}-${selectedVariant?.trade_area_id ?? "unassigned"}`,
    brief_version: CANDIDATE_EVIDENCE_BRIEF_VERSION,
    generated_at: CANDIDATE_EVIDENCE_GENERATED_AT,
    site_id: site.site_id,
    site_label: site.site_name,
    brand: site.brand,
    workflow_stage: site.workflow_stage,
    parent_market: {
      market_id: site.cbsa_id,
      market_label: site.cbsa_name ?? site.market_name,
      evidence_status: site.cbsa_id ? "Reported" : "Unknown",
      relationship_state: relationshipState(site),
      source_id: site.source_id,
    },
    trade_area_relationship: {
      trade_area_id: selectedVariant?.trade_area_id ?? null,
      role: selectedVariant?.trade_area_role ?? "unassigned",
      link_state: selectedLink?.link_state ?? "unassigned",
      review_state: relationshipReviewState(selectedLink),
      source_id: selectedLink?.source_id ?? site.source_id,
    },
    source_snapshot_versions: [
      input.manifest.snapshot_id,
      input.manifest.transformation_version,
      SYNTHETIC_CLINIC_LANDSCAPE_VERSION,
    ],
    readiness_state: readiness.readiness_state,
    visible_limitations: limitations,
    sections,
    missing_information: observations.filter(
      (item) => item.evidence_state === "missing",
    ),
    conflicting_information: observations.filter(
      (item) => item.evidence_state === "conflicting",
    ),
    restrictions: observations.filter(
      (item) =>
        item.evidence_state === "restricted" ||
        item.evidence_state === "rejected",
    ),
    follow_up_questions: questions,
    human_review_state: "not_reviewed",
    sensitivity: "internal",
    allowed_use: "internal_demo_evidence_only",
    scoring_eligibility: "none",
    disclaimers: [
      "Non-scored evidence organization for human review.",
      "Missing or unknown evidence is not unfavorable evidence.",
      "Workflow and readiness states do not indicate site attractiveness.",
      "This is not an approved investment, lease, or clinic-opening document.",
      "Restricted values are excluded before rendering and printing.",
    ],
  };
}

function observationForField(
  brief: CandidateEvidenceBrief,
  fieldId: string,
) {
  return brief.sections
    .flatMap((item) => item.observations)
    .find((item) => item.field_id === fieldId);
}

export function buildCandidateEvidenceComparison(
  input: CandidateEvidenceInput & {
    siteIds: readonly string[];
    tradeAreaIds?: Readonly<Record<string, string | null>>;
  },
): CandidateEvidenceComparison {
  validateInput(input);
  if (input.siteIds.length < 2 || input.siteIds.length > 5) {
    throw new Error("Candidate comparison requires two to five sites.");
  }
  if (new Set(input.siteIds).size !== input.siteIds.length) {
    throw new Error("Candidate comparison cannot contain duplicate sites.");
  }
  const briefs = input.siteIds.map((siteId) =>
    buildCandidateEvidenceBrief({
      ...input,
      siteId,
      tradeAreaId: input.tradeAreaIds?.[siteId],
    }),
  );
  const warnings: string[] = [];
  for (const fieldId of CANDIDATE_COMPARISON_FIELD_ORDER) {
    const observations = briefs
      .map((brief) => observationForField(brief, fieldId))
      .filter(
        (item): item is CandidateEvidenceObservation => item !== undefined,
      );
    if (observations.some((item) => item.observed_at === null)) {
      warnings.push(`${fieldId}: one or more observation dates are unknown.`);
    } else if (new Set(observations.map((item) => item.observed_at)).size > 1) {
      warnings.push(`${fieldId}: observation dates differ.`);
    }
    if (
      observations.some(
        (item) =>
          item.section_id === "market_trade_area" &&
          item.geography_method === null,
      )
    ) {
      warnings.push(`${fieldId}: trade-area methods are unknown.`);
    } else if (
      new Set(observations.map((item) => item.geography_method)).size > 1
    ) {
      warnings.push(`${fieldId}: geography methods differ.`);
    }
    if (new Set(observations.map((item) => item.unit)).size > 1) {
      warnings.push(`${fieldId}: units differ or are unknown.`);
    }
  }
  return {
    comparison_id: `comparison-${input.siteIds.join("--")}`,
    comparison_version: "candidate-evidence-comparison-v1",
    generated_at: CANDIDATE_EVIDENCE_GENERATED_AT,
    candidate_order: [...input.siteIds],
    briefs,
    section_order: [...CANDIDATE_EVIDENCE_SECTION_ORDER],
    field_order: [...CANDIDATE_COMPARISON_FIELD_ORDER],
    comparability_warnings: [...new Set(warnings)],
    scoring_eligibility: "none",
  };
}

export function candidateEvidenceDemoSiteIds() {
  return [...DEMO_CANDIDATE_SITE_IDS] as DemoCandidateSiteId[];
}
