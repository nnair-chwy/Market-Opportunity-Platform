import { z } from "zod";
import type { DiscoveredColumn, DiscoveredSourceProfile, DiscoveredSourceRegistry } from "./contracts.ts";

export const FIRST_PARTY_OUTCOME_CONTRACT_VERSION = "first-party-regional-outcome-v1" as const;
export const OUTCOME_READINESS_VERSION = "first-party-outcome-readiness-v1" as const;

export const firstPartyOutcomeIdSchema = z.enum([
  "regional_orders",
  "new_customers",
  "contribution_profit",
  "clinic_capacity",
  "appointments",
  "mature_clinic_performance",
]);
export type FirstPartyOutcomeId = z.infer<typeof firstPartyOutcomeIdSchema>;

export const firstPartyOutcomeDefinitionSchema = z.object({
  id: firstPartyOutcomeIdSchema,
  label: z.string(),
  metricDefinition: z.string(),
  compatibleGeographies: z.array(z.enum(["zip", "cbsa", "dma", "state", "county", "trade_area", "drive_time", "point"])),
  requiresTime: z.boolean(),
  requiredMetricPatterns: z.array(z.string()),
  requiredContextPatterns: z.array(z.string()),
  acceptedUnits: z.array(z.string()),
  maximumSensitivity: z.literal("internal"),
  minimumAggregation: z.string(),
}).strict();
export type FirstPartyOutcomeDefinition = z.infer<typeof firstPartyOutcomeDefinitionSchema>;

const definition = (value: FirstPartyOutcomeDefinition) => firstPartyOutcomeDefinitionSchema.parse(value);

export const firstPartyOutcomeDefinitions: FirstPartyOutcomeDefinition[] = [
  definition({ id: "regional_orders", label: "Regional orders", metricDefinition: "Distinct or total completed orders observed for a bounded business period and non-national geography.", compatibleGeographies: ["zip", "cbsa", "dma", "state", "county", "trade_area"], requiresTime: true, requiredMetricPatterns: ["^(distinct_orders|order_count|total_orders|orders)$"], requiredContextPatterns: [], acceptedUnits: ["count"], maximumSensitivity: "internal", minimumAggregation: "one period x approved aggregate geography; no order, customer, or address identifiers" }),
  definition({ id: "new_customers", label: "New customers", metricDefinition: "Count of customers whose governed acquisition definition falls within the bounded period and geography.", compatibleGeographies: ["zip", "cbsa", "dma", "state", "county", "trade_area"], requiresTime: true, requiredMetricPatterns: ["^(new_customer_count|new_customers|nca|new_to_chewy|new_to_chewy_count)$"], requiredContextPatterns: [], acceptedUnits: ["count"], maximumSensitivity: "internal", minimumAggregation: "one period x approved aggregate geography; no customer identifier or address retained" }),
  definition({ id: "contribution_profit", label: "Contribution or profit", metricDefinition: "Realized aggregate contribution, contribution margin, or profit under an owner-approved cost definition.", compatibleGeographies: ["zip", "cbsa", "dma", "state", "county", "trade_area"], requiresTime: true, requiredMetricPatterns: ["^(contribution|contribution_profit|contribution_margin|profit|gross_margin)$"], requiredContextPatterns: [], acceptedUnits: ["currency_unspecified"], maximumSensitivity: "internal", minimumAggregation: "one period x approved aggregate geography and optional product cohort; privacy-safe small-cell rule required" }),
  definition({ id: "clinic_capacity", label: "Clinic capacity", metricDefinition: "Staffed or schedulable clinical capacity for an identified clinic or approved service geography and period.", compatibleGeographies: ["zip", "cbsa", "dma", "state", "county", "trade_area", "drive_time", "point"], requiresTime: true, requiredMetricPatterns: ["^(staffed_capacity|staffed_hours|appointment_slots|available_slots|capacity|vet_hours)$"], requiredContextPatterns: ["^(clinic_id|site_id|clinic)$"], acceptedUnits: ["count", "hours", "minutes"], maximumSensitivity: "internal", minimumAggregation: "one clinic or approved service geography x period; no employee schedule or patient detail" }),
  definition({ id: "appointments", label: "Appointments", metricDefinition: "Aggregate booked, completed, available, or cancelled appointment count with explicit status/type semantics.", compatibleGeographies: ["zip", "cbsa", "dma", "state", "county", "trade_area", "drive_time", "point"], requiresTime: true, requiredMetricPatterns: ["^(appointment_count|appointments|completed_appointments|booked_appointments)$"], requiredContextPatterns: [], acceptedUnits: ["count"], maximumSensitivity: "internal", minimumAggregation: "one clinic or approved aggregate geography x period x appointment dimensions; no patient identifier" }),
  definition({ id: "mature_clinic_performance", label: "Mature-clinic performance", metricDefinition: "A named clinic outcome paired with an explicit opening date, months-open measure, or approved maturity status.", compatibleGeographies: ["zip", "cbsa", "dma", "state", "county", "trade_area", "drive_time", "point"], requiresTime: true, requiredMetricPatterns: ["^(total_orders|net_sales|appointment_count|completed_appointments|contribution|clinic_performance)$"], requiredContextPatterns: ["^(clinic_id|site_id)$", "^(open_date|opening_date|months_open|maturity_status|mature_flag)$"], acceptedUnits: ["count", "currency_unspecified", "ratio"], maximumSensitivity: "internal", minimumAggregation: "one clinic x bounded performance period with approved maturity rule and peer cohort" }),
];

