import {
  CBSA_TYPE_LABELS,
  MAINLAND_STATE_FIPS,
  STATE_OR_TERRITORY_BY_FIPS,
} from "./constants.ts";
import {
  CBSA_ALLOWED_USE,
  CBSA_DELINEATION_VINTAGE,
  CBSA_EVIDENCE_STATUS,
  CBSA_SCORING_ELIGIBILITY,
  CBSA_SENSITIVITY,
  CBSA_SOURCE_ID,
  CBSA_TRANSFORMATION_VERSION,
  type CbsaMarket,
  type CbsaRejectedAudit,
  type CbsaTransformationResult,
  type CbsaType,
  type CbsaUniverseSnapshot,
  type ComponentCounty,
  type PrincipalCity,
  type RejectedCbsaRow,
  type SourceRow,
} from "./types.ts";

type ParsedDelineation = {
  row: SourceRow;
  cbsaCode: string;
  cbsaName: string;
  cbsaType: CbsaType;
  county: ComponentCounty;
};

type ParsedPrincipalCity = {
  row: SourceRow;
  cbsaCode: string;
  cbsaName: string;
  cbsaType: CbsaType;
  city: PrincipalCity;
};

const FORBIDDEN_CREDENTIAL_PATTERN =
  /\b(api[_ -]?key|authorization|bearer|password|private[_ -]?key|secret|access[_ -]?token)\b/i;

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
}

export function normalizeFixedWidthCode(
  value: unknown,
  width: number,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0 || value >= 10 ** width) {
      return null;
    }
    return String(value).padStart(width, "0");
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return new RegExp(`^\\d{${width}}$`).test(trimmed) ? trimmed : null;
}

function reject(
  dataset: RejectedCbsaRow["dataset"],
  row: SourceRow,
  reasons: string[],
): RejectedCbsaRow {
  return {
    dataset,
    row_number: row.row_number,
    cbsa_code: normalizeFixedWidthCode(row.values["CBSA Code"], 5),
    reasons: [...new Set(reasons)].sort(),
    values: row.values,
  };
}

function parseType(value: unknown): CbsaType | null {
  const label = stringValue(value);
  return label === null ? null : (CBSA_TYPE_LABELS[label] ?? null);
}

function parseDelineation(
  row: SourceRow,
): { value: ParsedDelineation | null; rejection: RejectedCbsaRow | null } {
  const reasons: string[] = [];
  const cbsaCode = normalizeFixedWidthCode(row.values["CBSA Code"], 5);
  const cbsaName = stringValue(row.values["CBSA Title"]);
  const cbsaType = parseType(
    row.values["Metropolitan/Micropolitan Statistical Area"],
  );
  const countyName = stringValue(row.values["County/County Equivalent"]);
  const stateName = stringValue(row.values["State Name"]);
  const stateFips = normalizeFixedWidthCode(
    row.values["FIPS State Code"],
    2,
  );
  const countyPart = normalizeFixedWidthCode(
    row.values["FIPS County Code"],
    3,
  );

  if (cbsaCode === null) reasons.push("CBSA Code must be exactly five digits.");
  if (cbsaName === null) reasons.push("CBSA Title must be a non-empty string.");
  if (cbsaType === null) {
    reasons.push(
      "Metropolitan/Micropolitan Statistical Area must use an expected Census label.",
    );
  }
  if (countyName === null) {
    reasons.push("County/County Equivalent must be a non-empty string.");
  }
  if (stateName === null) reasons.push("State Name must be a non-empty string.");
  if (stateFips === null) reasons.push("FIPS State Code must be exactly two digits.");
  if (countyPart === null) {
    reasons.push("FIPS County Code must be exactly three digits.");
  }

  if (reasons.length > 0) {
    return { value: null, rejection: reject("delineation", row, reasons) };
  }

  const state =
    STATE_OR_TERRITORY_BY_FIPS[
      stateFips as keyof typeof STATE_OR_TERRITORY_BY_FIPS
    ];
  if (state === undefined) {
    return {
      value: null,
      rejection: reject("delineation", row, [
        `FIPS State Code ${stateFips} is not a recognized state or territory code.`,
      ]),
    };
  }
  if (state.name !== stateName) {
    return {
      value: null,
      rejection: reject("delineation", row, [
        `State Name ${stateName} does not match FIPS ${stateFips} (${state.name}).`,
      ]),
    };
  }
  const stateCode = state?.code ?? null;
  if (MAINLAND_STATE_FIPS.has(stateFips!) && stateCode === null) {
    return {
      value: null,
      rejection: reject("delineation", row, [
        `No state-code mapping exists for allowed FIPS ${stateFips}.`,
      ]),
    };
  }

  return {
    value: {
      row,
      cbsaCode: cbsaCode!,
      cbsaName: cbsaName!,
      cbsaType: cbsaType!,
      county: {
        county_name: countyName!,
        county_fips: `${stateFips}${countyPart}`,
        state_name: stateName!,
        state_code: stateCode ?? "",
        state_fips: stateFips!,
      },
    },
    rejection: null,
  };
}

