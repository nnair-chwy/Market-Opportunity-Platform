import registryJson from "../../data/contracts/snowflake-escalation/approved-query-templates.json" with { type: "json" };
import type { EvidenceExecutionResponse } from "../evidence-snapshot/contracts.ts";
import type { EvaluationPlan } from "../planning/contracts.ts";
import {
  governedSnowflakeEscalationAssessmentSchema,
  snowflakeQueryTemplateRegistrySchema,
  type GovernedSnowflakeEscalationAssessment,
  type SnowflakeQueryTemplateRegistry,
} from "./contracts.ts";

const registry = snowflakeQueryTemplateRegistrySchema.parse(registryJson);

const REQUIREMENT_METRICS: Record<string, RegExp> = {
  marketing_comparable_cohort: /campaign|account|spend|click|conversion/i,
  marketing_geography: /google_ads|regional|dma|postal|cbsa/i,
  marketing_business_outcome: /completed_orders|regional_orders|new_customers|contribution_profit/i,
  marketing_incrementality: /experiment|treatment|control|incremental/i,
  pricing_competitor_condition: /competitor|equalized_price|availability|price_signal/i,
  pricing_chewy_economics: /chewy_price|product_cost|net_sales|margin|price_signal/i,
  pricing_customer_outcome: /regional_orders|orders|net_sales|returns|contribution/i,
  pricing_test_authority: /experiment|elasticity|test_result|offer_pulsing/i,
  cvc_demand_outcome: /completed_appointments|active_customers|clinic_orders|clinic_performance|customer_demand/i,
  cvc_access_capacity: /available_capacity|available_slots|staffed_capacity|appointment/i,
  cvc_supply_feasibility: /veterinary_supply|staffing_feasibility|property_feasibility|competition/i,
};

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function coveredRequirements(plan: EvaluationPlan, executionStatus: EvidenceExecutionResponse["status"], metricLabels: string[]) {
  if (["blocked", "failed"].includes(executionStatus)) return [];
  return plan.answerContract.domainRequirements.flatMap((requirement) => {
    const matcher = REQUIREMENT_METRICS[requirement.requirementId];
    if (!matcher) return [];
    const covered = metricLabels.some((label) => matcher.test(label));
    return covered ? [requirement.requirementId] : [];
  });
}

type LocalEvidenceCoverage = {
  executionStatus: EvidenceExecutionResponse["status"];
  evidenceIds: string[];
  sourceIds: string[];
  metricLabels: string[];
};

