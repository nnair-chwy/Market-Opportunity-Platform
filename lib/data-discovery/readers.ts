import { open, readFile } from "node:fs/promises";
import path from "node:path";
import type { DiscoveredFileFormat } from "./contracts.ts";

export type SampledTable = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
  warnings: string[];
};

const MAX_TEXT_BYTES = 2 * 1024 * 1024;

async function readPrefix(file: string, maxBytes = MAX_TEXT_BYTES): Promise<{ text: string; truncated: boolean }> {
  const handle = await open(file, "r");
  try {
    const details = await handle.stat();
    const length = Math.min(details.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return { text: buffer.toString("utf8"), truncated: details.size > length };
  } finally {
    await handle.close();
  }
}

function parseDelimited(text: string, delimiter: string, maxRows: number): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length && records.length <= maxRows; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); records.push(row); row = []; field = ""; }
    else field += char;
  }
  if (records.length <= maxRows && (field.length > 0 || row.length > 0)) { row.push(field.replace(/\r$/, "")); records.push(row); }
  return records.slice(0, maxRows + 1);
}

function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((value, index) => {
    const base = value.replace(/^\uFEFF/, "").trim() || `column_${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

async function readDelimited(file: string, delimiter: string, maxRows: number): Promise<SampledTable> {
  const prefix = await readPrefix(file);
  const records = parseDelimited(prefix.text, delimiter, maxRows);
  if (!records.length) return { columns: [], rows: [], rowCount: 0, warnings: ["The delimited file is empty."] };
  const columns = uniqueHeaders(records[0]);
  const rows = records.slice(1).filter((record) => record.some((value) => value.trim() !== "")).map((record) => Object.fromEntries(columns.map((column, index) => [column, record[index] ?? null])));
  return {
    columns,
    rows,
    rowCount: prefix.truncated ? null : rows.length,
    warnings: prefix.truncated ? [`Profiled only the first ${MAX_TEXT_BYTES} bytes and ${maxRows} data rows.`] : [],
  };
}

async function readJson(file: string, maxRows: number): Promise<SampledTable> {
  const prefix = await readPrefix(file, 4 * 1024 * 1024);
  let values: unknown[];
  try {
    const parsed = JSON.parse(prefix.text) as unknown;
    values = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
  } catch {
    values = prefix.text.split(/\r?\n/).filter(Boolean).slice(0, maxRows).flatMap((line) => {
      try { return [JSON.parse(line) as unknown]; } catch { return []; }
    });
  }
  const objects = values.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value));
  const columns = [...new Set(objects.slice(0, maxRows).flatMap((row) => Object.keys(row)))];
  return {
    columns,
    rows: objects.slice(0, maxRows),
    rowCount: prefix.truncated ? null : objects.length,
    warnings: prefix.truncated ? ["JSON profile is sample-based because the file exceeded the bounded read limit."] : [],
  };
}

async function readXlsx(file: string, maxRows: number): Promise<SampledTable> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readFile(file) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { columns: [], rows: [], rowCount: 0, warnings: ["The workbook contains no worksheet."] };
  const first = worksheet.getRow(1).values as unknown[];
  const columns = uniqueHeaders(first.slice(1).map((value) => String(value ?? "")));
  const rows: Array<Record<string, unknown>> = [];
  for (let rowNumber = 2; rowNumber <= Math.min(worksheet.rowCount, maxRows + 1); rowNumber += 1) {
    const values = worksheet.getRow(rowNumber).values as unknown[];
    rows.push(Object.fromEntries(columns.map((column, index) => [column, values[index + 1] ?? null])));
  }
  return { columns, rows, rowCount: Math.max(worksheet.rowCount - 1, 0), warnings: workbook.worksheets.length > 1 ? [`Profiled the first worksheet (${worksheet.name}) only.`] : [] };
}

async function readParquet(file: string, maxRows: number): Promise<SampledTable> {
  const { closeDuckDb, openDuckDb, sqlString } = await import("../evidence-snapshot/duckdb.ts");
  const handle = await openDuckDb(":memory:");
  try {
    const reader = await handle.connection.runAndReadAll(`SELECT * FROM read_parquet(${sqlString(file)}) LIMIT ${Math.max(1, maxRows)}`);
    const rows = reader.getRowObjectsJson() as Array<Record<string, unknown>>;
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const countReader = await handle.connection.runAndReadAll(`SELECT count(*) AS row_count FROM read_parquet(${sqlString(file)})`);
    const countValue = (countReader.getRowObjectsJson() as Array<{ row_count: unknown }>)[0]?.row_count;
    const rowCount = countValue === undefined ? null : Number(countValue);
    return { columns, rows, rowCount: Number.isSafeInteger(rowCount) ? rowCount : null, warnings: [] };
  } finally {
    await closeDuckDb(handle);
  }
}

export function formatForFile(file: string): DiscoveredFileFormat | null {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".csv") return "csv";
  if (extension === ".tsv") return "tsv";
  if (extension === ".json" || extension === ".jsonl" || extension === ".ndjson") return "json";
  if (extension === ".xlsx") return "xlsx";
  if (extension === ".parquet") return "parquet";
  return null;
}

export async function readTableSample(file: string, format: DiscoveredFileFormat, maxRows = 200): Promise<SampledTable> {
  if (format === "csv") return readDelimited(file, ",", maxRows);
  if (format === "tsv") return readDelimited(file, "\t", maxRows);
  if (format === "json") return readJson(file, maxRows);
  if (format === "xlsx") return readXlsx(file, maxRows);
  return readParquet(file, maxRows);
}
