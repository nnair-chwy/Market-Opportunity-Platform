import { directIdentifierColumns, finiteNonnegative, isDateOnly, parseAggregateCsv } from "../regional-outcomes/csv.ts";

export const MARKETING_WEEKLY_DMA_REQUIRED_COLUMNS = [
  "DMA_CODE",
  "WEEK_START_DATE",
  "CHANNEL",
  "SPEND",
  "ORDER_COUNT",
] as const;

export type MarketingWeeklyDmaRecord = {
  dmaCode: string;
  weekStartDate: string;
  channel: string;
  spend: number;
  orderCount: number;
  newCustomerCount: number | null;
  contribution: number | null;
};

export type MarketingWeeklyDmaImport = {
  ready: boolean;
  records: MarketingWeeklyDmaRecord[];
  errors: string[];
  warnings: string[];
  metadata: { grain: "dma_x_week_x_channel"; containsIndividualDetail: false; geographyConversion: "none" };
};

export function parseMarketingWeeklyDmaCsv(csv: string): MarketingWeeklyDmaImport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let table;
  try {
    table = parseAggregateCsv(csv);
  } catch (error) {
    return { ready: false, records: [], errors: [error instanceof Error ? error.message : "Invalid CSV."], warnings, metadata: { grain: "dma_x_week_x_channel", containsIndividualDetail: false, geographyConversion: "none" } };
  }
  const identifiers = directIdentifierColumns(table.header);
  if (identifiers.length) errors.push(`Direct or row-level identifiers are not allowed: ${identifiers.join(", ")}.`);
  for (const column of MARKETING_WEEKLY_DMA_REQUIRED_COLUMNS) {
    if (!table.header.includes(column)) errors.push(`Required column ${column} is missing.`);
  }

  const records: MarketingWeeklyDmaRecord[] = [];
  const keys = new Set<string>();
  if (!errors.length) {
    for (const { rowNumber, values } of table.rows) {
      if (!values.DMA_CODE || !values.CHANNEL || !isDateOnly(values.WEEK_START_DATE)) {
        errors.push(`Row ${rowNumber} has a blank DMA/channel or invalid WEEK_START_DATE.`);
        continue;
      }
      const spend = finiteNonnegative(values.SPEND);
      const orderCount = finiteNonnegative(values.ORDER_COUNT);
      const newCustomerCount = table.header.includes("NEW_CUSTOMER_COUNT") ? finiteNonnegative(values.NEW_CUSTOMER_COUNT) : null;
      const contribution = table.header.includes("CONTRIBUTION") ? finiteNonnegative(values.CONTRIBUTION) : null;
      if (spend === null || orderCount === null) {
        errors.push(`Row ${rowNumber} has a blank, negative, or nonnumeric SPEND or ORDER_COUNT.`);
        continue;
      }
      const key = `${values.DMA_CODE}|${values.WEEK_START_DATE}|${values.CHANNEL.toLowerCase()}`;
      if (keys.has(key)) {
        errors.push(`Row ${rowNumber} duplicates the DMA × week × channel grain.`);
        continue;
      }
      keys.add(key);
      records.push({ dmaCode: values.DMA_CODE, weekStartDate: values.WEEK_START_DATE, channel: values.CHANNEL, spend, orderCount, newCustomerCount, contribution });
    }
  }
  if (!table.header.includes("NEW_CUSTOMER_COUNT")) warnings.push("NEW_CUSTOMER_COUNT is absent; acquisition efficiency cannot be calculated.");
  if (!table.header.includes("CONTRIBUTION")) warnings.push("CONTRIBUTION is absent; spend recommendations cannot be ranked by profit impact.");
  warnings.push("DMA values remain DMA-specific; this adapter does not convert them to CBSA.");
  return { ready: errors.length === 0 && records.length > 0, records, errors, warnings, metadata: { grain: "dma_x_week_x_channel", containsIndividualDetail: false, geographyConversion: "none" } };
}
