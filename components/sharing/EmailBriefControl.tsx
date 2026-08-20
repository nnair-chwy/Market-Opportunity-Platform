"use client";

import { useMemo, useState } from "react";
import { downloadDecisionBrief, type ReviewableActionPacket } from "@/lib/planning/reviewable-packet";

function briefBody(packet: ReviewableActionPacket, includeEvidence: boolean, includeLimitations: boolean) {
  const lines = [
    "FINAL RECOMMENDATION BRIEF",
    "",
    packet.action.title,
    "",
    packet.packetAnswer.directAnswer,
    "",
    `Recommended next step: ${packet.action.owner} — ${packet.action.nextStep}`,
  ];
  if (includeEvidence && packet.packetAnswer.facts.length) {
    lines.push("", "Evidence used:", ...packet.packetAnswer.facts.slice(0, 5).map((fact) => `• ${fact.geographyLabel}: ${fact.metricLabel} ${fact.displayValue} (${fact.periodLabel})`));
  }
  if (includeLimitations && packet.packetAnswer.limitations.length) {
    lines.push("", "What still needs validation:", ...packet.packetAnswer.limitations.slice(0, 4).map((item) => `• ${item}`));
  }
  lines.push("", "A Word decision brief is available from the Market Intelligence result screen.");
  return lines.join("\n");
}

export function EmailBriefControl({ packet }: { packet: ReviewableActionPacket }) {
  const [open, setOpen] = useState(false);
  const [delivery, setDelivery] = useState<"email" | "slack">("email");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState(`Recommendation brief: ${packet.action.title}`);
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [includeLimitations, setIncludeLimitations] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [slackConfig, setSlackConfig] = useState<{ configured: boolean; destination: string } | null>(null);
  const body = useMemo(() => briefBody(packet, includeEvidence, includeLimitations), [packet, includeEvidence, includeLimitations]);

  async function prepareEmail() {
    if (!recipient.trim() || !recipient.includes("@")) {
      setStatus("Enter the email address that should receive the brief.");
      return;
    }
    await downloadDecisionBrief(packet);
    const url = `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setStatus("The Word brief was downloaded and an addressed email draft was opened. Attach the downloaded file, review, and send.");
  }

  async function chooseSlack() {
    setDelivery("slack");
    setStatus(null);
    if (slackConfig) return;
    const response = await fetch("/api/share/slack", { cache: "no-store" });
    setSlackConfig(await response.json() as { configured: boolean; destination: string });
  }

  async function sendToSlack() {
    setStatus("Sending the reviewed brief…");
    const response = await fetch("/api/share/slack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packet }) });
    const payload = await response.json() as { message: string };
    setStatus(payload.message);
  }

  return (
    <section className="email-brief-control" aria-labelledby="email-brief-title">
      <div><div className="section-label">Share with a stakeholder</div><h2 id="email-brief-title">Send the recommendation brief</h2><p>Email yourself the Word brief or send a bounded summary to the configured Slack insights channel.</p></div>
      {!open ? <button type="button" className="secondary-action" onClick={() => setOpen(true)}>Share this brief</button> : (
        <div className="email-brief-form">
          <div className="brief-delivery-tabs" role="tablist" aria-label="Brief delivery method"><button type="button" role="tab" aria-selected={delivery === "email"} onClick={() => { setDelivery("email"); setStatus(null); }}>Email</button><button type="button" role="tab" aria-selected={delivery === "slack"} onClick={() => void chooseSlack()}>Slack</button></div>
          {delivery === "email" ? <>
            <label><span>Send to</span><input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="you@company.com" autoComplete="email" /></label>
            <label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
            <fieldset><legend>Include in email summary</legend><label><input type="checkbox" checked={includeEvidence} onChange={(event) => setIncludeEvidence(event.target.checked)} /> Evidence highlights</label><label><input type="checkbox" checked={includeLimitations} onChange={(event) => setIncludeLimitations(event.target.checked)} /> Validation needs</label></fieldset>
            <details><summary>Preview email summary</summary><pre>{body}</pre></details>
          </> : <div className="slack-delivery-preview"><strong>{slackConfig?.configured ? `Ready for ${slackConfig.destination}` : "Slack setup required"}</strong><p>{slackConfig?.configured ? "The destination is fixed by the administrator. The message includes the recommendation, evidence highlights, next step, and validation boundary." : "Add a restricted incoming webhook in the deployment settings. Viewers cannot choose an arbitrary workspace or channel."}</p></div>}
          {status ? <p role="status">{status}</p> : null}
          <div><button type="button" className="secondary-action" onClick={() => setOpen(false)}>Cancel</button>{delivery === "email" ? <button type="button" className="primary-action" onClick={() => void prepareEmail()}>Download brief &amp; open email</button> : <button type="button" className="primary-action" disabled={!slackConfig?.configured} onClick={() => void sendToSlack()}>Send to Slack</button>}</div>
        </div>
      )}
    </section>
  );
}