function parsePrincipalCity(
  row: SourceRow,
): { value: ParsedPrincipalCity | null; rejection: RejectedCbsaRow | null } {
  const reasons: string[] = [];
  const cbsaCode = normalizeFixedWidthCode(row.values["CBSA Code"], 5);
  const cbsaName = stringValue(row.values["CBSA Title"]);
  const cbsaType = parseType(
    row.values["Metropolitan/Micropolitan Statistical Area"],
  );
  const cityName = stringValue(row.values["Principal City Name"]);
  const stateFips = normalizeFixedWidthCode(
    row.values["FIPS State Code"],
    2,
  );
  const placeFips = normalizeFixedWidthCode(
    row.values["FIPS Place Code"],
    5,
  );

  if (cbsaCode === null) reasons.push("CBSA Code must be exactly five digits.");
  if (cbsaName === null) reasons.push("CBSA Title must be a non-empty string.");
  if (cbsaType === null) {
    reasons.push(
      "Metropolitan/Micropolitan Statistical Area must use an expected Census label.",
    );
  }
  if (cityName === null) reasons.push("Principal City Name must be non-empty.");
  if (stateFips === null) reasons.push("FIPS State Code must be exactly two digits.");
  if (placeFips === null) reasons.push("FIPS Place Code must be exactly five digits.");

  if (reasons.length > 0) {
    return { value: null, rejection: reject("principal_cities", row, reasons) };
  }

  const state =
    STATE_OR_TERRITORY_BY_FIPS[
      stateFips as keyof typeof STATE_OR_TERRITORY_BY_FIPS
    ];
  if (state === undefined) {
    return {
      value: null,
      rejection: reject("principal_cities", row, [
        `FIPS State Code ${stateFips} is not a recognized state or territory code.`,
      ]),
    };
  }
  return {
    value: {
      row,
      cbsaCode: cbsaCode!,
      cbsaName: cbsaName!,
      cbsaType: cbsaType!,
      city: {
        name: cityName!,
        state_code: state?.code ?? "",
        state_fips: stateFips!,
        place_fips: placeFips!,
      },
    },
    rejection: null,
  };
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function duplicateKeys<T>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );
}

function invalidMetadataCodes<T extends {
  cbsaCode: string;
  cbsaName: string;
  cbsaType: CbsaType;
}>(rows: readonly T[]): Set<string> {
  const metadata = new Map<string, Set<string>>();
  for (const row of rows) {
    const values = metadata.get(row.cbsaCode) ?? new Set<string>();
    values.add(`${row.cbsaName}\u0000${row.cbsaType}`);
    metadata.set(row.cbsaCode, values);
  }
  return new Set(
    [...metadata.entries()]
      .filter(([, values]) => values.size > 1)
      .map(([cbsaCode]) => cbsaCode),
  );
}

