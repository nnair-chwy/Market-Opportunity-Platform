import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

process.on("uncaughtException", (error) => {
  console.error(`DECK_BUILD_ERROR: ${error?.message ?? error}`);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(`DECK_BUILD_ERROR: ${error?.message ?? error}`);
  process.exit(1);
});

const STARTER = "/Users/nnair/Documents/Market Opportunity Platform/.tmp_outline_aligned_deck/template-starter.pptx";
const FINAL = "/Users/nnair/Documents/Market Opportunity Platform/presentations/Market_Opportunity_Platform_Outline_Aligned_Leadership_Deck.pptx";
const HOME_IMAGE = "/Users/nnair/Documents/Market Opportunity Platform/assets/market-opportunity-platform-home-concept-v2.png";
const SCRIPT = "/Users/nnair/Documents/Market Opportunity Platform/presentations/Market_Opportunity_Platform_Leadership_Script.md";
const PLAN = "/Users/nnair/Documents/Market Opportunity Platform/docs/strategy/opportunity-inbox-implementation-plan.md";
const RENDER_DIR = "/Users/nnair/Documents/Market Opportunity Platform/.tmp_outline_aligned_deck/final-renders";
const LAYOUT_DIR = "/Users/nnair/Documents/Market Opportunity Platform/.tmp_outline_aligned_deck/final-layout/final";

const presentation = await PresentationFile.importPptx(await FileBlob.load(STARTER));

function rewrite(currentValue, value) {
  const matches = [];
  const normalizedTarget = currentValue.replace(/\s+/g, " ").trim();
  for (const slide of presentation.slides.items) {
    for (const shape of slide.shapes.items) {
      if (String(shape.text).replace(/\s+/g, " ").trim() === normalizedTarget) matches.push(shape);
    }
  }
  if (matches.length !== 1) throw new Error(`Expected one inherited text target for: ${currentValue}. Found ${matches.length}.`);
  matches[0].text.set(value);
}

rewrite("Teams combine fragmented market, site, and feasibility evidence to compare opportunities and prepare human decisions.", "Teams combine market, site, and feasibility signals to compare opportunities and prepare human decisions.");
rewrite("Useful customer and pet information is collected, but not always connected to the next helpful action across experiences.", "Useful customer and pet context exists, but it is not always translated into the next helpful action across experiences.");

rewrite("One platform connects sectors, regions, and channels", "One platform turns regional signals into sector-specific action plans");
rewrite("connects internal and external data to surface regional opportunities across business sectors and online, offline, and hybrid channels.", "qualifies regional changes through business-owned playbooks, then prepares the owner, action, deadline, outcome, guardrails, and stop conditions.");
rewrite("Compare regions", "Detect meaningful changes");
rewrite("Explore sectors", "Qualify opportunities");
rewrite("See coverage gaps", "Prepare owned actions");
rewrite("Plan data collection", "Measure and improve");
rewrite("Clinic location evaluation is the reference use case, not the boundary of the platform.", "Clinic location evaluation is where we learned the pattern. The future platform applies it across sectors.");

rewrite("A common evidence workflow supports many opportunity types", "Qualified opportunities end in accountable action plans");
rewrite("Opportunity", "Detect change");
rewrite("Define the sector, customer, region,\nand online, offline, or hybrid mode", "Observe a regional shift in demand, capacity, coverage, or the local ecosystem");
rewrite("Regional evidence", "Qualify opportunity");
rewrite("Join governed internal and external\nsources with provenance", "Test the baseline, supporting evidence, contradictions, readiness, and expiration");
rewrite("Insights + gaps", "Prepare action");
rewrite("Surface signals, evidence gaps,\nand data collection priorities", "Name the owner, deadline, ordered steps, guardrails, and stop conditions");
rewrite("Action", "Measure + learn");
rewrite("Compare options and prepare\na human-reviewed next step", "Record the outcome, decision trail, and playbook changes for the next response");
rewrite("One workflow can support commerce, healthcare, services, operations, and future sectors.", "One operating model can support Growth, Pet Health, Market Ecosystem, and future sectors.");

rewrite("One workspace connects regional opportunities, channels, and data gaps", "The future home page makes regional opportunities ready for action");