export const outcomeCandidateAssessmentSchema = z.object({
  outcomeId: firstPartyOutcomeIdSchema,
  status: z.enum(["ready_for_adapter", "missing_fields", "incompatible", "blocked_sensitive", "excluded"]),
  sourceId: z.string(),
  packageId: z.string(),
  matchedMetricFields: z.array(z.string()),
  matchedContextFields: z.array(z.string()),
  geography: z.string(),
  timeFields: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  warnings: z.array(z.string()),
  queryRegistration: z.enum(["candidate_for_typed_query", "not_registered"]),
}).strict();
export type OutcomeCandidateAssessment = z.infer<typeof outcomeCandidateAssessmentSchema>;

export const firstPartyOutcomeReadinessReportSchema = z.object({
  version: z.literal(OUTCOME_READINESS_VERSION),
  contractVersion: z.literal(FIRST_PARTY_OUTCOME_CONTRACT_VERSION),
  generatedAt: z.string().datetime(),
  discoveryRegistryVersion: z.string(),
  outcomes: z.array(z.object({
    outcomeId: firstPartyOutcomeIdSchema,
    label: z.string(),
    status: z.enum(["ready", "gap"]),
    readySourceIds: z.array(z.string()),
    candidateCount: z.number().int().nonnegative(),
    missingEvidence: z.array(z.string()),
    assessments: z.array(outcomeCandidateAssessmentSchema),
  }).strict()),
  adapterCandidates: z.array(z.object({
    sourceId: z.string(),
    outcomeIds: z.array(firstPartyOutcomeIdSchema),
    registrationState: z.literal("candidate_for_typed_adapter"),
    allowedQuery: z.literal("none_until_contract_review"),
  }).strict()),
  summary: z.object({
    readyOutcomeCount: z.number().int().nonnegative(),
    gapOutcomeCount: z.number().int().nonnegative(),
    adapterCandidateCount: z.number().int().nonnegative(),
    executableQueryCount: z.number().int().nonnegative(),
  }).strict(),
  conclusionBoundary: z.string(),
}).strict();
export type FirstPartyOutcomeReadinessReport = z.infer<typeof firstPartyOutcomeReadinessReportSchema>;

const normalized = (column: DiscoveredColumn) => column.normalizedName;
const anyPattern = (column: DiscoveredColumn, patterns: string[]) => patterns.some((pattern) => new RegExp(pattern).test(normalized(column)));
const directIdentifierPattern = /(^|_)(customer_id|customer_address|address_id|order_id|order_line_id|patient_id|patient_name|email|phone|street_address)($|_)/;

