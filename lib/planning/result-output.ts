import type { ReviewableActionPacket } from "./reviewable-packet.ts";

export type ResultOutputFormat = "docx_report" | "csv_market_table";

export const RESULT_OUTPUT_COLUMNS = [
  "market_id",
  "market_name",
  "signal",
  "evidence_detail",
  "recommended_action",
  "confidence",
  "evidence_status",
  "current_spend",
  "proposed_adjustment_percent",
  "proposed_spend",
  "data_gap",
] as const;

export type ResultOutputColumn = typeof RESULT_OUTPUT_COLUMNS[number];
export type ResultOutputRow = Record<ResultOutputColumn, string>;

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function inferPreferredOutputFormat(question: string): ResultOutputFormat {
  return /\b(csv|spreadsheet|table|rows?|per[- ](?:market|region)|each (?:market|region))\b/i.test(question)
    ? "csv_market_table"
    : "docx_report";
}

export function defaultResultOutputColumns(packet: ReviewableActionPacket): ResultOutputColumn[] {
  const asksForSpendAllocation = packet.perspectiveId === "marketing"
    && /\b(spend|budget|allocation|invest|ads?|advertising|paid search)\b/i.test(packet.originalQuestion);
  if (asksForSpendAllocation) return [
    "market_id",
    "market_name",
    "current_spend",
    "proposed_adjustment_percent",
    "proposed_spend",
    "recommended_action",
    "evidence_status",
    "data_gap",
  ];
  return ["market_id", "market_name", "signal", "recommended_action", "confidence", "evidence_status", "data_gap"];
}

function marketLabel(title: string) {
  return title.split(":")[0]?.trim() || title;
}

function factForMarket(packet: ReviewableActionPacket, marketId: string, patterns: RegExp[]) {
  return packet.packetAnswer.facts.find((fact) => {
    const geographyId = fact.geographyId?.replace(/^cbsa:/, "") ?? "";
    return geographyId === marketId && patterns.some((pattern) => pattern.test(`${fact.metricId} ${fact.metricLabel}`));
  });
}

export function buildResultOutputRows(packet: ReviewableActionPacket): ResultOutputRow[] {
  const leads = packet.analysisAppendix?.leads ?? [];
  const evidenceStatus = packet.analysisAppendix?.evidenceStage === "triangulated_finding" ? "Triangulated finding" : "Signal—validation required";
  return leads.map((lead) => {
    const marketId = lead.marketIds[0] ?? "";
    const currentSpend = factForMarket(packet, marketId, [/costUsd/i, /\bspend\b/i, /\bcost\b/i]);
    const hasApprovedAdjustment = false;
    const spendGap = packet.perspectiveId === "marketing"
      ? hasApprovedAdjustment
        ? ""
        : "Exact revised spend requires current regional spend, a total-budget constraint, first-party outcomes, and an approved allocation rule."
      : "";
    return {
      market_id: marketId,
      market_name: marketLabel(lead.title),
      signal: lead.businessMeaning,
      evidence_detail: lead.observation,
      recommended_action: packet.actionPlan?.recommendation ?? lead.nextEvidence ?? packet.action.nextStep,
      confidence: packet.actionPlan?.confidence ?? packet.action.confidence,
      evidence_status: evidenceStatus,
      current_spend: currentSpend?.displayValue ?? "",
      proposed_adjustment_percent: "",
      proposed_spend: "",
      data_gap: spendGap || lead.challenge,
    };
  });
}

export function parseRequestedOutputColumns(value: string): ResultOutputColumn[] {
  const allowed = new Set<string>(RESULT_OUTPUT_COLUMNS);
  return unique(value.split(",").map((item) => item.trim().toLowerCase().replaceAll(" ", "_")).filter((item): item is ResultOutputColumn => allowed.has(item)));
}

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function formatResultCsv(rows: ResultOutputRow[], columns: ResultOutputColumn[]) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");
}

export function resultCsvFilename(packet: ReviewableActionPacket) {
  const stamp = packet.generatedAt.slice(0, 10);
  return `market-result-${packet.perspectiveId}-${stamp}.csv`;
}
