import {
  compare_cohort,
  DETERMINISTIC_OPERATOR_VERSION,
} from "../evaluation-operators.ts";
import type { CbsaAcsMetricKey } from "../data/cbsa-acs/types.ts";
import {
  geographicFocusSchema,
  type EvaluationPlan,
  type GeographicFocus,
  type PlanningIntent,
} from "./contracts.ts";

export type GeographicFocusMarket = {
  cbsa_code: string;
  cbsa_name: string;
  cbsa_type: "metropolitan" | "micropolitan";
  geometry_status: "available" | "missing";
  acs: {
    metrics: Partial<
      Record<
        CbsaAcsMetricKey,
        {
          raw_value: number | null;
          evidence_status: "Confirmed" | "Derived";
        }
      >
    >;
  } | null;
};

const FOCUS_COMPARISON_VERSION = "review-map-focus-v1" as const;

function measureKey(
  measure: PlanningIntent["requestedMeasure"],
): CbsaAcsMetricKey | null {
  if (measure === "none") return null;
  return measure;
}

function marketNames(
  codes: readonly string[],
  markets: readonly GeographicFocusMarket[],
) {
  return codes
    .map((code) => markets.find((market) => market.cbsa_code === code)?.cbsa_name ?? code)
    .join("; ");
}

function deriveEvaluationResultFocus(
  plan: Pick<EvaluationPlan, "intent" | "capabilityId" | "status">,
  markets: readonly GeographicFocusMarket[],
): GeographicFocus | null {
  const metric = measureKey(plan.intent.requestedMeasure);
  if (
    !metric
    || plan.capabilityId !== "census_market_context"
    || plan.status !== "executable"
  ) {
    return null;
  }

  const candidates = markets.filter((market) =>
    market.cbsa_type === "metropolitan"
    && market.geometry_status === "available"
    && market.acs?.metrics[metric]?.raw_value != null);

  if (!candidates.length) return null;

  const ranked = compare_cohort({
    operatorVersion: DETERMINISTIC_OPERATOR_VERSION,
    decisionLayer: "market_attractiveness",
    comparisonVersion: FOCUS_COMPARISON_VERSION,
    cohortId: `review-focus-${metric}`,
    direction: "higher_is_better",
    entities: candidates.map((market) => ({
      entityId: market.cbsa_code,
      cohortId: `review-focus-${metric}`,
      value: market.acs!.metrics[metric]!.raw_value!,
      provenance: {
        sourceIds: ["SRC-016"],
        inputVersion: "cbsa-acs-2024",
        transformationVersion: FOCUS_COMPARISON_VERSION,
      },
    })),
  });

  const top = ranked[0];
  if (!top) return null;
  const market = candidates.find((item) => item.cbsa_code === top.entityId);
  if (!market) return null;

  const measureLabel = metric.replaceAll("_", " ");
  return geographicFocusSchema.parse({
    state: "focused",
    source: "evaluation_result",
    cbsaCodes: [market.cbsa_code],
    label: market.cbsa_name,
    evidenceStatus: "Derived",
    message:
      `Map focus derived from the deterministic ${measureLabel} comparison `
      + `(rank ${top.rank} of ${ranked.length} metropolitan markets with observed values). `
      + "Public context only; not a recommendation or opportunity score.",
  });
}

function actionPlanFocusCodes(plan: Pick<EvaluationPlan, "actions">) {
  const codes = new Set<string>();
  for (const action of plan.actions) {
    for (const item of [...action.evidence, action.summary, action.nextStep]) {
      for (const match of item.matchAll(/\bCBSA\s+(\d{5})\b/gi)) {
        codes.add(match[1]);
      }
    }
  }
  return [...codes].sort((left, right) => left.localeCompare(right)).slice(0, 5);
}

/**
 * Deterministic review-map focus. Never invents a CBSA when resolution is unreliable.
 */
export function resolveGeographicFocus(
  plan: Pick<
    EvaluationPlan,
    "intent" | "geographyResolution" | "capabilityId" | "status" | "actions"
  >,
  markets: readonly GeographicFocusMarket[],
): GeographicFocus {
  const geography = plan.geographyResolution;

  if (
    (geography.mode === "single" || geography.mode === "compare")
    && geography.selectedCbsaCodes.length > 0
  ) {
    const available = geography.selectedCbsaCodes.filter((code) =>
      markets.some((market) =>
        market.cbsa_code === code && market.geometry_status === "available"));
    if (available.length) {
      return geographicFocusSchema.parse({
        state: "focused",
        source: "question_geography",
        cbsaCodes: available,
        label: marketNames(available, markets),
        evidenceStatus: "Confirmed",
        message: geography.message,
      });
    }
    return geographicFocusSchema.parse({
      state: "fallback",
      source: "unavailable",
      cbsaCodes: [],
      label: "Geographic focus unavailable",
      evidenceStatus: "Unknown",
      message:
        "The question named a market, but compatible CBSA boundary geometry is not available for map focus. No substitute location was invented.",
    });
  }

  if (geography.mode === "clarification" || geography.mode === "unavailable") {
    return geographicFocusSchema.parse({
      state: "fallback",
      source: "unavailable",
      cbsaCodes: [],
      label: "Geographic focus unavailable",
      evidenceStatus: "Unknown",
      message: geography.message,
    });
  }

  if (geography.mode === "national" || geography.mode === "needs_selection") {
    const derived = deriveEvaluationResultFocus(plan, markets);
    if (derived) return derived;

    const actionCodes = actionPlanFocusCodes(plan).filter((code) =>
      markets.some((market) =>
        market.cbsa_code === code && market.geometry_status === "available"));
    if (actionCodes.length) {
      return geographicFocusSchema.parse({
        state: "focused",
        source: "action_plan",
        cbsaCodes: actionCodes,
        label: marketNames(actionCodes, markets),
        evidenceStatus: "Derived",
        message:
          "Map focus taken from CBSA identifiers already present in the governed action packet. Context only; not a recommendation.",
      });
    }
  }

  return geographicFocusSchema.parse({
    state: "fallback",
    source: "unavailable",
    cbsaCodes: [],
    label: "Geographic focus unavailable",
    evidenceStatus: "Unknown",
    message:
      "No reliable focus geography could be resolved from the question, evaluation result, or action packet. Showing the labeled fallback map state instead of inventing a location.",
  });
}
