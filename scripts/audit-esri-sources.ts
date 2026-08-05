import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv, readXlsxTable } from "./build-esri-demo.ts";

type Table = ReturnType<typeof parseCsv>;

const SENSITIVE_FIELD_PATTERN =
  /phone|email|owner|employee|customer|pet|medical|landlord|lease|rent|deposit|tenant allowance|hin|street|address/i;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function duplicateGroupCount(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

function keyProfile(table: Table, field: string) {
  const values = table.rows.map((row) => row[field]?.trim() ?? "");
  const populated = values.filter(Boolean);
  return {
    field,
    populated: populated.length,
    null_count: values.length - populated.length,
    unique_non_null: new Set(populated).size,
    duplicate_value_groups: duplicateGroupCount(populated),
  };
}

function tableProfile(input: {
  name: string;
  bytes: Buffer;
  table: Table;
  keyFields: string[];
  nameField?: string;
  latitudeField?: string;
  longitudeField?: string;
}) {
  const {
    name,
    bytes,
    table,
    keyFields,
    nameField,
    latitudeField,
    longitudeField,
  } = input;
  const rowFingerprints = table.rows.map((row) =>
    sha256(table.headers.map((header) => row[header] ?? "").join("\u001f")),
  );
  const names = nameField
    ? table.rows.map((row) => row[nameField]?.trim().toLowerCase() ?? "")
    : [];
  const coordinates =
    latitudeField && longitudeField
      ? table.rows.map((row) => {
          const latitude = row[latitudeField]?.trim() ?? "";
          const longitude = row[longitudeField]?.trim() ?? "";
          return latitude && longitude ? `${latitude},${longitude}` : "";
        })
      : [];
  return {
    name,
    sha256: sha256(bytes),
    row_count: table.rows.length,
    field_count: table.headers.length,
    key_profiles: keyFields.map((field) => keyProfile(table, field)),
    duplicate_full_row_groups: duplicateGroupCount(rowFingerprints),
    duplicate_name_groups: duplicateGroupCount(names),
    unnamed_rows: names.filter((value) => !value).length,
    repeated_coordinate_groups: duplicateGroupCount(coordinates),
    rows_with_coordinates: coordinates.filter(Boolean).length,
    all_null_fields: table.headers.filter((header) =>
      table.rows.every((row) => !(row[header]?.trim() ?? "")),
    ),
    sensitive_or_restricted_field_names: table.headers.filter((header) =>
      SENSITIVE_FIELD_PATTERN.test(header),
    ),
  };
}

function projectionMatches(full: Table, demo: Table) {
  return (
    full.rows.length === demo.rows.length &&
    demo.headers.every((header) => full.headers.includes(header)) &&
    demo.rows.every((row, rowIndex) =>
      demo.headers.every(
        (header) => row[header] === full.rows[rowIndex][header],
      ),
    )
  );
}

function argumentsFromCli() {
  const values = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const value = process.argv[index + 1];
    if (!flag?.startsWith("--") || !value) {
      throw new Error("Arguments must be supplied as --name value pairs.");
    }
    values.set(flag.slice(2), path.resolve(value));
  }
  for (const flag of [
    "clinic-full",
    "clinic-demo",
    "master-full",
    "master-demo",
    "trade-areas",
  ]) {
    if (!values.has(flag)) throw new Error(`Missing --${flag}.`);
  }
  return values;
}

export async function auditEsriSources(values: Map<string, string>) {
  const paths = [
    values.get("clinic-full")!,
    values.get("clinic-demo")!,
    values.get("master-full")!,
    values.get("master-demo")!,
    values.get("trade-areas")!,
  ];
  const bytes = await Promise.all(paths.map((sourcePath) => readFile(sourcePath)));
  const clinicFull = parseCsv(bytes[0].toString("utf8"));
  const clinicDemo = parseCsv(bytes[1].toString("utf8"));
  const masterFull = parseCsv(bytes[2].toString("utf8"));
  const masterDemo = parseCsv(bytes[3].toString("utf8"));
  const tradeAreas = await readXlsxTable(bytes[4]);
  return {
    audited_at: "2026-07-30",
    demo_projection_checks: {
      clinic: projectionMatches(clinicFull, clinicDemo),
      master_site: projectionMatches(masterFull, masterDemo),
    },
    sources: [
      tableProfile({
        name: path.basename(paths[0]),
        bytes: bytes[0],
        table: clinicFull,
        keyFields: ["clinic_id", "clinic_key", "golden_clinic_id", "objectid"],
        nameField: "name",
        latitudeField: "latitude",
        longitudeField: "longitude",
      }),
      tableProfile({
        name: path.basename(paths[1]),
        bytes: bytes[1],
        table: clinicDemo,
        keyFields: ["clinic_id", "clinic_key", "golden_clinic_id", "objectid"],
        nameField: "name",
        latitudeField: "latitude",
        longitudeField: "longitude",
      }),
      tableProfile({
        name: path.basename(paths[2]),
        bytes: bytes[2],
        table: masterFull,
        keyFields: ["GlobalID", "ESRI ID", "Site Code", "Business ID"],
        nameField: "Site Name",
        latitudeField: "Latitude",
        longitudeField: "Longitude",
      }),
      tableProfile({
        name: path.basename(paths[3]),
        bytes: bytes[3],
        table: masterDemo,
        keyFields: ["GlobalID", "ESRI ID", "Site Code", "Business ID"],
        nameField: "Site Name",
        latitudeField: "Latitude",
        longitudeField: "Longitude",
      }),
      tableProfile({
        name: path.basename(paths[4]),
        bytes: bytes[4],
        table: tradeAreas,
        keyFields: ["GlobalID", "System ID", "ESRI_ID"],
        nameField: "Site Name",
      }),
    ],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await auditEsriSources(argumentsFromCli()), null, 2));
}
