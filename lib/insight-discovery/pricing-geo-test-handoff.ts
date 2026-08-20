import type { CurrentDataDiscoveryRun } from "./current-data-discovery.ts";

export const PRICING_GEO_TEST_HANDOFF_VERSION = "pricing-geo-test-handoff-v2" as const;

export type PricingGeoTestHandoff = {
  version: typeof PRICING_GEO_TEST_HANDOFF_VERSION;
  title: string;
  preparedFor: string;
  recipientRole: string;
  recommendation: string;
  why: string;
  currentEvidence: string[];
  testDesign: {
    candidateMarkets: string;
    treatmentAndControl: string;
    treatment: string;
    pricingRole: string;
    confoundRule: string;
  };
  primaryOutcomes: string[];
  secondaryOutcomes: string[];
  pricingInputsRequired: string[];
  decisionRules: {
    scale: string;
    iterate: string;
    pause: string;
  };
  owners: Array<{ workstream: string; owner: string }>;
  evidenceBoundary: string;
  sourceIds: string[];
};

/**
 * A decision handoff for the active PetSmart/Petco Dog Food geo test. The
 * design is intentionally cross-team: regional pricing evidence helps select
 * and interpret markets, but a price change is not mixed into the demand test.
 */
export function buildPricingGeoTestHandoff(run?: Pick<CurrentDataDiscoveryRun, "sourceIds">): PricingGeoTestHandoff {
  const runHasPricingEvidence = run?.sourceIds.some((sourceId) => ["SRC-025", "SRC-028", "SRC-030"].includes(sourceId)) ?? false;
  return {
    version: PRICING_GEO_TEST_HANDOFF_VERSION,
    title: "What pricing evidence means for the PetSmart/Petco Dog Food geo test",
    preparedFor: "Costa Angelakis",
    recipientRole: "Channel feasibility, timing, and launch coordination",
    recommendation: "Do not use the current competitor-pricing extract to choose PetSmart trade areas or add a price treatment. Select the first test markets on pre-period Dog Food demand, customer scale, trend stability, and store overlap; hold Chewy pricing stable so the test can identify the channel effect.",
    why: "The current PetSmart and Petco Dog Food samples contain zero overlapping SKUs, while the current production feed is Walmart-only and shows little geographic price variation. Pricing is therefore not a supported explanation for market differences in this test yet. A refreshed, fixed matched basket can be added as a stratification field without turning price into a second treatment.",
    currentEvidence: [
      runHasPricingEvidence
        ? "The discovery run includes monitored competitor-offer and coverage evidence, but its current production slice is Walmart-only."
        : "The current discovery run does not contain a production-ready PetSmart/Petco pricing slice.",
      "The approved historical sample contains 13 Petco Dog Food observations across 9 ZIPs and 9 PetSmart observations across 7 ZIPs from April 21 to May 3, 2025, with zero overlapping Dog Food SKUs between the two retailers.",
      "In the current Walmart Dog Food feed, 58.2% of observed offers are within $0.01 of Chewy price and 70.5% of sufficiently observed SKUs have one Walmart price across all sampled ZIPs. Current price level is therefore mostly a national SKU signal, not a useful regional treatment selector.",
    ],
    testDesign: {
      candidateMarkets: "Score 8–12 PetSmart trade areas using pre-period Dog Food outcomes, customer scale, trend stability, store overlap, and current matched-SKU competitor price/availability.",
      treatmentAndControl: "Select 3 treatment and 3 matched-control trade areas after 26–52 weeks of pre-period checks; preserve holdouts and suppress overlapping tests.",
      treatment: "Run the agreed local channel overlay for about 90 days while control markets remain business as usual.",
      pricingRole: "Use a refreshed fixed PetSmart/Petco Dog Food basket to stratify otherwise comparable markets and explain response differences. Do not let unmatched retailer samples or Walmart-only data determine treatment selection.",
      confoundRule: "Hold Chewy base price and pricing policy stable in treatment and control cells. If a pricing hypothesis remains, register it as a separate test with its own control and power calculation.",
    },
    primaryOutcomes: ["Incremental Dog Food orders", "Incremental Dog Food sales", "Incremental contribution after media cost"],
    secondaryOutcomes: ["New-to-Dog-Food customers", "Reactivated Dog Food customers", "First-to-second order conversion", "Autoship signups", "Gross profit per order"],
    pricingInputsRequired: [
      "Current PetSmart and Petco matched-SKU landed prices and availability by test ZIP",
      "Chewy item price, unit margin or contribution, elasticity, and expected unit response",
      "Active match, override, promotion, package-equivalence, and freshness state",
      "Same-period Dog Food orders, new customers, sales, contribution, and Autoship by trade area",
    ],
    decisionRules: {
      scale: "Expand only when matched-control lift is positive on Dog Food orders and contribution after media cost, with no material deterioration in retention, Autoship, or margin.",
      iterate: "Change audience, creative, channel mix, or offer when demand lift is directional but contribution or customer quality misses the pre-registered hurdle.",
      pause: "Stop when lift is not distinguishable from the control, contribution is negative, test contamination is material, or current competitor coverage is insufficient to interpret the market.",
    },
    owners: [
      { workstream: "Channel feasibility, timing, and launch coordination", owner: "Costa Angelakis / Growth Marketing" },
      { workstream: "Test design, power, controls, and readout", owner: "MSO Measurement / Testing" },
      { workstream: "Matched-SKU regional evidence and pricing guardrails", owner: "Pricing Analytics / Pricing Ops" },
      { workstream: "Dog Food outcomes and contribution", owner: "Customer Growth / Finance data owners" },
    ],
    evidenceBoundary: "Shareable conclusion: current pricing evidence does not support a regional price action or market ranking for this test. It supports keeping price stable and refreshing a matched basket for interpretation. Dollar opportunity still requires same-period orders, new customers, units, and contribution.",
    sourceIds: ["SRC-025", "SRC-028", "SRC-030", "internal-local-demand-test-design"],
  };
}
