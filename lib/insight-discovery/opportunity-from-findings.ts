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
  if (/census|acs|esri|public/i.test(sourceId)) return "market_context";
  if (/tableau.*cvc|cvc.*outcome/i.test(sourceId)) return "clinic_outcomes";
  if (/google|paid|marketing/i.test(sourceId)) return "marketing_delivery";
  if (/pricing|zeus|competitor/i.test(sourceId)) return "competitive_pricing";
  return sourceId;
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
      evidence.push({
        evidenceId: `${finding.insightId}:source:${index}`,
        hypothesisId: definition.hypothesisId,
        regionId,
        regionName: finding.marketName,
        sourceId,
        sourceFamily: family(sourceId),
        metricId: finding.hypothesisIds[index] ?? finding.hypothesisIds[0] ?? "regional_signal",
        role: qualityRisk ? "data_quality" : "signal",
        stance: qualityRisk ? "context" : "supports",
        statement: qualityRisk ? finding.headline : finding.evidenceDetail,
        qualityStatus: qualityRisk ? "rejected" : "accepted",
        compatibilityStatus: "compatible",
        observationStart: null,
        observationEnd: null,
        value: null,
        unit: null,
        authorizationScope: null,
      });
    });
    if (finding.businessValue.status === "outcome_connected") {
      evidence.push({
        evidenceId: `${finding.insightId}:business-outcome`,
        hypothesisId: definition.hypothesisId,
        regionId,
        regionName: finding.marketName,
        sourceId: finding.businessValue.sourceIds[0] ?? finding.sourceIds[0] ?? "connected-outcome",
        sourceFamily: "first_party_outcomes",
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
