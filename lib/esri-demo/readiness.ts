import {
  ESRI_DEMO_SOURCE_ID,
  ESRI_DEMO_SYNTHETIC_SOURCE_ID,
  ESRI_DEMO_TRANSFORMATION_VERSION,
  type EsriSiteIdentity,
  type EsriSiteTradeAreaLink,
  type EsriTradeAreaRecord,
  type PortfolioSiteReadiness,
  type ReadinessEvidenceState,
  type ReadinessIssue,
  type WorkflowStage,
} from "./types.ts";

const COMMON_REQUIREMENTS = [
  "site_name",
  "brand",
  "coordinates",
  "market_name",
  "trade_area_link",
  "population",
  "households",
  "households_with_pets",
] as const;

const CANDIDATE_REQUIREMENTS = [
  ...COMMON_REQUIREMENTS,
  "site_square_feet",
  "center_type",
  "parking",
  "visibility",
  "ingress_egress",
] as const;

export function readinessRequirements(stage: WorkflowStage): readonly string[] {
  return stage === "candidate_review"
    ? CANDIDATE_REQUIREMENTS
    : COMMON_REQUIREMENTS;
}

function issue(
  siteId: string,
  sequence: number,
  input: Omit<ReadinessIssue, "issue_id" | "site_id" | "resolution_state">,
): ReadinessIssue {
  return {
    issue_id: `${siteId}-issue-${String(sequence).padStart(2, "0")}`,
    site_id: siteId,
    resolution_state: "open",
    ...input,
  };
}

function metricAvailable(
  tradeAreas: readonly EsriTradeAreaRecord[],
  links: readonly EsriSiteTradeAreaLink[],
  metricId: string,
) {
  const linkedIds = new Set(links.map((link) => link.trade_area_id));
  return tradeAreas.some(
    (record) =>
      linkedIds.has(record.trade_area_id) &&
      !record.is_synthetic &&
      record.metrics.some(
        (metric) => metric.metric_id === metricId && metric.raw_value !== null,
      ),
  );
}

