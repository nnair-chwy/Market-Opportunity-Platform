import { z } from "zod";
import type { EvaluationPlan } from "./contracts.ts";

export const validationEvidenceStatusSchema = z.enum([
  "available",
  "missing",
  "synthetic_placeholder",
  "requires_approval",
  "unknown",
]);

export const validationEvidenceItemSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  status: validationEvidenceStatusSchema,
  sourceId: z.string().trim().min(1).nullable(),
  expectedGrain: z.string().trim().min(1),
  observationDate: z.string().trim().min(1).nullable(),
  owner: z.string().trim().min(1),
  allowedUse: z.string().trim().min(1),
  whyNeeded: z.string().trim().min(1),
}).strict();

export const validationWorkstreamSchema = z.object({
  id: z.string().trim().min(1),
  sequence: z.number().int().positive(),
  title: z.string().trim().min(1),
  owner: z.string().trim().min(1),
  action: z.string().trim().min(1),
  evidenceIds: z.array(z.string().trim().min(1)).min(1),
  deliverable: z.string().trim().min(1),
  completionCriteria: z.string().trim().min(1),
  /** Optional so previously saved 1.0.0 workplans remain valid. */
  kpi: z.string().trim().min(1).optional(),
  validationThreshold: z.string().trim().min(1).optional(),
  stopCondition: z.string().trim().min(1).optional(),
  status: z.enum(["ready_to_start", "blocked_on_evidence", "requires_approval"]),
}).strict();

