import type { PerspectiveId } from "../perspectives/contracts.ts";

export type BusinessValueStatus = "outcome_connected" | "export_available" | "needs_geo_join" | "proxy_only" | "outcome_missing";

export type BusinessValueAssessment = {
  status: BusinessValueStatus;
  label: string;
  headline: string;
  formula: string;
  requiredInputs: string[];
  sourceIds: string[];
};

export type FirstPartyValueExport = {
  id: string;
  label: string;
  status: "available_now" | "available_partial" | "needs_geo_join" | "context_only";
  targetGrain: string;
  metrics: string[];
  valueUse: string;
  limitation: string;
  tableauUrl: string;
};

export const CHEWY_VALUE_DEFINITIONS = {
  ccp: {
    label: "Customer Contribution Profit (CCP)",
    definition: "Historical order contribution plus modeled downstream customer value, using the governed customer-value definition.",
    sourceUrl: "https://chewyinc.atlassian.net/wiki/spaces/MAR/pages/2800025682/CCP+V3.0+Customer+Equity",
  },
  ccv: {
    label: "Chewy Composite Value (CCV)",
    definition: "Twelve-month retail CCP plus transactional Ads contribution profit.",
    sourceUrl: "https://chewyinc.atlassian.net/wiki/spaces/SAA/pages/2914779250/Chewy+Composite+Value+CCV+Explainer+Document",
  },
  marketingEfficiency: {
    label: "Incremental CCP efficiency",
    definition: "Incremental CCP divided by incremental media spend; this requires a valid counterfactual and is not the same as platform-attributed ROAS or CPA.",
    sourceUrl: "https://chewyinc.atlassian.net/wiki/spaces/MMT1/pages/3747251499/CCP+DNS+tROAS+metrics+definitions",
  },
} as const;

export const TABLEAU_FIRST_PARTY_EXPORTS: readonly FirstPartyValueExport[] = [
  {
    id: "dma-marketing-outcomes",
    label: "DMA marketing spend and performance",
    status: "available_partial",
    targetGrain: "week × DMA × channel/network/campaign",
    metrics: ["spend", "orders", "engaged sessions", "bounces", "CPC", "CPM", "CPO", "CVR"],
    valueUse: "Joins regional media cost to order response so the platform can size observed efficiency and select geo-test candidates.",
    limitation: "Orders include paid and direct web traffic, exclude app traffic, and are not incremental or CCP-valued.",
    tableauUrl: "https://prod-useast-b.online.tableau.com/#/site/chewy/views/DMAPerformanceMetrics/MarketingSpendandEfficiency?:iid=1",
  },
  {
    id: "cvc-site-outcomes",
    label: "CVC site and metro performance",
    status: "available_now",
    targetGrain: "week × CVC site × metro × acquisition segment",
    metrics: ["spend", "appointments", "completed appointments", "new-to-Chewy appointments", "new-to-CVC appointments", "net sales", "net sales per completed appointment"],
    valueUse: "Sizes clinic demand and sales opportunity at the same site/metro grain used by footprint findings.",
    limitation: "Capacity, staffed appointment slots, clinic contribution and CCP are still required before footprint or spend recommendations are decision-ready.",
    tableauUrl: "https://prod-useast-b.online.tableau.com/#/site/chewy/redirect_to_view/13932416",
  },
  {
    id: "ccp-channel-value",
    label: "Marketing CCP performance",
    status: "needs_geo_join",
    targetGrain: "desired: week × DMA × channel × customer type",
    metrics: ["average CCP", "aggregate CCP", "spend", "customer type", "channel"],
    valueUse: "Replaces attributed-conversion proxies with Chewy customer contribution value.",
    limitation: "The current reviewed workbook is channel/time based; a governed DMA key or approved regional extract is still needed.",
    tableauUrl: "https://prod-useast-b.online.tableau.com/#/site/chewy/redirect_to_view/13932365",
  },
  {
    id: "new-customer-acquisition",
    label: "New-customer acquisitions by business segment",
    status: "needs_geo_join",
    targetGrain: "desired: week × DMA × business segment",
    metrics: ["new-customer acquisitions", "business segment", "country", "shipped date"],
    valueUse: "Adds a first-party customer-growth outcome so regional media findings can distinguish traffic response from customer acquisition.",
    limitation: "The reviewed view is segmented by time and business taxonomy but exposes no approved DMA field; request a governed regional extract rather than inferring geography.",
    tableauUrl: "https://prod-useast-b.online.tableau.com/#/site/chewy/redirect_to_view/14052832",
  },
  {
    id: "clinic-network-context",
    label: "Clinic network operating context",
    status: "context_only",
    targetGrain: "period × clinic/state/city",
    metrics: ["net sales", "prescriptions", "clinic count", "response and approval rates", "response and approval times"],
    valueUse: "Provides peer operating context and possible benchmarks for clinic performance.",
    limitation: "The reviewed workbook explicitly excludes CVC clinics, so it cannot be treated as a CVC first-party outcome source.",
    tableauUrl: "https://prod-useast-b.online.tableau.com/#/site/chewy/home",
  },
] as const;

export function assessBusinessValue(department: PerspectiveId): BusinessValueAssessment {
  if (department === "marketing") {
    return {
      status: "proxy_only",
      label: "Opportunity size not yet validated",
      headline: "The current data can rank a geo-test candidate, but it cannot yet estimate incremental CCP or sales lift.",
      formula: "Incremental CCP efficiency = (test-region CCP − counterfactual CCP) ÷ incremental media spend",
      requiredInputs: ["DMA spend and orders", "DMA-level CCP or approved customer-value join", "test/control counterfactual", "new-customer and contribution outcomes"],
      sourceIds: ["dma-marketing-outcomes", "ccp-channel-value", "new-customer-acquisition"],
    };
  }
  if (department === "cvc") {
    return {
      status: "export_available",
      label: "Outcome export available",
      headline: "Appointments, completed visits and net sales can size this market once the CVC site/metro export is connected.",
      formula: "Observed sales opportunity = expected incremental completed appointments × net sales per completed appointment",
      requiredInputs: ["CVC site/metro performance export", "staffed appointment capacity", "clinic contribution or CCP", "mature-clinic comparison cohort"],
      sourceIds: ["cvc-site-outcomes"],
    };
  }
  return {
    status: "outcome_missing",
    label: "Opportunity size not yet available",
    headline: "Competitor observations can identify where to investigate, but not the sales or contribution impact of a price change.",
    formula: "Contribution opportunity = projected units after price change × contribution per unit − current contribution",
    requiredInputs: ["regional Chewy orders and units", "matched SKU/category", "regional realized price and discount", "product and fulfillment cost", "elasticity or controlled-test response"],
    sourceIds: [],
  };
}
