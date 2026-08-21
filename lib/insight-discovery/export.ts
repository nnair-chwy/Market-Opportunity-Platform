import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import type { PerspectiveId } from "../perspectives/contracts.ts";
import type { AutonomousInsight, CurrentDataDiscoveryRun } from "./current-data-discovery.ts";
import { findingPresentation } from "./finding-presentation.ts";
import { buildFindingDecisionCase } from "./decision-case.ts";
import { buildTeamOpportunityBrief } from "./team-opportunity-brief.ts";

export type DiscoveryExportScope = "all" | PerspectiveId;
export type DiscoveryExportFormat = "csv" | "docx";

const TEAM_LABELS: Record<PerspectiveId, string> = {
  marketing: "Marketing",
  pricing: "Pricing",
  cvc: "CVC",
};

const CSV_COLUMNS = [
  "rank",
  "insight_id",
  "team",
  "owner",
  "market",
  "recommendation_headline",
  "observed_opportunity",
  "estimated_or_scenario_value",
  "scenario_range",
  "calculation",
  "recommended_next_action",
  "recommendation_type",
  "actionability",
  "potential_value_status",
  "observed_signal_evidence",
  "urgency",
  "confidence_and_caveat",
  "evidence_detail",
  "inputs_needed_to_size_value",
  "decision_boundary",
  "success_rule",
  "stop_rule",
  "could_reverse_recommendation",
  "source_ids",
  "snapshot_versions",
] as const;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function observedOpportunityText(finding: AutonomousInsight) {
  const statement = normalize(finding.valueTranslation.statement).replace(/^[.\-–—\s]+/, "");
  return statement.length === 0
    ? "Not yet quantified from the connected evidence; use the listed inputs to size the opportunity."
    : statement;
}

function csvCell(value: string | number) {
  const text = normalize(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sortFindings(run: CurrentDataDiscoveryRun, findings: AutonomousInsight[]) {
  const primaryRank = new Map(run.primaryFindings.map((finding, index) => [finding.insightId, index]));
  return [...findings].sort((left, right) => {
    const leftRank = primaryRank.get(left.insightId);
    const rightRank = primaryRank.get(right.insightId);
    if (leftRank !== undefined || rightRank !== undefined) {
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    }
    return right.importance.score - left.importance.score || left.marketName.localeCompare(right.marketName);
  });
}

export function getScopedDiscoveryFindings(run: CurrentDataDiscoveryRun, scope: DiscoveryExportScope) {
  return sortFindings(run, run.findings.filter((finding) => scope === "all" || finding.department === scope));
}

function confidenceText(finding: AutonomousInsight) {
  const actionability = finding.analystInterpretation?.actionabilityLevel.replaceAll("_", " ") ?? "investigation lead";
  return `${finding.importance.label}; ${actionability}. ${finding.valueTranslation.caveat}`;
}

export function buildDiscoveryCsv(run: CurrentDataDiscoveryRun, scope: DiscoveryExportScope) {
  const rows = getScopedDiscoveryFindings(run, scope).map((finding, index) => {
    const presentation = findingPresentation(finding);
    const decisionCase = buildFindingDecisionCase(finding);
    return [
    index + 1,
    finding.insightId,
    TEAM_LABELS[finding.department],
    finding.applicability.primaryTeamLabel,
    finding.marketName,
    finding.headline,
    observedOpportunityText(finding),
    `${decisionCase.scenario.label}: ${decisionCase.scenario.summary}`,
    decisionCase.scenario.range ?? "Not sized from current evidence",
    decisionCase.calculation.join(" "),
    decisionCase.proposedAction,
    presentation.recommendationLabel,
    finding.analystInterpretation?.actionabilityLevel ?? "investigation_ready",
    presentation.valueStatus,
    presentation.confidence,
    presentation.urgency,
    confidenceText(finding),
    finding.evidenceDetail,
    finding.businessValue.requiredInputs.join("; "),
    finding.analystInterpretation?.approvalBoundary ?? finding.applicability.approvalBoundary,
    decisionCase.successRule,
    decisionCase.stopRule,
    decisionCase.couldReverseRecommendation.join("; "),
    finding.sourceIds.join("; "),
    finding.snapshotVersions.join("; "),
    ];
  });
  return [CSV_COLUMNS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function safeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function discoveryExportFilename(run: CurrentDataDiscoveryRun, scope: DiscoveryExportScope, format: DiscoveryExportFormat) {
  const team = scope === "all" ? "all-teams" : safeFilePart(TEAM_LABELS[scope]);
  return `market-opportunity-findings-${team}-run-${run.runSequence}.${format}`;
}

function bodyParagraph(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: "1F4D78" }),
      new TextRun(normalize(value)),
    ],
    spacing: { after: 120, line: 264 },
  });
}

