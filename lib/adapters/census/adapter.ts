import {
  CENSUS_VARIABLE_CATALOG,
  DEFAULT_CENSUS_METRICS,
  isDirectCensusMetric,
} from "./catalog.ts";
import {
  censusGeoId,
  geographyFips,
  geographyQuery,
  responseFips,
  validateGeography,
} from "./geography.ts";
import type {
  CensusAdapter,
  CensusAdapterOptions,
  CensusAdapterResult,
  CensusMetricId,
  CensusProvenance,
  CensusRequest,
  CensusWarning,
  MetricObservation,
} from "./types.ts";

const DATASET = "acs/acs5" as const;
const DEFAULT_BASE_URL = "https://api.census.gov/data";
const SQUARE_METERS_PER_SQUARE_MILE = 2_589_988.110336;
const DERIVED_DENSITY_VARIABLE = null;

const SUPPRESSED_VALUES = new Set(["-666666666", "-999999999"]);
const UNAVAILABLE_VALUES = new Set(["-888888888"]);

type ParsedTable = {
  row: Record<string, unknown> | null;
  rowCount: number;
};

type ObservationParts = {
  observation: MetricObservation;
  provenance: CensusProvenance;
  warnings: CensusWarning[];
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function vintageObservedAt(vintage: number) {
  return `${vintage}-12-31`;
}

function uniqueMetricIds<T extends CensusMetricId>(metricIds: readonly T[]) {
  return [...new Set(metricIds)];
}

function buildUrl(
  baseUrl: string,
  request: CensusRequest,
  directMetricIds: readonly Exclude<
    CensusMetricId,
    "census.population_density"
  >[],
) {
  const url = new URL(
    `${baseUrl.replace(/\/$/, "")}/${request.vintage}/${DATASET}`,
  );
  const variables = directMetricIds.flatMap((metricId) => {
    const definition = CENSUS_VARIABLE_CATALOG[metricId];
    return [definition.variableId, definition.annotationVariableId];
  });

  url.searchParams.set("get", ["NAME", "GEO_ID", ...variables].join(","));
  const query = geographyQuery(request.geography);
  url.searchParams.set("for", query.forValue);
  if (query.inValue) {
    url.searchParams.set("in", query.inValue);
  }
  return url;
}

function parseTable(payload: unknown): ParsedTable {
  if (!Array.isArray(payload) || payload.length < 2) {
    return { row: null, rowCount: 0 };
  }
  const [header, ...rows] = payload;
  if (
    !Array.isArray(header) ||
    !header.every((column) => typeof column === "string")
  ) {
    return { row: null, rowCount: 0 };
  }
  const firstRow = rows[0];
  if (!Array.isArray(firstRow)) {
    return { row: null, rowCount: rows.length };
  }
  return {
    row: Object.fromEntries(
      header.map((column, index) => [column, firstRow[index]]),
    ),
    rowCount: rows.length,
  };
}

function qualityStatus(warnings: readonly CensusWarning[]) {
  return warnings.some((warning) => warning.code === "incompatible")
    ? ("rejected" as const)
    : warnings.length > 0
      ? ("warning" as const)
      : ("accepted" as const);
}

function staleWarning(
  metricId: CensusMetricId,
  variableId: string | null,
  observedYear: number,
  retrievalYear: number,
  maxAge: number,
): CensusWarning | null {
  if (retrievalYear - observedYear <= maxAge) {
    return null;
  }
  return {
    code: "stale",
    metricId,
    variableId,
    message: `The ${observedYear} observation exceeds the configured freshness threshold of ${maxAge} years as of ${retrievalYear}.`,
  };
}

function baseObservation(
  metricId: CensusMetricId,
  rawValue: number | null,
  unit: string,
  sourceId: string,
  observedAt: string,
  geography: CensusRequest["geography"],
  warnings: readonly CensusWarning[],
): MetricObservation {
  return {
    metric_id: metricId,
    raw_value: rawValue,
    unit,
    source_id: sourceId,
    observed_at: observedAt,
    geography: geography.type,
    quality_status: qualityStatus(warnings),
    sensitivity: "public",
  };
}

function directMetricParts(
  metricId: Exclude<CensusMetricId, "census.population_density">,
  request: CensusRequest,
  row: Readonly<Record<string, unknown>>,
  retrievedAt: string,
  sourceUrl: string,
  maxVintageAgeYears: number,
): ObservationParts {
  const definition = CENSUS_VARIABLE_CATALOG[metricId];
  const sourceId = `census:${DATASET}:${request.vintage}`;
  const observedAt = vintageObservedAt(request.vintage);
  const raw = row[definition.variableId];
  const annotation = row[definition.annotationVariableId];
  const warnings: CensusWarning[] = [];
  let rawValue: number | null = null;

  if (!(definition.variableId in row)) {
    warnings.push({
      code: "unavailable",
      metricId,
      variableId: definition.variableId,
      message: `The Census response did not include ${definition.variableId}.`,
    });
  } else if (raw === null || raw === "") {
    warnings.push({
      code: "missing",
      metricId,
      variableId: definition.variableId,
      message: `Census returned no value for ${definition.variableId}.`,
    });
  } else if (SUPPRESSED_VALUES.has(String(raw))) {
    warnings.push({
      code: "suppressed",
      metricId,
      variableId: definition.variableId,
      message: `Census suppressed ${definition.variableId} because the estimate could not be computed or displayed for this geography.`,
    });
  } else if (UNAVAILABLE_VALUES.has(String(raw))) {
    warnings.push({
      code: "unavailable",
      metricId,
      variableId: definition.variableId,
      message: `Census marked ${definition.variableId} as not applicable or unavailable for this geography.`,
    });
  } else if (annotation === "median-" || annotation === "median+") {
    warnings.push({
      code: "incompatible",
      metricId,
      variableId: definition.variableId,
      message: `Census returned ${definition.variableId} as an open-ended median interval, which this point-estimate adapter does not coerce to an exact value.`,
    });
  } else {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      warnings.push({
        code: "incompatible",
        metricId,
        variableId: definition.variableId,
        message: `Census returned a non-numeric or out-of-range value for ${definition.variableId}.`,
      });
    } else {
      rawValue = parsed;
    }
  }

  const freshness = staleWarning(
    metricId,
    definition.variableId,
    request.vintage,
    Number(retrievedAt.slice(0, 4)),
    maxVintageAgeYears,
  );
  if (freshness) {
    warnings.push(freshness);
  }

  return {
    observation: baseObservation(
      metricId,
      rawValue,
      definition.unit,
      sourceId,
      observedAt,
      request.geography,
      warnings,
    ),
    provenance: {
      metricId,
      variableId: definition.variableId,
      dataset: DATASET,
      datasetVintage: request.vintage,
      geographyType: request.geography.type,
      fips: geographyFips(request.geography),
      censusGeoId: censusGeoId(request.geography),
      retrievedAt,
      unit: definition.unit,
      transformation: "identity",
      evidenceStatus: "Confirmed",
      sourceUrl,
      inputs: [],
    },
    warnings,
  };
}

