import { z } from "zod";
import { perspectiveIdSchema, perspectiveViewIdSchema, type PerspectiveViewId } from "../perspectives/contracts.ts";
import { planningIntentSchema } from "./contracts.ts";

export const RECEIVING_TEAM_CATALOG_VERSION = "receiving-team-catalog-v1" as const;
export const FINDING_TEAM_ROUTING_VERSION = "finding-team-routing-v1" as const;

export const receivingTeamIdSchema = z.enum([
  "growth_marketing",
  "seo_content",
  "brand_consumer_insights",
  "pricing",
  "clinic_operations",
  "clinic_real_estate",
  "delivery_experience",
  "merchandising_category",
  "measurement_analytics",
]);
export type ReceivingTeamId = z.infer<typeof receivingTeamIdSchema>;

export const findingActionSchema = z.enum([
  "investigate_market",
  "design_controlled_test",
  "adjust_paid_media_plan",
  "create_content_brief",
  "design_message_test",
  "review_price_or_match",
  "review_clinic_capacity",
  "perform_market_site_diligence",
  "review_delivery_experience",
  "review_assortment_or_category",
  "validate_measurement_and_causality",
]);

export const receivingTeamSchema = z.object({
  id: receivingTeamIdSchema,
  label: z.string().trim().min(1),
  caresAbout: z.array(z.string().trim().min(1)).min(1),
  applicableActions: z.array(findingActionSchema).min(1),
  requiredEvidence: z.array(z.string().trim().min(1)).min(1),
  approvalBoundary: z.string().trim().min(1),
}).strict();
export type ReceivingTeam = z.infer<typeof receivingTeamSchema>;

export const receivingTeamCatalogSchema = z.object({
  version: z.literal(RECEIVING_TEAM_CATALOG_VERSION),
  teams: z.array(receivingTeamSchema).length(9),
}).strict().superRefine((catalog, ctx) => {
  const ids = catalog.teams.map((team) => team.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["teams"], message: "Receiving-team IDs must be unique." });
  for (const id of receivingTeamIdSchema.options) if (!ids.includes(id)) ctx.addIssue({ code: "custom", path: ["teams"], message: `Missing receiving team ${id}.` });
});

const team = (value: ReceivingTeam) => receivingTeamSchema.parse(value);

