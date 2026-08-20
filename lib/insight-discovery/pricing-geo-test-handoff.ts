import type { CurrentDataDiscoveryRun } from "./current-data-discovery.ts";

export const PRICING_GEO_TEST_HANDOFF_VERSION = "pricing-geo-test-handoff-v1" as const;

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
    title: "PetSmart/Petco Dog Food geo-test pricing handoff",
    preparedFor: "Costa Angelakis",
    recipientRole: "Channel feasibility, timing, and launch coordination",
    recommendation: "Keep the first test a clean local-demand experiment. Use PetSmart/Petco regional price and availability as market-selection and interpretation inputs; do not change Chewy price in the same cells because that would prevent the team from knowing whether media or price caused the result.",
    why: "The decision is whether a local channel overlay can create incremental Dog Food demand in PetSmart trade areas. Pricing can improve the market match and explain heterogeneous response, but the connected evidence cannot yet size a safe price move or expected contribution impact.",
    currentEvidence: [
      runHasPricingEvidence
        ? "The discovery run includes monitored competitor-offer and coverage evidence, but its current production slice is Walmart-only."
        : "The current discovery run does not contain a production-ready PetSmart/Petco pricing slice.",
      "The approved historical validation sample contains 13 Petco Dog Food observations across 9 ZIPs and 9 PetSmart observations across 7 ZIPs, observed from April 21 to May 3, 2025.",
      "That sample proves the join path exists; it is too sparse and stale to rank trade areas or recommend a live Chewy price change.",
    ],
    testDesign: {
      candidateMarkets: "Score 8–12 PetSmart trade areas using pre-period Dog Food outcomes, customer scale, trend stability, store overlap, and current matched-SKU competitor price/availability.",
      treatmentAndControl: "Select 3 treatment and 3 matched-control trade areas after 26–52 weeks of pre-period checks; preserve holdouts and suppress overlapping tests.",
      treatment: "Run the agreed local channel overlay for about 90 days while control markets remain business as usual.",
      pricingRole: "Attach a current PetSmart/Petco matched-SKU price index, availability rate, regional dispersion, Chewy margin, elasticity, and active match/override state to each candidate market.",
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
    evidenceBoundary: "This is a test-design recommendation, not approval to change price or spend. The dollar opportunity becomes measurable only after same-period first-party outcomes and contribution are joined to current PetSmart/Petco market evidence.",
    sourceIds: ["SRC-025", "SRC-028", "SRC-030", "internal-local-demand-test-design"],
  };
}
