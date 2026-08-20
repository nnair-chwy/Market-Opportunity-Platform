import { directIdentifierColumns, finiteNonnegative, isDateOnly, parseAggregateCsv } from "../regional-outcomes/csv.ts";

export type TableauCvcMetroOutcomeRecord = {
  metro: string;
  weekStartDate: string;
  channel: string;
  spend: number;
  impressions: number;
  clicks: number;
  appointments: number;
  completedAppointments: number;
  newToChewyAppointments: number;
  netSales: number;
  siteCount: number;
};

const REQUIRED = ["METRO", "WEEK_START_DATE", "CHANNEL_CODE", "SPEND", "IMPRESSIONS", "CLICKS", "CVC_APPOINTMENTS", "COMPLETED_APPOINTMENTS", "NEW_TO_CHEWY_APPOINTMENTS", "NET_SALES", "SITE_COUNT"] as const;

export function parseTableauCvcMetroOutcomesCsv(csv: string) {
  const errors: string[] = [];
  let table;
  try {
    table = parseAggregateCsv(csv);
  } catch (error) {
    return { ready: false, records: [] as TableauCvcMetroOutcomeRecord[], errors: [error instanceof Error ? error.message : "Invalid CSV."], warnings: [] as string[], metadata: { grain: "metro_x_week_x_channel" as const, crosswalkStatus: "tableau_label_only" as const, containsIndividualDetail: false as const } };
  }
  const identifiers = directIdentifierColumns(table.header);
  if (identifiers.length) errors.push(`Direct or row-level identifiers are not allowed: ${identifiers.join(", ")}.`);
  for (const column of REQUIRED) if (!table.header.includes(column)) errors.push(`Required column ${column} is missing.`);
  const records: TableauCvcMetroOutcomeRecord[] = [];
  const keys = new Set<string>();
  if (!errors.length) for (const { rowNumber, values } of table.rows) {
    const numericValues = REQUIRED.slice(3).map((column) => finiteNonnegative(values[column]));
    if (!values.METRO || !values.CHANNEL_CODE || !isDateOnly(values.WEEK_START_DATE) || numericValues.some((value) => value === null)) {
      errors.push(`Row ${rowNumber} has a blank or invalid metro, week, channel, or measure.`);
      continue;
    }
    const key = `${values.METRO}|${values.WEEK_START_DATE}|${values.CHANNEL_CODE}`;
    if (keys.has(key)) { errors.push(`Row ${rowNumber} duplicates the metro x week x channel grain.`); continue; }
    keys.add(key);
    const [spend, impressions, clicks, appointments, completedAppointments, newToChewyAppointments, netSales, siteCount] = numericValues as number[];
    records.push({ metro: values.METRO, weekStartDate: values.WEEK_START_DATE, channel: values.CHANNEL_CODE, spend, impressions, clicks, appointments, completedAppointments, newToChewyAppointments, netSales, siteCount });
  }
  return {
    ready: errors.length === 0 && records.length > 0,
    records,
    errors,
    warnings: ["Tableau metro labels are not CBSA or DMA codes; joins require an approved crosswalk.", "Observed spend and outcomes do not establish incrementality or CCP."],
    metadata: { grain: "metro_x_week_x_channel" as const, crosswalkStatus: "tableau_label_only" as const, containsIndividualDetail: false as const },
  };
}
