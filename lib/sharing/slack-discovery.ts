import type { AutonomousInsight, CurrentDataDiscoveryRun } from "../insight-discovery/current-data-discovery.ts";

const FINDINGS_PER_MESSAGE = 24;

function escapeSlack(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function clamp(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function actionFor(finding: AutonomousInsight) {
  return finding.analystInterpretation?.recommendedNextDecisionOrAction ?? finding.nextValidation;
}

function findingBlock(finding: AutonomousInsight, rank: number) {
  const label = finding.importance.label;
  const heading = `${rank}. ${label} · ${finding.department.toUpperCase()} · ${finding.marketName}`;
  const body = [
    `*${escapeSlack(heading)}*`,
    escapeSlack(finding.headline),
    `*Value:* ${escapeSlack(finding.valueTranslation.statement)}`,
    `*Do next:* ${escapeSlack(actionFor(finding))}`,
    `*Owner:* ${escapeSlack(finding.applicability.primaryTeamLabel)}`,
  ].join("\n");
  return { type: "section" as const, text: { type: "mrkdwn" as const, text: clamp(body, 2900) } };
}

export type SlackDiscoveryMessage = {
  text: string;
  blocks: Array<
    | { type: "header"; text: { type: "plain_text"; text: string; emoji: true } }
    | { type: "section"; text: { type: "mrkdwn"; text: string } }
    | { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> }
  >;
};

export function buildSlackDiscoveryMessages(run: Pick<CurrentDataDiscoveryRun, "runId" | "runSequence" | "completedAt" | "analysesRun" | "findings">): SlackDiscoveryMessage[] {
  const findings = [...run.findings].sort((left, right) => right.importance.score - left.importance.score);
  const chunks = Array.from({ length: Math.max(1, Math.ceil(findings.length / FINDINGS_PER_MESSAGE)) }, (_, index) =>
    findings.slice(index * FINDINGS_PER_MESSAGE, (index + 1) * FINDINGS_PER_MESSAGE));

  return chunks.map((chunk, chunkIndex) => {
    const startRank = chunkIndex * FINDINGS_PER_MESSAGE;
    const partLabel = chunks.length > 1 ? ` · Part ${chunkIndex + 1} of ${chunks.length}` : "";
    return {
      text: `Market Intelligence discovery run ${run.runSequence}: ${findings.length} qualified findings${partLabel}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: clamp(`Regional insight discovery${partLabel}`, 140), emoji: true },
        },
        ...(chunk.length
          ? chunk.map((finding, index) => findingBlock(finding, startRank + index + 1))
          : [{ type: "section" as const, text: { type: "mrkdwn" as const, text: "No qualified findings were returned for this run." } }]),
        {
          type: "context",
          elements: [{
            type: "mrkdwn",
            text: `${findings.length} findings from ${run.analysesRun} reviewed decision screens · Run ${escapeSlack(run.runId)} · ${escapeSlack(run.completedAt)} · Findings are investigation leads, not approval to change spend, price, or clinic footprint.`,
          }],
        },
      ],
    };
  });
}
