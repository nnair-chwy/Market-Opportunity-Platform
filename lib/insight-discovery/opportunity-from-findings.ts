import type { PerspectiveId } from "../perspectives/contracts.ts";
import type { AutonomousInsight } from "./current-data-discovery.ts";
import {
  runIterativeCrossSourceDiscovery,
  type IterativeDiscoveryRun,
} from "./iterative-discovery-loop.ts";
import type { CrossSourceHypothesisDefinition, RegionalOpportunityEvidence } from "./cross-source-opportunity.ts";

const DEFINITION: Record<PerspectiveId, CrossSourceHypothesisDefinition> = {
  marketing: { hypothesisId: "marketing-regional-growth", department: "marketing", title: "Regional growth opportunity in {region}", decisionQuestionTemplate: "Which bounded marketing action, if any, should change in {region}?", hypothesisTemplate: "{region} may support more efficient incremental customer growth when media, customer outcomes, and operating context are considered together.", businessOutcome: "incremental orders, new customers, and contribution", receivingTeamId: "growth_marketing", materialLever: "paid_media", minimumSourceFamilies: 2 },
  pricing: { hypothesisId: "pricing-regional-value", department: "pricing", title: "Regional pricing opportunity in {region}", decisionQuestionTemplate: "Should price, promotion, or matching strategy change in {region}?", hypothesisTemplate: "{region} may support a different pricing strategy when matched product economics, customer response, and competitor context agree.", businessOutcome: "incremental contribution after unit response", receivingTeamId: "pricing", materialLever: "price", minimumSourceFamilies: 2 },
  cvc: { hypothesisId: "cvc-regional-growth", department: "cvc", title: "Regional clinic opportunity in {region}", decisionQuestionTemplate: "Should clinic capacity, demand generation, or footprint planning change in {region}?", hypothesisTemplate: "{region} may support a clinic intervention when demand, completed appointments, capacity, and economics agree.", businessOutcome: "incremental completed appointments and clinic contribution", receivingTeamId: "clinic_operations", materialLever: "clinic_footprint", minimumSourceFamilies: 2 },
};

function family(sourceId: string) {
  if (/SRC-0(?:14|15|16|17)|census|acs|esri|public|AVMA|PDS/i.test(sourceId)) return "market_context";
  if (/SRC-009|clinic.*footprint/i.test(sourceId)) return "clinic_footprint";
  if (/SRC-018|google|paid|marketing/i.test(sourceId)) return "marketing_delivery";
  if (/SRC-02(?:5|6|7|8|9)|SRC-030|pricing|zeus|competitor/i.test(sourceId)) return "competitive_pricing";
  if (/tableau.*cvc|cvc.*outcome/i.test(sourceId)) return "clinic_outcomes";
  return sourceId;
}

function sourceRole(finding: AutonomousInsight, sourceId: string) {
  if (family(sourceId) === "market_context") return "context" as const;
  return finding.decisionValue.flags.includes("coverage_risk") ? "data_quality" as const : "signal" as const;
}