function conciseEvidence(value: string, sentenceLimit = 2) {
  const normalized = normalize(value);
  const sentences = normalized.split(/(?<=[.!?])\s+(?=[A-Z])/).map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.slice(0, sentenceLimit).join(" ");
}

function stakeholderInsightParagraphs(move: ReturnType<typeof buildTeamOpportunityBrief>["opportunityMoves"][number], rank: number) {
  return [
    new Paragraph({
      text: `${rank}. ${move.market}: ${move.decision}`,
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
    }),
    bodyParagraph("What we learned", conciseEvidence(move.evidence)),
    bodyParagraph("Decision this can inform", conciseEvidence(move.action, 1)),
    bodyParagraph("Evidence trail", move.sourceIds.join(", ")),
  ];
}

export async function buildDiscoveryDocx(run: CurrentDataDiscoveryRun, scope: DiscoveryExportScope): Promise<Uint8Array> {
  const findings = getScopedDiscoveryFindings(run, scope);
  const scopeLabel = scope === "all" ? "Cross-team portfolio" : `${TEAM_LABELS[scope]} team`;
  const teamBrief = buildTeamOpportunityBrief(run, scope);
  const stakeholderMoves = teamBrief.opportunityMoves.slice(0, 3);
  const teamBriefParagraphs: Paragraph[] = [
    new Paragraph({ text: "What the data says", heading: HeadingLevel.HEADING_1 }),
    bodyParagraph("Relevant teams", `${teamBrief.primaryTeam} · ${teamBrief.partnerTeams.join(" · ")}`),
    bodyParagraph("Why this matters", teamBrief.why),
    new Paragraph({ text: "Top takeaways", heading: HeadingLevel.HEADING_2 }),
    ...stakeholderMoves.map((move) => new Paragraph({
      children: [
        new TextRun({ text: `${move.market}: `, bold: true, color: "1F4D78" }),
        new TextRun(conciseEvidence(move.evidence, 1)),
      ],
      numbering: { reference: "discovery-report-bullets", level: 0 },
      spacing: { after: 120, line: 280 },
    })),
    ...stakeholderMoves.flatMap((move, index) => stakeholderInsightParagraphs(move, index + 1)),
    new Paragraph({ text: "How to use these insights", heading: HeadingLevel.HEADING_1 }),
    bodyParagraph("Decisions informed", stakeholderMoves.map((move) => `${move.market}: ${move.decision}.`).join(" ") || "No scoped opportunity was supported by this run."),
    bodyParagraph("Measure impact with", teamBrief.primaryOutcomes.join("; ")),
    bodyParagraph("Important boundary", teamBrief.evidenceBoundary),
    new Paragraph({
      text: "Supporting detail: the CSV export contains every ranked finding, calculation field, caveat, and source identifier.",
      spacing: { before: 160, after: 120, line: 264 },
    }),
  ];
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "MARKET OPPORTUNITY INSIGHT BRIEF", bold: true, size: 20, color: "2E67A6", font: "Arial" })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${scopeLabel} insights`, bold: true, size: 40, color: "13284D", font: "Arial" })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Run ${run.runSequence} · ${new Date(run.completedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific · ${findings.length} reviewable findings`, size: 21, color: "607089", font: "Arial" })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "C9D8EA" } },
      spacing: { after: 260 },
    }),
    new Paragraph({ text: "Executive takeaway", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      text: `This brief highlights the ${scope === "all" ? "cross-team" : TEAM_LABELS[scope]} patterns most likely to change a business decision. It leads with what the data shows and why it matters; methodology and the full sortable finding set remain in the CSV export.`,
      spacing: { after: 160, line: 264 },
    }),
    bodyParagraph("Portfolio coverage", `${run.analysesRun} decision screens, ${run.marketUniverse.toLocaleString("en-US")} markets compared, and ${run.measuresExamined} measures checked`),
    ...teamBriefParagraphs,
  ];

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "263B5D" },
          paragraph: { spacing: { after: 120, line: 264 } },
        },
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 32, bold: true, color: "2E67A6" }, paragraph: { spacing: { before: 320, after: 160 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 26, bold: true, color: "1F4D78" }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [{
        reference: "discovery-report-bullets",
        levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 }, spacing: { after: 160, line: 280 } } } }],
      }],
    },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } },
      },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: `${scopeLabel} findings · Market Opportunity Platform`, size: 18, color: "6A788E", font: "Arial" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Reviewable evidence · Page ", size: 16, color: "6A788E", font: "Arial" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "6A788E", font: "Arial" })] })] }) },
      children,
    }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
