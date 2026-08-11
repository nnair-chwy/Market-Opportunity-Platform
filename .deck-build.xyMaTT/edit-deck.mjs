import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

process.on("uncaughtException", (error) => {
  console.error(`ERROR_MESSAGE: ${error?.message ?? error}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`ERROR_MESSAGE: ${error?.message ?? error}`);
  process.exit(1);
});

const buildDir = "/Users/nnair/Documents/Market Opportunity Platform/.deck-build.xyMaTT";
const starterPath = path.join(buildDir, "template-starter.pptx");
const outputPath = "/Users/nnair/Documents/Market Opportunity Platform/CVC_Clinic_Market_and_Location_Discovery_Journey_and_Future.pptx";
const renderDir = path.join(buildDir, "final-render");
const layoutDir = path.join(buildDir, "final-layout");

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPath));

const replacements = {
  "sh/tw3qx43q": "WHERE WE STARTED",
  "sh/dob69cre": "We started with two high-value problem spaces",
  "sh/3y9o3i9c": "Sources: Top 5 Ideas; Contacts & Conversations; Matt check-in",
  "sh/ozipcnqx": "CLINIC EXPANSION",
  "sh/nudofmpg": "Location evaluation",
  "sh/mt47mh8b": "Teams combine fragmented market, site, and feasibility evidence to compare opportunities and prepare human decisions.",
  "sh/ponq5o3i": "USER CONTEXT",
  "sh/2lwru9k7": "User Profile Studio",
  "sh/3m583els": "Useful customer and pet information is collected, but not always connected to the next helpful action across experiences.",
  "sh/h0nq143m": "WHY THESE",
  "sh/uxc7q9kv": "Governed decisions",
  "sh/fyl8zelg": "Both offered a clear role for AI: organize validated evidence and explain tradeoffs without taking ownership from people.",
  "sh/svupoz25": "Clinic expansion became the first wedge because it offered a focused, high-value decision we could prototype.",

  "sh/gjy1oba5": "DISCOVERY JOURNEY",
  "sh/xwf2d4ja": "Conversations moved us from broad ideas to a sharper clinic opportunity",
  "sh/zyhkfe10": "Sources: Contacts & Conversations; Cale notes; Matt check-in",
  "sh/l0z2h4j6": "WHO WE HEARD FROM",
  "sh/kzqloj2l": "WHAT WE LEARNED",
  "sh/e14ja5kb": "Cathy Harley • CVC / hybrid care",
  "sh/10za9o3y": "Mike Cammarota • CVC operations",
  "sh/zyhs7el8": "Krista Bardelli • CVC CRM",
  "sh/94jud83a": "Lana Lee • search + personalization",
  "sh/n21cbyl4": "Matt Merrill + Cale Harrington • expansion",
  "sh/58fa143q": "Customer and pet context is not always connected to action",
  "sh/krehgrax": "Clinic work crosses systems, owners, and handoffs",
  "sh/ypwze1sr": "Esri and Excel already cover major parts of analysis",
  "sh/8fyhkba9": "Market, property, and sequence are different decisions",
  "sh/6tgzi1s3": "The gap is a shared, reviewable decision trace",
  "sh/hk7ihgrq": "synthesis"
};

const sourceAnchors = {
  "sh/tw3qx43q": [2, "WHERE WE STARTED"],
  "sh/dob69cre": [2, "We started with a candidate property evaluator"],
  "sh/3y9o3i9c": [2, "Sources: project context; MVP scope; discovery notes"],
  "sh/ozipcnqx": [2, "EVIDENCE FIRST"],
  "sh/nudofmpg": [2, "Assemble evidence"],
  "sh/mt47mh8b": [2, "Gather candidate inputs, provenance, missingness, and warnings in one reviewable place."],
  "sh/ponq5o3i": [2, "DETERMINISTIC"],
  "sh/2lwru9k7": [2, "Compare candidates"],
  "sh/3m583els": [2, "Apply explicit constraints, weights, contributions, and sensitivity to a small candidate set."],
  "sh/h0nq143m": [2, "HUMAN REVIEW"],
  "sh/uxc7q9kv": [2, "Explain the result"],
  "sh/fyl8zelg": [2, "Draft source-linked briefs and questions while keeping the final decision with people."],
  "sh/svupoz25": [2, "Useful once candidates exist, but it does not tell us where to search next."],
  "sh/gjy1oba5": [3, "DISCOVERY JOURNEY"],
  "sh/xwf2d4ja": [3, "Discovery expanded the problem from scoring sites to connecting decisions"],
  "sh/zyhkfe10": [3, "Sources: Cale discovery; MVP scope; user workflows"],
  "sh/l0z2h4j6": [3, "WHERE WE STARTED"],
  "sh/kzqloj2l": [3, "WHAT DISCOVERY SHOWED"],
  "sh/e14ja5kb": [3, "Candidate addresses already chosen"],
  "sh/10za9o3y": [3, "One property score"],
  "sh/zyhs7el8": [3, "Local evidence assembly"],
  "sh/94jud83a": [3, "Single-reviewer workflow"],
  "sh/n21cbyl4": [3, "Site-level recommendation risk"],
  "sh/58fa143q": [3, "Esri already handles spatial analysis"],
  "sh/krehgrax": [3, "Excel already supports adjustable models"],
  "sh/ypwze1sr": [3, "Evidence fragments across handoffs"],
  "sh/8fyhkba9": [3, "Market, property, and sequence differ"],
  "sh/6tgzi1s3": [3, "The gap is a shared decision trace"],
  "sh/hk7ihgrq": [3, "discovery"]
};

const preEditInspect = await presentation.inspect({ kind: "textbox,notes", maxChars: 50000 });
const preEditRecords = preEditInspect.ndjson.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

for (const [sourceId, value] of Object.entries(replacements)) {
  const [slide, oldText] = sourceAnchors[sourceId];
  const record = preEditRecords.find((item) => item.kind === "textbox" && item.slide === slide && item.text === oldText);
  if (!record) throw new Error(`Could not resolve source text on slide ${slide}: ${oldText}`);
  presentation.resolve(record.id).text = value;
}

const noteId = (slide) => {
  const record = preEditRecords.find((item) => item.kind === "notes" && item.slide === slide);
  if (!record) throw new Error(`Could not resolve notes for slide ${slide}`);
  return record.id;
};

presentation.resolve(noteId(2)).setText(`Timing: 1:15
Explain that discovery initially converged on two promising problems. User Profile Studio addressed customer and pet information that is collected but not consistently connected to action. Clinic expansion addressed fragmented market, property, and feasibility evidence. Clinic expansion became the first wedge because it offered a focused decision that could be prototyped with transparent boundaries.

[Sources]
- https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5325357932/TOP+5+IDEAS
- https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5330470157/01+Contacts+Conversations
- https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5352818031/Check-in+With+Matt
[/Sources]`);

presentation.resolve(noteId(3)).setText(`Timing: 1:30
Name only completed conversations that are documented. Cathy Harley, Mike Cammarota, Krista Bardelli, and Lana Lee informed the broader CVC and user-context problem space. Matt Merrill and Cale Harrington sharpened the clinic expansion opportunity. Their combined input showed that important tools already exist, while evidence and rationale fragment across decision stages.

[Sources]
- https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5330470157/01+Contacts+Conversations
- https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5352949587/Cale
- https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5352818031/Check-in+With+Matt
[/Sources]`);

presentation.resolve(noteId(8)).setText(`Timing: 1:15
Transition clearly from current to future. This slide is a product direction, not a current capability claim.

Mission statement:
Our mission began with clinic location evaluation because it offered a focused, high-value way to improve how teams assemble evidence, compare opportunities, and prepare decisions. By bringing together a broad range of internal and external data, we learned that the greater opportunity is a transparent, governed platform that generates new insights across the sectors we hope to impact and helps teams move from fragmented evidence to confident human decisions.

[Sources]
- /Users/nnair/Documents/Market Opportunity Platform/market-opportunity-platform-transition-brief.md
[/Sources]`);

await fs.mkdir(renderDir, { recursive: true });
await fs.mkdir(layoutDir, { recursive: true });

for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  await writeBlob(path.join(renderDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(layoutDir, `${stem}.layout.json`), await layout.text());
}

await writeBlob(path.join(buildDir, "final-montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
const finalPptx = await PresentationFile.exportPptx(presentation);
await finalPptx.save(outputPath);

const inspect = await presentation.inspect({
  kind: "slide,textbox,shape,image,notes,layout",
  maxChars: 30000
});
await fs.writeFile(path.join(buildDir, "final-inspect.ndjson"), inspect.ndjson);

console.log(outputPath);
