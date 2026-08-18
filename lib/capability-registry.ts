import { z } from "zod";

export const CAPABILITY_REGISTRY_VERSION = "1.2.0" as const;

const identifierSchema = z.string().trim().min(1).max(180);
const descriptionSchema = z.string().trim().min(1).max(800);
export const capabilityGeographyGrainSchema = z.enum([
  "point",
  "radius",
  "drive_time",
  "site",
  "trade_area",
  "submarket",
  "market",
  "cbsa",
  "state",
  "county",
  "place",
  "census_tract",
  "block_group",
  "region",
  "portfolio",
  "other",
  "unknown",
]);

export const capabilityStatusSchema = z.enum([
  "connected",
  "synthetic",
  "unavailable",
  "planned",
]);

export const deterministicOperatorSchema = z.enum([
  "exact_geography_join",
  "filter",
  "aggregate",
  "compare",
  "normalize",
  "weight",
  "rank",
  "threshold",
  "sensitivity_test",
  "none",
]);

export const capabilityEvidenceRequirementSchema = z.object({
  evidenceId: identifierSchema,
  label: descriptionSchema,
  required: z.boolean(),
  availableByDefault: z.boolean(),
  sourceIds: z.array(identifierSchema),
  limitation: descriptionSchema.nullable(),
}).strict();

export const capabilityApprovalRequirementSchema = z.object({
  approvalId: identifierSchema,
  label: descriptionSchema,
  requiredRole: identifierSchema,
  required: z.boolean(),
  satisfiedByDefault: z.literal(false),
}).strict();

export const capabilityOutputSchema = z.object({
  outputId: identifierSchema,
  label: descriptionSchema,
  requiredEvidenceIds: z.array(identifierSchema),
  approvalRequirementIds: z.array(identifierSchema),
}).strict();

export const workspaceCapabilitySchema = z.object({
  capabilityId: z.enum([
    "census_market_context",
    "clinic_performance",
    "clinic_site_evaluation",
    "local_growth_test",
    "consumer_insights",
  ]),
  version: identifierSchema,
  status: capabilityStatusSchema,
  supportedGeographyGrains: z.array(capabilityGeographyGrainSchema).min(1),
  supportedOutputs: z.array(capabilityOutputSchema).min(1),
  requiredEvidence: z.array(capabilityEvidenceRequirementSchema),
  permittedDeterministicOperators: z.array(deterministicOperatorSchema).min(1),
  approvalRequirements: z.array(capabilityApprovalRequirementSchema),
  knownLimitations: z.array(descriptionSchema).min(1),
}).strict().superRefine((capability, context) => {
  const evidenceIds = new Set(capability.requiredEvidence.map((item) => item.evidenceId));
  const approvalIds = new Set(capability.approvalRequirements.map((item) => item.approvalId));
  capability.supportedOutputs.forEach((output, index) => {
    if (output.requiredEvidenceIds.some((id) => !evidenceIds.has(id))) {
      context.addIssue({
        code: "custom",
        path: ["supportedOutputs", index, "requiredEvidenceIds"],
        message: "Outputs must reference declared evidence requirements.",
      });
    }
    if (output.approvalRequirementIds.some((id) => !approvalIds.has(id))) {
      context.addIssue({
        code: "custom",
        path: ["supportedOutputs", index, "approvalRequirementIds"],
        message: "Outputs must reference declared approval requirements.",
      });
    }
  });
});
export type WorkspaceCapability = z.infer<typeof workspaceCapabilitySchema>;

export const capabilityRegistrySchema = z.object({
  registryVersion: z.literal(CAPABILITY_REGISTRY_VERSION),
  capabilities: z.array(workspaceCapabilitySchema).length(5),
}).strict().superRefine((registry, context) => {
  if (new Set(registry.capabilities.map((item) => item.capabilityId)).size !== registry.capabilities.length) {
    context.addIssue({ code: "custom", path: ["capabilities"], message: "Capability identifiers must be unique." });
  }
});

