import type { Feature } from "geojson";
import type { CbsaMarket } from "../cbsa-universe/index.ts";
import {
  CBSA_BOUNDARY_VINTAGE,
  CBSA_GEOMETRY_SOURCE_ID,
  CBSA_GEOMETRY_TRANSFORMATION_VERSION,
  type CbsaBoundaryFeature,
  type CbsaBoundaryGeometry,
  type CbsaGeometryAudit,
  type CbsaGeometryTransformationResult,
  type GeometryAuditRecord,
  type RawCbsaBoundaryProperties,
} from "./types.ts";

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function nonnegativeInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }
  return value;
}

function cbsaCode(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    const padded = String(value).padStart(5, "0");
    return /^\d{5}$/.test(padded) ? padded : null;
  }
  const text = stringValue(value);
  return text !== null && /^\d{5}$/.test(text) ? text : null;
}

function sourceProperties(
  feature: Feature | null,
): GeometryAuditRecord["source_properties"] {
  const properties = (feature?.properties ?? {}) as RawCbsaBoundaryProperties;
  return {
    GEOID:
      typeof properties.GEOID === "string" ||
      typeof properties.GEOID === "number"
        ? properties.GEOID
        : null,
    NAME: stringValue(properties.NAME),
    NAMELSAD: stringValue(properties.NAMELSAD),
    LSAD: stringValue(properties.LSAD),
    ALAND: nonnegativeInteger(properties.ALAND),
    AWATER: nonnegativeInteger(properties.AWATER),
    geometry_type: feature?.geometry?.type ?? null,
  };
}

function auditRecord(
  feature: Feature | null,
  featureIndex: number | null,
  reasons: string[],
): GeometryAuditRecord {
  const properties = (feature?.properties ?? {}) as RawCbsaBoundaryProperties;
  return {
    feature_index: featureIndex,
    cbsa_code: cbsaCode(properties.GEOID),
    reasons: [...new Set(reasons)].sort(compareStrings),
    source_properties: sourceProperties(feature),
  };
}

function expectedLsad(market: CbsaMarket): string {
  return market.cbsa_type === "metropolitan" ? "M1" : "M2";
}

function validateFeature(
  feature: Feature | null,
  featureIndex: number,
  market: CbsaMarket,
): { value: CbsaBoundaryFeature | null; rejection: GeometryAuditRecord | null } {
  const properties = (feature?.properties ?? {}) as RawCbsaBoundaryProperties;
  const reasons: string[] = [];
  const code = cbsaCode(properties.GEOID);
  const name = stringValue(properties.NAME);
  const namedArea = stringValue(properties.NAMELSAD);
  const lsad = stringValue(properties.LSAD);
  const aland = nonnegativeInteger(properties.ALAND);
  const awater = nonnegativeInteger(properties.AWATER);
  const geometry = feature?.geometry;

  if (code === null) reasons.push("GEOID must be a five-digit CBSA code.");
  if (name === null) reasons.push("NAME must be a non-empty string.");
  if (namedArea === null) reasons.push("NAMELSAD must be a non-empty string.");
  if (lsad !== expectedLsad(market)) {
    reasons.push(
      `LSAD must be ${expectedLsad(market)} for a ${market.cbsa_type} market.`,
    );
  }
  if (aland === null) reasons.push("ALAND must be a nonnegative integer.");
  if (awater === null) reasons.push("AWATER must be a nonnegative integer.");
  if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") {
    reasons.push("Geometry must be Polygon or MultiPolygon.");
  }
  if (code !== market.cbsa_code) {
    reasons.push("Feature GEOID does not match the joined market code.");
  }
  if (
    name !== null &&
    name.localeCompare(market.cbsa_name.replace(/ Metropolitan Statistical Area$| Micropolitan Statistical Area$/, "")) !==
      0 &&
    namedArea !== market.cbsa_name
  ) {
    reasons.push("Boundary name does not match the market-universe name.");
  }

  if (reasons.length > 0) {
    return {
      value: null,
      rejection: auditRecord(feature, featureIndex, reasons),
    };
  }

  return {
    value: {
      type: "Feature",
      id: code!,
      properties: {
        cbsa_code: code!,
        cbsa_name: market.cbsa_name,
        cbsa_type: market.cbsa_type,
        aland: aland!,
        awater: awater!,
        geometry_type: geometry!.type as CbsaBoundaryGeometry["type"],
        boundary_vintage: CBSA_BOUNDARY_VINTAGE,
      },
      geometry: geometry as CbsaBoundaryGeometry,
    },
    rejection: null,
  };
}

