import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  CBSA_ALLOWED_USE,
  CBSA_DELINEATION_VINTAGE,
  CBSA_SCORING_ELIGIBILITY,
  CBSA_SOURCE_ID,
  DELINEATION_COLUMNS,
  DELINEATION_WORKBOOK_SPEC,
  PRINCIPAL_CITY_WORKBOOK_SPEC,
  assertNoCredentialMaterial,
  createCbsaUniverseSnapshot,
  normalizeFixedWidthCode,
  readCbsaSourceWorkbooks,
  readSourceRowsFromWorkbook,
  transformCbsaRows,
  type SourceRow,
} from "../lib/data/cbsa-universe/index.ts";
import {
  DELINEATION_URL,
  PRINCIPAL_CITY_URL,
  createCbsaUniverseManifest,
} from "../scripts/build-cbsa-universe.ts";

function row(
  rowNumber: number,
  values: Readonly<Record<string, unknown>>,
): SourceRow {
  return { row_number: rowNumber, values };
}

function delineation(
  rowNumber: number,
  input: {
    cbsaCode: unknown;
    cbsaName: string;
    type: string;
    countyName: string;
    stateName: string;
    stateFips: unknown;
    countyFips: unknown;
  },
): SourceRow {
  return row(rowNumber, {
    "CBSA Code": input.cbsaCode,
    "CBSA Title": input.cbsaName,
    "Metropolitan/Micropolitan Statistical Area": input.type,
    "County/County Equivalent": input.countyName,
    "State Name": input.stateName,
    "FIPS State Code": input.stateFips,
    "FIPS County Code": input.countyFips,
  });
}

function principalCity(
  rowNumber: number,
  input: {
    cbsaCode: unknown;
    cbsaName: string;
    type: string;
    name: string;
    stateFips: unknown;
    placeFips: unknown;
  },
): SourceRow {
  return row(rowNumber, {
    "CBSA Code": input.cbsaCode,
    "CBSA Title": input.cbsaName,
    "Metropolitan/Micropolitan Statistical Area": input.type,
    "Principal City Name": input.name,
    "FIPS State Code": input.stateFips,
    "FIPS Place Code": input.placeFips,
  });
}

const METRO = "Metropolitan Statistical Area";
const MICRO = "Micropolitan Statistical Area";

const baseDelineations = [
  delineation(4, {
    cbsaCode: "12345",
    cbsaName: "Alpha-Beta, TX-OK",
    type: METRO,
    countyName: "Beta County",
    stateName: "Oklahoma",
    stateFips: "40",
    countyFips: "003",
  }),
  delineation(5, {
    cbsaCode: "12345",
    cbsaName: "Alpha-Beta, TX-OK",
    type: METRO,
    countyName: "Alpha County",
    stateName: "Texas",
    stateFips: "48",
    countyFips: "001",
  }),
  delineation(6, {
    cbsaCode: "10100",
    cbsaName: "Small Place, CA",
    type: MICRO,
    countyName: "Small County",
    stateName: "California",
    stateFips: "06",
    countyFips: "007",
  }),
] as const;

const baseCities = [
  principalCity(4, {
    cbsaCode: "12345",
    cbsaName: "Alpha-Beta, TX-OK",
    type: METRO,
    name: "Beta",
    stateFips: "40",
    placeFips: "00002",
  }),
  principalCity(5, {
    cbsaCode: "12345",
    cbsaName: "Alpha-Beta, TX-OK",
    type: METRO,
    name: "Alpha",
    stateFips: "48",
    placeFips: "00001",
  }),
  principalCity(6, {
    cbsaCode: "10100",
    cbsaName: "Small Place, CA",
    type: MICRO,
    name: "Small Place",
    stateFips: "06",
    placeFips: "01234",
  }),
] as const;

test("builds stable IDs and aggregates metro, micro, cities, counties, and states", () => {
  const result = transformCbsaRows(baseDelineations, baseCities);

  assert.equal(result.rejected_rows.length, 0);
  assert.deepEqual(
    result.markets.map((market) => market.market_id),
    ["cbsa:10100", "cbsa:12345"],
  );
  assert.deepEqual(
    result.markets.map((market) => market.cbsa_type),
    ["micropolitan", "metropolitan"],
  );

  const metro = result.markets[1];
  assert.deepEqual(
    metro.principal_cities.map((city) => city.name),
    ["Alpha", "Beta"],
  );
  assert.deepEqual(
    metro.component_counties.map((county) => county.county_fips),
    ["40003", "48001"],
  );
  assert.deepEqual(metro.state_codes, ["OK", "TX"]);
  assert.equal(metro.allowed_use, "market_context_only");
  assert.equal(metro.scoring_eligibility, "none");
});