export const receivingTeamCatalog = receivingTeamCatalogSchema.parse({
  version: RECEIVING_TEAM_CATALOG_VERSION,
  teams: [
    team({ id: "growth_marketing", label: "Growth Marketing / Customer Growth", caresAbout: ["Local acquisition, repeat, and win-back outcomes", "Paid-media delivery, efficiency, and incrementality"], applicableActions: ["investigate_market", "design_controlled_test", "adjust_paid_media_plan"], requiredEvidence: ["Comparable campaign and customer cohorts", "Governed orders, new customers, repeat or win-back outcomes", "Attribution, lag, incrementality, contribution, and operational guardrails"], approvalBoundary: "May investigate and prepare a controlled media plan; spend, targeting, or campaign changes require the authorized channel and budget approval process." }),
    team({ id: "seo_content", label: "SEO / Content", caresAbout: ["External organic-search demand and visibility", "Geographic content questions and briefs"], applicableActions: ["investigate_market", "create_content_brief"], requiredEvidence: ["Search demand, ranking, result-page, and content-gap evidence", "Geographic applicability, query intent, seasonality, and source/license terms", "Organic traffic and downstream outcome measurement"], approvalBoundary: "May prepare a content or research brief; publication, claims, localization, and production prioritization require the responsible content and brand review." }),
    team({ id: "brand_consumer_insights", label: "Brand / Consumer Insights", caresAbout: ["Awareness, consideration, message resonance, and consumer needs", "Market-specific qualitative and survey contrasts"], applicableActions: ["investigate_market", "design_message_test"], requiredEvidence: ["Representative sample, questionnaire, weighting, and significance metadata", "Current geography, audience, message, and brand-funnel definitions", "Approved test design and interpretation boundary"], approvalBoundary: "May frame a research or message-test hypothesis; brand claims, campaign use, and broad population inference require accountable Brand and research approval." }),
    team({ id: "pricing", label: "Pricing", caresAbout: ["Competitor price, availability, coupon, and assortment evidence", "Chewy price position, economics, prior interventions, and test guardrails"], applicableActions: ["investigate_market", "design_controlled_test", "review_price_or_match"], requiredEvidence: ["Dated ZIP × competitor × SKU observations and coverage", "Matched Chewy SKU, price, promotion, cost, margin, MAP, and elasticity context", "Privacy-safe regional outcomes and prior action state"], approvalBoundary: "May review evidence, match configuration, and controlled-test design; no price, match, or override is changed without authorized Pricing controls and approval." }),
    team({ id: "clinic_operations", label: "Clinic Operations", caresAbout: ["Mature-clinic performance, appointment demand, staffed capacity, and service constraints", "Operational feasibility and readiness"], applicableActions: ["investigate_market", "review_clinic_capacity"], requiredEvidence: ["Clinic identity, opening date, maturity rule, and comparable peer cohort", "Staffed or schedulable capacity and appointment status definitions", "Performance period, quality, staffing, and operational constraints"], approvalBoundary: "May validate capacity and operating implications; staffing, schedule, service, or opening changes require authorized Operations and clinical review." }),
    team({ id: "clinic_real_estate", label: "Clinic / Real Estate", caresAbout: ["Market and site diligence", "Trade area, access, competition, property, regulatory, and physical-site constraints"], applicableActions: ["investigate_market", "perform_market_site_diligence"], requiredEvidence: ["Approved market, site, trade-area, or drive-time identity", "Demand, access, supply, workforce, property, economics, and physical inspection evidence", "Current pipeline, lease, regulatory, and accountable review state"], approvalBoundary: "May prioritize diligence and prepare a review packet; it cannot select a site, approve a lease, or authorize a clinic opening." }),
    team({ id: "delivery_experience", label: "Delivery Experience", caresAbout: ["Geographic delivery promise, fulfillment, shipping cost, reliability, and customer experience", "Operational effects that could explain conversion or retention differences"], applicableActions: ["investigate_market", "review_delivery_experience"], requiredEvidence: ["Governed delivery-promise and actual-delivery outcomes", "Fulfillment path, shipping cost, inventory, carrier, and service cohort", "Customer outcome, period, geography, and operational guardrails"], approvalBoundary: "May diagnose delivery-related signals and propose validation; promise, carrier, fulfillment, or service changes require the authorized operations process." }),
    team({ id: "merchandising_category", label: "Merchandising / Category", caresAbout: ["Assortment, category demand, availability, promotion, and SKU materiality", "Regional product and competitor conditions"], applicableActions: ["investigate_market", "review_assortment_or_category", "design_controlled_test"], requiredEvidence: ["Stable SKU and category hierarchy", "Assortment, availability, exposure, sales, promotion, and inventory evidence", "Comparable geography, period, customer outcome, and commercial guardrails"], approvalBoundary: "May review assortment or category evidence and test hypotheses; assortment, inventory, promotion, or vendor actions require authorized category processes." }),
    team({ id: "measurement_analytics", label: "Measurement / Analytics", caresAbout: ["Metric definitions, geography and time compatibility, causal validity, quality, and reproducibility", "Experiment design, thresholds, and answer completeness"], applicableActions: ["investigate_market", "validate_measurement_and_causality", "design_controlled_test"], requiredEvidence: ["Versioned source, metric, geography, period, unit, and cohort contracts", "Coverage, missingness, suppression, contradictions, and approved crosswalks", "Pre-period, comparison or test design, power, success, stop, and rollback rules"], approvalBoundary: "Validates evidence and methods as a partner; it does not own the underlying commercial, clinical, property, content, or operational action." }),
  ],
});

const teamById = new Map(receivingTeamCatalog.teams.map((entry) => [entry.id, entry]));

const PRICING_VIEWS = new Set<PerspectiveViewId>(["competitor_availability", "observed_equalized_price", "offer_observation_volume", "assortment_breadth", "price_index", "competitive_price_gaps", "promotion_intensity", "price_elasticity_context", "margin_contribution_context", "price_opportunity_by_region"]);
const MARKETING_VIEWS = new Set<PerspectiveViewId>(["paid_search_response", "paid_search_impressions", "paid_search_ctr", "paid_search_cpc", "customer_demand", "acquisition_efficiency", "campaign_reach", "conversion_booking_rate", "local_engagement", "marketing_opportunity_by_region"]);
const CVC_VIEWS = new Set<PerspectiveViewId>(["clinic_footprint", "pet_ownership", "household_demand", "access_and_pet_demand", "clinic_performance_context", "market_expansion_context"]);

export const findingTeamRoutingInputSchema = z.object({
  perspectiveId: perspectiveIdSchema,
  viewId: perspectiveViewIdSchema.nullable(),
  topic: planningIntentSchema.shape.topic,
}).strict();

export const findingTeamRouteSchema = z.object({
  version: z.literal(FINDING_TEAM_ROUTING_VERSION),
  input: findingTeamRoutingInputSchema,
  primaryTeam: z.object({ teamId: receivingTeamIdSchema, reason: z.string().trim().min(1) }).strict(),
  partnerTeams: z.array(z.object({ teamId: receivingTeamIdSchema, reason: z.string().trim().min(1) }).strict()),
  approvalBoundary: z.string().trim().min(1),
}).strict();
export type FindingTeamRoute = z.infer<typeof findingTeamRouteSchema>;

