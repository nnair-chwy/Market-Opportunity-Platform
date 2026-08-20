import { directIdentifierColumns, finiteNonnegative, isDateOnly, parseAggregateCsv } from "../regional-outcomes/csv.ts";

export const CVC_WEEKLY_SITE_METRO_REQUIRED_COLUMNS = [
  "SITE_ID",
  "CBSA_CODE",
  "WEEK_START_DATE",
  "COMPLETED_APPOINTMENTS",
  "STAFFED_CAPACITY",
] as const;

export type CvcWeeklySiteMetroRecord = {
  siteId: string;
  cbsaCode: string;
  weekStartDate: string;
  completedAppointments: number;
  staffedCapacity: number;
  maturityStatus: string | null;
  monthsOpen: number | null;
  netSales: number | null;
  newToChewyCount: number | null;
};

export type CvcWeeklySiteMetroImport = {
  ready: boolean;
  records: CvcWeeklySiteMetroRecord[];
  errors: string[];
  warnings: string[];
  metadata: { grain: "site_x_cbsa_x_week"; containsIndividualDetail: false };
};

export function parseCvcWeeklySiteMetroCsv(csv: string): CvcWeeklySiteMetroImport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let table;
  try {
    table = parseAggregateCsv(csv);
  } catch (error) {
    return { ready: false, records: [], errors: [error instanceof Error ? error.message : "Invalid CSV."], warnings, metadata: { grain: "site_x_cbsa_x_week", containsIndividualDetail: false } };
  }

  const identifiers = directIdentifierColumns(table.header);
  if (identifiers.length) errors.push(`Direct or row-level identifiers are not allowed: ${identifiers.join(", ")}.`);
  for (const column of CVC_WEEKLY_SITE_METRO_REQUIRED_COLUMNS) {
    if (!table.header.includes(column)) errors.push(`Required column ${column} is missing.`);
  }
  if (!table.header.includes("MATURITY_STATUS") && !table.header.includes("MONTHS_OPEN")) {
    errors.push("MATURITY_STATUS or MONTHS_OPEN is required for mature-clinic comparisons.");
  }

  const records: CvcWeeklySiteMetroRecord[] = [];
  const keys = new Set<string>();
  if (!errors.length) {
    for (const { rowNumber, values } of table.rows) {
      const requiredText = [values.SITE_ID, values.CBSA_CODE, values.WEEK_START_DATE];
      if (requiredText.some((value) => !value)) {
        errors.push(`Row ${rowNumber} has a blank site, CBSA, or week.`);
        continue;
      }
      if (!/^\d{5}$/.test(values.CBSA_CODE) || !isDateOnly(values.WEEK_START_DATE)) {
        errors.push(`Row ${rowNumber} has an invalid CBSA_CODE or WEEK_START_DATE.`);
        continue;
      }
      const completedAppointments = finiteNonnegative(values.COMPLETED_APPOINTMENTS);
      const staffedCapacity = finiteNonnegative(values.STAFFED_CAPACITY);
      const monthsOpen = table.header.includes("MONTHS_OPEN") ? finiteNonnegative(values.MONTHS_OPEN) : null;
      const netSales = table.header.includes("NET_SALES") ? finiteNonnegative(values.NET_SALES) : null;
      const newToChewyCount = table.header.includes("NEW_TO_CHEWY_COUNT") ? finiteNonnegative(values.NEW_TO_CHEWY_COUNT) : null;
      if (completedAppointments === null || staffedCapacity === null || (table.header.includes("MONTHS_OPEN") && monthsOpen === null)) {
        errors.push(`Row ${rowNumber} has a blank, negative, or nonnumeric required measure.`);
        continue;
      }
      const key = `${values.SITE_ID}|${values.CBSA_CODE}|${values.WEEK_START_DATE}`;
      if (keys.has(key)) {
        errors.push(`Row ${rowNumber} duplicates the site × CBSA × week grain.`);
        continue;
      }
      keys.add(key);
      records.push({ siteId: values.SITE_ID, cbsaCode: values.CBSA_CODE, weekStartDate: values.WEEK_START_DATE, completedAppointments, staffedCapacity, maturityStatus: values.MATURITY_STATUS || null, monthsOpen, netSales, newToChewyCount });
    }
  }
  if (!table.header.includes("NET_SALES")) warnings.push("NET_SALES is absent; the adapter can assess capacity and appointments but not clinic revenue value.");
  if (!table.header.includes("NEW_TO_CHEWY_COUNT")) warnings.push("NEW_TO_CHEWY_COUNT is absent; acquisition value cannot be sized from this export.");
  return { ready: errors.length === 0 && records.length > 0, records, errors, warnings, metadata: { grain: "site_x_cbsa_x_week", containsIndividualDetail: false } };
}
