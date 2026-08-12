import { z } from "zod";

export const DecisionLayer = z.enum([
  "market_attractiveness",
  "submarket_opportunity",
  "property_feasibility",
  "execution_priority",
]);

export const PlaybookMetric = z.object({
  metricId: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1),
  direction: z.enum(["higher-is-better", "lower-is-better", "descriptive-only"]),
  required: z.boolean(),
  scoringEligible: z.boolean(),
  sourceIds: z.array(z.string()),
});

export const PlaybookDefinition = z.object({
  playbookId: z.enum([
    "clinic_site_evaluation",
    "retail_location_evaluation",
    "local_growth_test",
    "regional_pricing",
  ]),
  version: z.string().min(1),
  decisionLayer: DecisionLayer,
  questionTemplate: z.string().min(1),
  geographyGrain: z.enum(["cbsa", "zip", "trade_area", "site", "state"]),
  metrics: z.array(PlaybookMetric),
  requiredApprovals: z.array(z.string()),
  permittedOutputs: z.array(z.string()),
  prohibitedConclusions: z.array(z.string()),
});

export const PLAYBOOK_DEFINITIONS = {
  clinic_site_evaluation: PlaybookDefinition.parse({
    playbookId: "clinic_site_evaluation",
    version: "clinic-site-evaluation-v1",
    decisionLayer: "property_feasibility",
    questionTemplate: "Which candidate clinic locations merit human review in this market?",
    geographyGrain: "site",
    metrics: [
      { metricId: "regional_customer_demand", label: "Regional customer demand", description: "Aggregate demand context linked through approved geography.", unit: "sales", direction: "higher-is-better", required: true, scoringEligible: false, sourceIds: [] },
      { metricId: "clinic_performance", label: "Comparable clinic performance", description: "Approved outcome observations at a fixed maturity window.", unit: "configured", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
      { metricId: "veterinary_supply", label: "Veterinary supply", description: "Approved clinic and workforce context.", unit: "configured", direction: "descriptive-only", required: false, scoringEligible: false, sourceIds: [] },
      { metricId: "property_feasibility", label: "Property feasibility", description: "Human-reviewed site and lease constraints.", unit: "review", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
    ],
    requiredApprovals: ["clinic outcome definition", "maturity window", "comparable cohort", "data-use approval"],
    permittedOutputs: ["evidence comparison", "warnings", "diligence questions", "review packet"],
    prohibitedConclusions: ["autonomous site selection", "lease recommendation", "opening approval"],
  }),
  retail_location_evaluation: PlaybookDefinition.parse({
    playbookId: "retail_location_evaluation",
    version: "retail-location-evaluation-v1",
    decisionLayer: "property_feasibility",
    questionTemplate: "Which retail markets or candidate properties merit human review?",
    geographyGrain: "site",
    metrics: [
      { metricId: "regional_customer_demand", label: "Regional customer demand", description: "Aggregate demand context.", unit: "sales", direction: "higher-is-better", required: true, scoringEligible: false, sourceIds: [] },
      { metricId: "competition", label: "Retail competition", description: "Approved competitor context.", unit: "count", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
      { metricId: "accessibility", label: "Accessibility", description: "Approved traffic, drive-time, and access context.", unit: "configured", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
      { metricId: "property_feasibility", label: "Property feasibility", description: "Human-reviewed property and lease evidence.", unit: "review", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
    ],
    requiredApprovals: ["retail criteria", "property evidence", "data-use approval"],
    permittedOutputs: ["market comparison", "evidence gaps", "review packet"],
    prohibitedConclusions: ["autonomous store selection", "lease recommendation"],
  }),
  local_growth_test: PlaybookDefinition.parse({
    playbookId: "local_growth_test",
    version: "local-growth-test-v1",
    decisionLayer: "execution_priority",
    questionTemplate: "Which regional customer opportunity merits a controlled growth test?",
    geographyGrain: "zip",
    metrics: [
      { metricId: "customer_demand", label: "Customer demand", description: "Aggregate demand and penetration context.", unit: "configured", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
      { metricId: "historical_response", label: "Historical response", description: "Approved campaign or test outcome evidence.", unit: "configured", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
    ],
    requiredApprovals: ["test owner", "control design", "privacy approval"],
    permittedOutputs: ["test packet", "control questions", "measurement plan"],
    prohibitedConclusions: ["causal claim without test", "automatic campaign launch"],
  }),
  regional_pricing: PlaybookDefinition.parse({
    playbookId: "regional_pricing",
    version: "regional-pricing-v1",
    decisionLayer: "execution_priority",
    questionTemplate: "Which regional pricing change merits governed analysis?",
    geographyGrain: "cbsa",
    metrics: [
      { metricId: "price_signal", label: "Price signal", description: "Approved regional price and competitor context.", unit: "configured", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
      { metricId: "demand_response", label: "Demand response", description: "Approved historical response evidence.", unit: "configured", direction: "descriptive-only", required: true, scoringEligible: false, sourceIds: [] },
    ],
    requiredApprovals: ["pricing owner", "metric definitions", "execution authority"],
    permittedOutputs: ["analysis packet", "sensitivity questions", "review route"],
    prohibitedConclusions: ["automatic price change", "override of pricing authority"],
  }),
} as const;