export function transformCbsaGeometry(
  rawFeatures: readonly Feature[],
  markets: readonly CbsaMarket[],
): CbsaGeometryTransformationResult {
  const marketsByCode = new Map(markets.map((market) => [market.cbsa_code, market]));
  if (marketsByCode.size !== markets.length) {
    throw new Error("Market universe contains duplicate CBSA codes.");
  }

  const rawCodes = rawFeatures.map((feature) =>
    cbsaCode((feature.properties as RawCbsaBoundaryProperties | null)?.GEOID),
  );
  const countsByCode = new Map<string, number>();
  for (const code of rawCodes) {
    if (code !== null) countsByCode.set(code, (countsByCode.get(code) ?? 0) + 1);
  }
  const duplicateCodes = new Set(
    [...countsByCode.entries()]
      .filter(([, count]) => count > 1)
      .map(([code]) => code),
  );

  const included: CbsaBoundaryFeature[] = [];
  const duplicateFeatures: GeometryAuditRecord[] = [];
  const unmatchedFeatures: GeometryAuditRecord[] = [];
  const rejectedFeatures: GeometryAuditRecord[] = [];

  rawFeatures.forEach((feature, featureIndex) => {
    const code = rawCodes[featureIndex];
    if (code !== null && duplicateCodes.has(code)) {
      duplicateFeatures.push(
        auditRecord(feature, featureIndex, [
          `Duplicate boundary feature for CBSA ${code}.`,
        ]),
      );
      return;
    }
    if (code === null) {
      rejectedFeatures.push(
        auditRecord(feature, featureIndex, [
          "GEOID must be a five-digit CBSA code.",
        ]),
      );
      return;
    }
    const market = marketsByCode.get(code);
    if (market === undefined) {
      unmatchedFeatures.push(
        auditRecord(feature, featureIndex, [
          `CBSA ${code} is not present in the validated mainland market universe.`,
        ]),
      );
      return;
    }
    const parsed = validateFeature(feature, featureIndex, market);
    if (parsed.rejection !== null) {
      rejectedFeatures.push(parsed.rejection);
    } else {
      included.push(parsed.value!);
    }
  });

  included.sort((a, b) =>
    compareStrings(a.properties.cbsa_code, b.properties.cbsa_code),
  );
  const includedCodes = new Set(
    included.map((feature) => feature.properties.cbsa_code),
  );
  const missingMarketGeometry = markets
    .filter((market) => !includedCodes.has(market.cbsa_code))
    .map((market) => ({
      cbsa_code: market.cbsa_code,
      cbsa_name: market.cbsa_name,
      cbsa_type: market.cbsa_type,
    }))
    .sort((a, b) => compareStrings(a.cbsa_code, b.cbsa_code));

  const sortAudit = (records: GeometryAuditRecord[]) =>
    records.sort(
      (a, b) =>
        compareStrings(a.cbsa_code ?? "", b.cbsa_code ?? "") ||
        (a.feature_index ?? Number.MAX_SAFE_INTEGER) -
          (b.feature_index ?? Number.MAX_SAFE_INTEGER),
    );
  const audit: CbsaGeometryAudit = {
    schema_version: "1.0.0",
    transformation_version: CBSA_GEOMETRY_TRANSFORMATION_VERSION,
    boundary_vintage: CBSA_BOUNDARY_VINTAGE,
    source_id: CBSA_GEOMETRY_SOURCE_ID,
    duplicate_features: sortAudit(duplicateFeatures),
    unmatched_features: sortAudit(unmatchedFeatures),
    rejected_features: sortAudit(rejectedFeatures),
    missing_market_geometry: missingMarketGeometry,
  };

  return {
    feature_collection: {
      type: "FeatureCollection",
      features: included,
    },
    audit,
    counts: {
      total_features: rawFeatures.length,
      included_features: included.length,
      excluded_features:
        duplicateFeatures.length +
        unmatchedFeatures.length +
        rejectedFeatures.length,
      unmatched_features: unmatchedFeatures.length,
      duplicate_features: duplicateFeatures.length,
      rejected_features: rejectedFeatures.length,
      missing_market_geometry: missingMarketGeometry.length,
      polygon_features: included.filter(
        (feature) => feature.geometry.type === "Polygon",
      ).length,
      multipolygon_features: included.filter(
        (feature) => feature.geometry.type === "MultiPolygon",
      ).length,
    },
  };
}
