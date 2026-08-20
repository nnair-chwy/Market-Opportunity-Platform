import { z } from "zod";
import { buildSlackDiscoveryMessages } from "@/lib/sharing/slack-discovery";

export const dynamic = "force-dynamic";

const findingSchema = z.object({
  insightId: z.string().min(1),
  department: z.enum(["marketing", "pricing", "cvc"]),
  marketName: z.string().min(1),
  headline: z.string().min(1),
  nextValidation: z.string(),
  importance: z.object({ label: z.string(), score: z.number() }).passthrough(),
  valueTranslation: z.object({ statement: z.string() }).passthrough(),
  applicability: z.object({ primaryTeamLabel: z.string() }).passthrough(),
  analystInterpretation: z.object({ recommendedNextDecisionOrAction: z.string() }).passthrough().optional(),
}).passthrough();

const requestSchema = z.object({
  run: z.object({
    runId: z.string().min(1),
    runSequence: z.number().int().positive(),
    completedAt: z.string().min(1),
    analysesRun: z.number().int().nonnegative(),
    findings: z.array(findingSchema).max(100),
  }).passthrough(),
}).strict();

export async function POST(request: Request) {
  const webhook = process.env.SLACK_FINDINGS_WEBHOOK_URL?.trim();
  if (!webhook) return Response.json({ message: "Slack delivery is not configured for this deployment." }, { status: 503 });
  const allowedSenders = (process.env.SLACK_FINDINGS_ALLOWED_SENDERS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const sender = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(new URL(request.url).hostname);
  if (!isLocal && (!sender || (allowedSenders.length > 0 && !allowedSenders.includes(sender)))) {
    return Response.json({ message: "You do not have permission to send findings to the configured Slack channel." }, { status: 403 });
  }

  try {
    const { run } = requestSchema.parse(await request.json());
    const messages = buildSlackDiscoveryMessages(run as Parameters<typeof buildSlackDiscoveryMessages>[0]);
    for (let index = 0; index < messages.length; index += 1) {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(messages[index]),
      });
      if (!response.ok) {
        const sent = index * 24;
        return Response.json({ message: sent
          ? `Slack accepted ${Math.min(sent, run.findings.length)} of ${run.findings.length} findings before delivery stopped.`
          : "Slack rejected the findings digest." }, { status: 502 });
      }
    }
    console.info(JSON.stringify({ event: "discovery_findings_sent", delivery: "slack", sender: sender ?? "local-developer", runId: run.runId, findingCount: run.findings.length, generatedAt: new Date().toISOString() }));
    return Response.json({ message: `Sent all ${run.findings.length} findings to ${process.env.SLACK_FINDINGS_DESTINATION?.trim() || "the configured insights channel"}.` });
  } catch {
    return Response.json({ message: "A completed discovery run is required." }, { status: 400 });
  }
}
