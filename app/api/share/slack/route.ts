import { reviewableActionPacketSchema } from "@/lib/planning/reviewable-packet";
import { z } from "zod";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ packet: reviewableActionPacketSchema }).strict();

export async function GET() {
  return Response.json({ configured: Boolean(process.env.SLACK_FINDINGS_WEBHOOK_URL?.trim()), destination: process.env.SLACK_FINDINGS_DESTINATION?.trim() || "the configured insights channel" }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const webhook = process.env.SLACK_FINDINGS_WEBHOOK_URL?.trim();
  if (!webhook) return Response.json({ message: "Slack delivery is not configured for this deployment." }, { status: 503 });
  const allowedSenders = (process.env.SLACK_FINDINGS_ALLOWED_SENDERS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const sender = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(new URL(request.url).hostname);
  if (!isLocal && (!sender || (allowedSenders.length > 0 && !allowedSenders.includes(sender)))) {
    return Response.json({ message: "You do not have permission to send findings to the configured Slack channel." }, { status: 403 });
  }
  try {
    const { packet } = requestSchema.parse(await request.json());
    const facts = packet.packetAnswer.facts.slice(0, 3).map((fact) => `• *${fact.geographyLabel}:* ${fact.metricLabel} ${fact.displayValue}`).join("\n");
    const limitations = packet.packetAnswer.limitations.slice(0, 2).map((item) => `• ${item}`).join("\n");
    const text = `${packet.action.title}\n${packet.packetAnswer.directAnswer}`;
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "Market Intelligence recommendation", emoji: true } },
          { type: "section", text: { type: "mrkdwn", text: `*${packet.action.title}*\n${packet.packetAnswer.directAnswer}` } },
          ...(facts ? [{ type: "section", text: { type: "mrkdwn", text: `*Evidence highlights*\n${facts}` } }] : []),
          { type: "section", text: { type: "mrkdwn", text: `*Recommended next step*\n${packet.action.owner}: ${packet.action.nextStep}` } },
          ...(limitations ? [{ type: "context", elements: [{ type: "mrkdwn", text: `*Still to validate:*\n${limitations}` }] }] : []),
          { type: "context", elements: [{ type: "mrkdwn", text: "Draft for accountable review. This message does not approve spend, pricing, sites, or another material action." }] },
        ],
      }),
    });
    if (!response.ok) return Response.json({ message: "Slack rejected the recommendation brief." }, { status: 502 });
    return Response.json({ message: `Recommendation brief sent to ${process.env.SLACK_FINDINGS_DESTINATION?.trim() || "the configured insights channel"}.` });
  } catch {
    return Response.json({ message: "A valid recommendation packet is required." }, { status: 400 });
  }
}