export function calculatePortfolioReadiness(input: {
  site: EsriSiteIdentity;
  links: readonly EsriSiteTradeAreaLink[];
  tradeAreas: readonly EsriTradeAreaRecord[];
  requirementOverrides?: Partial<Record<string, ReadinessEvidenceState>>;
}): PortfolioSiteReadiness {
  const { site, links, tradeAreas, requirementOverrides = {} } = input;
  const requirements = readinessRequirements(site.workflow_stage);
  const issues: ReadinessIssue[] = [];
  let issueSequence = 1;
  const availability = new Map<string, boolean>([
    ["site_name", site.site_name.trim().length > 0],
    ["brand", site.brand.trim().length > 0],
    [
      "coordinates",
      Number.isFinite(site.latitude) && Number.isFinite(site.longitude),
    ],
    ["market_name", Boolean(site.market_name)],
    [
      "trade_area_link",
      links.some((link) =>
        ["source_provided", "needs_review"].includes(link.link_state),
      ),
    ],
    ["population", metricAvailable(tradeAreas, links, "population")],
    ["households", metricAvailable(tradeAreas, links, "households")],
    [
      "households_with_pets",
      metricAvailable(tradeAreas, links, "households_with_pets"),
    ],
    [
      "site_square_feet",
      typeof site.physical_evidence.site_square_feet === "number",
    ],
    ["center_type", typeof site.physical_evidence.center_type === "string"],
    [
      "parking",
      typeof site.physical_evidence.dedicated_parking_spaces === "number" ||
        typeof site.physical_evidence.parking_type === "string",
    ],
    [
      "visibility",
      typeof site.physical_evidence.main_street_visibility === "string",
    ],
    [
      "ingress_egress",
      typeof site.physical_evidence.center_ingress_egress === "string",
    ],
  ]);
  const allRequirements = new Set([
    ...COMMON_REQUIREMENTS,
    ...CANDIDATE_REQUIREMENTS,
  ]);
  const evidenceStates = Object.fromEntries(
    [...allRequirements].map((requirement) => {
      if (!requirements.includes(requirement)) {
        return [requirement, "not_required"];
      }
      const override = requirementOverrides[requirement];
      if (override) return [requirement, override];
      if (availability.get(requirement)) return [requirement, "available"];
      return [
        requirement,
        requirement === "trade_area_link" ? "unresolved_link" : "missing",
      ];
    }),
  ) as Record<string, ReadinessEvidenceState>;

  for (const requirement of requirements) {
    const requirementState = evidenceStates[requirement];
    if (requirementState === "available") continue;
    const syntheticLink = links.some(
      (link) => link.link_state === "synthetic_fallback",
    );
    const isRelationship = requirement === "trade_area_link";
    const issueState =
      requirementState === "unresolved_link"
        ? "unresolved_link"
        : requirementState === "unavailable"
          ? "unavailable"
          : requirementState === "rejected"
            ? "rejected"
            : requirementState === "restricted"
              ? "restricted"
              : requirementState === "stale"
                ? "stale"
                : "missing";
    issues.push(
      issue(site.site_id, issueSequence, {
        field_or_relationship: requirement,
        state: issueState,
        severity:
          ["unresolved_link", "rejected", "restricted"].includes(issueState)
            ? "error"
            : "warning",
        reason:
          isRelationship && syntheticLink
            ? "The supplied master site has no source-provided trade-area link. A synthetic fallback exists for demonstration only."
            : `Required ${requirement.replaceAll("_", " ")} evidence is ${issueState.replaceAll("_", " ")} in the approved fixture.`,
        expected_source_or_owner: isRelationship
          ? "GIS / Real Estate owner"
          : requirement.startsWith("site_") ||
              ["center_type", "parking", "visibility", "ingress_egress"].includes(
                requirement,
              )
            ? "Real Estate analytics"
            : "GIS / data steward",
        evidence_status: isRelationship ? "Unknown" : "Reported",
        sensitivity: "internal",
        suggested_follow_up: isRelationship
          ? "Review the source ESRI ID and assign the intended trade-area record and role."
          : `Confirm the definition and source for ${requirement.replaceAll("_", " ")}.`,
      }),
    );
    issueSequence += 1;
  }

  const linkedSourceTradeAreas = tradeAreas.filter(
    (record) =>
      !record.is_synthetic &&
      links.some((link) => link.trade_area_id === record.trade_area_id),
  );
  if (
    linkedSourceTradeAreas.length &&
    linkedSourceTradeAreas.some((record) =>
      record.metrics.some((metric) => metric.observed_at === null),
    )
  ) {
    issues.push(
      issue(site.site_id, issueSequence, {
        field_or_relationship: "trade_area_observation_date",
        state: "missing",
        severity: "warning",
        reason:
          "The supplied trade-area metrics do not include an observation date or vintage.",
        expected_source_or_owner: "GIS / data steward",
        evidence_status: "Unknown",
        sensitivity: "internal",
        suggested_follow_up:
          "Confirm the metric vintage and whether the fields share one observation period.",
      }),
    );
    issueSequence += 1;
  }
  if (
    linkedSourceTradeAreas.length &&
    linkedSourceTradeAreas.some((record) =>
      record.metrics.some((metric) => metric.geography_method === null),
    )
  ) {
    issues.push(
      issue(site.site_id, issueSequence, {
        field_or_relationship: "trade_area_method",
        state: "warning",
        severity: "warning",
        reason:
          "The supplied export does not define how the trade area was constructed.",
        expected_source_or_owner: "GIS / Real Estate owner",
        evidence_status: "Unknown",
        sensitivity: "internal",
        suggested_follow_up:
          "Confirm whether each record represents a radius, drive time, custom polygon, or another method.",
      }),
    );
    issueSequence += 1;
  }

  if (links.length > 1) {
    issues.push(
      issue(site.site_id, issueSequence, {
        field_or_relationship: "trade_area_link",
        state: "unresolved_link",
        severity: "warning",
        reason:
          "The source ESRI ID links this site to multiple trade-area records. No primary record was selected.",
        expected_source_or_owner: "GIS / Real Estate owner",
        evidence_status: "Reported",
        sensitivity: "internal",
        suggested_follow_up:
          "Label each linked polygon as primary, custom, scenario, comparison, or historical.",
      }),
    );
    issueSequence += 1;
  }

  if (!site.cbsa_id) {
    issues.push(
      issue(site.site_id, issueSequence, {
        field_or_relationship: "cbsa_id",
        state: "warning",
        severity: "warning",
        reason:
          "The source export does not provide a stable CBSA ID for this site.",
        expected_source_or_owner: "GIS / data steward",
        evidence_status: "Reported",
        sensitivity: "internal",
        suggested_follow_up:
          "Confirm the approved source and geography version for the parent-market assignment.",
      }),
    );
    issueSequence += 1;
  }

  if (site.state === "WA" && /florida|sarasota/i.test(site.site_name)) {
    issues.push(
      issue(site.site_id, issueSequence, {
        field_or_relationship: "state",
        state: "warning",
        severity: "warning",
        reason:
          "The source state conflicts with the Florida place name and market context.",
        expected_source_or_owner: "Real Estate analytics",
        evidence_status: "Reported",
        sensitivity: "internal",
        suggested_follow_up:
          "Review the source record and confirm the intended state before using it in filters or joins.",
      }),
    );
  }

  const availableEvidenceCount = requirements.filter(
    (requirement) => evidenceStates[requirement] === "available",
  ).length;
  const unresolvedLinkCount = issues.filter(
    (item) => item.state === "unresolved_link",
  ).length;
  const missingCount = issues.filter((item) => item.state === "missing").length;
  const warningCount = issues.filter((item) => item.state === "warning").length;
  const rejectedCount = issues.filter((item) => item.state === "rejected").length;
  const restrictedCount = issues.filter(
    (item) => item.state === "restricted",
  ).length;
  const staleCount = issues.filter((item) => item.state === "stale").length;
  const readinessPercent = Math.round(
    (availableEvidenceCount / requirements.length) * 100,
  );
  const hasSourceLink = links.some(
    (link) =>
      link.link_state === "source_provided" ||
      link.link_state === "needs_review",
  );
  const readinessState = !hasSourceLink
    ? "blocked"
    : issues.length
      ? "needs_review"
      : "ready_for_research";

  return {
    site_id: site.site_id,
    site_name: site.site_name,
    brand: site.brand,
    market_name: site.market_name,
    state: site.state,
    cbsa_id: site.cbsa_id,
    latitude: site.latitude,
    longitude: site.longitude,
    workflow_stage: site.workflow_stage,
    source_link_state: "available",
    trade_area_link_state:
      links.find((link) => link.link_state === "needs_review")?.link_state ??
      links[0]?.link_state ??
      "unassigned",
    expected_evidence_count: requirements.length,
    available_evidence_count: availableEvidenceCount,
    missing_count: missingCount,
    warning_count: warningCount,
    rejected_count: rejectedCount,
    restricted_count: restrictedCount,
    stale_count: staleCount,
    unresolved_link_count: unresolvedLinkCount,
    readiness_percent: readinessPercent,
    readiness_state: readinessState,
    evidence_states: evidenceStates,
    issues,
    follow_up_items: issues.map((item) => item.suggested_follow_up),
    source_ids: [
      ESRI_DEMO_SOURCE_ID,
      ...(links.some((link) => link.link_state === "synthetic_fallback")
        ? [ESRI_DEMO_SYNTHETIC_SOURCE_ID]
        : []),
    ],
    provenance: {
        source_id: ESRI_DEMO_SOURCE_ID as typeof ESRI_DEMO_SOURCE_ID,
      transformation_version: ESRI_DEMO_TRANSFORMATION_VERSION,
      calculation: "available_required_evidence / expected_required_evidence",
    },
    evidence_status: "Derived",
    sensitivity: "internal",
    allowed_use: "internal_demo_evidence_only",
    scoring_eligibility: "none",
  };
}
