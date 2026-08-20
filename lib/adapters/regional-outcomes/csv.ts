export type CsvTable = {
  header: string[];
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
};

export function parseAggregateCsv(csv: string): CsvTable {
  const parsed: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.trim());
      if (row.some(Boolean)) parsed.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") field += character;
  }

  if (quoted) throw new Error("CSV ended inside a quoted field.");
  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some(Boolean)) parsed.push(row);
  }

  const [rawHeader = [], ...data] = parsed;
  const header = rawHeader.map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim().toUpperCase(),
  );
  if (!header.length) throw new Error("CSV has no header.");
  if (new Set(header).size !== header.length) throw new Error("CSV contains duplicate columns.");

  return {
    header,
    rows: data.map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(header.map((column, columnIndex) => [column, values[columnIndex]?.trim() ?? ""])),
    })),
  };
}

export const isDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export function finiteNonnegative(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export const directIdentifierColumns = (header: string[]) => header.filter((column) =>
  /(^|_)(CUSTOMER_ID|ORDER_ID|PATIENT_ID|EMAIL|PHONE|STREET_ADDRESS|EMPLOYEE_ID)($|_)/.test(column),
);
