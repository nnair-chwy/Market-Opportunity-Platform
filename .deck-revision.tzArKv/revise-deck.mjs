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

const buildDir = "/Users/nnair/Documents/Market Opportunity Platform/.deck-revision.tzArKv";
const starterPath = path.join(buildDir, "template-starter.pptx");
const outputPath = "/Users/nnair/Documents/Market Opportunity Platform/Market_Opportunity_Platform_Discovery_Journey_and_Future.pptx";
const imagePath = "/Users/nnair/Documents/Market Opportunity Platform/assets/market-opportunity-platform-home-concept-v2.png";
const renderDir = path.join(buildDir, "final-render");
const layoutDir = path.join(buildDir, "final-layout");

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPath));
const preEdit = await presentation.inspect({ kind: "slide,textbox,image,notes", maxChars: 60000 });
const records = preEdit.ndjson.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

const textChanges = [
  [1, "CHEWY VET CARE", "MARKET OPPORTUNITY PLATFORM"],
  [1, "CVC Clinic Market\nand Location Discovery", "From Clinic Discovery to a\nMarket Opportunity Platform"],
  [1, "From a governed clinic evaluator to a scalable market opportunity vision", "Regional insights across business sectors, online and offline"],
  [1, "MONDAY PRESENTATION | CURRENT DEMO + FUTURE DIRECTION", "DISCOVERY JOURNEY | CURRENT DEMO | FUTURE PLATFORM"],
  [1, "CVC", "MOP"],

  [8, "Thinking bigger: a Market Opportunity Platform", "One platform connects sectors, regions, and channels"],
  [8, "Sources: market opportunity transition brief", "Sources: user direction; market opportunity transition brief"],
  [8, "Market Opportunity Platform", "Market Opportunity Platform"],
  [8, "would automate nationwide screening, focus deeper analysis on promising submarkets, connect viable properties, and prepare a human-reviewed execution queue.", "connects internal and external data to surface regional opportunities across business sectors and online, offline, and hybrid channels."],
  [8, "IT WOULD HELP TEAMS", "IT WOULD HELP TEAMS"],
  [8, "Scan nationally", "Compare regions"],
  [8, "Drill down selectively", "Explore sectors"],
  [8, "Compare feasibility", "See coverage gaps"],
  [8, "Sequence transparently", "Plan data collection"],
  [8, "The clinic prototype becomes the reference vertical, not the limit of the platform.", "Clinic location evaluation is the reference use case, not the boundary of the platform."],

  [9, "The future platform scales through a four-level funnel", "A common evidence workflow supports many opportunity types"],
  [9, "Sources: market opportunity transition brief; open questions", "Sources: user direction; market opportunity transition brief"],
  [9, "Market", "Opportunity"],
  [9, "Which metros deserve attention?\nTier + rank", "Define the sector, customer, region,\nand online, offline, or hybrid mode"],
  [9, "Submarket", "Regional evidence"],
  [9, "Where is opportunity concentrated?\nRanked heat-map areas", "Join governed internal and external\nsources with provenance"],
  [9, "Property", "Insights + gaps"],
  [9, "Which available properties are feasible? Advance, review, or blocked", "Surface signals, evidence gaps,\nand data collection priorities"],
  [9, "Sequence", "Action"],
  [9, "What should Chewy pursue first? Human-reviewed queue + rationale", "Compare options and prepare\na human-reviewed next step"],
  [9, "Each stage narrows the search while preserving a separate decision and rationale.", "One workflow can support commerce, healthcare, services, operations, and future sectors."],

  [10, "One workspace could connect national scan, diligence, and review sequence", "One workspace connects regional opportunities, channels, and data gaps"],
  [10, "Illustrative future-state concept. No real rankings or properties shown.", "Illustrative future-state concept. Example sectors and signals only."],

  [11, "Four product decisions unlock a bounded pilot", "Five decisions define a bounded platform pilot"],
  [11, "Sources: open questions; market opportunity transition brief", "Sources: user direction; market opportunity transition brief"],
  [11, "Market model", "Pilot\nquestion"],
  [11, "Approved attractiveness criteria, directions, and weights", "One sector, one regional decision, and one accountable user"],
  [11, "Submarket definition", "Market\ndefinition"],
  [11, "Units, grouping rules, drive-time, and overlap method", "Approved regions, hierarchy, and comparison universe"],
  [11, "Property gate", "Channel\nmodel"],
  [11, "Mandatory constraints and approved availability source", "Clear meanings for online, offline, and hybrid signals"],
  [11, "Queue logic", "Data\ncontracts"],
  [11, "Rules separating attractiveness, feasibility, and priority", "Sources, permissions, freshness, gaps, and collection plan"],
  [11, "Pilot scope", "Pilot\nmeasure"],
  [11, "One accountable user, one decision, approved inputs, and measurable workflow baseline", "Baseline for insight quality, speed, and evidence readiness"],
  [11, "Validate the workflow before claiming rankings, savings, or production readiness.", "Start with one question, but design the evidence model to travel across sectors."],

  [12, "THE ASK", "THE ASK"],
  [12, "Choose one decision. Pilot the workflow. Validate the value.", "Choose one regional question. Prove the workflow. Expand by sector."],
  [12, "Next step: name one accountable user, confirm the four decision rules, and run one bounded portfolio decision with approved inputs and a measurable baseline.", "Next step: select one regional opportunity and accountable user. Define the market universe and test whether the platform improves insight, evidence coverage, and decision preparation."],
  [12, "CVC", "MOP"]
];