export const capabilityRegistry = capabilityRegistrySchema.parse({
  registryVersion: CAPABILITY_REGISTRY_VERSION,
  capabilities: [
    {
      capabilityId: "census_market_context",
      version: "1.0.0",
      status: "connected",
      supportedGeographyGrains: ["cbsa", "state", "county", "other"],
      supportedOutputs: [
        {
          outputId: "market_context_profile",
          label: "Market context profile",
          requiredEvidenceIds: ["public_census_aggregate"],
          approvalRequirementIds: [],
        },
        {
          outputId: "geography_identity",
          label: "Census geography identity",
          requiredEvidenceIds: ["public_census_geography"],
          approvalRequirementIds: [],
        },
      ],
      requiredEvidence: [
        {
          evidenceId: "public_census_aggregate",
          label: "Validated public Census aggregate",
          required: true,
          availableByDefault: true,
          sourceIds: ["SRC-016"],
          limitation: "ACS values are period estimates and market context only.",
        },
        {
          evidenceId: "public_census_geography",
          label: "Validated Census geography identifier",
          required: true,
          availableByDefault: true,
          sourceIds: ["SRC-014", "SRC-015"],
          limitation: "CBSA boundaries are not trade areas, drive times, or service areas.",
        },
      ],
      permittedDeterministicOperators: ["exact_geography_join", "filter", "aggregate", "compare"],
      approvalRequirements: [],
      knownLimitations: [
        "Public Census context has no scoring eligibility.",
        "Population growth is unavailable without an approved boundary-compatibility rule.",
        "This capability creates no Esri, Snowflake, Tableau, campaign, or customer-data connection.",
      ],
    },
    {
      capabilityId: "clinic_performance",
      version: "1.0.0",
      status: "connected",
      supportedGeographyGrains: ["site", "portfolio"],
      supportedOutputs: [{
        outputId: "clinic_outcome_comparison",
        label: "Clinic performance comparison",
        requiredEvidenceIds: ["approved_aggregate_clinic_export", "approved_outcome_definition"],
        approvalRequirementIds: ["performance_metric_owner_approval"],
      }],
      requiredEvidence: [
        {
          evidenceId: "approved_aggregate_clinic_export",
          label: "Approved aggregate clinic-performance export",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-002"],
          limitation: "Documented dashboards do not establish data access.",
        },
        {
          evidenceId: "approved_outcome_definition",
          label: "Versioned outcome and maturity-window definition",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-001", "SRC-002"],
          limitation: "The primary outcome, maturity rule, and comparable-clinic rule are unresolved.",
        },
      ],
      permittedDeterministicOperators: ["filter", "compare"],
      approvalRequirements: [{
        approvalId: "performance_metric_owner_approval",
        label: "Clinic outcome definition approval",
        requiredRole: "CVC Analytics and Finance metric owner",
        required: true,
        satisfiedByDefault: false,
      }],
      knownLimitations: [
        "The adapter accepts an approved manual aggregate CSV; it does not connect to Snowflake or Tableau.",
        "Customer-level, appointment-level, employee, and medical data are outside the contract.",
      ],
    },
    {
      capabilityId: "clinic_site_evaluation",
      version: "1.0.0",
      status: "synthetic",
      supportedGeographyGrains: ["site", "trade_area", "submarket", "market", "cbsa"],
      supportedOutputs: [
        {
          outputId: "market_ranking",
          label: "Market ranking",
          requiredEvidenceIds: ["synthetic_market_fixture", "synthetic_scoring_configuration"],
          approvalRequirementIds: [],
        },
        {
          outputId: "candidate_site_comparison",
          label: "Candidate site comparison",
          requiredEvidenceIds: ["synthetic_site_fixture", "synthetic_scoring_configuration"],
          approvalRequirementIds: [],
        },
        {
          outputId: "final_site_decision",
          label: "Final site decision",
          requiredEvidenceIds: ["synthetic_site_fixture"],
          approvalRequirementIds: ["authorized_real_estate_decision"],
        },
      ],
      requiredEvidence: [
        {
          evidenceId: "synthetic_market_fixture",
          label: "Versioned synthetic market fixture",
          required: true,
          availableByDefault: true,
          sourceIds: ["SYN-MARKET-001"],
          limitation: "Hypothesis evidence is limited to prototype use.",
        },
        {
          evidenceId: "synthetic_site_fixture",
          label: "Versioned synthetic candidate-site fixture",
          required: true,
          availableByDefault: true,
          sourceIds: ["SYN-SITE-001"],
          limitation: "Synthetic values are not production observations.",
        },
        {
          evidenceId: "synthetic_scoring_configuration",
          label: "Versioned synthetic scoring configuration",
          required: true,
          availableByDefault: true,
          sourceIds: ["SYN-CONFIG-001"],
          limitation: "Weights and thresholds are demonstration assumptions.",
        },
      ],
      permittedDeterministicOperators: [
        "exact_geography_join",
        "filter",
        "compare",
        "normalize",
        "weight",
        "rank",
        "threshold",
        "sensitivity_test",
      ],
      approvalRequirements: [{
        approvalId: "authorized_real_estate_decision",
        label: "Material site decision approval",
        requiredRole: "Authorized clinic real-estate reviewer",
        required: true,
        satisfiedByDefault: false,
      }],
      knownLimitations: [
        "Ranking and comparison are synthetic prototype outputs, not real-estate recommendations.",
        "Public Census and minimized Esri context cannot enter site scoring.",
        "No production Esri layer, export path, or API connection is claimed.",
      ],
    },
    {
      capabilityId: "local_growth_test",
      version: "1.1.0",
      status: "planned",
      supportedGeographyGrains: ["drive_time", "trade_area", "market"],
      supportedOutputs: [
        {
          outputId: "audience_eligibility",
          label: "Audience eligibility",
          requiredEvidenceIds: ["approved_customer_geography_view"],
          approvalRequirementIds: ["growth_audience_approval"],
        },
        {
          outputId: "growth_test_measurement",
          label: "Local growth-test measurement",
          requiredEvidenceIds: [
            "approved_campaign_aggregate",
            "approved_first_party_regional_outcome",
            "approved_campaign_taxonomy",
            "approved_dma_market_relationship",
            "approved_attribution_lag_contract",
            "approved_geo_experiment_design",
          ],
          approvalRequirementIds: ["growth_measurement_approval"],
        },
      ],
      requiredEvidence: [
        {
          evidenceId: "approved_customer_geography_view",
          label: "an approved customer-geography view",
          required: true,
          availableByDefault: false,
          sourceIds: [],
          limitation: "No approved customer-geography connection is documented.",
        },
        {
          evidenceId: "approved_campaign_aggregate",
          label: "Approved weekly DMA campaign aggregate",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-018", "SRC-020"],
          limitation: "Manual Google Ads exports are validation evidence, not an approved production connection or refresh path.",
        },
        {
          evidenceId: "approved_first_party_regional_outcome",
          label: "Approved first-party regional outcome aggregate",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-021"],
          limitation: "Platform-attributed conversions alone do not establish total-business demand or incremental impact.",
        },
        {
          evidenceId: "approved_campaign_taxonomy",
          label: "Approved campaign taxonomy and comparison cohort",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-023"],
          limitation: "Account, funnel, tactic, brand, audience, bid, budget, and outcome differences can invalidate regional comparisons.",
        },
        {
          evidenceId: "approved_dma_market_relationship",
          label: "Approved versioned DMA-to-market relationship",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-018", "SRC-019"],
          limitation: "Nielsen DMA, postal, physical-user, matched-interest, and Census CBSA geographies are not interchangeable.",
        },
        {
          evidenceId: "approved_attribution_lag_contract",
          label: "Approved conversion, attribution, and lag contract",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-018", "SRC-021"],
          limitation: "Conversion-action downloads omit many performance denominators and cannot define efficiency by themselves.",
        },
        {
          evidenceId: "approved_geo_experiment_design",
          label: "Approved geo-experiment design and guardrails",
          required: true,
          availableByDefault: false,
          sourceIds: ["SRC-022", "SRC-024"],
          limitation: "Observational matched-location efficiency cannot establish incrementality or justify a spend change.",
        },
      ],
      permittedDeterministicOperators: ["filter", "aggregate", "compare"],
      approvalRequirements: [
        {
          approvalId: "growth_audience_approval",
          label: "Audience definition and privacy approval",
          requiredRole: "Growth owner and data governance",
          required: true,
          satisfiedByDefault: false,
        },
        {
          approvalId: "growth_measurement_approval",
          label: "Growth-test measurement approval",
          requiredRole: "Growth measurement owner",
          required: true,
          satisfiedByDefault: false,
        },
      ],
      knownLimitations: [
        "Google Ads UI exports are available for source validation, but no approved product connection is documented.",
        "DMA is the default comparable layer; postal evidence requires coverage and volume gates and is drill-down only.",
        "Observed advertising efficiency does not establish causal lift, total demand, pricing power, or site suitability.",
        "Precise customer locations are prohibited.",
        "A 30-minute launch-marketing area is not automatically an approved site-scoring trade area.",
      ],
    },
    {
      capabilityId: "consumer_insights",
      version: "1.0.0",
      status: "connected",
      supportedGeographyGrains: ["cbsa", "market"],
      supportedOutputs: [
        { outputId: "consumer_insights_profile", label: "Consumer-insights DMA profile aligned to CBSA", requiredEvidenceIds: ["brand_health_snapshot"], approvalRequirementIds: [] },
        { outputId: "brand_health_review", label: "Brand-health funnel, relevance, driver, and generation review", requiredEvidenceIds: ["brand_health_snapshot"], approvalRequirementIds: [] },
      ],
      requiredEvidence: [{
        evidenceId: "brand_health_snapshot",
        label: "Normalized Brand Health Tracker snapshot",
        required: true,
        availableByDefault: true,
        sourceIds: ["SRC-033"],
        limitation: "The snapshot is a dated reported survey. DMA-to-CBSA alignment is intuitive local-demo context and is not a Nielsen boundary equivalence.",
      }],
      permittedDeterministicOperators: ["filter", "exact_geography_join", "compare", "aggregate"],
      approvalRequirements: [],
      knownLimitations: [
        "The source covers 32 DMAs and the April 11 to May 15, 2024 survey wave only.",
        "The DMA-to-CBSA crosswalk is Derived, intuitive, and requires owner review before external or production use.",
        "BDI, CDI, funnel, relevance, and driver observations are descriptive and have no clinic-site scoring eligibility.",
        "Narrative, correlation, and causal claims are outside the registered output boundary.",
      ],
    },
  ],
});