function unavailableMetricParts(
  metricId: CensusMetricId,
  request: CensusRequest,
  retrievedAt: string,
  sourceUrl: string,
  message: string,
  incompatible = false,
): ObservationParts {
  const directDefinition = isDirectCensusMetric(metricId)
    ? CENSUS_VARIABLE_CATALOG[metricId]
    : null;
  const variableId = directDefinition?.variableId ?? DERIVED_DENSITY_VARIABLE;
  const unit = directDefinition?.unit ?? "people_per_square_mile";
  const warning: CensusWarning = {
    code: incompatible ? "incompatible" : "unavailable",
    metricId,
    variableId,
    message,
  };
  return {
    observation: baseObservation(
      metricId,
      null,
      unit,
      `census:${DATASET}:${request.vintage}`,
      vintageObservedAt(request.vintage),
      request.geography,
      [warning],
    ),
    provenance: {
      metricId,
      variableId,
      dataset: DATASET,
      datasetVintage: request.vintage,
      geographyType: request.geography.type,
      fips: geographyFips(request.geography),
      censusGeoId: censusGeoId(request.geography),
      retrievedAt,
      unit,
      transformation:
        metricId === "census.population_density"
          ? "total_population / land_area_square_miles; rounded to 6 decimal places"
          : "identity",
      evidenceStatus:
        metricId === "census.population_density" ? "Derived" : "Confirmed",
      sourceUrl,
      inputs: [],
    },
    warnings: [warning],
  };
}