test("uses the explicit mainland FIPS allowlist and excludes Alaska, Hawaii, and territories", () => {
  const excluded = [
    ["20000", "Alaska Place, AK", "Alaska", "02"],
    ["20001", "Hawaii Place, HI", "Hawaii", "15"],
    ["20002", "Puerto Rico Place, PR", "Puerto Rico", "72"],
    ["20003", "Guam Place, GU", "Guam", "66"],
  ] as const;
  const delineations = excluded.map(([code, name, state, fips], index) =>
    delineation(index + 4, {
      cbsaCode: code,
      cbsaName: name,
      type: MICRO,
      countyName: `${state} County`,
      stateName: state,
      stateFips: fips,
      countyFips: "001",
    }),
  );
  const cities = excluded.map(([code, name, , fips], index) =>
    principalCity(index + 4, {
      cbsaCode: code,
      cbsaName: name,
      type: MICRO,
      name: name.split(",")[0],
      stateFips: fips,
      placeFips: "00001",
    }),
  );

  const result = transformCbsaRows(
    [...baseDelineations, ...delineations],
    [...baseCities, ...cities],
  );

  assert.equal(result.markets.length, 2);
  assert.equal(result.exclusions.market_count, 4);
  assert.deepEqual(result.exclusions.by_state_fips, {
    "02": 1,
    "15": 1,
    "66": 1,
    "72": 1,
  });
});

test("rejects every duplicate record and prevents a partial market", () => {
  const duplicateCounty = baseDelineations[2];
  const duplicateCity = baseCities[2];
  const result = transformCbsaRows(
    [...baseDelineations, { ...duplicateCounty, row_number: 20 }],
    [...baseCities, { ...duplicateCity, row_number: 20 }],
  );

  assert.equal(
    result.markets.some((market) => market.cbsa_code === "10100"),
    false,
  );
  assert.equal(
    result.rejected_rows.filter((item) => item.cbsa_code === "10100").length,
    4,
  );
  assert(
    result.rejected_rows.every((item) =>
      item.reasons.some((reason) => reason.startsWith("Duplicate")),
    ),
  );
});

test("retains malformed rows in audit and excludes their market", () => {
  const malformed = delineation(30, {
    cbsaCode: "12345",
    cbsaName: "Alpha-Beta, TX-OK",
    type: METRO,
    countyName: "Malformed County",
    stateName: "Texas",
    stateFips: "48",
    countyFips: "7",
  });
  const result = transformCbsaRows(
    [...baseDelineations, malformed],
    baseCities,
  );

  assert.equal(
    result.markets.some((market) => market.cbsa_code === "12345"),
    false,
  );
  assert.equal(result.rejected_rows[0].row_number, 30);
  assert.match(result.rejected_rows[0].reasons.join(" "), /exactly three digits/);
});

test("orders records and nested arrays deterministically", () => {
  const forward = transformCbsaRows(baseDelineations, baseCities);
  const reverse = transformCbsaRows(
    [...baseDelineations].reverse(),
    [...baseCities].reverse(),
  );

  assert.deepEqual(reverse, forward);
});

test("preserves null separately from observed numeric zero", () => {
  assert.equal(normalizeFixedWidthCode(null, 5), null);
  assert.equal(normalizeFixedWidthCode("", 5), null);
  assert.equal(normalizeFixedWidthCode(0, 5), "00000");
  assert.equal(normalizeFixedWidthCode("00000", 5), "00000");
});

test("creates and validates manifest counts and public provenance", () => {
  const transformed = transformCbsaRows(baseDelineations, baseCities);
  const manifest = createCbsaUniverseManifest({
    transformed,
    retrievedAt: "2026-07-29T12:00:00.000Z",
    sources: [
      {
        role: "principal_cities",
        url: PRINCIPAL_CITY_URL,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sha256: "b".repeat(64),
      },
      {
        role: "cbsa_delineation",
        url: DELINEATION_URL,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sha256: "a".repeat(64),
      },
    ],
    outputs: [
      {
        path: "data/public/census/cbsa-universe/2023-07/markets.json",
        sha256: "c".repeat(64),
        record_count: 2,
      },
    ],
  });

  assert.equal(manifest.source_id, CBSA_SOURCE_ID);
  assert.equal(manifest.source_vintage, CBSA_DELINEATION_VINTAGE);
  assert.equal(manifest.counts.output_markets, 2);
  assert.equal(manifest.counts.metropolitan_markets, 1);
  assert.equal(manifest.counts.micropolitan_markets, 1);
  assert.equal(manifest.counts.rejected_rows, 0);
  assert.deepEqual(
    manifest.sources.map((source) => source.role),
    ["cbsa_delineation", "principal_cities"],
  );
});

