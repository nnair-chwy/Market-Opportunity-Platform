import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const inputPath = process.env.TABLEAU_NEW_CUSTOMER_EXPORT_PATH
  ? path.resolve(workspaceRoot, process.env.TABLEAU_NEW_CUSTOMER_EXPORT_PATH)
  : path.join(workspaceRoot, "data/approved/tableau-new-customer/2026-08-20/excluded/calendar-view-new-customer-acquisitions.original.csv");
const outputPath = path.join(workspaceRoot, "data/approved/new-customer-acquisition/current.json");

function decodeExport(buffer: Buffer) {
  const utf16 = buffer[0] === 0xff && buffer[1] === 0xfe || buffer.subarray(0, Math.min(buffer.length, 200)).includes(0);
  return (utf16 ? buffer.toString("utf16le") : buffer.toString("utf8")).replace(/^\uFEFF/, "");
}

function isoDate(value: string) {
  const [month, day, shortYear] = value.trim().split("/").map(Number);
  const year = shortYear < 100 ? 2000 + shortYear : shortYear;
  if (!year || !month || !day) throw new Error(`Invalid Tableau week: ${value}`);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function countValue(value: string | undefined) {
  const parsed = Number((value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const rows = decodeExport(await readFile(inputPath)).trimEnd().split(/\r?\n/).map((line) => line.split("\t"));
const header = rows.shift() ?? [];
const weeks = header.slice(2).map(isoDate);
const newestWeeks = [...weeks].sort().slice(-52);
const includedWeeks = new Set(newestWeeks);
const records: Array<{ weekStartDate: string; businessSegment: string; netNewToChewySegmentAcquisitions: number }> = [];

for (const row of rows) {
  const businessSegment = row[0]?.trim();
  const measure = row[1]?.trim();
  if (!businessSegment || measure !== "Net New to Chewy") continue;
  weeks.forEach((weekStartDate, index) => {
    if (!includedWeeks.has(weekStartDate)) return;
    const value = countValue(row[index + 2]);
    if (value === null) return;
    records.push({ weekStartDate, businessSegment, netNewToChewySegmentAcquisitions: value });
  });
}

if (!records.length) throw new Error("The Tableau export produced no national segment acquisition records.");
records.sort((left, right) => left.weekStartDate.localeCompare(right.weekStartDate) || left.businessSegment.localeCompare(right.businessSegment));
const latestWeek = newestWeeks.at(-1)!;
const latestSegmentLeaders = records
  .filter((record) => record.weekStartDate === latestWeek)
  .sort((left, right) => right.netNewToChewySegmentAcquisitions - left.netNewToChewySegmentAcquisitions)
  .slice(0, 20);

const snapshot = {
  version: "tableau-new-customer-segment-v1",
  generatedAt: process.env.TABLEAU_NEW_CUSTOMER_GENERATED_AT ?? new Date().toISOString(),
  sourceId: "new-customer-acquisition",
  sourceFile: path.relative(workspaceRoot, inputPath),
  grain: "week_x_business_segment_x_us_national",
  period: { start: newestWeeks[0], end: latestWeek },
  geography: { type: "country", value: "US", regionalJoinStatus: "not_available" },
  privacy: { containsIndividualDetail: false, containsDirectIdentifiers: false },
  metricDefinition: "Net New to Chewy segment acquisitions reported by the Tableau workbook; one customer may acquire into more than one segment and must not be interpreted as a deduplicated national customer count.",
  limitations: [
    "The source exposes U.S. national business-segment and weekly context but no approved DMA, CBSA, ZIP, or trade-area key.",
    "The records cannot be allocated to regions or joined to regional marketing, pricing, or clinic evidence.",
    "Values describe reported segment acquisition events, not incremental customers, contribution, or a causal response to a business lever.",
  ],
  latestSegmentLeaders,
  records,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${records.length} national segment-week acquisition records to ${path.relative(workspaceRoot, outputPath)}.`);
