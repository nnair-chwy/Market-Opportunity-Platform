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
import {
  formatDecisionBriefDocument,
  formatReviewableActionPacketDocument,
  type ReviewableActionPacket,
} from "./reviewable-packet.ts";

export type PacketDocxKind = "decision_brief" | "audit_appendix";

function plain(value: string) {
  return value.replace(/^>\s*/, "").replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
}

function inlineRuns(value: string) {
  const normalized = value.replace(/^>\s*/, "").replace(/^#{1,6}\s+/, "").trim();
  const runs: TextRun[] = [];
  let cursor = 0;
  for (const match of normalized.matchAll(/\*\*(.+?)\*\*/g)) {
    const start = match.index ?? 0;
    if (start > cursor) runs.push(new TextRun(normalized.slice(cursor, start)));
    runs.push(new TextRun({ text: match[1], bold: true }));
    cursor = start + match[0].length;
  }
  if (cursor < normalized.length) runs.push(new TextRun(normalized.slice(cursor)));
  return runs.length ? runs : [new TextRun(plain(normalized))];
}

function markdownParagraphs(markdown: string) {
  const children: Paragraph[] = [];
  let inJson = false;
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "```json") {
      inJson = true;
      children.push(new Paragraph({ text: "Structured record", heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph({ text: "The complete machine-readable packet remains attached to the saved result in the platform. The Word appendix presents its human-reviewable evidence and decision record." }));
      continue;
    }
    if (line === "```" && inJson) { inJson = false; continue; }
    if (inJson || !line || line === "---") continue;
    if (line.startsWith("# ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: plain(line.slice(2)), bold: true, size: 38, color: "13284D", font: "Arial" })],
        spacing: { before: 0, after: 180 },
      }));
      continue;
    }
    if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: plain(line.slice(3)), heading: HeadingLevel.HEADING_1 }));
      continue;
    }
    if (line.startsWith("### ")) {
      children.push(new Paragraph({ text: plain(line.slice(4)), heading: HeadingLevel.HEADING_2 }));
      continue;
    }
    if (line.startsWith("#### ")) {
      children.push(new Paragraph({ text: plain(line.slice(5)), heading: HeadingLevel.HEADING_3 }));
      continue;
    }
    if (/^-\s+/.test(line)) {
      children.push(new Paragraph({ children: inlineRuns(line.replace(/^-\s+/, "")), bullet: { level: 0 } }));
      continue;
    }
    if (/^\s+-\s+/.test(rawLine)) {
      children.push(new Paragraph({ children: inlineRuns(rawLine.replace(/^\s+-\s+/, "")), bullet: { level: 1 } }));
      continue;
    }
    children.push(new Paragraph({ children: inlineRuns(line) }));
  }
  return children;
}

export async function buildPacketDocx(packet: ReviewableActionPacket, kind: PacketDocxKind): Promise<Uint8Array> {
  const markdown = kind === "decision_brief"
    ? formatDecisionBriefDocument(packet)
    : formatReviewableActionPacketDocument(packet);
  const title = kind === "decision_brief" ? "Decision brief" : "Evidence audit appendix";
  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "263B5D" },
          paragraph: { spacing: { after: 120, line: 264 } },
        },
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 32, bold: true, color: "2E67A6" }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 26, bold: true, color: "1F4D78" }, paragraph: { spacing: { before: 180, after: 100 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [{
        reference: "report-bullets",
        levels: [0, 1].map((level) => ({
          level,
          format: "bullet" as const,
          text: level === 0 ? "•" : "–",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
        })),
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          children: [new TextRun({ text: `${title} · Market Opportunity Platform`, size: 18, color: "6A788E", font: "Arial" })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D7E1F1" } },
          spacing: { after: 100 },
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Draft for accountable review · Page ", size: 16, color: "6A788E", font: "Arial" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "6A788E", font: "Arial" })],
        })] }),
      },
      children: markdownParagraphs(markdown),
    }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