function addPartner(partners: Map<ReceivingTeamId, string>, id: ReceivingTeamId, reason: string, primary: ReceivingTeamId) {
  if (id !== primary && !partners.has(id)) partners.set(id, reason);
}

/** Deterministically routes a geo finding without inferring a named owner. */
export function routeAutonomousGeoFinding(input: z.input<typeof findingTeamRoutingInputSchema>): FindingTeamRoute {
  const parsed = findingTeamRoutingInputSchema.parse(input);
  if (parsed.viewId) {
    const valid = parsed.perspectiveId === "pricing" ? PRICING_VIEWS.has(parsed.viewId) : parsed.perspectiveId === "marketing" ? MARKETING_VIEWS.has(parsed.viewId) : CVC_VIEWS.has(parsed.viewId);
    if (!valid) throw new Error(`${parsed.viewId} does not belong to the ${parsed.perspectiveId} perspective.`);
  }
  let primary: ReceivingTeamId;
  let primaryReason: string;
  if (parsed.perspectiveId === "pricing") {
    primary = "pricing";
    primaryReason = "Pricing owns interpretation of competitor price/availability evidence and any price or match review.";
  } else if (parsed.perspectiveId === "cvc" && (parsed.topic === "clinic_performance" || parsed.viewId === "clinic_performance_context")) {
    primary = "clinic_operations";
    primaryReason = "Clinic Operations owns mature-clinic performance and capacity interpretation.";
  } else if (parsed.perspectiveId === "cvc") {
    primary = "clinic_real_estate";
    primaryReason = "Clinic / Real Estate owns market and site diligence for clinic-location findings.";
  } else if (parsed.topic === "consumer_insights") {
    primary = "brand_consumer_insights";
    primaryReason = "Brand / Consumer Insights owns awareness, message, and consumer-research interpretation.";
  } else if (parsed.viewId === "local_engagement") {
    primary = "seo_content";
    primaryReason = "SEO / Content owns external organic-demand and content-brief applicability for this local-engagement view.";
  } else {
    primary = "growth_marketing";
    primaryReason = "Growth Marketing / Customer Growth owns local acquisition, repeat, win-back, and paid-media applicability.";
  }

  const partners = new Map<ReceivingTeamId, string>();
  addPartner(partners, "measurement_analytics", "Validate definitions, compatibility, quality, causality, and completion rules.", primary);
  if (parsed.perspectiveId === "pricing") {
    addPartner(partners, "merchandising_category", "Validate SKU/category materiality, assortment, promotion, and inventory context.", primary);
    addPartner(partners, "delivery_experience", "Validate geographic fulfillment, shipping-cost, and delivery-experience explanations.", primary);
  } else if (parsed.perspectiveId === "cvc") {
    addPartner(partners, primary === "clinic_operations" ? "clinic_real_estate" : "clinic_operations", "Validate the complementary site-diligence or clinic-capacity boundary.", primary);
  } else {
    addPartner(partners, "growth_marketing", "Connect the finding to governed acquisition, repeat, win-back, and paid-media outcomes.", primary);
    if (parsed.topic === "consumer_insights" || parsed.viewId === "local_engagement") addPartner(partners, "brand_consumer_insights", "Validate awareness, audience, and message interpretation.", primary);
    if (["customer_demand", "local_engagement", "marketing_opportunity_by_region"].includes(parsed.viewId ?? "")) addPartner(partners, "seo_content", "Validate external search demand, visibility, intent, and content applicability.", primary);
    if (["acquisition_efficiency", "conversion_booking_rate", "marketing_opportunity_by_region"].includes(parsed.viewId ?? "") || parsed.topic === "local_growth") addPartner(partners, "delivery_experience", "Check whether delivery promise or experience explains conversion and retention differences.", primary);
    if (parsed.viewId === "customer_demand" || parsed.topic === "local_growth") addPartner(partners, "merchandising_category", "Validate assortment, category demand, availability, and promotion context.", primary);
  }
  return findingTeamRouteSchema.parse({
    version: FINDING_TEAM_ROUTING_VERSION,
    input: parsed,
    primaryTeam: { teamId: primary, reason: primaryReason },
    partnerTeams: [...partners].map(([teamId, reason]) => ({ teamId, reason })),
    approvalBoundary: teamById.get(primary)!.approvalBoundary,
  });
}

export function getReceivingTeam(id: ReceivingTeamId): ReceivingTeam {
  return teamById.get(receivingTeamIdSchema.parse(id))!;
}
