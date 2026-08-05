import type { Feature, FeatureCollection, Point } from "geojson";

export type UnifiedLocationCategory = "current" | "potential" | "evaluated";

export type UnifiedMapLocation = {
  id: string;
  marketId: string | null;
  name: string;
  market: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  category: UnifiedLocationCategory;
  evidenceStatus: "Confirmed" | "Derived" | "Hypothesis";
  sourceId: string;
  statusLabel: string;
  address?: string;
  score?: number;
};

export type CategoryVisibility = Record<UnifiedLocationCategory, boolean>;

export const DEFAULT_CATEGORY_VISIBILITY: CategoryVisibility = {
  current: true,
  potential: true,
  evaluated: true,
};

export const LOCATION_MARKER_CONTRACT = {
  current: {
    color: "#087f75",
    shape: "circle",
    label: "Current",
  },
  potential: {
    color: "#6d4aff",
    shape: "diamond",
    label: "Potential",
  },
  evaluated: {
    color: "#c35a05",
    shape: "square",
    label: "Evaluated",
  },
} as const;

export type UnifiedLocationProperties = Omit<
  UnifiedMapLocation,
  "latitude" | "longitude"
>;

export type UnifiedLocationCollection = FeatureCollection<
  Point,
  UnifiedLocationProperties
>;

export function deduplicateEvaluatedLocations(
  locations: readonly UnifiedMapLocation[],
): UnifiedMapLocation[] {
  const evaluatedIds = new Set(
    locations
      .filter((location) => location.category === "evaluated")
      .map((location) => location.id),
  );
  return locations.filter(
    (location) =>
      location.category !== "potential" || !evaluatedIds.has(location.id),
  );
}

export function locationsForCategory(
  locations: readonly UnifiedMapLocation[],
  category: UnifiedLocationCategory,
): UnifiedMapLocation[] {
  return deduplicateEvaluatedLocations(locations).filter(
    (location) => location.category === category,
  );
}

export function locationsToGeoJson(
  locations: readonly UnifiedMapLocation[],
  category: UnifiedLocationCategory,
): UnifiedLocationCollection {
  return {
    type: "FeatureCollection",
    features: locationsForCategory(locations, category).map(
      (location): Feature<Point, UnifiedLocationProperties> => ({
        type: "Feature",
        id: `${category}:${location.id}`,
        geometry: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
        properties: {
          id: location.id,
          marketId: location.marketId,
          name: location.name,
          market: location.market,
          city: location.city,
          state: location.state,
          category: location.category,
          evidenceStatus: location.evidenceStatus,
          sourceId: location.sourceId,
          statusLabel: location.statusLabel,
          ...(location.address ? { address: location.address } : {}),
          ...(location.score !== undefined ? { score: location.score } : {}),
        },
      }),
    ),
  };
}

export function visibleUnifiedLocations(
  locations: readonly UnifiedMapLocation[],
  visibility: CategoryVisibility,
): UnifiedMapLocation[] {
  return deduplicateEvaluatedLocations(locations).filter(
    (location) => visibility[location.category],
  );
}

export function unifiedLocationAriaLabel(
  location: UnifiedMapLocation,
): string {
  const contract = LOCATION_MARKER_CONTRACT[location.category];
  const evaluationNotice =
    location.category === "evaluated"
      ? " Evaluation completed, not approved or recommended."
      : "";
  return `Focus ${location.name}, ${location.city}, ${location.state}. ${contract.label} ${contract.shape} marker. ${location.statusLabel}. Evidence ${location.evidenceStatus}.${evaluationNotice}`;
}
