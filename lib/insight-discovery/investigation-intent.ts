import { z } from "zod";
import { publicMarkets } from "../data/public-market-ui.ts";
import {
  perspectiveIdSchema,
  perspectiveViewIdSchema,
  selectPerspectiveView,
  type PerspectiveId,
  type PerspectiveViewId,
} from "../perspectives/index.ts";
import {
  MAX_SELECTED_GEOGRAPHIC_CONTEXTS,
  type SelectedGeographicContext,
} from "../planning/geographic-context.ts";

export const DISCOVERY_INVESTIGATION_INTENT_VERSION = "discovery-investigation-intent-v1" as const;

const selectedGeographicContextSchema = z.object({
  cbsaCode: z.string().regex(/^\d{5}$/),
  cbsaName: z.string().trim().min(1).max(180),
}).strict();

export const discoveryInvestigationIntentSchema = z.object({
  schemaVersion: z.literal(DISCOVERY_INVESTIGATION_INTENT_VERSION),
  sourceInsightId: z.string().trim().min(1).max(240),
  question: z.string().trim().min(3).max(600),
  perspectiveId: perspectiveIdSchema,
  viewId: perspectiveViewIdSchema,
  selectedCbsaCodes: z.array(z.string().regex(/^\d{5}$/)).min(1).max(MAX_SELECTED_GEOGRAPHIC_CONTEXTS),
  selectedGeographicContexts: z.array(selectedGeographicContextSchema).min(1).max(MAX_SELECTED_GEOGRAPHIC_CONTEXTS),
  marketNames: z.array(z.string().trim().min(1).max(180)).min(1).max(MAX_SELECTED_GEOGRAPHIC_CONTEXTS),
}).strict().superRefine((intent, context) => {
  if (new Set(intent.selectedCbsaCodes).size !== intent.selectedCbsaCodes.length) {
    context.addIssue({ code: "custom", path: ["selectedCbsaCodes"], message: "Selected CBSA codes must be unique." });
  }
  if (intent.selectedGeographicContexts.length !== intent.selectedCbsaCodes.length) {
    context.addIssue({ code: "custom", path: ["selectedGeographicContexts"], message: "Every selected CBSA must have one geographic context." });
  }
  if (intent.marketNames.length !== intent.selectedCbsaCodes.length) {
    context.addIssue({ code: "custom", path: ["marketNames"], message: "Every selected CBSA must have one market name." });
  }
  const view = selectPerspectiveView(intent.perspectiveId, intent.viewId);
  if ("status" in view) {
    context.addIssue({ code: "custom", path: ["viewId"], message: view.reason });
  }
  intent.selectedCbsaCodes.forEach((cbsaCode, index) => {
    const market = publicMarkets.find((candidate) => candidate.cbsa_code === cbsaCode);
    if (!market) {
      context.addIssue({ code: "custom", path: ["selectedCbsaCodes", index], message: `Unknown CBSA code: ${cbsaCode}.` });
      return;
    }
    const geographicContext = intent.selectedGeographicContexts[index];
    if (geographicContext?.cbsaCode !== cbsaCode || geographicContext.cbsaName !== market.cbsa_name) {
      context.addIssue({ code: "custom", path: ["selectedGeographicContexts", index], message: "Geographic context must match the canonical CBSA registry." });
    }
    if (intent.marketNames[index] !== market.cbsa_name) {
      context.addIssue({ code: "custom", path: ["marketNames", index], message: "Market name must match the canonical CBSA registry." });
    }
  });
});

export type DiscoveryInvestigationIntent = z.infer<typeof discoveryInvestigationIntentSchema>;

