import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import { seattleSubmarkets } from "./data.ts";
import {
  SEATTLE_GEOMETRY_METHOD_VERSION,
  type SeattleSubmarket,
} from "./types.ts";

const EARTH_RADIUS_KM = 6371.0088;
export const SEATTLE_AREA_VERTEX_COUNT = 64;

export type SeattleIllustrativeAreaProperties = {
  feature_kind: "illustrative_area";
  submarket_id: string;
  label: string;
  short_label: string;
  display_number: number;
  color: string;
  radius_km: number;
  source_id: "SYN-SEATTLE-SUBMARKET-001";
  evidence_status: "Hypothesis";
  allowed_use: "synthetic_prototype_only";
  geometry_status: "illustrative_analysis_area";
  geometry_method_version: typeof SEATTLE_GEOMETRY_METHOD_VERSION;
  scoring_eligibility: "none";
};

export type SeattleIllustrativeHubProperties = Omit<
  SeattleIllustrativeAreaProperties,
  "feature_kind"
> & { feature_kind: "illustrative_hub"; place_label: string };

export type SeattleIllustrativeFeature =
  | Feature<Polygon, SeattleIllustrativeAreaProperties>
  | Feature<Point, SeattleIllustrativeHubProperties>;

export type SeattleIllustrativeOverlay = FeatureCollection<
  Polygon | Point,
  SeattleIllustrativeAreaProperties | SeattleIllustrativeHubProperties
>;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function createGeodesicRing(
  longitude: number,
  latitude: number,
  radiusKm: number,
  vertexCount = SEATTLE_AREA_VERTEX_COUNT,
): [number, number][] {
  if (![longitude, latitude, radiusKm, vertexCount].every(Number.isFinite)) {
    throw new Error("Illustrative area inputs must be finite.");
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error("Illustrative area hub coordinates are out of range.");
  }
  if (radiusKm <= 0 || radiusKm > 50 || !Number.isInteger(vertexCount) || vertexCount < 16 || vertexCount > 256) {
    throw new Error("Illustrative area radius or vertex count is invalid.");
  }
  const angularDistance = radiusKm / EARTH_RADIUS_KM;
  const centerLatitude = toRadians(latitude);
  const centerLongitude = toRadians(longitude);
  const ring: [number, number][] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const bearing = (index / vertexCount) * Math.PI * 2;
    const destinationLatitude = Math.asin(
      Math.sin(centerLatitude) * Math.cos(angularDistance) +
      Math.cos(centerLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const destinationLongitude = centerLongitude + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatitude),
      Math.cos(angularDistance) - Math.sin(centerLatitude) * Math.sin(destinationLatitude),
    );
    ring.push([
      Number(toDegrees(destinationLongitude).toFixed(6)),
      Number(toDegrees(destinationLatitude).toFixed(6)),
    ]);
  }
  ring.push([...ring[0]] as [number, number]);
  return ring;
}

function commonProperties(submarket: SeattleSubmarket) {
  return {
    submarket_id: submarket.submarket_id,
    label: submarket.label,
    short_label: submarket.short_label,
    display_number: submarket.display_number,
    color: submarket.display_color,
    radius_km: submarket.hub.radius_km,
    source_id: submarket.source_id,
    evidence_status: submarket.evidence_status,
    allowed_use: submarket.allowed_use,
    geometry_status: submarket.geometry_status,
    geometry_method_version: submarket.geometry_method_version,
    scoring_eligibility: submarket.geometry_scoring_eligibility,
  } as const;
}

export function createSeattleIllustrativeOverlay(
  submarkets: readonly SeattleSubmarket[],
): SeattleIllustrativeOverlay {
  const features: SeattleIllustrativeFeature[] = [];
  for (const submarket of [...submarkets].sort((left, right) => left.display_number - right.display_number)) {
    const common = commonProperties(submarket);
    features.push({
      type: "Feature",
      id: `area:${submarket.submarket_id}`,
      properties: { ...common, feature_kind: "illustrative_area" },
      geometry: {
        type: "Polygon",
        coordinates: [[...createGeodesicRing(
          submarket.hub.longitude,
          submarket.hub.latitude,
          submarket.hub.radius_km,
        )]],
      },
    });
    features.push({
      type: "Feature",
      id: `hub:${submarket.submarket_id}`,
      properties: { ...common, feature_kind: "illustrative_hub", place_label: submarket.hub.place_label },
      geometry: { type: "Point", coordinates: [submarket.hub.longitude, submarket.hub.latitude] },
    });
  }
  return { type: "FeatureCollection", features } as SeattleIllustrativeOverlay;
}

export const seattleIllustrativeOverlay = createSeattleIllustrativeOverlay(seattleSubmarkets);
