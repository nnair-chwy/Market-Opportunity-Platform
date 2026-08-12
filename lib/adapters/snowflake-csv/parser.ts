export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value !== "" || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  const [headers, ...data] = rows;
  if (!headers?.length) return [];
  return data.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
  );
}

export function numberOrNull(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function integerOrNull(value: string | undefined): number | null {
  const parsed = numberOrNull(value);
  return parsed === null || !Number.isInteger(parsed) ? null : parsed;
}

export function booleanOrNull(value: string | undefined): boolean | null {
  if (!value?.trim()) return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
}

export function normalizeZip(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/^8600000US/, "").replace(/[^0-9]/g, "");
  return digits ? digits.padStart(5, "0") : null;
}