test("snapshot contract is market context only and output rejects credential-like material", () => {
  const transformed = transformCbsaRows(baseDelineations, baseCities);
  const snapshot = createCbsaUniverseSnapshot(transformed.markets);

  assert.equal(snapshot.allowed_use, CBSA_ALLOWED_USE);
  assert.equal(snapshot.scoring_eligibility, CBSA_SCORING_ELIGIBILITY);
  assert.doesNotThrow(() => assertNoCredentialMaterial(snapshot));
  assert.throws(
    () => assertNoCredentialMaterial({ access_token: "not-allowed" }),
    /credential material/,
  );
});

async function writeWorkbook(
  filePath: string,
  spec: typeof DELINEATION_WORKBOOK_SPEC,
  values: readonly (readonly unknown[])[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(spec.worksheetName);
  sheet.getCell(2, 1).value = `Synthetic ${spec.titleFragment}`;
  spec.columns.forEach((column, index) => {
    sheet.getCell(3, index + 1).value = column;
  });
  values.forEach((record, rowIndex) => {
    record.forEach((value, columnIndex) => {
      sheet.getCell(rowIndex + 4, columnIndex + 1).value =
        value as ExcelJS.CellValue;
    });
  });
  const blankRow = values.length + 4;
  sheet.getCell(blankRow + 1, 1).value = "Note: synthetic offline fixture";
  sheet.getCell(blankRow + 2, 1).value = "Source: synthetic offline fixture";
  await workbook.xlsx.writeFile(filePath);
}

test("parses offline XLSX fixtures and fails closed on a changed worksheet", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cbsa-xlsx-test-"));
  const delineationPath = path.join(directory, "list1.xlsx");
  const citiesPath = path.join(directory, "list2.xlsx");
  try {
    await writeWorkbook(delineationPath, DELINEATION_WORKBOOK_SPEC, [
      [
        "10100",
        null,
        null,
        "Small Place, CA",
        MICRO,
        null,
        null,
        "Small County",
        "California",
        "06",
        "007",
        "Central",
      ],
    ]);
    await writeWorkbook(
      citiesPath,
      PRINCIPAL_CITY_WORKBOOK_SPEC as typeof DELINEATION_WORKBOOK_SPEC,
      [["10100", "Small Place, CA", MICRO, "Small Place", "06", "01234"]],
    );

    const parsed = await readCbsaSourceWorkbooks(
      delineationPath,
      citiesPath,
    );
    assert.equal(parsed.delineationRows.length, 1);
    assert.equal(parsed.principalCityRows.length, 1);
    assert.equal(parsed.delineationRows[0].values["FIPS State Code"], "06");

    const changed = new ExcelJS.Workbook();
    const changedSheet = changed.addWorksheet("Renamed List");
    changedSheet.getCell(2, 1).value = "Synthetic JULY 2023";
    DELINEATION_COLUMNS.forEach((column, index) => {
      changedSheet.getCell(3, index + 1).value = column;
    });
    const changedPath = path.join(directory, "changed.xlsx");
    await changed.xlsx.writeFile(changedPath);
    await assert.rejects(
      readSourceRowsFromWorkbook(changedPath, DELINEATION_WORKBOOK_SPEC),
      /Required worksheet List 1 is missing/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("fails manifest validation for missing or malformed provenance", () => {
  const transformed = transformCbsaRows(baseDelineations, baseCities);
  assert.throws(
    () =>
      createCbsaUniverseManifest({
        transformed,
        retrievedAt: "not-a-timestamp",
        sources: [],
        outputs: [],
      }),
    /ISO 8601/,
  );
  assert.throws(
    () =>
      createCbsaUniverseManifest({
        transformed,
        retrievedAt: "2026-07-29T12:00:00.000Z",
        sources: [
          {
            role: "cbsa_delineation",
            url: DELINEATION_URL,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            sha256: "bad-hash",
          },
          {
            role: "principal_cities",
            url: PRINCIPAL_CITY_URL,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            sha256: "b".repeat(64),
          },
        ],
        outputs: [],
      }),
    /SHA-256/,
  );
});
