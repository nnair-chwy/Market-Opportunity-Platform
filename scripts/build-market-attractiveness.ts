import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_VERSION = "synthetic-market-attractiveness-2026-07-31-v1";
const TRANSFORMATION_VERSION = "market-attractiveness-csv-to-json-v2";
const inputPath = path.resolve(
  "data/synthetic/market-attractiveness/v1/markets.csv",
);
const outputPath = path.resolve(
  "data/synthetic/market-attractiveness/v1/markets.json",
);
const manifestPath = path.resolve(
  "data/synthetic/market-attractiveness/v1/manifest.json",
);
const cbsaUniversePath = path.resolve(
  "data/public/census/cbsa-universe/2023-07/markets.json",
);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (quoted) throw new Error("CSV ended inside a quoted field.");
  return rows;
}

function required(row: Record<string, string>, field: string): string {
  const value = row[field]?.trim();
  if (!value) throw new Error(`Missing required field ${field}.`);
  return value;
}

function requiredNumber(
  row: Record<string, string>,
  field: string,
): number {
  const value = Number(required(row, field));
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }
  return value;
}

function optionalNumber(
  row: Record<string, string>,
  field: string,
): number | null {
  const raw = row[field]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be blank or a finite number.`);
  }
  return value;
}

type CbsaUniverse = {
  delineation_vintage: string;
  source_id: string;
  markets: Array<{
    cbsa_code: string;
    cbsa_name: string;
  }>;
};

const [csvText, cbsaUniverseText] = await Promise.all([
  readFile(inputPath, "utf8"),
  readFile(cbsaUniversePath, "utf8"),
]);
const cbsaUniverse = JSON.parse(cbsaUniverseText) as CbsaUniverse;
const cbsaByExactName = new Map<string, CbsaUniverse["markets"]>();
for (const market of cbsaUniverse.markets) {
  const matches = cbsaByExactName.get(market.cbsa_name) ?? [];
  matches.push(market);
  cbsaByExactName.set(market.cbsa_name, matches);
}
const parsed = parseCsv(csvText);
const headers = parsed.shift();
if (!headers) throw new Error("CSV has no header row.");

const expectedColumns = new Set([
  "prototype_market_id",
  "cbsa_name",
  "cbsa_type",
  "reporting_date",
  "active_customer_count",
  "active_customer_yoy_growth",
  "total_households",
  "avg_zip_median_household_income",
  "clinics_per_10000_households",
  "veterinarians_per_10000_households",
  "corporate_clinic_share",
  "practice_hub_clinic_share",
  "clinic_orders_per_clinic",
  "synthetic_fields",
  "prototype_evidence_status",
  "synthetic_method_version",
  "scoring_eligibility",
]);
for (const field of expectedColumns) {
  if (!headers.includes(field)) throw new Error(`CSV is missing ${field}.`);
}

const markets = parsed.map((values, rowIndex) => {
  if (values.length !== headers.length) {
    throw new Error(
      `Row ${rowIndex + 2} has ${values.length} columns; expected ${headers.length}.`,
    );
  }
  const row = Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  );
  const cbsaType = required(row, "cbsa_type");
  if (cbsaType !== "metropolitan" && cbsaType !== "micropolitan") {
    throw new Error(`Row ${rowIndex + 2} has invalid cbsa_type ${cbsaType}.`);
  }

  const cbsaName = required(row, "cbsa_name");
  const exactCbsaMatches = cbsaByExactName.get(cbsaName) ?? [];
  if (exactCbsaMatches.length > 1) {
    throw new Error(
      `Row ${rowIndex + 2} has an ambiguous exact CBSA name ${cbsaName}.`,
    );
  }
  const exactCbsaMatch = exactCbsaMatches[0] ?? null;

  return {
    prototype_market_id: required(row, "prototype_market_id"),
    cbsa_code: exactCbsaMatch?.cbsa_code ?? null,
    cbsa_join_status: exactCbsaMatch ? "exact_name" : "unmatched",
    cbsa_join_source_id: cbsaUniverse.source_id,
    cbsa_join_vintage: cbsaUniverse.delineation_vintage,
    cbsa_name: cbsaName,
    cbsa_type: cbsaType,
    reporting_date: required(row, "reporting_date"),
    evidence_status: required(row, "prototype_evidence_status"),
    scoring_eligibility: required(row, "scoring_eligibility"),
    synthetic_method_version: required(row, "synthetic_method_version"),
    synthetic_fields: required(row, "synthetic_fields")
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean),
    metrics: {
      active_customers_per_1000_households: requiredNumber(
        row,
        "active_customers_per_1000_households",
      ),
      active_customer_count: requiredNumber(row, "active_customer_count"),
      active_customer_yoy_growth: requiredNumber(
        row,
        "active_customer_yoy_growth",
      ),
      total_households: requiredNumber(row, "total_households"),
      avg_zip_median_household_income: requiredNumber(
        row,
        "avg_zip_median_household_income",
      ),
      clinics_per_10000_households: requiredNumber(
        row,
        "clinics_per_10000_households",
      ),
      veterinarians_per_10000_households: requiredNumber(
        row,
        "veterinarians_per_10000_households",
      ),
      corporate_clinic_share: requiredNumber(row, "corporate_clinic_share"),
      practice_hub_clinic_share: requiredNumber(
        row,
        "practice_hub_clinic_share",
      ),
      clinic_orders_per_clinic: requiredNumber(
        row,
        "clinic_orders_per_clinic",
      ),
    },
    source_values: {
      active_customer_yoy_growth: optionalNumber(
        row,
        "source_active_customer_yoy_growth",
      ),
      total_households: optionalNumber(row, "source_total_households"),
      avg_zip_median_household_income: optionalNumber(
        row,
        "source_avg_zip_median_household_income",
      ),
      total_veterinary_clinics: optionalNumber(
        row,
        "source_total_veterinary_clinics",
      ),
      total_veterinarians: optionalNumber(row, "source_total_veterinarians"),
      corporate_clinic_count: optionalNumber(
        row,
        "source_corporate_clinic_count",
      ),
      practice_hub_clinic_count: optionalNumber(
        row,
        "source_practice_hub_clinic_count",
      ),
      total_clinic_order_volume: optionalNumber(
        row,
        "source_total_clinic_order_volume",
      ),
    },
    sources: {
      customer: required(row, "customer_data_source"),
      geography: required(row, "geography_source"),
      household_income: required(row, "household_income_source"),
      clinic: required(row, "clinic_data_source"),
      population: required(row, "population_source"),
    },
  };
});

const ids = new Set<string>();
const cbsaCodes = new Set<string>();
for (const market of markets) {
  if (ids.has(market.prototype_market_id)) {
    throw new Error(`Duplicate prototype_market_id ${market.prototype_market_id}.`);
  }
  ids.add(market.prototype_market_id);
  if (market.cbsa_code) {
    if (cbsaCodes.has(market.cbsa_code)) {
      throw new Error(`Duplicate mapped cbsa_code ${market.cbsa_code}.`);
    }
    cbsaCodes.add(market.cbsa_code);
  }
  if (market.evidence_status !== "Hypothesis") {
    throw new Error(`${market.prototype_market_id} is not labeled Hypothesis.`);
  }
  if (market.scoring_eligibility !== "synthetic_prototype_only") {
    throw new Error(
      `${market.prototype_market_id} is not restricted to synthetic prototype use.`,
    );
  }
}
if (markets.length !== 917) {
  throw new Error(`Expected 917 synthetic markets, received ${markets.length}.`);
}

const snapshot = {
  schema_version: "1.0.0",
  data_version: DATA_VERSION,
  transformation_version: TRANSFORMATION_VERSION,
  evidence_status: "Hypothesis",
  allowed_use: "synthetic_prototype_only",
  markets,
};
const outputText = `${JSON.stringify(snapshot, null, 2)}\n`;
const manifest = {
  schema_version: "1.0.0",
  data_version: DATA_VERSION,
  transformation_version: TRANSFORMATION_VERSION,
  evidence_status: "Hypothesis",
  allowed_use: "synthetic_prototype_only",
  input: {
    file: path.relative(process.cwd(), inputPath),
    sha256: sha256(csvText),
    row_count: markets.length,
    column_count: headers.length,
  },
  cbsa_crosswalk: {
    file: path.relative(process.cwd(), cbsaUniversePath),
    sha256: sha256(cbsaUniverseText),
    source_id: cbsaUniverse.source_id,
    delineation_vintage: cbsaUniverse.delineation_vintage,
    method: "exact_cbsa_name_only",
    matched_count: markets.filter((market) => market.cbsa_code !== null).length,
    unmatched_count: markets.filter((market) => market.cbsa_code === null).length,
  },
  output: {
    file: path.relative(process.cwd(), outputPath),
    sha256: sha256(outputText),
    market_count: markets.length,
    metropolitan_count: markets.filter(
      (market) => market.cbsa_type === "metropolitan",
    ).length,
    micropolitan_count: markets.filter(
      (market) => market.cbsa_type === "micropolitan",
    ).length,
  },
  limitations: [
    "CBSA codes are attached only when the synthetic name exactly and uniquely matches the versioned SRC-014 universe.",
    "Unmatched synthetic records retain null CBSA codes and remain unscored on the public map; renamed or changed areas are not inferred.",
    "All scoring inputs are synthetic prototype evidence.",
    "The snapshot supports screening demonstrations, not site or lease decisions.",
  ],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, outputText);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Built ${markets.length} synthetic market records at ${path.relative(process.cwd(), outputPath)}.`,
);