for (const [slide, oldText, newText] of textChanges) {
  const record = records.find((item) => item.kind === "textbox" && item.slide === slide && item.text === oldText);
  if (!record) throw new Error(`Could not resolve slide ${slide} text: ${oldText}`);
  presentation.resolve(record.id).text = newText;
}

const imageRecord = records.find((item) => item.kind === "image" && item.slide === 10);
if (!imageRecord) throw new Error("Could not resolve the future home-page image on slide 10");
const image = presentation.resolve(imageRecord.id);
const oldFrame = image.frame;
const oldCrop = image.crop;
const oldFit = image.fit;
const oldRotation = image.rotation;
const oldFlipHorizontal = image.flipHorizontal;
const oldFlipVertical = image.flipVertical;
const oldLockAspectRatio = image.lockAspectRatio;
const imageBytes = await fs.readFile(imagePath);
const imageBlob = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength);
image.replace({
  blob: imageBlob,
  contentType: "image/png",
  alt: "Illustrative Market Opportunity Platform home page showing regional opportunities, online and offline modes, sector signals, evidence coverage, and data collection priorities",
  fit: "contain"
});
image.frame = oldFrame;
image.fit = "contain";
image.geometry = "rect";
image.borderRadius = undefined;
image.rotation = oldRotation;
image.flipHorizontal = oldFlipHorizontal;
image.flipVertical = oldFlipVertical;
image.lockAspectRatio = oldLockAspectRatio;

const noteId = (slide) => {
  const record = records.find((item) => item.kind === "notes" && item.slide === slide);
  if (!record) throw new Error(`Could not resolve notes for slide ${slide}`);
  return record.id;
};

presentation.resolve(noteId(1)).setText(`Timing: 0:30
Open with the clinic evaluator as the origin story, not the platform definition. The broader opportunity is a reusable way to explore regional opportunities across sectors and channels while keeping evidence quality and human ownership visible.

[Sources]
- User direction, August 5, 2026
- /Users/nnair/Documents/Market Opportunity Platform/market-opportunity-platform-transition-brief.md
[/Sources]`);

presentation.resolve(noteId(8)).setText(`Timing: 1:15
This is the corrected platform mission. Clinic location evaluation supplied the first focused workflow, but the platform is intended to support multiple business sectors and online, offline, and hybrid opportunities by regional market.

Mission statement:
Our mission began with clinic location evaluation because it offered a focused, high-value way to improve how teams assemble evidence, compare opportunities, and prepare decisions. By bringing together a broad range of internal and external data, we learned that the greater opportunity is a transparent, governed platform that generates new insights across the sectors we hope to impact. The platform helps teams compare regional opportunities across online, offline, and hybrid channels, identify gaps in available evidence, and focus data collection before people make the final decision.

[Sources]
- User direction, August 5, 2026
- /Users/nnair/Documents/Market Opportunity Platform/market-opportunity-platform-transition-brief.md
[/Sources]`);

presentation.resolve(noteId(9)).setText(`Timing: 1:15
Walk left to right. Every use case starts by defining the sector, customer, region, and channel mode. The platform assembles governed regional evidence, surfaces opportunity signals and evidence gaps, and helps teams decide what to investigate, collect, or test next. The workflow is common even when sector-specific evidence differs.

[Sources]
- User direction, August 5, 2026
- /Users/nnair/Documents/Market Opportunity Platform/market-opportunity-platform-transition-brief.md
[/Sources]`);

presentation.resolve(noteId(10)).setText(`Timing: 0:45
This is an illustrative future-state concept, not a current product screenshot. It shows a sector-neutral regional opportunity map, online and offline opportunity modes, cross-sector signals, evidence coverage, and explicit data collection priorities. All labels and examples are synthetic.

[Sources]
- Generated concept asset: /Users/nnair/Documents/Market Opportunity Platform/assets/market-opportunity-platform-home-concept-v2.png
- User direction, August 5, 2026
[/Sources]`);

presentation.resolve(noteId(11)).setText(`Timing: 1:15
The platform vision is intentionally broad, so the pilot must remain bounded. Choose one regional opportunity question, define the regional universe and channel meanings, approve the data contracts and collection plan, and measure whether the shared workflow improves insight and evidence readiness.

[Sources]
- User direction, August 5, 2026
- /Users/nnair/Documents/Market Opportunity Platform/market-opportunity-platform-transition-brief.md
[/Sources]`);

presentation.resolve(noteId(12)).setText(`Timing: 0:45
Close with one pilot question, not one permanent sector. The pilot should validate a reusable evidence workflow that can later expand to other sectors, regions, and online, offline, or hybrid opportunity types.

[Sources]
- User direction, August 5, 2026
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
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPath);

const finalInspect = await presentation.inspect({ kind: "slide,textbox,image,notes,layout", maxChars: 60000 });
await fs.writeFile(path.join(buildDir, "final-inspect.ndjson"), finalInspect.ndjson);
console.log(outputPath);
