import { z } from "zod";
import type { EvidenceStatus } from "../data/types.ts";
import type {
  AllowedUse,
  MapPresentation,
  PerspectiveMeasureId,
  ScoringEligibility,
} from "./contracts.ts";

export const MAP_VIEW_MODES = ["single", "compare", "layer"] as const;
export const mapViewModeSchema = z.enum(MAP_VIEW_MODES);
export type MapViewMode = z.infer<typeof mapViewModeSchema>;

export const APPROVED_MAP_LAYER_IDS = [
  "active_measure",
  "workflow_category",
  "current_locations",
  "public_context",
  "non_scored_unavailable",
] as const;
export const approvedMapLayerIdSchema = z.enum(APPROVED_MAP_LAYER_IDS);
export type ApprovedMapLayerId = z.infer<typeof approvedMapLayerIdSchema>;

export type ApprovedMapLayer = {
  layerId: ApprovedMapLayerId;
  label: string;
  legendLabel: string;
  sourceIds: readonly string[];
  vintage: string;
  evidenceStatus: EvidenceStatus;
  evidenceAvailability: "available" | "unavailable" | "evidence_needed";
  allowedUse: AllowedUse;
  scoringEligibility: ScoringEligibility;
  descriptiveOnly: boolean;
  evidenceBoundary: string;
  visuallyDistinctFromScoredMeasures: true;
  contributesToHiddenScore: false;
};

export type ComparisonFingerprint = {
  geographyGrain: string;
  measureId: PerspectiveMeasureId;
  sourceKey: string;
  vintage: string;
  cohortId: string;
};

export type ComparisonAddResult = {
  allowed: boolean;
  reason: string | null;
};

export const MAX_COMPARISON_REGIONS = 5;

const APPROVED_MAP_LAYERS: Record<ApprovedMapLayerId, ApprovedMapLayer> = {
  active_measure: {
    layerId: "active_measure",
    label: "Active measure",
    legendLabel: "Active regional measure",
    sourceIds: ["presentation"],
    vintage: "view-bound",
    evidenceStatus: "Confirmed",
    evidenceAvailability: "available",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
    descriptiveOnly: false,
    evidenceBoundary:
      "The active measure is displayed alone. It is not blended with other layers into a hidden score.",
    visuallyDistinctFromScoredMeasures: true,
    contributesToHiddenScore: false,
  },
  workflow_category: {
    layerId: "workflow_category",
    label: "Workflow or category",
    legendLabel: "Workflow category context",
    sourceIds: ["SYN-MARKET-WORKFLOW-01"],
    vintage: "workflow-v1",
    evidenceStatus: "Hypothesis",
    evidenceAvailability: "available",
    allowedUse: "synthetic_prototype_only",
    scoringEligibility: "none",
    descriptiveOnly: true,
    evidenceBoundary:
      "Workflow categories are descriptive routing context only and do not alter deterministic scoring inputs.",
    visuallyDistinctFromScoredMeasures: true,
    contributesToHiddenScore: false,
  },
  current_locations: {
    layerId: "current_locations",
    label: "Current locations",
    legendLabel: "Current clinic locations",
    sourceIds: ["SRC-009"],
    vintage: "public-clinic-directory",
    evidenceStatus: "Confirmed",
    evidenceAvailability: "available",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
    descriptiveOnly: true,
    evidenceBoundary:
      "Current location pins are public context only. Visibility does not change measure values or rankings.",
    visuallyDistinctFromScoredMeasures: true,
    contributesToHiddenScore: false,
  },
  public_context: {
    layerId: "public_context",
    label: "Public context",
    legendLabel: "Public Census market context",
    sourceIds: ["SRC-016"],
    vintage: "acs-2024-5yr",
    evidenceStatus: "Confirmed",
    evidenceAvailability: "available",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
    descriptiveOnly: true,
    evidenceBoundary:
      "Public Census data remains market context only. It is not a business recommendation or universal opportunity score.",
    visuallyDistinctFromScoredMeasures: true,
    contributesToHiddenScore: false,
  },
  non_scored_unavailable: {
    layerId: "non_scored_unavailable",
    label: "Non-scored or unavailable",
    legendLabel: "Non-scored / unavailable regions",
    sourceIds: ["SRC-016"],
    vintage: "view-bound",
    evidenceStatus: "Unknown",
    evidenceAvailability: "available",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
    descriptiveOnly: true,
    evidenceBoundary:
      "Missing or unscored regions stay visibly unavailable. Null values are never converted to zero.",
    visuallyDistinctFromScoredMeasures: true,
    contributesToHiddenScore: false,
  },
};

export function listApprovedMapLayers(): readonly ApprovedMapLayer[] {
  return APPROVED_MAP_LAYER_IDS.map((layerId) => APPROVED_MAP_LAYERS[layerId]);
}

export function resolveApprovedMapLayer(
  layerId: string,
): ApprovedMapLayer | { status: "unsupported"; reason: string } {
  const parsed = approvedMapLayerIdSchema.safeParse(layerId);
  if (!parsed.success) {
    return {
      status: "unsupported",
      reason: `Layer "${layerId}" is not an approved regional data layer.`,
    };
  }
  return APPROVED_MAP_LAYERS[parsed.data];
}

export function createDefaultLayerVisibility(): Record<ApprovedMapLayerId, boolean> {
  return {
    active_measure: true,
    workflow_category: true,
    current_locations: true,
    public_context: true,
    non_scored_unavailable: true,
  };
}