export function transformCbsaRows(
  delineationRows: readonly SourceRow[],
  principalCityRows: readonly SourceRow[],
): CbsaTransformationResult {
  const rejected: RejectedCbsaRow[] = [];
  const delineations: ParsedDelineation[] = [];
  const principalCities: ParsedPrincipalCity[] = [];
  const taintedCodes = new Set<string>();

  for (const row of delineationRows) {
    const parsed = parseDelineation(row);
    if (parsed.rejection) {
      rejected.push(parsed.rejection);
      if (parsed.rejection.cbsa_code) taintedCodes.add(parsed.rejection.cbsa_code);
    } else {
      delineations.push(parsed.value!);
    }
  }
  for (const row of principalCityRows) {
    const parsed = parsePrincipalCity(row);
    if (parsed.rejection) {
      rejected.push(parsed.rejection);
      if (parsed.rejection.cbsa_code) taintedCodes.add(parsed.rejection.cbsa_code);
    } else {
      principalCities.push(parsed.value!);
    }
  }

  const duplicateCounties = duplicateKeys(
    delineations,
    (row) => `${row.cbsaCode}:${row.county.county_fips}`,
  );
  const duplicateCities = duplicateKeys(
    principalCities,
    (row) =>
      `${row.cbsaCode}:${row.city.state_fips}:${row.city.place_fips}`,
  );
  const inconsistentDelineations = invalidMetadataCodes(delineations);
  const inconsistentCities = invalidMetadataCodes(principalCities);

  const acceptedDelineations = delineations.filter((row) => {
    const duplicateKey = `${row.cbsaCode}:${row.county.county_fips}`;
    const reasons: string[] = [];
    if (duplicateCounties.has(duplicateKey)) {
      reasons.push(`Duplicate CBSA/county record ${duplicateKey}.`);
    }
    if (inconsistentDelineations.has(row.cbsaCode)) {
      reasons.push(`Conflicting delineation metadata for CBSA ${row.cbsaCode}.`);
    }
    if (reasons.length === 0) return true;
    rejected.push(reject("delineation", row.row, reasons));
    taintedCodes.add(row.cbsaCode);
    return false;
  });

  const acceptedCities = principalCities.filter((row) => {
    const duplicateKey =
      `${row.cbsaCode}:${row.city.state_fips}:${row.city.place_fips}`;
    const reasons: string[] = [];
    if (duplicateCities.has(duplicateKey)) {
      reasons.push(`Duplicate CBSA/principal-city record ${duplicateKey}.`);
    }
    if (inconsistentCities.has(row.cbsaCode)) {
      reasons.push(`Conflicting principal-city metadata for CBSA ${row.cbsaCode}.`);
    }
    if (reasons.length === 0) return true;
    rejected.push(reject("principal_cities", row.row, reasons));
    taintedCodes.add(row.cbsaCode);
    return false;
  });

  const byCbsa = new Map<string, ParsedDelineation[]>();
  for (const row of acceptedDelineations) {
    const rows = byCbsa.get(row.cbsaCode) ?? [];
    rows.push(row);
    byCbsa.set(row.cbsaCode, rows);
  }
  const citiesByCbsa = new Map<string, ParsedPrincipalCity[]>();
  for (const row of acceptedCities) {
    const rows = citiesByCbsa.get(row.cbsaCode) ?? [];
    rows.push(row);
    citiesByCbsa.set(row.cbsaCode, rows);
  }

  for (const row of acceptedCities) {
    const marketRows = byCbsa.get(row.cbsaCode);
    if (marketRows === undefined) {
      if (!taintedCodes.has(row.cbsaCode)) {
        rejected.push(
          reject("principal_cities", row.row, [
            `Principal city references unknown CBSA ${row.cbsaCode}.`,
          ]),
        );
      }
      taintedCodes.add(row.cbsaCode);
      continue;
    }
    const market = marketRows[0];
    if (market.cbsaName !== row.cbsaName || market.cbsaType !== row.cbsaType) {
      rejected.push(
        reject("principal_cities", row.row, [
          `Principal-city metadata does not match delineation for CBSA ${row.cbsaCode}.`,
        ]),
      );
      taintedCodes.add(row.cbsaCode);
    }
  }

  const exclusions = {
    market_count: 0,
    delineation_row_count: 0,
    principal_city_row_count: 0,
    by_state_fips: {} as Record<string, number>,
  };
  const markets: CbsaMarket[] = [];

  for (const [cbsaCode, rows] of [...byCbsa.entries()].sort(([a], [b]) =>
    compareStrings(a, b),
  )) {
    if (taintedCodes.has(cbsaCode)) continue;
    const disallowedFips = [
      ...new Set(
        rows
          .map((row) => row.county.state_fips)
          .filter((stateFips) => !MAINLAND_STATE_FIPS.has(stateFips)),
      ),
    ].sort(compareStrings);
    if (disallowedFips.length > 0) {
      exclusions.market_count += 1;
      exclusions.delineation_row_count += rows.length;
      exclusions.principal_city_row_count +=
        citiesByCbsa.get(cbsaCode)?.length ?? 0;
      for (const stateFips of disallowedFips) {
        exclusions.by_state_fips[stateFips] =
          (exclusions.by_state_fips[stateFips] ?? 0) + 1;
      }
      continue;
    }

    const cities = citiesByCbsa.get(cbsaCode) ?? [];
    if (cities.length === 0) {
      rejected.push({
        dataset: "principal_cities",
        row_number: null,
        cbsa_code: cbsaCode,
        reasons: [`No principal-city record exists for CBSA ${cbsaCode}.`],
        values: {},
      });
      continue;
    }
    if (cities.some((city) => !MAINLAND_STATE_FIPS.has(city.city.state_fips))) {
      for (const city of cities.filter(
        (item) => !MAINLAND_STATE_FIPS.has(item.city.state_fips),
      )) {
        rejected.push(
          reject("principal_cities", city.row, [
            `Principal city uses non-mainland state FIPS ${city.city.state_fips} for an eligible CBSA.`,
          ]),
        );
      }
      continue;
    }

    const first = rows[0];
    const componentCounties = rows
      .map((row) => row.county)
      .sort(
        (a, b) =>
          compareStrings(a.county_fips, b.county_fips) ||
          compareStrings(a.county_name, b.county_name),
      );
    const principalCityValues = cities
      .map((row) => row.city)
      .sort(
        (a, b) =>
          compareStrings(a.name, b.name) ||
          compareStrings(a.state_fips, b.state_fips) ||
          compareStrings(a.place_fips, b.place_fips),
      );

    markets.push({
      market_id: `cbsa:${cbsaCode}`,
      cbsa_code: cbsaCode,
      cbsa_name: first.cbsaName,
      cbsa_type: first.cbsaType,
      principal_cities: principalCityValues,
      component_counties: componentCounties,
      state_codes: [
        ...new Set(componentCounties.map((county) => county.state_code)),
      ].sort(compareStrings),
      delineation_vintage: CBSA_DELINEATION_VINTAGE,
      source_id: CBSA_SOURCE_ID,
      evidence_status: CBSA_EVIDENCE_STATUS,
      sensitivity: CBSA_SENSITIVITY,
      allowed_use: CBSA_ALLOWED_USE,
      scoring_eligibility: CBSA_SCORING_ELIGIBILITY,
    });
  }

  rejected.sort(
    (a, b) =>
      compareStrings(a.dataset, b.dataset) ||
      (a.row_number ?? Number.MAX_SAFE_INTEGER) -
        (b.row_number ?? Number.MAX_SAFE_INTEGER) ||
      compareStrings(a.cbsa_code ?? "", b.cbsa_code ?? ""),
  );

  return {
    markets,
    rejected_rows: rejected,
    exclusions: {
      ...exclusions,
      by_state_fips: Object.fromEntries(
        Object.entries(exclusions.by_state_fips).sort(([a], [b]) =>
          compareStrings(a, b),
        ),
      ),
    },
    input_counts: {
      delineation_rows: delineationRows.length,
      principal_city_rows: principalCityRows.length,
    },
  };
}