function densityParts(
  request: CensusRequest,
  population: ObservationParts,
  retrievedAt: string,
  sourceUrl: string,
  maxVintageAgeYears: number,
): ObservationParts {
  const metricId = "census.population_density" as const;
  const area = request.densityArea;
  if (!area) {
    return unavailableMetricParts(
      metricId,
      request,
      retrievedAt,
      sourceUrl,
      "Population density is unavailable because no land-area input was supplied.",
    );
  }

  const expectedFips = geographyFips(request.geography);
  if (
    area.geographyType !== request.geography.type ||
    area.fips !== expectedFips
  ) {
    return unavailableMetricParts(
      metricId,
      request,
      retrievedAt,
      sourceUrl,
      "Population density was rejected because population and land area do not describe the same geography and FIPS identifier.",
      true,
    );
  }
  if (!Number.isFinite(area.squareMeters) || area.squareMeters <= 0) {
    return unavailableMetricParts(
      metricId,
      request,
      retrievedAt,
      sourceUrl,
      "Population density was rejected because land area must be a positive finite number of square meters.",
      true,
    );
  }
  if (population.observation.raw_value === null) {
    return unavailableMetricParts(
      metricId,
      request,
      retrievedAt,
      sourceUrl,
      "Population density is unavailable because total population is missing, suppressed, incompatible, or unavailable.",
    );
  }

  const warnings = [...population.warnings.filter(({ code }) => code === "stale")];
  const areaYear = Number(area.observedAt.slice(0, 4));
  const areaFreshness = Number.isInteger(areaYear)
    ? staleWarning(
        metricId,
        null,
        areaYear,
        Number(retrievedAt.slice(0, 4)),
        maxVintageAgeYears,
      )
    : null;
  if (areaFreshness) {
    warnings.push(areaFreshness);
  }

  const squareMiles = area.squareMeters / SQUARE_METERS_PER_SQUARE_MILE;
  const density =
    Math.round(
      (population.observation.raw_value / squareMiles) * 1_000_000,
    ) / 1_000_000;
  const sourceId = `census:${DATASET}:${request.vintage}:derived`;
  const inputs = [
    {
      metricId: population.observation.metric_id,
      rawValue: population.observation.raw_value,
      unit: population.observation.unit,
      sourceId: population.observation.source_id,
      observedAt: population.observation.observed_at,
      transformation: "identity",
    },
    {
      metricId: "census.land_area",
      rawValue: area.squareMeters,
      unit: "square_meters",
      sourceId: area.sourceId,
      observedAt: area.observedAt,
      transformation: area.transformation,
    },
  ];

  return {
    observation: baseObservation(
      metricId,
      density,
      "people_per_square_mile",
      sourceId,
      population.observation.observed_at,
      request.geography,
      warnings,
    ),
    provenance: {
      metricId,
      variableId: null,
      dataset: DATASET,
      datasetVintage: request.vintage,
      geographyType: request.geography.type,
      fips: expectedFips,
      censusGeoId: censusGeoId(request.geography),
      retrievedAt,
      unit: "people_per_square_mile",
      transformation:
        "total_population / (land_area_square_meters / 2589988.110336); rounded to 6 decimal places",
      evidenceStatus: "Derived",
      sourceUrl,
      inputs,
    },
    warnings,
  };
}

function toResult(
  request: CensusRequest,
  retrievedAt: string,
  rowCount: number,
  parts: readonly ObservationParts[],
): CensusAdapterResult {
  return {
    sourceVersion: {
      provider: "United States Census Bureau",
      dataset: DATASET,
      vintage: request.vintage,
    },
    refreshTime: retrievedAt,
    rowCount,
    geographicGrain: request.geography.type,
    allowedUse: {
      sensitivity: "public",
      purpose: "market_context_only",
      scoringWeight: "none",
    },
    observations: parts.map(({ observation }) => observation),
    provenance: parts.map(({ provenance }) => provenance),
    warnings: parts.flatMap(({ warnings }) => warnings),
  };
}

