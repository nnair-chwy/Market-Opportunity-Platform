import marketUniverseJson from "../../data/public/census/cbsa-universe/2023-07/markets.json" with { type: "json" };
import type { CbsaMarket, CbsaUniverseSnapshot } from "../data/cbsa-universe/types.ts";
import {
  sisterGeographySuggestionSchema,
  type EvaluationPlan,
  type SisterGeographySignal,
  type SisterGeographySuggestion,
} from "./contracts.ts";

const universe = marketUniverseJson as CbsaUniverseSnapshot;

/**
 * Deterministic sister-geography rule (no composite score).
 *
 * Eligibility (all required):
 * 1. Focus CBSA codes come from the validated evaluation plan geography
 *    resolution or the review-map geographic focus already derived from that
 *    result (question geography, evaluation-result measure focus, or action-plan
 *    CBSA identifiers). No substitute market is invented.
 * 2. Candidate is not in the focus selection.
 * 3. Candidate shares at least one state_code with the focus market(s).
 * 4. Candidate matches the primary focus market's cbsa_type.
 *
 * Ordering: alphabetical by cbsa_name, then cbsa_code (presentation order only).
 * Limit: up to three suggestions.
 *
 * Signals are listed separately. Shared state and matching CBSA type do not
 * imply similar demand, population, performance, or opportunity.
 */
export const SISTER_GEOGRAPHY_RULE_ID = "sister-geographies-v1-shared-state-and-cbsa-type";
export const SISTER_GEOGRAPHY_LIMIT = 3;

const marketsByCode = new Map(
  universe.markets.map((market) => [market.cbsa_code, market] as const),
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function principalCityLabel(market: CbsaMarket): string {
  return market.principal_cities[0]?.name
    ?? market.cbsa_name.split(/[-,]/)[0]?.trim()
    ?? market.cbsa_name;
}

function sharedStates(focus: readonly CbsaMarket[], candidate: CbsaMarket): string[] {
  const focusStates = new Set(focus.flatMap((market) => market.state_codes));
  return candidate.state_codes.filter((code) => focusStates.has(code));
}

function buildSignals(
  focus: readonly CbsaMarket[],
  candidate: CbsaMarket,
): SisterGeographySignal[] {
  const shared = sharedStates(focus, candidate);
  const focusType = focus[0]?.cbsa_type ?? null;
  const signals: SisterGeographySignal[] = [
    {
      id: "shared_state",
      label: "Shared state coverage",
      value: shared.length ? shared.join(", ") : null,
      status: shared.length ? "Confirmed" : "Unknown",
      sourceId: "SRC-014",
    },
    {
      id: "matching_cbsa_type",
      label: "Matching CBSA type",
      value: focusType && candidate.cbsa_type === focusType ? candidate.cbsa_type : null,
      status: focusType && candidate.cbsa_type === focusType ? "Confirmed" : "Unknown",
      sourceId: "SRC-014",
    },
  ];
  return signals;
}

function whySuggested(signals: readonly SisterGeographySignal[]): string {
  const shared = signals.find((signal) => signal.id === "shared_state");
  const type = signals.find((signal) => signal.id === "matching_cbsa_type");
  const parts: string[] = [];
  if (shared?.value) {
    parts.push(`shares state coverage (${shared.value}) with the focus geography`);
  }
  if (type?.value) {
    parts.push(`matches the focus ${type.value} CBSA type`);
  }
  if (!parts.length) {
    return "Listed only when shared-state and CBSA-type evidence is Confirmed in SRC-014.";
  }
  return `Suggested follow-up geography because it ${parts.join(" and ")}. This is not a recommendation or an equivalent substitute for the current focus.`;
}

export function suggestSisterGeographiesFromPlan(
  plan: Pick<EvaluationPlan, "geographyResolution">,
  limit = SISTER_GEOGRAPHY_LIMIT,
  focusCbsaCodes?: readonly string[],
): SisterGeographySuggestion[] {
  const focusCodes = focusCbsaCodes?.length
    ? [...focusCbsaCodes]
    : plan.geographyResolution.selectedCbsaCodes;
  if (!focusCodes.length) return [];

  const focusMarkets = focusCodes
    .map((code) => marketsByCode.get(code))
    .filter((market): market is CbsaMarket => Boolean(market));
  if (!focusMarkets.length) return [];

  const focusType = focusMarkets[0].cbsa_type;
  const focusStateSet = new Set(focusMarkets.flatMap((market) => market.state_codes));
  const focusCodeSet = new Set(focusCodes);

  return universe.markets
    .filter((market) =>
      !focusCodeSet.has(market.cbsa_code)
      && market.cbsa_type === focusType
      && market.state_codes.some((code) => focusStateSet.has(code)))
    .slice()
    .sort((left, right) =>
      left.cbsa_name.localeCompare(right.cbsa_name)
      || left.cbsa_code.localeCompare(right.cbsa_code))
    .slice(0, limit)
    .map((market) => {
      const signals = buildSignals(focusMarkets, market);
      return sisterGeographySuggestionSchema.parse({
        cbsaCode: market.cbsa_code,
        cbsaName: market.cbsa_name,
        principalCityLabel: principalCityLabel(market),
        whySuggested: whySuggested(signals),
        signals,
        evidenceStatus: "Confirmed",
        uncertainty:
          "State overlap and CBSA type matching are public delineation facts only. They do not establish similar demand, population, performance, or opportunity. Missing ACS or clinic evidence remains Unknown and is not imputed.",
        sourceIds: ["SRC-014"],
        ruleId: SISTER_GEOGRAPHY_RULE_ID,
        allowedUse: "market_context_only",
        scoringEligibility: "none",
      });
    });
}

export function focusPlaceLabelsForRewrite(
  plan: Pick<EvaluationPlan, "geographyResolution">,
): string[] {
  const labels: string[] = [];
  for (const place of plan.geographyResolution.places) {
    if (place.status !== "resolved") continue;
    if (place.requestedName) labels.push(place.requestedName);
    if (place.cbsaName) labels.push(place.cbsaName);
    const market = place.cbsaCode ? marketsByCode.get(place.cbsaCode) : undefined;
    if (market) {
      labels.push(principalCityLabel(market));
      for (const city of market.principal_cities) labels.push(city.name);
      const lead = market.cbsa_name.split(/[-,]/)[0]?.trim();
      if (lead) labels.push(lead);
    }
  }
  for (const code of plan.geographyResolution.selectedCbsaCodes) {
    const market = marketsByCode.get(code);
    if (!market) continue;
    labels.push(market.cbsa_name, principalCityLabel(market));
    for (const city of market.principal_cities) labels.push(city.name);
  }
  const unique = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  return unique.sort((left, right) => right.length - left.length || left.localeCompare(right));
}

export function buildSisterFollowUpQuestion(
  originalQuestion: string,
  focusPlaceLabels: readonly string[],
  sister: Pick<SisterGeographySuggestion, "cbsaName" | "principalCityLabel">,
): string {
  const source = originalQuestion.trim();
  let rewritten = source;
  let replaced = false;
  for (const label of focusPlaceLabels) {
    if (label.length < 3) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(label)}\\b`, "i");
    if (!pattern.test(rewritten)) continue;
    rewritten = rewritten.replace(pattern, sister.principalCityLabel);
    replaced = true;
    break;
  }
  if (!replaced) {
    const base = source.replace(/[?]+$/, "").trim();
    rewritten = `${base} for ${sister.cbsaName}?`;
  }
  if (!/[?]$/.test(rewritten)) rewritten = `${rewritten}?`;
  return rewritten.replace(/\s+/g, " ").trim();
}