export function createCbsaUniverseSnapshot(
  markets: CbsaMarket[],
): CbsaUniverseSnapshot {
  return {
    schema_version: "1.0.0",
    transformation_version: CBSA_TRANSFORMATION_VERSION,
    delineation_vintage: CBSA_DELINEATION_VINTAGE,
    source_id: CBSA_SOURCE_ID,
    evidence_status: CBSA_EVIDENCE_STATUS,
    sensitivity: CBSA_SENSITIVITY,
    allowed_use: CBSA_ALLOWED_USE,
    scoring_eligibility: CBSA_SCORING_ELIGIBILITY,
    markets,
  };
}

export function createCbsaRejectedAudit(
  rejectedRows: RejectedCbsaRow[],
): CbsaRejectedAudit {
  return {
    schema_version: "1.0.0",
    transformation_version: CBSA_TRANSFORMATION_VERSION,
    delineation_vintage: CBSA_DELINEATION_VINTAGE,
    source_id: CBSA_SOURCE_ID,
    rejected_rows: rejectedRows,
  };
}

export function assertNoCredentialMaterial(value: unknown): void {
  const serialized = JSON.stringify(value);
  if (FORBIDDEN_CREDENTIAL_PATTERN.test(serialized)) {
    throw new Error("Output contains text that resembles credential material.");
  }
}