export function assessGovernedSnowflakeEscalationFromLocalEvidence(input: {
  runId: string;
  plan: EvaluationPlan;
  localEvidence: LocalEvidenceCoverage;
  registryOverride?: SnowflakeQueryTemplateRegistry;
}): GovernedSnowflakeEscalationAssessment {
  const approvedRegistry = input.registryOverride
    ? snowflakeQueryTemplateRegistrySchema.parse(input.registryOverride)
    : registry;
  const required = input.plan.answerContract.domainRequirements
    .filter((requirement) => requirement.required && requirement.readiness !== "not_applicable")
    .map((requirement) => requirement.requirementId);
  const covered = coveredRequirements(input.plan, input.localEvidence.executionStatus, input.localEvidence.metricLabels);
  const unmet = required.filter((requirementId) => !covered.includes(requirementId));
  const requestedGeographyGrain = input.plan.geographyGrain === "submarket"
    ? "trade_area"
    : input.plan.geographyGrain === "site"
      ? input.plan.perspectiveId === "cvc" ? "clinic_service_area" : "postal"
      : "cbsa";
  const geographyIds = input.plan.geographyResolution.selectedCbsaCodes.map((code) => `cbsa:${code}`);
  const templates = approvedRegistry.templates
    .filter((template) => template.perspectiveId === input.plan.perspectiveId)
    .flatMap((template) => {
      const requestedRequirementIds = template.addressesRequirementIds.filter((requirementId) => unmet.includes(requirementId));
      return requestedRequirementIds.length ? [{
        ...template,
        requestedRequirementIds,
        parameters: {
          metrics: template.requiredMetrics,
          geographyGrains: [template.allowedGeographyGrains.includes(requestedGeographyGrain) ? requestedGeographyGrain : template.allowedGeographyGrains[0]!],
          geographyScope: geographyIds.length ? "selected_geographies" as const : "approved_market_universe" as const,
          geographyIds,
          timeGrain: template.timeGrain,
          lookbackDays: template.lookbackDays,
          finalizedPeriodsOnly: true as const,
          minimumGroupSize: template.minimumGroupSize,
        },
      }] : [];
    });
  const templatedRequirements = new Set(templates.flatMap((template) => template.requestedRequirementIds));
  const unresolvedGovernanceRequirementIds = unmet.filter((requirementId) => !templatedRequirements.has(requirementId));

  if (!templates.length) {
    return governedSnowflakeEscalationAssessmentSchema.parse({
      version: "governed-snowflake-escalation-v1",
      runId: input.runId,
      planId: input.plan.planId,
      originalQuestion: input.plan.originalQuestion,
      status: unmet.length ? "governance_review_required" : "local_evidence_sufficient",
      reason: unmet.length
        ? "The remaining requirement is an accountable governance decision, not a request for more warehouse data."
        : "Approved local evidence covers every data requirement that a governed Snowflake template could address.",
      localEvidence: {
        executionStatus: input.localEvidence.executionStatus,
        evidenceIds: input.localEvidence.evidenceIds,
        sourceIds: input.localEvidence.sourceIds,
        coveredRequirementIds: covered,
        unmetRequirementIds: unmet,
      },
      accessRequest: null,
    });
  }

  return governedSnowflakeEscalationAssessmentSchema.parse({
    version: "governed-snowflake-escalation-v1",
    runId: input.runId,
    planId: input.plan.planId,
    originalQuestion: input.plan.originalQuestion,
    status: "snowflake_escalation_required",
    reason: `Approved local evidence leaves ${unmet.length} required answer-contract item(s) unresolved; use only the reviewed semantic-view template plan below.`,
    localEvidence: {
      executionStatus: input.localEvidence.executionStatus,
      evidenceIds: input.localEvidence.evidenceIds,
      sourceIds: input.localEvidence.sourceIds,
      coveredRequirementIds: covered,
      unmetRequirementIds: unmet,
    },
    accessRequest: {
      requestType: "publish_or_grant_read_only_semantic_view",
      owningTeams: unique(templates.map((template) => template.owningTeam)),
      purpose: `Answer the approved evaluation question without raw customer data: ${input.plan.originalQuestion}`,
      approvedUseBoundary: "aggregate_internal_decision_support_and_shadow_evaluation_only",
      prohibitedData: ["credentials or connection secrets", "raw customer, order, address, pet, or employee identifiers", "unsuppressed small groups", "model-written or request-supplied SQL"],
      executionPolicy: {
        mode: "read_only_template",
        sqlSource: "reviewed_template_only",
        credentialsRequested: false,
        externalConnectionAttempted: false,
        arbitrarySqlAllowed: false,
        materialActionsAllowed: false,
      },
      templates,
      unresolvedGovernanceRequirementIds,
    },
  });
}

export function assessGovernedSnowflakeEscalation(input: {
  runId: string;
  plan: EvaluationPlan;
  execution: EvidenceExecutionResponse;
  registryOverride?: SnowflakeQueryTemplateRegistry;
}): GovernedSnowflakeEscalationAssessment {
  return assessGovernedSnowflakeEscalationFromLocalEvidence({
    runId: input.runId,
    plan: input.plan,
    registryOverride: input.registryOverride,
    localEvidence: {
      executionStatus: input.execution.status,
      evidenceIds: input.execution.evidenceBundle.map((item) => item.evidenceId),
      sourceIds: input.execution.sourceIds,
      metricLabels: input.execution.evidenceBundle.map((item) => `${item.metricId} ${item.reportScope}`),
    },
  });
}