export const capabilityQuestionSchema = z.object({
  question: descriptionSchema,
  requirements: z.array(z.object({
    capabilityId: workspaceCapabilitySchema.shape.capabilityId,
    outputId: identifierSchema,
    geographyGrain: capabilityGeographyGrainSchema,
  }).strict()).min(1),
  availableEvidenceIds: z.array(identifierSchema).default([]),
  satisfiedApprovalIds: z.array(identifierSchema).default([]),
}).strict();
export type CapabilityQuestion = z.input<typeof capabilityQuestionSchema>;

export type CapabilityExecutionAssessment = {
  registryVersion: typeof CAPABILITY_REGISTRY_VERSION;
  outcome: "supported" | "unsupported" | "partially_supported" | "blocked";
  message: string;
  supportedOutputs: string[];
  unsupportedOutputs: string[];
  missingEvidence: string[];
  missingApprovals: string[];
};

function sentenceList(labels: string[]): string {
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" })
    .format(labels);
}

export function assessCapabilityQuestion(input: CapabilityQuestion): CapabilityExecutionAssessment {
  const question = capabilityQuestionSchema.parse(input);
  const suppliedEvidence = new Set(question.availableEvidenceIds);
  const suppliedApprovals = new Set(question.satisfiedApprovalIds);
  const supported: string[] = [];
  const unsupported: string[] = [];
  const missingEvidence = new Set<string>();
  const missingApprovals = new Set<string>();

  for (const requirement of question.requirements) {
    const capability = capabilityRegistry.capabilities.find(
      (item) => item.capabilityId === requirement.capabilityId,
    )!;
    const output = capability.supportedOutputs.find(
      (item) => item.outputId === requirement.outputId,
    );
    const label = output?.label ?? requirement.outputId.replaceAll("_", " ");
    if (!output) {
      unsupported.push(label);
      continue;
    }

    const absentEvidence = output.requiredEvidenceIds.filter((id) => {
      const evidence = capability.requiredEvidence.find((item) => item.evidenceId === id);
      return evidence?.required && !evidence.availableByDefault && !suppliedEvidence.has(id);
    });
    const absentApprovals = output.approvalRequirementIds.filter(
      (id) => !suppliedApprovals.has(id),
    );
    absentEvidence.forEach((id) => {
      missingEvidence.add(capability.requiredEvidence.find((item) => item.evidenceId === id)!.label);
    });
    absentApprovals.forEach((id) => {
      missingApprovals.add(capability.approvalRequirements.find((item) => item.approvalId === id)!.label);
    });
    if (
      !capability.supportedGeographyGrains.includes(requirement.geographyGrain) ||
      capability.status === "unavailable" ||
      capability.status === "planned" ||
      absentEvidence.length ||
      absentApprovals.length
    ) {
      unsupported.push(label);
    } else {
      supported.push(label);
    }
  }

  const missing = [...missingEvidence];
  const approvals = [...missingApprovals];
  let outcome: CapabilityExecutionAssessment["outcome"];
  let message: string;
  if (supported.length && unsupported.length) {
    outcome = "partially_supported";
    const requirement = missing.length
      ? ` requires ${sentenceList(missing).toLowerCase()}`
      : " is not available in the current registry";
    message = `${sentenceList(supported)} is supported, but ${sentenceList(unsupported).toLowerCase()}${requirement}.`;
  } else if (supported.length) {
    outcome = "supported";
    message = `${sentenceList(supported)} is supported by registry version ${CAPABILITY_REGISTRY_VERSION}.`;
  } else if (missing.length || approvals.length) {
    outcome = "blocked";
    const blockers = [
      ...(missing.length ? [`required evidence: ${sentenceList(missing)}`] : []),
      ...(approvals.length ? [`approval: ${sentenceList(approvals)}`] : []),
    ];
    message = `${sentenceList(unsupported)} is blocked by ${sentenceList(blockers)}.`;
  } else {
    outcome = "unsupported";
    message = `${sentenceList(unsupported)} is not supported by the current capability registry.`;
  }

  return {
    registryVersion: CAPABILITY_REGISTRY_VERSION,
    outcome,
    message,
    supportedOutputs: supported,
    unsupportedOutputs: unsupported,
    missingEvidence: missing,
    missingApprovals: approvals,
  };
}
