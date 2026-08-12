import { perspectiveCatalog } from "./catalog.ts";
import type {
  MapPresentation,
  PerspectiveId,
  PerspectiveMeasureId,
  PerspectiveView,
  PerspectiveViewId,
} from "./contracts.ts";
import { perspectiveIdSchema, perspectiveViewIdSchema } from "./contracts.ts";

export {
  PERSPECTIVE_CATALOG_VERSION,
  perspectiveCatalogSchema,
  perspectiveIdSchema,
  perspectiveMeasureIdSchema,
  perspectiveViewIdSchema,
  perspectiveViewSchema,
} from "./contracts.ts";
export type {
  AllowedUse,
  LegendConfiguration,
  MapBinding,
  MapPresentation,
  PerspectiveCatalog,
  PerspectiveDefinition,
  PerspectiveId,
  PerspectiveMeasureId,
  PerspectiveView,
  PerspectiveViewId,
  ScoringEligibility,
  ViewEvidenceAvailability,
} from "./contracts.ts";
export { perspectiveCatalog } from "./catalog.ts";
export {
  APPROVED_MAP_LAYER_IDS,
  MAX_COMPARISON_REGIONS,
  MAP_VIEW_MODES,
  appendComparisonRegion,
  assertNoHiddenLayerScore,
  buildComparisonFingerprint,
  canAddRegionToComparison,
  clearComparisonRegions,
  coerceSupportedMapMode,
  createDefaultLayerVisibility,
  fingerprintsCompatible,
  formatNullableMeasureValue,
  layerVisibilityChangesScoringInputs,
  listApprovedMapLayers,
  modeSupportsPresentation,
  preserveMissingNumeric,
  removeComparisonRegion,
  resolveApprovedMapLayer,
  resolveLayerForPresentation,
  approvedMapLayerIdSchema,
  mapViewModeSchema,
} from "./map-modes.ts";
export type {
  ApprovedMapLayer,
  ApprovedMapLayerId,
  ComparisonAddResult,
  ComparisonFingerprint,
  MapViewMode,
} from "./map-modes.ts";

export function listPerspectives() {
  return perspectiveCatalog.perspectives;
}

export function getPerspective(perspectiveId: PerspectiveId) {
  const perspective = perspectiveCatalog.perspectives.find(
    (item) => item.perspectiveId === perspectiveId,
  );
  if (!perspective) {
    throw new Error(`Unknown perspective: ${perspectiveId}`);
  }
  return perspective;
}

export function listViewsForPerspective(perspectiveId: PerspectiveId) {
  return getPerspective(perspectiveId).views;
}

export function getPerspectiveView(
  perspectiveId: PerspectiveId,
  viewId: PerspectiveViewId,
): PerspectiveView {
  const view = getPerspective(perspectiveId).views.find((item) => item.viewId === viewId);
  if (!view) {
    throw new Error(`View ${viewId} is not available in perspective ${perspectiveId}.`);
  }
  return view;
}

export function getDefaultView(perspectiveId: PerspectiveId): PerspectiveView {
  const perspective = getPerspective(perspectiveId);
  return getPerspectiveView(perspectiveId, perspective.defaultViewId);
}

export function createDefaultActiveViews(): Record<PerspectiveId, PerspectiveViewId> {
  return {
    pricing: getPerspective("pricing").defaultViewId,
    marketing: getPerspective("marketing").defaultViewId,
    cvc: getPerspective("cvc").defaultViewId,
  };
}

export function resolvePerspectiveId(value: string): PerspectiveId | null {
  const parsed = perspectiveIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function resolveViewId(value: string): PerspectiveViewId | null {
  const parsed = perspectiveViewIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function selectPerspectiveView(
  perspectiveId: PerspectiveId,
  viewId: PerspectiveViewId,
): PerspectiveView | { status: "unavailable"; reason: string } {
  const perspective = resolvePerspectiveId(perspectiveId);
  if (!perspective) {
    return { status: "unavailable", reason: "Unknown perspective." };
  }
  const viewKey = resolveViewId(viewId);
  if (!viewKey) {
    return { status: "unavailable", reason: "Unknown view." };
  }
  try {
    return getPerspectiveView(perspective, viewKey);
  } catch {
    return {
      status: "unavailable",
      reason: `View ${viewId} is not configured for perspective ${perspectiveId}.`,
    };
  }
}

export function measureBelongsToPerspective(
  measureId: PerspectiveMeasureId,
  perspectiveId: PerspectiveId,
): boolean {
  return measureId.startsWith(`${perspectiveId}.`);
}

export function assertMeasureIsolation(
  measureId: PerspectiveMeasureId,
  perspectiveId: PerspectiveId,
): void {
  if (!measureBelongsToPerspective(measureId, perspectiveId)) {
    throw new Error(
      `Measure ${measureId} cannot enter ${perspectiveId} calculations.`,
    );
  }
}

export function resolveMapPresentation(view: PerspectiveView): MapPresentation {
  assertMeasureIsolation(view.activeMeasure, view.perspectiveId);
  return {
    perspectiveId: view.perspectiveId,
    viewId: view.viewId,
    measureId: view.activeMeasure,
    mapTitle: view.mapTitle,
    sourceLabel: view.sourceLabel,
    evidenceBoundary: view.evidenceBoundary,
    legend: view.legend,
    emptyState: view.emptyState,
    evidenceAvailability: view.evidenceAvailability,
    allowedUse: view.allowedUse,
    scoringEligibility: view.scoringEligibility,
    sourceIds: view.sourceIds,
    mapBinding: view.mapBinding,
    supportsComparison: view.supportsComparison,
    supportsLayerMode: view.supportsLayerMode,
  };
}

export function hasUniversalScoreField(presentation: MapPresentation): boolean {
  const record = presentation as MapPresentation & Record<string, unknown>;
  return (
    "universal_score" in record ||
    "universalScore" in record ||
    "cross_perspective_score" in record ||
    "opportunity_score" in record ||
    "opportunityScore" in record
  );
}

export function isPublicContextNonScored(view: PerspectiveView): boolean {
  if (view.allowedUse !== "market_context_only") return true;
  return view.scoringEligibility === "none";
}