const MEASURE_PHRASE_BY_VIEW: Partial<Record<PerspectiveViewId, string>> = {
  paid_search_response: "paid search response",
  paid_search_impressions: "paid search delivery",
  paid_search_ctr: "paid search click-through response",
  paid_search_cpc: "paid search click cost and attributed conversion efficiency",
  competitor_availability: "competitor availability",
  observed_equalized_price: "observed equalized competitor offer prices",
  offer_observation_volume: "competitor offer observation counts",
  assortment_breadth: "observed competitor assortment breadth",
  clinic_footprint: "clinic footprint evidence",
  clinic_performance_context: "clinic performance and capacity evidence",
  market_expansion_context: "clinic footprint and market context",
};

function joinMarketNames(names: readonly string[]) {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

export function discoveryInvestigationGeographicContexts(marketIds: readonly string[]): SelectedGeographicContext[] {
  const selectedCodes = [...new Set(marketIds)].slice(0, MAX_SELECTED_GEOGRAPHIC_CONTEXTS);
  return selectedCodes.map((cbsaCode) => {
    const market = publicMarkets.find((candidate) => candidate.cbsa_code === cbsaCode);
    if (!market) throw new Error(`Finding references unknown CBSA code ${cbsaCode}.`);
    return { cbsaCode: market.cbsa_code, cbsaName: market.cbsa_name };
  });
}

export function buildDiscoveryInvestigationQuestion(input: {
  perspectiveId: PerspectiveId;
  viewId: PerspectiveViewId;
  marketNames: readonly string[];
}) {
  const place = joinMarketNames(input.marketNames);
  const measure = MEASURE_PHRASE_BY_VIEW[input.viewId] ?? "regional evidence";
  if (input.perspectiveId === "pricing") return `Investigate regional pricing ${measure} for ${place}.`;
  if (input.perspectiveId === "cvc") return `Investigate ${measure} for ${place}.`;
  return `Investigate ${measure} for ${place}.`;
}

export function buildDiscoveryInvestigationIntent(input: {
  insightId: string;
  department: PerspectiveId;
  viewId: PerspectiveViewId;
  marketIds: readonly string[];
  question?: string;
}): DiscoveryInvestigationIntent {
  const selectedGeographicContexts = discoveryInvestigationGeographicContexts(input.marketIds);
  const selectedCbsaCodes = selectedGeographicContexts.map((context) => context.cbsaCode);
  const marketNames = selectedGeographicContexts.map((context) => context.cbsaName);
  return discoveryInvestigationIntentSchema.parse({
    schemaVersion: DISCOVERY_INVESTIGATION_INTENT_VERSION,
    sourceInsightId: input.insightId,
    question: input.question?.trim() || buildDiscoveryInvestigationQuestion({
      perspectiveId: input.department,
      viewId: input.viewId,
      marketNames,
    }),
    perspectiveId: input.department,
    viewId: input.viewId,
    selectedCbsaCodes,
    selectedGeographicContexts,
    marketNames,
  });
}

export function discoveryInvestigationIntentSearchParams(intent: DiscoveryInvestigationIntent) {
  const parsed = discoveryInvestigationIntentSchema.parse(intent);
  const params = new URLSearchParams();
  params.set("finding", parsed.sourceInsightId);
  params.set("perspective", parsed.perspectiveId);
  params.set("view", parsed.viewId);
  params.set("question", parsed.question);
  parsed.selectedCbsaCodes.forEach((cbsaCode) => params.append("cbsa", cbsaCode));
  return params;
}

export function discoveryInvestigationIntentFromSearchParams(params: URLSearchParams): DiscoveryInvestigationIntent | null {
  const sourceInsightId = params.get("finding")?.trim();
  const parsedPerspective = perspectiveIdSchema.safeParse(params.get("perspective"));
  const parsedView = perspectiveViewIdSchema.safeParse(params.get("view"));
  if (!sourceInsightId || !parsedPerspective.success || !parsedView.success) return null;
  try {
    return buildDiscoveryInvestigationIntent({
      insightId: sourceInsightId,
      department: parsedPerspective.data,
      viewId: parsedView.data,
      marketIds: params.getAll("cbsa"),
      question: params.get("question") ?? undefined,
    });
  } catch {
    return null;
  }
}