export function assessOutcomeCandidate(profile: DiscoveredSourceProfile, outcome: FirstPartyOutcomeDefinition): OutcomeCandidateAssessment {
  const matchedMetricColumns = profile.columns.filter((column) => anyPattern(column, outcome.requiredMetricPatterns));
  const matchedMetricFields = matchedMetricColumns.map((column) => column.name);
  const matchedContextFields = profile.columns.filter((column) => anyPattern(column, outcome.requiredContextPatterns)).map((column) => column.name);
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const directIdentifiers = profile.columns.filter((column) => directIdentifierPattern.test(column.normalizedName)).map((column) => column.name);
  if (!matchedMetricFields.length) missingRequirements.push(`metric: ${outcome.metricDefinition}`);
  else if (!matchedMetricColumns.some((column) => column.inferredUnit !== null && outcome.acceptedUnits.includes(column.inferredUnit))) missingRequirements.push(`recognized metric unit (${outcome.acceptedUnits.join(", ")})`);
  for (const pattern of outcome.requiredContextPatterns) {
    if (!profile.columns.some((column) => new RegExp(pattern).test(column.normalizedName))) missingRequirements.push(`context field matching ${pattern}`);
  }
  if (!outcome.compatibleGeographies.includes(profile.geography.grain as never)) missingRequirements.push(`compatible aggregate geography (${outcome.compatibleGeographies.join(", ")})`);
  if (outcome.requiresTime && profile.time.fields.length === 0) missingRequirements.push("bounded observation period");
  if (directIdentifiers.length) warnings.push(`Direct or row-level identifiers detected: ${directIdentifiers.join(", ")}.`);
  if (["confidential", "restricted"].includes(profile.inferredSensitivity) || directIdentifiers.length) warnings.push("Confidential, restricted, or row-level source data cannot become a regional outcome adapter; only reviewed aggregate internal data is eligible.");
  if (profile.grain.confidence === "none") missingRequirements.push("reviewable aggregate row grain");

  let status: OutcomeCandidateAssessment["status"];
  if (profile.approvalState === "excluded") status = "excluded";
  else if (["confidential", "restricted"].includes(profile.inferredSensitivity) || directIdentifiers.length) status = "blocked_sensitive";
  else if (!matchedMetricFields.length) status = "missing_fields";
  else if (missingRequirements.length) status = "incompatible";
  else status = "ready_for_adapter";

  return outcomeCandidateAssessmentSchema.parse({
    outcomeId: outcome.id,
    status,
    sourceId: profile.sourceId,
    packageId: profile.packageId,
    matchedMetricFields,
    matchedContextFields,
    geography: profile.geography.grain,
    timeFields: profile.time.fields,
    missingRequirements,
    warnings,
    queryRegistration: status === "ready_for_adapter" ? "candidate_for_typed_query" : "not_registered",
  });
}

export function buildFirstPartyOutcomeReadiness(registry: DiscoveredSourceRegistry): FirstPartyOutcomeReadinessReport {
  const outcomes = firstPartyOutcomeDefinitions.map((outcome) => {
    const assessments = registry.profiles.map((profile) => assessOutcomeCandidate(profile, outcome));
    const ready = assessments.filter((item) => item.status === "ready_for_adapter");
    return {
      outcomeId: outcome.id,
      label: outcome.label,
      status: ready.length ? "ready" as const : "gap" as const,
      readySourceIds: ready.map((item) => item.sourceId).sort(),
      candidateCount: ready.length,
      missingEvidence: ready.length ? [] : [`No approved, privacy-safe source currently satisfies the ${outcome.label.toLowerCase()} contract: ${outcome.minimumAggregation}.`],
      assessments: assessments.filter((item) => item.status !== "missing_fields" || item.matchedContextFields.length > 0),
    };
  });
  const candidateMap = new Map<string, FirstPartyOutcomeId[]>();
  for (const outcome of outcomes) for (const sourceId of outcome.readySourceIds) candidateMap.set(sourceId, [...(candidateMap.get(sourceId) ?? []), outcome.outcomeId]);
  const adapterCandidates = [...candidateMap].sort(([left], [right]) => left.localeCompare(right)).map(([sourceId, outcomeIds]) => ({ sourceId, outcomeIds, registrationState: "candidate_for_typed_adapter" as const, allowedQuery: "none_until_contract_review" as const }));
  const readyOutcomeCount = outcomes.filter((outcome) => outcome.status === "ready").length;
  return firstPartyOutcomeReadinessReportSchema.parse({
    version: OUTCOME_READINESS_VERSION,
    contractVersion: FIRST_PARTY_OUTCOME_CONTRACT_VERSION,
    generatedAt: registry.generatedAt,
    discoveryRegistryVersion: registry.version,
    outcomes,
    adapterCandidates,
    summary: { readyOutcomeCount, gapOutcomeCount: outcomes.length - readyOutcomeCount, adapterCandidateCount: adapterCandidates.length, executableQueryCount: 0 },
    conclusionBoundary: "Discovery can nominate a typed adapter candidate, but it cannot register arbitrary SQL, approve metric semantics, or expose a raw file. No query becomes executable until contract, privacy, full-file grain, quality, and source-owner review are complete.",
  });
}

export function outcomeReadinessMissingEvidence(report: FirstPartyOutcomeReadinessReport) {
  return report.outcomes.flatMap((outcome) => outcome.missingEvidence);
}
