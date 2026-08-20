import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const inputPath = process.env.TABLEAU_CVC_EXPORT_PATH
  ? path.resolve(workspaceRoot, process.env.TABLEAU_CVC_EXPORT_PATH)
  : path.join(workspaceRoot, "data/approved/tableau-cvc/2026-08-20/excluded/cvc-metrics-self-serve.original.csv");
const outputPath = path.join(workspaceRoot, "data/approved/cvc-metro-outcomes/current.json");
const canonicalPath = path.join(workspaceRoot, "data/approved/tableau-cvc/2026-08-20/cvc-metro-week-outcomes.csv");

function decodeTableauExport(buffer: Buffer) {
  const utf16 = buffer[0] === 0xff && buffer[1] === 0xfe || buffer.subarray(0, Math.min(buffer.length, 200)).includes(0);
  return (utf16 ? buffer.toString("utf16le") : buffer.toString("utf8")).replace(/^\uFEFF/, "");
}

function parseTsv(text: string) {
  const rows = text.trimEnd().split(/\r?\n/).map((line) => line.split("\t"));
  const header = rows.shift()?.map((value) => value.trim()) ?? [];
  return rows.map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])));
}

function numberValue(value: string | undefined) {
  const parsed = Number((value ?? "").replace(/[$,%]/g, "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid Campaign Date: ${value}`);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type Aggregate = {
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
  siteIds: Set<string>;
  sourceRows: number;
};

const rows = parseTsv(decodeTableauExport(await readFile(inputPath)));
const aggregates = new Map<string, Aggregate>();
for (const row of rows) {
  const metro = row.Metro?.trim();
  const campaignDate = row["Campaign Date"]?.trim();
  const channel = row.Channel?.trim() || "Unspecified";
  if (!metro || ["total", "general"].includes(metro.toLowerCase()) || !campaignDate) continue;
  const weekStartDate = isoDate(campaignDate);
  const key = `${metro}|${weekStartDate}|${channel}`;
  const aggregate = aggregates.get(key) ?? {
    metro, weekStartDate, channel, spend: 0, impressions: 0, clicks: 0, appointments: 0,
    completedAppointments: 0, newToChewyAppointments: 0, netSales: 0, siteIds: new Set<string>(), sourceRows: 0,
  };
  aggregate.spend += numberValue(row.Spend);
  aggregate.impressions += numberValue(row.Impressions);
  aggregate.clicks += numberValue(row.Clicks);
  aggregate.appointments += numberValue(row["CVC Appointments"]);
  aggregate.completedAppointments += numberValue(row["Completed Appointments"]);
  aggregate.newToChewyAppointments += numberValue(row["New to Chewy - New to CVC Appts"]);
  aggregate.netSales += numberValue(row["Net Sales"]);
  const siteId = row["Site ID"]?.trim();
  if (siteId && siteId.toLowerCase() !== "general") aggregate.siteIds.add(siteId);
  aggregate.sourceRows += 1;
  aggregates.set(key, aggregate);
}

const records = [...aggregates.values()]
  .map(({ siteIds, ...record }) => ({ ...record, siteCount: siteIds.size }))
  .sort((left, right) => left.weekStartDate.localeCompare(right.weekStartDate) || left.metro.localeCompare(right.metro) || left.channel.localeCompare(right.channel));
if (!records.length) throw new Error("The Tableau export produced no aggregate metro outcome records.");

const dates = records.map((record) => record.weekStartDate).sort();
const snapshot = {
  version: "tableau-cvc-metro-outcomes-v1",
  generatedAt: process.env.TABLEAU_CVC_GENERATED_AT ?? new Date().toISOString(),
  sourceId: "tableau-cvc-site-outcomes",
  sourceFile: path.relative(workspaceRoot, inputPath),
  grain: "week_x_tableau_metro_label_x_channel",
  geography: { type: "tableau_metro_label", crosswalkStatus: "not_mapped_to_cbsa_or_dma" },
  period: { start: dates[0], end: dates.at(-1) },
  privacy: { containsIndividualDetail: false, containsDirectIdentifiers: false },
  limitations: [
    "This snapshot is historical and covers only the approved fiscal-period export.",
    "Metro labels must pass an approved crosswalk before joining CBSA- or DMA-keyed evidence.",
    "Observed spend efficiency is not incremental lift, contribution profit, or CCP.",
  ],
  records,
};

await mkdir(path.dirname(outputPath), { recursive: true });
const canonicalHeader = ["METRO", "WEEK_START_DATE", "CHANNEL_CODE", "SPEND", "IMPRESSIONS", "CLICKS", "CVC_APPOINTMENTS", "COMPLETED_APPOINTMENTS", "NEW_TO_CHEWY_APPOINTMENTS", "NET_SALES", "SITE_COUNT", "SOURCE_ROWS"];
const csvValue = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const canonicalRows = records.map((record) => [record.metro, record.weekStartDate, record.channel, record.spend, record.impressions, record.clicks, record.appointments, record.completedAppointments, record.newToChewyAppointments, record.netSales, record.siteCount, record.sourceRows].map(csvValue).join(","));
await writeFile(canonicalPath, `${canonicalHeader.join(",")}\n${canonicalRows.join("\n")}\n`);
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${records.length} CVC metro-week-channel outcomes to ${path.relative(workspaceRoot, canonicalPath)} and ${path.relative(workspaceRoot, outputPath)}.`);
