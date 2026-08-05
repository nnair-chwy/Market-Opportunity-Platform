import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { CbsaType } from "../cbsa-universe/index.ts";

export const CBSA_BOUNDARY_VINTAGE = "2024" as const;
export const CBSA_BOUNDARY_SCALE = "1:5,000,000" as const;
export const CBSA_GEOMETRY_SOURCE_ID = "SRC-015" as const;
export const CBSA_GEOMETRY_TRANSFORMATION_VERSION =
  "cbsa-geometry-v1" as const;
export const CBSA_GEOMETRY_FORMAT = "TopoJSON" as const;
export const CBSA_MISSING_GEOMETRY_TOLERANCE = 0 as const;

export type CbsaBoundaryGeometry = Polygon | MultiPolygon;

export type RawCbsaBoundaryProperties = {
  GEOID?: unknown;
  NAME?: unknown;
  NAMELSAD?: unknown;
  LSAD?: unknown;
  ALAND?: unknown;
  AWATER?: unknown;
  [key: string]: unknown;
};

export type CbsaBoundaryProperties = {
  cbsa_code: string;
  cbsa_name: string;
  cbsa_type: CbsaType;
  aland: number;
  awater: number;
  geometry_type: CbsaBoundaryGeometry["type"];
  boundary_vintage: typeof CBSA_BOUNDARY_VINTAGE;
};

export type CbsaBoundaryFeature = Feature<
  CbsaBoundaryGeometry,
  CbsaBoundaryProperties
>;

export type GeometryAuditRecord = {
  feature_index: number | null;
  cbsa_code: string | null;
  reasons: string[];
  source_properties: {
    GEOID: string | number | null;
    NAME: string | null;
    NAMELSAD: string | null;
    LSAD: string | null;
    ALAND: number | null;
    AWATER: number | null;
    geometry_type: string | null;
  };
};

export type CbsaGeometryAudit = {
  schema_version: "1.0.0";
  transformation_version: typeof CBSA_GEOMETRY_TRANSFORMATION_VERSION;
  boundary_vintage: typeof CBSA_BOUNDARY_VINTAGE;
  source_id: typeof CBSA_GEOMETRY_SOURCE_ID;
  duplicate_features: GeometryAuditRecord[];
  unmatched_features: GeometryAuditRecord[];
  rejected_features: GeometryAuditRecord[];
  missing_market_geometry: Array<{
    cbsa_code: string;
    cbsa_name: string;
    cbsa_type: CbsaType;
  }>;
};

export type CbsaGeometryTransformationResult = {
  feature_collection: FeatureCollection<
    CbsaBoundaryGeometry,
    CbsaBoundaryProperties
  >;
  audit: CbsaGeometryAudit;
  counts: {
    total_features: number;
    included_features: number;
    excluded_features: number;
    unmatched_features: number;
    duplicate_features: number;
    rejected_features: number;
    missing_market_geometry: number;
    polygon_features: number;
    multipolygon_features: number;
  };
};