export const validationWorkplanSchema = z.object({
  version: z.literal("1.0.0"),
  planId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  objective: z.string().trim().min(1),
  accountableOwner: z.string().trim().min(1),
  proposedAction: z.string().trim().min(1),
  whatThisInforms: z.array(z.string().trim().min(1)).min(1),
  evidence: z.array(validationEvidenceItemSchema).min(1),
  workstreams: z.array(validationWorkstreamSchema).min(1),
  decisionRules: z.array(z.object({
    disposition: z.enum(["advance", "hold", "stop"]),
    rule: z.string().trim().min(1),
  }).strict()).length(3),
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

export type ValidationWorkplan = z.infer<typeof validationWorkplanSchema>;

type EvidenceSpec = Omit<ValidationWorkplan["evidence"][number], "status"> & {
  status?: ValidationWorkplan["evidence"][number]["status"];
};

function isPhoenix(plan: EvaluationPlan) {
  return plan.geographyResolution.selectedCbsaCodes.includes("38060")
    || plan.geographyResolution.places.some((place) => /phoenix/i.test(place.cbsaName ?? place.requestedName));
}

function evidenceItem(spec: EvidenceSpec, plan: EvaluationPlan) {
  const missingText = plan.missingEvidence.join(" ").toLowerCase();
  const status = spec.status
    ?? (spec.sourceId ? "available" : missingText.includes(spec.id.replaceAll("_", " ")) ? "missing" : "unknown");
  return { ...spec, status };
}

function clinicWorkplan(plan: EvaluationPlan): ValidationWorkplan {
  const phoenix = isPhoenix(plan);
  const market = phoenix ? "Phoenix-Mesa-Chandler, AZ" : "the resolved clinic market";
  const evidence = [
    evidenceItem({
      id: "pet_demand",
      label: "Pet and customer demand",
      sourceId: null,
      expectedGrain: "CBSA or approved trade area",
      observationDate: null,
      owner: "Consumer Insights and CVC Strategy",
      allowedUse: "Market validation only; not a site score until approved",
      whyNeeded: `Test whether ${market} has sufficient pet-parent need, awareness, consideration, and Chewy demand.`,
    }, plan),
    evidenceItem({
      id: "clinic_capacity",
      label: "Clinic supply and operating capacity",
      sourceId: null,
      expectedGrain: "Clinic and approved trade area",
      observationDate: null,
      owner: "CVC Operations and Workforce Analytics",
      allowedUse: "Validation gate; not a staffing approval",
      whyNeeded: "Test appointment capacity, veterinarian availability, current coverage, and cannibalization risk.",
    }, plan),
    evidenceItem({
      id: "veterinary_supply",
      label: "Veterinary supply and competitive access",
      sourceId: null,
      expectedGrain: "Approved market or trade area",
      observationDate: null,
      owner: "CVC Strategy and Real Estate Analytics",
      allowedUse: "Descriptive validation context only",
      whyNeeded: "Understand access, competitor presence, and whether a whitespace interpretation is credible.",
    }, plan),
    evidenceItem({
      id: "property_feasibility",
      label: "Property and trade-area feasibility",
      sourceId: null,
      expectedGrain: "Candidate trade area or site",
      owner: "CVC Real Estate and Finance",
      allowedUse: "Future site-screening input only after approval",
      whyNeeded: "Test availability, access, cost, economics, and physical feasibility before any site-screening decision.",
      observationDate: null,
    }, plan),
    evidenceItem({
      id: "public_market_context",
      label: "Public Census market context",
      sourceId: "SRC-016",
      expectedGrain: "CBSA",
      observationDate: "2020-2024 ACS 5-year period",
      owner: "Market Intelligence",
      allowedUse: "Non-scored descriptive context",
      whyNeeded: "Anchor the geography and describe the market without treating households or population as pet demand.",
    }, plan),
  ];
  const workstreams = [
    {
      id: "validate-demand",
      sequence: 1,
      title: "Validate demand",
      owner: "Consumer Insights and CVC Strategy",
      action: `Request a governed demand and awareness cut for ${market} using an approved geography, population definition, period, and benchmark.`,
      evidenceIds: ["pet_demand"],
      deliverable: "A source-linked demand brief with sample, geography, period, benchmark, and contrary evidence.",
      completionCriteria: "The owner documents whether demand evidence is sufficient for market validation and records unresolved gaps.",
      kpi: "Share of required demand measures delivered at the approved geography, period, population, and benchmark.",
      validationThreshold: "All owner-required demand measures are source-linked and comparable, and the accountable owner records whether the approved expansion benchmark is met.",
      stopCondition: "Stop this workstream if the geography, population, period, benchmark, or source cannot be made comparable without imputation.",
      status: "blocked_on_evidence" as const,
    },
    {
      id: "validate-capacity-and-supply",
      sequence: 2,
      title: "Validate capacity and competitive access",
      owner: "CVC Operations, Workforce Analytics, and CVC Strategy",
      action: `Assemble ${market} clinic supply, appointment capacity, veterinarian availability, competitor access, and cannibalization evidence at an approved grain.`,
      evidenceIds: ["clinic_capacity", "veterinary_supply"],
      deliverable: "A current supply-and-capacity brief with definitions, source dates, conflicts, and feasibility limitations.",
      completionCriteria: "No material identity, geography, capacity, or competitive-access conflict remains hidden.",
      kpi: "Coverage of current clinic supply, appointment capacity, veterinarian availability, competitor access, and cannibalization checks.",
      validationThreshold: "Every required supply-and-capacity check has a current source, approved grain, documented definition, and owner disposition.",
      stopCondition: "Stop advancement if clinic identity or geography cannot be reconciled, or if an operating owner confirms a material capacity, workforce, access, or cannibalization constraint.",
      status: "blocked_on_evidence" as const,
    },
    {
      id: "validate-property-feasibility",
      sequence: 3,
      title: "Validate property feasibility",
      owner: "CVC Real Estate and Finance",
      action: `Request a bounded property and trade-area screen for ${market} without selecting a site or approving a lease.`,
      evidenceIds: ["property_feasibility"],
      deliverable: "A feasibility brief with candidate trade areas, assumptions, excluded areas, and approval gates.",
      completionCriteria: "The owner records whether the market is ready for a later site-screening review, without treating this workplan as approval.",
      kpi: "Count of candidate trade areas that clear all owner-approved property, access, cost, and feasibility gates.",
      validationThreshold: "At least one candidate trade area clears every approved feasibility gate with assumptions and exclusions documented.",
      stopCondition: "Stop property research if no candidate trade area clears an approved gate or required property/economic evidence cannot be obtained.",
      status: "requires_approval" as const,
    },
    {
      id: "produce-validation-brief",
      sequence: 4,
      title: "Produce the market-validation brief",
      owner: "CVC Strategy and Real Estate Analytics",
      action: `Combine the evidence into a human-reviewed validation brief for ${market} and record an Advance, Hold, or Stop disposition for the next research stage only.`,
      evidenceIds: ["pet_demand", "clinic_capacity", "veterinary_supply", "property_feasibility", "public_market_context"],
      deliverable: "A source-linked validation brief with evidence status, limitations, decision owner, and follow-up requests.",
      completionCriteria: "An accountable human records the validation disposition and the next research owner; no site, lease, opening, or spend decision is made here.",
      kpi: "Completion of the source-linked validation packet and accountable human research disposition.",
      validationThreshold: "All required workstreams have an evidence status and the accountable owner records Advance, Hold, or Stop for the next research stage only.",
      stopCondition: "Stop and record Hold or Stop when any required workstream is unresolved, contradictory, unapproved, or meets its stop condition.",
      status: "blocked_on_evidence" as const,
    },
  ];
  return validationWorkplanSchema.parse({
    version: "1.0.0",
    planId: plan.planId,
    title: phoenix ? "Phoenix market-validation workplan" : "Clinic-market validation workplan",
    objective: `Determine whether ${market} has enough governed demand, capacity, competitive-access, and property evidence to support a later site-screening review.`,
    accountableOwner: "CVC Strategy and Real Estate Analytics",
    proposedAction: `Run the ${market} market-validation workplan; do not recommend advancement yet.`,
    whatThisInforms: [
      `Whether ${market} is ready for a later, separately governed site-screening review`,
      "Which evidence gaps require owners, approvals, or new collection work",
      "Whether the current public-context signal survives after business evidence is added",
    ],
    evidence,
    workstreams,
    decisionRules: [
      { disposition: "advance", rule: "Only consider a later site-screening review after the required evidence is complete, owner-approved, and free of material stop conditions." },
      { disposition: "hold", rule: "Hold the validation when evidence is incomplete, incompatible, stale, contradictory, or awaiting approval." },
      { disposition: "stop", rule: "Stop the validation when governed evidence fails an owner-approved requirement or a material feasibility constraint is confirmed." },
    ],
    limitations: [
      "The current public market context is descriptive and not a clinic opportunity score.",
      "Placeholder evidence has no values and must be replaced by approved or explicitly synthetic inputs before interpretation.",
      "This workplan does not select a market, site, lease, opening, campaign, or spend action.",
    ],
  });
}

function genericWorkplan(plan: EvaluationPlan): ValidationWorkplan {
  const label = plan.capabilityId === "local_growth_test"
    ? "local growth test"
    : plan.capabilityId === "clinic_performance"
      ? "clinic performance"
      : "market validation";
  const owner = plan.capabilityId === "local_growth_test" ? "Marketing Science" : "Market Intelligence";
  const measurement = plan.perspectiveId === "marketing"
    ? {
      outcomeKpi: "Coverage of source-linked regional business outcomes and valid comparison design for each candidate market.",
      outcomeThreshold: "Each candidate market has an approved outcome, matched geography and period, documented comparator, and owner-approved measurement rule.",
      outcomeStop: "Stop before any spend recommendation if outcomes, geography, periods, or comparator design are missing, incompatible, or unapproved.",
      feasibilityKpi: "Completion of test design, budget, privacy, operational, success, rollback, and measurement guardrails.",
      feasibilityThreshold: "Every required guardrail has an accountable owner and an approved pass/fail rule before a controlled test is proposed.",
      feasibilityStop: "Stop test planning if any required guardrail lacks an owner or approved rule, or if contamination or operational feasibility cannot be bounded.",
    }
    : plan.perspectiveId === "pricing"
      ? {
        outcomeKpi: "Coverage of representative geographic price observations, reliable SKU matches, and compatible first-party business outcomes.",
        outcomeThreshold: "The owner-approved ZIP and SKU coverage gates, match-reliability gate, comparable period, and business-outcome requirement are all met.",
        outcomeStop: "Stop before any price recommendation if evidence depends on a single unrepresentative ZIP, unreliable matches, incompatible periods, or missing business outcomes.",
        feasibilityKpi: "Completion of margin, promotion, inventory, legal, customer-impact, measurement, and rollback guardrails.",
        feasibilityThreshold: "Every required pricing guardrail has an accountable owner and approved pass/fail rule before a controlled test is proposed.",
        feasibilityStop: "Stop test planning if margin, legal, inventory, customer, measurement, or rollback constraints cannot be bounded and approved.",
      }
      : {
        outcomeKpi: "Coverage of source-linked approved outcomes at the requested geography, cohort, and period.",
        outcomeThreshold: "Every required outcome is approved, comparable, and linked to the confirmed question and cohort.",
        outcomeStop: "Stop interpretation when a required outcome is absent, stale, incompatible, or unapproved.",
        feasibilityKpi: "Completion of operational, measurement, privacy, approval, and implementation checks.",
        feasibilityThreshold: "Every required feasibility check has an owner and an explicit pass/fail disposition.",
        feasibilityStop: "Stop when a required constraint or approval cannot be satisfied.",
      };
  const evidence = [
    evidenceItem({ id: "question_definition", label: "Decision question and cohort definition", sourceId: null, expectedGrain: plan.geographyGrain, observationDate: null, owner, allowedUse: "Workflow definition only", whyNeeded: "Ensure the work measures the stated question and uses a stable comparison cohort." }, plan),
    evidenceItem({ id: "approved_business_outcomes", label: "Approved business outcomes", sourceId: null, expectedGrain: plan.geographyGrain, observationDate: null, owner, allowedUse: "Requires owner approval before interpretation", whyNeeded: "Connect the context to an outcome that the accountable owner actually uses." }, plan),
    evidenceItem({ id: "execution_constraints", label: "Execution constraints and feasibility", sourceId: null, expectedGrain: plan.geographyGrain, observationDate: null, owner, allowedUse: "Validation planning only", whyNeeded: "Identify constraints that could change the proposed research path." }, plan),
  ];
  return validationWorkplanSchema.parse({
    version: "1.0.0",
    planId: plan.planId,
    title: `${label[0].toUpperCase()}${label.slice(1)} validation workplan`,
    objective: `Collect and validate the evidence needed to answer the question about ${label} without turning context into an unsupported recommendation.`,
    accountableOwner: owner,
    proposedAction: `Run the ${label} validation workplan before making a consequential business decision.`,
    whatThisInforms: ["Whether the question is answerable with approved evidence", "Which gaps require owners or approvals", "What later analysis or test would be justified"],
    evidence,
    workstreams: [
      { id: "define-validation", sequence: 1, title: "Confirm the decision and cohort", owner, action: "Confirm the decision, geography, timeframe, cohort, metric definitions, and intended output with the accountable owner.", evidenceIds: ["question_definition"], deliverable: "A confirmed evaluation brief.", completionCriteria: "The owner accepts the question and comparison definition.", kpi: "Share of required question, geography, timeframe, cohort, metric, and output definitions confirmed by the accountable owner.", validationThreshold: "All six definition elements are recorded and accepted before outcome interpretation begins.", stopCondition: "Stop if the accountable owner cannot confirm the decision, comparison cohort, geography, timeframe, or intended output.", status: "ready_to_start" },
      { id: "connect-outcomes", sequence: 2, title: "Connect approved business outcomes", owner, action: "Request the approved outcome data and record its grain, period, freshness, and allowed use.", evidenceIds: ["approved_business_outcomes"], deliverable: "A source-linked outcome evidence table or an explicit missing-data record.", completionCriteria: "The outcome is approved and comparable, or the gap is recorded as blocking.", kpi: measurement.outcomeKpi, validationThreshold: measurement.outcomeThreshold, stopCondition: measurement.outcomeStop, status: "blocked_on_evidence" },
      { id: "review-feasibility", sequence: 3, title: "Review execution feasibility", owner, action: "Document operational, measurement, privacy, approval, and implementation constraints before proposing a test or intervention.", evidenceIds: ["execution_constraints"], deliverable: "A feasibility and approval checklist.", completionCriteria: "The owner records which next research step is feasible and what remains blocked.", kpi: measurement.feasibilityKpi, validationThreshold: measurement.feasibilityThreshold, stopCondition: measurement.feasibilityStop, status: "requires_approval" },
    ],
    decisionRules: [
      { disposition: "advance", rule: "Only proceed to the next research or test stage when evidence and approvals meet the owner-defined requirements." },
      { disposition: "hold", rule: "Hold when evidence is incomplete, stale, incompatible, or awaiting approval." },
      { disposition: "stop", rule: "Stop when a required outcome, constraint, or approval cannot be satisfied." },
    ],
    limitations: ["The workplan does not create a score or authorize an action.", "Missing inputs remain missing and are not imputed."],
  });
}

export function buildValidationWorkplan(plan: EvaluationPlan): ValidationWorkplan {
  return plan.capabilityId === "clinic_site_evaluation" ? clinicWorkplan(plan) : genericWorkplan(plan);
}