export function createCensusAdapter(
  options: CensusAdapterOptions,
): CensusAdapter {
  if (!options.fetch) {
    throw new TypeError("A fetch implementation must be injected.");
  }
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const now = options.now ?? (() => new Date());
  const maxVintageAgeYears = options.maxVintageAgeYears ?? 3;

  return {
    async retrieve(request) {
      validateGeography(request.geography);
      if (!Number.isInteger(request.vintage) || request.vintage < 2009) {
        throw new TypeError(
          "ACS 5-year vintage must be an integer greater than or equal to 2009.",
        );
      }

      const requestedMetricIds = uniqueMetricIds(
        request.metricIds ?? DEFAULT_CENSUS_METRICS,
      );
      const needsPopulation = requestedMetricIds.includes(
        "census.population_density",
      );
      const directMetricIds = requestedMetricIds.filter(isDirectCensusMetric);
      if (
        needsPopulation &&
        !directMetricIds.includes("census.total_population")
      ) {
        directMetricIds.push("census.total_population");
      }
      const url = buildUrl(baseUrl, request, directMetricIds);
      const sourceUrl = url.toString();
      const retrievedAt = dateOnly(now());

      let response;
      try {
        response = await options.fetch(url);
      } catch {
        const parts = requestedMetricIds.map((metricId) =>
          unavailableMetricParts(
            metricId,
            request,
            retrievedAt,
            sourceUrl,
            "The Census API request was unavailable.",
          ),
        );
        return toResult(request, retrievedAt, 0, parts);
      }

      if (!response.ok) {
        const statusText = response.statusText
          ? ` ${response.statusText}`
          : "";
        const parts = requestedMetricIds.map((metricId) =>
          unavailableMetricParts(
            metricId,
            request,
            retrievedAt,
            sourceUrl,
            `The Census API request was unavailable with HTTP ${response.status}${statusText}.`,
          ),
        );
        return toResult(request, retrievedAt, 0, parts);
      }

      let table: ParsedTable;
      try {
        table = parseTable(await response.json());
      } catch {
        table = { row: null, rowCount: 0 };
      }
      if (!table.row) {
        const parts = requestedMetricIds.map((metricId) =>
          unavailableMetricParts(
            metricId,
            request,
            retrievedAt,
            sourceUrl,
            "The Census API returned no usable data row.",
          ),
        );
        return toResult(request, retrievedAt, table.rowCount, parts);
      }

      const expectedFips = geographyFips(request.geography);
      const actualFips = responseFips(request.geography, table.row);
      const expectedGeoId = censusGeoId(request.geography);
      const actualGeoId = table.row.GEO_ID;
      if (
        actualFips !== expectedFips ||
        (typeof actualGeoId === "string" && actualGeoId !== expectedGeoId)
      ) {
        const parts = requestedMetricIds.map((metricId) =>
          unavailableMetricParts(
            metricId,
            request,
            retrievedAt,
            sourceUrl,
            `The Census response geography is incompatible with requested FIPS ${expectedFips}.`,
            true,
          ),
        );
        return toResult(request, retrievedAt, table.rowCount, parts);
      }

      const directParts = new Map<
        Exclude<CensusMetricId, "census.population_density">,
        ObservationParts
      >();
      for (const metricId of directMetricIds) {
        directParts.set(
          metricId,
          directMetricParts(
            metricId,
            request,
            table.row,
            retrievedAt,
            sourceUrl,
            maxVintageAgeYears,
          ),
        );
      }

      const parts = requestedMetricIds.map((metricId) => {
        if (isDirectCensusMetric(metricId)) {
          return directParts.get(metricId)!;
        }
        return densityParts(
          request,
          directParts.get("census.total_population")!,
          retrievedAt,
          sourceUrl,
          maxVintageAgeYears,
        );
      });
      return toResult(request, retrievedAt, table.rowCount, parts);
    },
  };
}