const image = presentation.slides.items[9].images.items[0];
if (!image) throw new Error("The inherited future home-page image was not found.");
const oldFrame = image.frame;
const oldCrop = image.crop;
const oldFit = image.fit;
const oldAlt = image.alt;
const oldGeometry = image.geometry;
const oldBorderRadius = image.borderRadius;
const oldRotation = image.rotation;
const oldFlipHorizontal = image.flipHorizontal;
const oldFlipVertical = image.flipVertical;
const oldLockAspectRatio = image.lockAspectRatio;
image.replace({
  blob: await fs.readFile(HOME_IMAGE),
  contentType: "image/png",
  alt: oldAlt ?? "Illustrative Market Opportunity Platform home page",
  ...(oldFit ? { fit: oldFit } : {}),
});
image.frame = oldFrame;
image.crop = oldCrop;
image.geometry = oldGeometry;
image.borderRadius = oldBorderRadius;
image.rotation = oldRotation;
image.flipHorizontal = oldFlipHorizontal;
image.flipVertical = oldFlipVertical;
image.lockAspectRatio = oldLockAspectRatio;

rewrite("Five decisions define a bounded platform pilot", "Five decisions define a measurable platform pilot");
rewrite("Pilot\nmeasure", "Business\noutcome");
rewrite("Baseline for insight quality, speed, and evidence readiness", "Baseline, target, measurement window, guardrails, and stop conditions");
rewrite("Start with one question, but design the evidence model to travel across sectors.", "Start with one action-ready opportunity, then improve and extend the playbook by sector.");

rewrite("Choose one regional question. Prove the workflow. Expand by sector.", "Choose one regional question. Prove the action workflow. Expand by sector.");
rewrite("Next step: select one regional opportunity and accountable user. Define the market universe and test whether the platform improves insight, evidence coverage, and decision preparation.", "Next step: select one accountable owner and one real regional decision. Test whether the platform shortens time to action, produces a measurable result, and avoids work when guardrails fail.");

const talkTracks = [
  "We started with a focused clinic decision and used it to discover a broader regional opportunity workflow.",
  "We began with two high-value problem spaces. Clinic expansion became the first wedge because it gave us a focused regional decision with clear constraints and human ownership.",
  "Our discovery conversations narrowed broad ideas into a sharper clinic opportunity and revealed that market, property, and execution decisions need different evidence and owners.",
  "The most important learning was that attractiveness, property feasibility, and execution priority are separate decisions. A single hidden score should not combine them.",
  "The current project is governed clinic decision support. It makes evidence, calculations, missing information, and human review visible. It is not a production locator or autonomous recommendation engine.",
  "The prototype can demonstrate market context, comparisons, candidate briefs, bounded AI explanations, and controlled sandbox behavior with public, reported, or synthetic inputs.",
  "In the demo, show the current clinic workflow from market context through comparison, evidence review, and bounded decision preparation.",
  "The future direction is bigger than connecting data. The platform should turn a qualified regional signal into a sector-specific action plan with an owner, deadline, outcome, guardrails, and stop conditions.",
  "The future operating model is detect, qualify, prepare the action, then measure and learn. Evidence remains traceable underneath, but the user experience leads with what should happen next.",
  "This illustrative home page shows the future destination: one regional workspace where teams can identify opportunity signals and move them into the right sector playbook.",
  "A credible pilot needs one owner, one regional question, an approved market definition, governed inputs, and a measurable business outcome with guardrails and stop rules.",
  "The ask is to choose one real regional question and prove whether the platform improves the quality and speed of an accountable action before expanding by sector.",
];

for (const [index, slide] of presentation.slides.items.entries()) {
  const extraSource = index === 9 ? `\n- ${HOME_IMAGE}` : "";
  slide.speakerNotes.textFrame.setText(`${talkTracks[index]}\n\n[Sources]\n- ${SCRIPT}\n- ${PLAN}${extraSource}\n[/Sources]`);
  slide.speakerNotes.setVisible(true);
}

await fs.mkdir(RENDER_DIR, { recursive: true });
await fs.mkdir(LAYOUT_DIR, { recursive: true });
for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, "0")}`;
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(`${RENDER_DIR}/${stem}.png`, new Uint8Array(await png.arrayBuffer()));
  await fs.writeFile(`${LAYOUT_DIR}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
}

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(FINAL);