export function buildOpportunityRunFromFindings(input: {
  runId: string;
  generatedAt: string;
  findings: AutonomousInsight[];
  previousRun?: IterativeDiscoveryRun | null;
}) {
  const evidence: RegionalOpportunityEvidence[] = [];
  for (const finding of input.findings) {
    const definition = DEFINITION[finding.department];
    const regionId = finding.marketIds[0] ?? finding.insightId;
    finding.sourceIds.forEach((sourceId, index) => {
      const qualityRisk = finding.decisionValue.flags.includes("coverage_risk");
      const role = sourceRole(finding, sourceId);
      evidence.push({
        evidenceId: `${finding.insightId}:source:${index}`,
        hypothesisId: definition.hypothesisId,
        regionId,
        regionName: finding.marketName,
        sourceId,
        sourceFamily: family(sourceId),
        metricId: finding.hypothesisIds[index] ?? finding.hypothesisIds[0] ?? "regional_signal",
        role,
        stance: qualityRisk || role === "context" ? "context" : "supports",
        statement: qualityRisk
          ? finding.headline
          : role === "context"
            ? `${finding.marketName} public market context was used only to define the comparable regional peer set.`
            : finding.evidenceDetail,
        qualityStatus: qualityRisk ? "rejected" : "accepted",
        compatibilityStatus: "compatible",
        observationStart: null,
        observationEnd: null,
        value: null,
        unit: null,
        authorizationScope: null,
      });
    });
    if (finding.department === "marketing" && finding.decisionValue.flags.includes("cross_measure_contradiction")) {
      const deliverySourceId = finding.sourceIds.find((sourceId) => family(sourceId) === "marketing_delivery");
      if (deliverySourceId) evidence.push({
        evidenceId: `${finding.insightId}:cross-measure-pattern`,
        hypothesisId: definition.hypothesisId,
        regionId,
        regionName: finding.marketName,
        sourceId: deliverySourceId,
        sourceFamily: family(deliverySourceId),
        metricId: "within_source_cross_measure_pattern",
        role: "signal",
        stance: "supports",
        statement: `${finding.marketName} has a decision-relevant contrast across multiple Google Ads funnel measures in the same source. This is corroboration across measures, not across independent sources.`,
        qualityStatus: "accepted",
        compatibilityStatus: "compatible",
        observationStart: null,
        observationEnd: null,
        value: null,
        unit: null,
        authorizationScope: null,
      });
    }
    if (finding.department === "cvc" && finding.decisionValue.flags.includes("capacity_validation")) {
      const footprintSourceId = finding.sourceIds.find((sourceId) => family(sourceId) === "clinic_footprint");
      if (footprintSourceId) evidence.push({
        evidenceId: `${finding.insightId}:derived-footprint-load`,
        hypothesisId: definition.hypothesisId,
        regionId,
        regionName: finding.marketName,
        sourceId: footprintSourceId,
        sourceFamily: family(footprintSourceId),
        metricId: "derived_households_per_published_clinic",
        role: "signal",
        stance: "supports",
        statement: `${finding.marketName}'s households-per-published-clinic contrast is derived from published clinic footprint and Census households. It is a demand-pressure screen, not capacity or clinic economics.`,
        qualityStatus: "accepted",
        compatibilityStatus: "compatible",
        observationStart: null,
        observationEnd: null,
        value: null,
        unit: null,
        authorizationScope: null,
      });
    }
    if (finding.businessValue.status === "outcome_connected") {
      evidence.push({
        evidenceId: `${finding.insightId}:business-outcome`,
        hypothesisId: definition.hypothesisId,
        regionId,
        regionName: finding.marketName,
        sourceId: finding.businessValue.sourceIds[0] ?? finding.sourceIds[0] ?? "connected-outcome",
        sourceFamily: family(finding.businessValue.sourceIds[0] ?? finding.sourceIds[0] ?? "connected-outcome"),
        metricId: "connected_business_outcome",
        role: "business_outcome",
        stance: "supports",
        statement: finding.valueTranslation.statement,
        qualityStatus: "accepted",
        compatibilityStatus: "compatible",
        observationStart: null,
        observationEnd: null,
        value: null,
        unit: null,
        authorizationScope: null,
      });
    }
  }
  return runIterativeCrossSourceDiscovery({
    runId: `${input.runId}:opportunities`,
    generatedAt: input.generatedAt,
    definitions: Object.values(DEFINITION),
    evidence,
    previousRun: input.previousRun,
  });
}

export function opportunityForFinding(run: IterativeDiscoveryRun, finding: AutonomousInsight) {
  const hypothesisId = DEFINITION[finding.department].hypothesisId;
  const regionId = finding.marketIds[0] ?? finding.insightId;
  return run.opportunities.find((item) => item.hypothesisId === hypothesisId && item.regionId === regionId) ?? null;
}