export function resolveLayerForPresentation(
  layerId: ApprovedMapLayerId,
  presentation: MapPresentation,
): ApprovedMapLayer | { status: "unsupported"; reason: string } {
  const base = resolveApprovedMapLayer(layerId);
  if ("status" in base) return base;

  if (layerId === "active_measure") {
    if (presentation.evidenceAvailability !== "available") {
      return {
        status: "unsupported",
        reason: presentation.emptyState.message,
      };
    }
    return {
      ...base,
      sourceIds: presentation.sourceIds,
      vintage:
        presentation.mapBinding.kind === "census_percentile"
          ? "acs-2024-5yr"
          : presentation.mapBinding.kind === "clinic_locations"
            ? "public-clinic-directory"
            : "unavailable",
      evidenceStatus:
        presentation.evidenceAvailability === "available" ? "Confirmed" : "Unknown",
      evidenceAvailability: presentation.evidenceAvailability,
      allowedUse: presentation.allowedUse,
      scoringEligibility: presentation.scoringEligibility,
      descriptiveOnly: presentation.scoringEligibility === "none",
      evidenceBoundary: presentation.evidenceBoundary,
    };
  }

  if (layerId === "current_locations" && !presentation.supportsLayerMode) {
    return {
      status: "unsupported",
      reason: "Current locations are not approved for this view's layer mode.",
    };
  }

  if (
    layerId === "public_context" &&
    presentation.mapBinding.kind !== "census_percentile" &&
    presentation.allowedUse !== "market_context_only"
  ) {
    return {
      status: "unsupported",
      reason: "Public context is unavailable for this perspective view.",
    };
  }

  return base;
}

export function buildComparisonFingerprint(input: {
  presentation: MapPresentation;
  geographyGrain: string;
  vintage: string;
  cohortId: string;
}): ComparisonFingerprint {
  return {
    geographyGrain: input.geographyGrain,
    measureId: input.presentation.measureId,
    sourceKey: [...input.presentation.sourceIds].sort().join("|"),
    vintage: input.vintage,
    cohortId: input.cohortId,
  };
}

export function fingerprintsCompatible(
  left: ComparisonFingerprint,
  right: ComparisonFingerprint,
): boolean {
  return (
    left.geographyGrain === right.geographyGrain &&
    left.measureId === right.measureId &&
    left.sourceKey === right.sourceKey &&
    left.vintage === right.vintage &&
    left.cohortId === right.cohortId
  );
}

export function canAddRegionToComparison(input: {
  regionId: string | null | undefined;
  selectedRegionIds: readonly string[];
  activeFingerprint: ComparisonFingerprint;
  candidateFingerprint: ComparisonFingerprint | null;
}): ComparisonAddResult {
  if (!input.regionId) {
    return { allowed: false, reason: "Select a visible region before comparing." };
  }
  if (input.selectedRegionIds.includes(input.regionId)) {
    return { allowed: false, reason: "This region is already in the comparison." };
  }
  if (input.selectedRegionIds.length >= MAX_COMPARISON_REGIONS) {
    return {
      allowed: false,
      reason: "A comparison can include up to five regions.",
    };
  }
  if (!input.candidateFingerprint) {
    return {
      allowed: false,
      reason: "Comparison requires a compatible geography, measure, source, vintage, and cohort.",
    };
  }
  if (!fingerprintsCompatible(input.activeFingerprint, input.candidateFingerprint)) {
    return {
      allowed: false,
      reason:
        "Comparison requires matching geography, measure, source, vintage, and cohort.",
    };
  }
  return { allowed: true, reason: null };
}

export function appendComparisonRegion(
  selectedRegionIds: readonly string[],
  regionId: string,
): string[] {
  if (
    selectedRegionIds.includes(regionId) ||
    selectedRegionIds.length >= MAX_COMPARISON_REGIONS
  ) {
    return [...selectedRegionIds];
  }
  return [...selectedRegionIds, regionId];
}

export function removeComparisonRegion(
  selectedRegionIds: readonly string[],
  regionId: string,
): string[] {
  return selectedRegionIds.filter((code) => code !== regionId);
}

export function clearComparisonRegions(): string[] {
  return [];
}

export function formatNullableMeasureValue(
  value: number | null | undefined,
  formatter: (value: number) => string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }
  return formatter(value);
}

export function preserveMissingNumeric(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function layerVisibilityChangesScoringInputs(
  previous: Readonly<Record<ApprovedMapLayerId, boolean>>,
  next: Readonly<Record<ApprovedMapLayerId, boolean>>,
): boolean {
  void previous;
  void next;
  // Layer visibility never mutates deterministic scoring inputs.
  return false;
}

export function assertNoHiddenLayerScore(layers: readonly ApprovedMapLayer[]): void {
  for (const layer of layers) {
    if (layer.contributesToHiddenScore) {
      throw new Error(`Layer ${layer.layerId} must not contribute to a hidden score.`);
    }
  }
}

export function modeSupportsPresentation(
  mode: MapViewMode,
  presentation: MapPresentation,
): boolean {
  if (mode === "compare") return presentation.supportsComparison;
  if (mode === "layer") return presentation.supportsLayerMode;
  return true;
}

export function coerceSupportedMapMode(
  mode: MapViewMode,
  presentation: MapPresentation,
): MapViewMode {
  return modeSupportsPresentation(mode, presentation) ? mode : "single";
}
