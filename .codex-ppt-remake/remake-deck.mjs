import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const ROOT = "/Users/nnair/Documents/Retail and Clinic Location Evaluator/.codex-ppt-remake";
const SOURCE = `${ROOT}/template-starter.pptx`;
const OUTPUT = "/Users/nnair/Documents/Retail and Clinic Location Evaluator/CVC_Clinic_Market_and_Location_Discovery_Redesigned.pptx";

const C = {
  navy: "#0B1733",
  ink: "#13213A",
  cream: "#F7F3EA",
  white: "#FFFFFF",
  blue: "#2D5BFF",
  blue2: "#6F8CFF",
  paleBlue: "#DDE6FF",
  mint: "#BFE9D0",
  mintDark: "#176A45",
  coral: "#FF8A73",
  amber: "#F3C96B",
  fog: "#E8EDF5",
  gray: "#667085",
  muted: "#A9B5CC",
};

const presentation = await PresentationFile.importPptx(await FileBlob.load(SOURCE));
const layouts = [];
for (let slide = 1; slide <= 16; slide += 1) {
  const n = String(slide).padStart(2, "0");
  layouts.push(JSON.parse(await fs.readFile(`${ROOT}/template-starter-layout/starter-slide-${n}.layout.json`, "utf8")));
}

function getShape(slideIndex, elementIndex) {
  const shape = presentation.slides.getItem(slideIndex).shapes.items[elementIndex];
  if (!shape) throw new Error(`Missing shape at slide ${slideIndex + 1}, element ${elementIndex}`);
  return shape;
}

function clearSlide(slideIndex, background = C.cream) {
  const slide = presentation.slides.getItem(slideIndex);
  slide.background.fill = background;
  for (const shape of slide.shapes.items) {
    shape.position = { left: 4, top: 4, width: 1, height: 1 };
    shape.fill = "none";
    shape.line = { style: "solid", fill: "none", width: 0 };
    shape.text = "";
  }
}

function text(slideIndex, elementIndex, value, position, style = {}) {
  const shape = getShape(slideIndex, elementIndex);
  shape.position = position;
  shape.fill = style.fill ?? "none";
  shape.line = style.line ?? { style: "solid", fill: "none", width: 0 };
  shape.text = value;
  shape.text.style = {
    fontSize: style.fontSize ?? 22,
    bold: style.bold ?? false,
    color: style.color ?? C.ink,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: style.autoFit ?? "shrinkText",
    wrap: style.wrap ?? "square",
    lineSpacing: style.lineSpacing ?? 1.0,
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function box(slideIndex, elementIndex, position, fill, options = {}) {
  const shape = getShape(slideIndex, elementIndex);
  shape.position = position;
  shape.fill = fill;
  shape.line = options.line ?? { style: "solid", fill: "none", width: 0 };
  shape.borderRadius = options.radius ?? 0;
  shape.shadow = options.shadow ?? "shadow-none";
  // Keep decorative panels identifiable as edited inherited shapes during fidelity QA.
  // The zero-width character has no visible glyph in PowerPoint.
  shape.text = "\u200B";
  shape.text.style = { fontSize: 1, color: fill, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  return shape;
}

function label(slideIndex, elementIndex, value, color = C.blue, dark = false) {
  return text(slideIndex, elementIndex, value.toUpperCase(), { left: 64, top: 34, width: 560, height: 26 }, {
    fontSize: 15,
    bold: true,
    color: dark ? C.paleBlue : color,
  });
}

function footer(slideIndex, lineIndex, sourceIndex, pageIndex, source, dark = false) {
  box(slideIndex, lineIndex, { left: 64, top: 674, width: 1152, height: 2 }, dark ? "#33415F" : "#D6DCE7");
  text(slideIndex, sourceIndex, source, { left: 64, top: 684, width: 980, height: 18 }, {
    fontSize: 12,
    color: dark ? C.muted : C.gray,
  });
  text(slideIndex, pageIndex, String(slideIndex + 1).padStart(2, "0"), { left: 1150, top: 684, width: 66, height: 18 }, {
    fontSize: 12,
    bold: true,
    color: dark ? C.white : C.ink,
    alignment: "right",
  });
}

const notes = [
`Today we are showing a smarter way to find and evaluate potential CVC clinic locations.

The idea begins with a broader question: how can Chewy better understand what is happening in a specific market, identify the areas with the strongest potential, and use those insights to make better local decisions?

We started with clinic locations, but what we learned has implications well beyond real estate.

[Sources]
User-provided presentation script
PROJECT_CONTEXT.md
docs/product/mvp-scope.md`,
`CVC already has strong mapping and analysis tools. The problem is that the full decision is still spread across maps, spreadsheets, property information, and conversations.

The hard part is connecting those pieces. Why did we focus on this part of the market? What makes it different from another area? Why did one opportunity move forward? What information is missing?

Our solution creates one guided path through those questions.

[Sources]
User-provided presentation script
PROJECT_CONTEXT.md`,
`The product is an AI-guided market and location discovery workflow.

It helps the team move from a large market to a smaller set of promising submarkets, and then to real candidate properties. At each step it gathers the available evidence, runs a consistent analysis, explains the tradeoffs, and prepares the next decision for review.

The result is not just a score. It is a clear story of where to look, why that area matters, and what the team should investigate next.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md
docs/technical/ai-boundaries.md`,
`The workflow narrows the search in four steps.

We start with markets, identify the strongest submarkets inside them, evaluate available properties, and create a review order.

The broad market view tells us where to begin. The AI-guided deep dive then turns a large geography into practical areas the team can investigate.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md`,
`At scale, the system could regularly review an approved list of markets and highlight the ones that appear most promising under the selected business criteria.

Instead of asking someone to manually study every city, we use the broad screen to decide where deeper work is worth the effort.

Once a market advances, the AI agent begins a focused regional investigation. That is where the system moves from a national view into local opportunity.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md
docs/product/open-questions.md`,
`This is a key part of the solution.

The AI agent gathers the approved market information and works through the market one step at a time. It proposes a set of practical submarkets, such as the urban core, nearby growth areas, suburban coverage areas, or other locally meaningful groups.

The analyst reviews that proposed breakdown before the analysis continues. Once it is confirmed, the system calculates the results for each submarket using the same rules. The agent then studies those results, looks for strengths, gaps, and tradeoffs, and groups the submarkets into clear categories: areas to investigate now, areas that look promising but need more evidence, and areas that are lower priority under the current scenario.

This turns a large market into a short, explainable list of places where deeper investigation should begin.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md
docs/technical/ai-boundaries.md`,
`The analyst sees the whole journey in one place.

They can start with the market, review the submarkets the agent created, see why each area received its category, and then move into actual properties.

For every submarket or property, the system shows the information used, what is missing, and what drove the result. The analyst can ask follow-up questions in plain language, compare areas, and understand what would need to change for a different result.

The goal is to make the analysis easier to use, not just faster to produce.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md
docs/technical/data-contracts.md`,
`We keep three questions separate: Is the area attractive? Is the property workable? And is it ready to pursue now?

Keeping those questions separate prevents a high score from hiding a serious property or timing issue.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md
docs/technical/ai-boundaries.md`,
`A strong market or location score does not automatically determine what should move first.

Property feasibility and execution readiness remain separate. A viable property can move ahead of a higher-scoring option when the higher-scoring option still has unresolved constraints or missing evidence.

[Sources]
Source presentation
docs/product/mvp-scope.md
docs/technical/data-contracts.md`,
`The prototype demonstrates this guided workflow with a Seattle example.

It can show market context, present proposed submarkets, pause for analyst approval, run a consistent comparison, and explain which areas rise under the demonstration criteria.

It is not yet a production national ranking or a real-estate recommendation. The current example is designed to prove the workflow before we connect approved business rules and full sensitive production data.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md
PROJECT_CONTEXT.md`,
`Before real rankings are credible, the team still needs to approve the market model, submarket definition rules, property feasibility gate, and execution sequencing logic.

Those decisions establish what the system may calculate and how the team interprets the result. The prototype does not resolve them on its own.

[Sources]
Source presentation
docs/product/open-questions.md
docs/technical/ai-boundaries.md`,
`AI is what makes this feel like a guided investigation instead of a dashboard.

The agent decides which approved step to take next. It gathers the relevant information, proposes the submarket plan, runs the allowed analysis, compares the results, asks for human input when needed, and writes a clear summary.

The application still handles the math and map calculations. The analyst approves the proposed submarkets and makes the final decision. So AI drives the process forward without becoming a black box.

[Sources]
User-provided presentation script
docs/technical/ai-boundaries.md
docs/product/mvp-scope.md`,
`Today, market analysis, property research, and review can feel like separate handoffs.

With this workflow, they become one connected investigation. The team can see what the agent did, what evidence it used, why an area moved forward, and what still needs to be resolved.

More importantly, that regional understanding does not have to stop with clinic locations.

[Sources]
User-provided presentation script
PROJECT_CONTEXT.md`,
`The biggest lesson from this project is that markets are not interchangeable.

Customer needs, competition, local events, available services, business density, and growth patterns can look very different from one region to another. A national average can hide those differences.

If we can identify and explain meaningful regional signals, the same capability could support decisions across marketing, merchandising, services, partnerships, operations, and other parts of the business.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md`,
`Start the market deep dive
I will start with Seattle and launch the AI-guided market deep dive. The agent is not receiving an open-ended instruction to find anything it wants. It follows a defined process and uses the information available inside the application.
Demo action: Open Seattle and start the Market Deep Dive.

Gather context and propose submarkets
The agent first gathers the market context. It then creates a proposed way to break the market into smaller, practical areas for analysis.
Demo action: Show the seven proposed Seattle submarkets and the map.

Ask for human confirmation
Before scoring anything, the agent pauses. The analyst can confirm the proposed submarkets, reject them, or leave the question unresolved.
Demo action: Confirm the proposed segmentation.

Run the analysis and create categories
After confirmation, the application runs the same analysis across every submarket. The agent reviews the results and turns them into useful categories. It also explains what drove each result, so the analyst sees more than a ranking.
Demo action: Run the comparison. Show the priority cards, table, contributions, and missing information.

Move from submarket to properties
For the clinic use case, the strongest submarket categories become the starting point for property discovery.
Demo action: Open a candidate brief or location comparison.

Ask AI and close the demo
The analyst can ask AI to explain the result in plain language. The answer stays tied to the information shown here, including missing information and uncertainty.
Demo action: Show one short AI explanation or generated review brief.

[Sources]
User-provided presentation script
docs/product/mvp-scope.md
docs/technical/ai-boundaries.md`,
`We started by asking how to make clinic location decisions better. What we learned is bigger: every market has its own combination of customers, competition, needs, and local signals.

Our ask is to treat clinic location discovery as the first use case for a broader regional insights capability.

The next step is to choose a small number of business sectors and test how the same AI-guided workflow can identify local opportunities for each one. The regional evidence can be shared, while each team applies its own goals, rules, and measures of success.

The opportunity is not simply to find better clinic locations. It is to help more of Chewy understand what is changing locally, why it matters to their business, and where they should act next.

[Sources]
User-provided presentation script
PROJECT_CONTEXT.md
docs/product/mvp-scope.md`,
];

// Slide 1
clearSlide(0, C.navy);
text(0, 0, "CHEWY VET CARE", { left: 64, top: 48, width: 350, height: 30 }, { fontSize: 16, bold: true, color: C.paleBlue });
text(0, 1, "CVC Clinic Market\nand Location Discovery", { left: 64, top: 150, width: 900, height: 190 }, { fontSize: 60, bold: true, color: C.white, lineSpacing: 0.9 });
text(0, 2, "A guided path from market signal to the next local decision", { left: 68, top: 380, width: 760, height: 70 }, { fontSize: 26, color: C.paleBlue });
text(0, 3, "VISION + LIVE DEMO", { left: 68, top: 612, width: 320, height: 30 }, { fontSize: 15, bold: true, color: C.mint });
box(0, 4, { left: 1036, top: 0, width: 244, height: 720 }, C.blue);
text(0, 5, "CVC", { left: 1036, top: 286, width: 244, height: 120 }, { fontSize: 42, bold: true, color: C.white, alignment: "center" });

// Slide 2
clearSlide(1);
label(1, 0, "Why the vision changed");
text(1, 1, "The gap is between the tools", { left: 64, top: 76, width: 990, height: 74 }, { fontSize: 44, bold: true });
footer(1, 2, 3, 4, "Maps + files + conversations need one decision trail");
box(1, 5, { left: 64, top: 220, width: 310, height: 280 }, C.paleBlue, { radius: 26 });
text(1, 6, "SEE", { left: 92, top: 246, width: 250, height: 30 }, { fontSize: 15, bold: true, color: C.blue });
text(1, 7, "Maps", { left: 92, top: 296, width: 250, height: 64 }, { fontSize: 44, bold: true });
text(1, 8, "Market context", { left: 92, top: 388, width: 250, height: 44 }, { fontSize: 21, color: C.gray });
box(1, 9, { left: 422, top: 220, width: 310, height: 280 }, C.amber, { radius: 26 });
text(1, 10, "CALCULATE", { left: 450, top: 246, width: 250, height: 30 }, { fontSize: 15, bold: true, color: C.ink });
text(1, 11, "Files", { left: 450, top: 296, width: 250, height: 64 }, { fontSize: 44, bold: true });
text(1, 12, "Scores + facts", { left: 450, top: 388, width: 250, height: 44 }, { fontSize: 21, color: C.ink });
box(1, 13, { left: 780, top: 190, width: 436, height: 340 }, C.blue, { radius: 26 });
text(1, 14, "DECIDE", { left: 816, top: 226, width: 340, height: 30 }, { fontSize: 15, bold: true, color: C.paleBlue });
text(1, 15, "One guided\npath", { left: 816, top: 280, width: 340, height: 110 }, { fontSize: 46, bold: true, color: C.white, lineSpacing: 0.9 });
text(1, 16, "Evidence → tradeoffs → next action", { left: 816, top: 430, width: 340, height: 44 }, { fontSize: 20, color: C.paleBlue });
text(1, 17, "Connect the work. Preserve the why.", { left: 64, top: 566, width: 930, height: 48 }, { fontSize: 28, bold: true, color: C.blue });

// Slide 3
clearSlide(2, C.white);
label(2, 0, "Product statement");
text(2, 1, "A guided investigation, not another score", { left: 64, top: 76, width: 1110, height: 72 }, { fontSize: 44, bold: true });
footer(2, 2, 3, 4, "Evidence-backed workflow | Human-reviewed decisions");
text(2, 5, "DISCOVER", { left: 72, top: 220, width: 300, height: 50 }, { fontSize: 18, bold: true, color: C.blue });
text(2, 6, "Where to look", { left: 72, top: 276, width: 300, height: 70 }, { fontSize: 38, bold: true });
box(2, 7, { left: 398, top: 195, width: 8, height: 210 }, C.fog);
text(2, 8, "COMPARE", { left: 454, top: 220, width: 300, height: 50 }, { fontSize: 18, bold: true, color: C.mintDark });
text(2, 9, "Why it matters", { left: 454, top: 276, width: 320, height: 70 }, { fontSize: 38, bold: true });
box(2, 10, { left: 806, top: 195, width: 8, height: 210 }, C.fog);
text(2, 11, "REVIEW", { left: 860, top: 220, width: 300, height: 50 }, { fontSize: 18, bold: true, color: C.coral });
text(2, 12, "What happens next", { left: 860, top: 276, width: 330, height: 100 }, { fontSize: 38, bold: true });
box(2, 13, { left: 64, top: 482, width: 1152, height: 96 }, C.navy, { radius: 20 });
text(2, 14, "The output is a clear story of evidence, tradeoffs, and next steps.", { left: 94, top: 482, width: 1092, height: 96 }, { fontSize: 27, bold: true, color: C.white, alignment: "center" });

// Slide 4
clearSlide(3);
label(3, 0, "The scalable funnel");
text(3, 1, "Narrow the question at every step", { left: 64, top: 76, width: 1000, height: 70 }, { fontSize: 44, bold: true });
footer(3, 2, 3, 4, "Each level answers a different decision question");
const funnel = [
  { y: 190, left: 90, width: 1100, fill: C.paleBlue, num: "01", name: "MARKET", q: "Where should we begin?" },
  { y: 288, left: 180, width: 920, fill: C.mint, num: "02", name: "SUBMARKET", q: "Where is potential concentrated?" },
  { y: 386, left: 270, width: 740, fill: C.amber, num: "03", name: "PROPERTY", q: "Is the site workable?" },
  { y: 484, left: 360, width: 560, fill: C.coral, num: "04", name: "REVIEW ORDER", q: "What should move first?" },
];
let e4 = 5;
for (const row of funnel) {
  box(3, e4++, { left: row.left, top: row.y, width: row.width, height: 76 }, row.fill, { radius: 18 });
  text(3, e4++, row.num, { left: row.left + 22, top: row.y, width: 54, height: 76 }, { fontSize: 16, bold: true, color: C.ink });
  text(3, e4++, row.name, { left: row.left + 82, top: row.y, width: 240, height: 76 }, { fontSize: 23, bold: true });
  text(3, e4++, row.q, { left: row.left + row.width - 360, top: row.y, width: 330, height: 76 }, { fontSize: 18, color: C.ink, alignment: "right" });
}

// Slide 5
clearSlide(4, C.white);
label(4, 0, "How it works at scale");
text(4, 1, "Screen broadly. Investigate locally.", { left: 64, top: 76, width: 1080, height: 72 }, { fontSize: 44, bold: true });
footer(4, 2, 3, 4, "Approved market universe → focused regional investigation");
text(4, 5, "BROAD SCREEN", { left: 72, top: 190, width: 340, height: 30 }, { fontSize: 16, bold: true, color: C.blue });
const barHeights = [66, 118, 84, 150, 96, 132, 72, 108, 144, 90];
for (let i = 0; i < 10; i += 1) {
  box(4, 6 + i, { left: 76 + i * 47, top: 460 - barHeights[i], width: 24, height: barHeights[i] }, i === 8 ? C.blue : C.paleBlue, { radius: 8 });
}
text(4, 16, "Review the approved market list consistently", { left: 72, top: 500, width: 500, height: 58 }, { fontSize: 22, bold: true });
box(4, 17, { left: 642, top: 178, width: 574, height: 396 }, C.navy, { radius: 28 });
text(4, 18, "DEEP DIVE", { left: 686, top: 216, width: 430, height: 30 }, { fontSize: 16, bold: true, color: C.mint });
text(4, 19, "Earn the right\nto go deeper", { left: 686, top: 272, width: 440, height: 112 }, { fontSize: 44, bold: true, color: C.white, lineSpacing: 0.9 });
text(4, 20, "1", { left: 686, top: 430, width: 30, height: 34 }, { fontSize: 17, bold: true, color: C.mint });
text(4, 21, "Apply hard rules", { left: 730, top: 430, width: 350, height: 34 }, { fontSize: 19, color: C.white });
text(4, 22, "2", { left: 686, top: 474, width: 30, height: 34 }, { fontSize: 17, bold: true, color: C.mint });
text(4, 23, "Compare approved criteria", { left: 730, top: 474, width: 350, height: 34 }, { fontSize: 19, color: C.white });
text(4, 24, "3", { left: 686, top: 518, width: 30, height: 34 }, { fontSize: 17, bold: true, color: C.mint });
text(4, 25, "Investigate the region", { left: 730, top: 518, width: 350, height: 34 }, { fontSize: 19, color: C.white });

// Slide 6
clearSlide(5);
label(5, 0, "AI-guided submarket analysis");
text(5, 1, "The analyst sets the geography before scoring", { left: 64, top: 76, width: 1120, height: 72 }, { fontSize: 42, bold: true });
footer(5, 2, 3, 4, "Proposal → human confirmation → deterministic comparison → explanation");
const stages6 = [
  { x: 64, fill: C.paleBlue, n: "01", title: "PROPOSE", body: "Practical local areas" },
  { x: 354, fill: C.mint, n: "02", title: "CONFIRM", body: "Human geography gate" },
  { x: 644, fill: C.amber, n: "03", title: "COMPARE", body: "Same rules for every area" },
  { x: 934, fill: C.coral, n: "04", title: "EXPLAIN", body: "Strengths, gaps, tradeoffs" },
];
let e6 = 5;
for (const stage of stages6) {
  box(5, e6++, { left: stage.x, top: 210, width: 250, height: 330 }, stage.fill, { radius: 24 });
  text(5, e6++, stage.n, { left: stage.x + 24, top: 234, width: 60, height: 28 }, { fontSize: 16, bold: true, color: C.ink });
  text(5, e6++, stage.title, { left: stage.x + 24, top: 300, width: 202, height: 44 }, { fontSize: 24, bold: true });
  text(5, e6++, stage.body, { left: stage.x + 24, top: 378, width: 202, height: 80 }, { fontSize: 19, color: C.ink });
}
box(5, e6++, { left: 330, top: 182, width: 298, height: 6 }, C.blue);
text(5, e6++, "ANALYST CHECKPOINT", { left: 330, top: 150, width: 298, height: 28 }, { fontSize: 15, bold: true, color: C.blue, alignment: "center" });

// Slide 7
clearSlide(6, C.white);
label(6, 0, "What analysts see");
text(6, 1, "One workspace. One evidence trail.", { left: 64, top: 76, width: 980, height: 72 }, { fontSize: 44, bold: true });
footer(6, 2, 3, 4, "Every result shows inputs, missing evidence, and drivers");
box(6, 5, { left: 68, top: 208, width: 1120, height: 8 }, C.fog);
const journey7 = [
  { x: 68, c: C.blue, title: "MARKET", sub: "Context" },
  { x: 440, c: C.mintDark, title: "SUBMARKET", sub: "Why here" },
  { x: 812, c: C.coral, title: "PROPERTY", sub: "What is workable" },
];
let e7 = 6;
for (const item of journey7) {
  box(6, e7++, { left: item.x, top: 185, width: 26, height: 54 }, item.c, { radius: 13 });
  text(6, e7++, item.title, { left: item.x, top: 270, width: 300, height: 44 }, { fontSize: 28, bold: true, color: item.c });
  text(6, e7++, item.sub, { left: item.x, top: 320, width: 300, height: 38 }, { fontSize: 20, color: C.gray });
}
box(6, e7++, { left: 68, top: 420, width: 340, height: 132 }, C.navy, { radius: 22 });
text(6, e7++, "ASK", { left: 96, top: 438, width: 280, height: 36 }, { fontSize: 16, bold: true, color: C.paleBlue });
text(6, e7++, "Plain language", { left: 96, top: 486, width: 280, height: 44 }, { fontSize: 25, bold: true, color: C.white });
box(6, e7++, { left: 454, top: 420, width: 340, height: 132 }, C.blue, { radius: 22 });
text(6, e7++, "COMPARE", { left: 482, top: 438, width: 280, height: 36 }, { fontSize: 16, bold: true, color: C.paleBlue });
text(6, e7++, "Tradeoffs", { left: 482, top: 486, width: 280, height: 44 }, { fontSize: 25, bold: true, color: C.white });
box(6, e7++, { left: 840, top: 420, width: 348, height: 132 }, C.mint, { radius: 22 });
text(6, e7++, "TRACE", { left: 868, top: 438, width: 292, height: 36 }, { fontSize: 16, bold: true, color: C.mintDark });
text(6, e7++, "Evidence + gaps", { left: 868, top: 486, width: 292, height: 44 }, { fontSize: 25, bold: true, color: C.ink });

// Slide 8
clearSlide(7, C.navy);
label(7, 0, "Three outputs stay separate", C.blue, true);
text(7, 1, "Three questions. Three different decisions.", { left: 64, top: 76, width: 1120, height: 72 }, { fontSize: 43, bold: true, color: C.white });
footer(7, 2, 3, 4, "A strong signal cannot hide a hard constraint", true);
const cols8 = [
  { x: 64, c: C.blue2, n: "01", word: "ATTRACTIVE?", q: "Is the area promising?" },
  { x: 452, c: C.amber, n: "02", word: "WORKABLE?", q: "Can the property operate?" },
  { x: 840, c: C.mint, n: "03", word: "READY?", q: "Should it move now?" },
];
let e8 = 5;
for (const col of cols8) {
  text(7, e8++, col.n, { left: col.x, top: 220, width: 80, height: 36 }, { fontSize: 17, bold: true, color: col.c });
  box(7, e8++, { left: col.x, top: 274, width: 324, height: 10 }, col.c);
  text(7, e8++, col.word, { left: col.x, top: 318, width: 324, height: 68 }, { fontSize: 32, bold: true, color: C.white });
  text(7, e8++, col.q, { left: col.x, top: 414, width: 300, height: 56 }, { fontSize: 20, color: C.paleBlue });
}

// Slide 9
clearSlide(8, C.white);
label(8, 0, "Sequencing example");
text(8, 1, "The highest score can still wait", { left: 64, top: 76, width: 1000, height: 72 }, { fontSize: 44, bold: true });
footer(8, 2, 3, 4, "Viability and readiness determine the queue");
box(8, 5, { left: 64, top: 200, width: 480, height: 360 }, C.coral, { radius: 28 });
text(8, 6, "PROPERTY A", { left: 98, top: 232, width: 400, height: 32 }, { fontSize: 16, bold: true, color: C.ink });
text(8, 7, "HIGH\nSCORE", { left: 98, top: 300, width: 390, height: 118 }, { fontSize: 48, bold: true, color: C.ink, lineSpacing: 0.85 });
text(8, 8, "Missing evidence\nUnconfirmed constraints", { left: 98, top: 460, width: 390, height: 70 }, { fontSize: 19, color: C.ink });
box(8, 9, { left: 596, top: 200, width: 620, height: 360 }, C.mint, { radius: 28 });
text(8, 10, "PROPERTY B", { left: 632, top: 232, width: 520, height: 32 }, { fontSize: 16, bold: true, color: C.mintDark });
text(8, 11, "MOVES\nFIRST", { left: 632, top: 300, width: 510, height: 118 }, { fontSize: 48, bold: true, color: C.ink, lineSpacing: 0.85 });
text(8, 12, "Workable option\nStronger evidence coverage", { left: 632, top: 460, width: 510, height: 70 }, { fontSize: 19, color: C.ink });
box(8, 13, { left: 520, top: 342, width: 104, height: 8 }, C.blue);
text(8, 14, "QUEUE", { left: 520, top: 306, width: 104, height: 28 }, { fontSize: 14, bold: true, color: C.blue, alignment: "center" });

// Slide 10
clearSlide(9, C.blue);
label(9, 0, "Where the prototype stands", C.white, true);
text(9, 1, "It proves the workflow,\nnot the recommendation.", { left: 64, top: 84, width: 1040, height: 136 }, { fontSize: 50, bold: true, color: C.white, lineSpacing: 0.9 });
footer(9, 2, 3, 4, "Seattle synthetic demonstration | Human review required", true);
box(9, 5, { left: 64, top: 280, width: 528, height: 300 }, C.white, { radius: 26 });
text(9, 6, "DEMONSTRATES", { left: 98, top: 312, width: 450, height: 30 }, { fontSize: 16, bold: true, color: C.blue });
text(9, 7, "Market context", { left: 98, top: 370, width: 420, height: 38 }, { fontSize: 22, bold: true });
text(9, 8, "Proposed submarkets", { left: 98, top: 422, width: 420, height: 38 }, { fontSize: 22, bold: true });
text(9, 9, "Approval + comparison", { left: 98, top: 474, width: 420, height: 38 }, { fontSize: 22, bold: true });
box(9, 10, { left: 624, top: 280, width: 592, height: 300 }, C.navy, { radius: 26 });
text(9, 11, "DOES NOT CLAIM", { left: 660, top: 312, width: 500, height: 30 }, { fontSize: 16, bold: true, color: C.coral });
text(9, 12, "National ranking", { left: 660, top: 370, width: 500, height: 38 }, { fontSize: 22, bold: true, color: C.white });
text(9, 13, "Production geography", { left: 660, top: 422, width: 500, height: 38 }, { fontSize: 22, bold: true, color: C.white });
text(9, 14, "Real-estate recommendation", { left: 660, top: 474, width: 500, height: 38 }, { fontSize: 22, bold: true, color: C.white });

// Slide 11
clearSlide(10);
label(10, 0, "What must be decided next");
text(10, 1, "Real rankings require four clear rules", { left: 64, top: 76, width: 1050, height: 72 }, { fontSize: 44, bold: true });
footer(10, 2, 3, 4, "Approve the rules before connecting production data");
const steps11 = [
  { x: 72, y: 390, c: C.paleBlue, n: "01", t: "MARKET MODEL" },
  { x: 330, y: 332, c: C.mint, n: "02", t: "SUBMARKET RULES" },
  { x: 588, y: 274, c: C.amber, n: "03", t: "PROPERTY GATE" },
  { x: 846, y: 216, c: C.coral, n: "04", t: "QUEUE LOGIC" },
];
let e11 = 5;
for (const step of steps11) {
  box(10, e11++, { left: step.x, top: step.y, width: 232, height: 178 }, step.c, { radius: 22 });
  text(10, e11++, step.n, { left: step.x + 22, top: step.y + 20, width: 54, height: 32 }, { fontSize: 17, bold: true });
  text(10, e11++, step.t, { left: step.x + 22, top: step.y + 82, width: 188, height: 62 }, { fontSize: 22, bold: true });
}
box(10, e11++, { left: 330, top: 590, width: 746, height: 54 }, C.navy, { radius: 18 });
text(10, e11++, "CLEAR RULES  →  CLEAR DIRECTION", { left: 354, top: 590, width: 698, height: 54 }, { fontSize: 19, bold: true, color: C.white, alignment: "center" });

// Slide 12
clearSlide(11, C.white);
label(11, 0, "Responsible AI role");
text(11, 1, "AI guides. Code calculates. People decide.", { left: 64, top: 76, width: 1120, height: 72 }, { fontSize: 42, bold: true });
footer(11, 2, 3, 4, "Transparent decision support, with explicit human gates");
const roles12 = [
  { x: 64, w: 360, c: C.paleBlue, head: "AI", verb: "GUIDES", body: "Gather\nPropose\nCompare\nExplain" },
  { x: 460, w: 360, c: C.amber, head: "APP", verb: "CALCULATES", body: "Math\nMaps\nRules\nValidation" },
  { x: 856, w: 360, c: C.mint, head: "ANALYST", verb: "DECIDES", body: "Confirm\nChallenge\nApprove\nAct" },
];
let e12 = 5;
for (const role of roles12) {
  box(11, e12++, { left: role.x, top: 204, width: role.w, height: 390 }, role.c, { radius: 26 });
  text(11, e12++, role.head, { left: role.x + 28, top: 232, width: role.w - 56, height: 34 }, { fontSize: 16, bold: true, color: C.ink });
  text(11, e12++, role.verb, { left: role.x + 28, top: 292, width: role.w - 56, height: 54 }, { fontSize: 30, bold: true });
  text(11, e12++, role.body, { left: role.x + 28, top: 380, width: role.w - 56, height: 160 }, { fontSize: 22, color: C.ink, lineSpacing: 1.15 });
}

// Slide 13
clearSlide(12);
label(12, 0, "Before and after");
text(12, 1, "Turn handoffs into one decision trace", { left: 64, top: 76, width: 1050, height: 72 }, { fontSize: 44, bold: true });
footer(12, 2, 3, 4, "See what happened, why it happened, and what remains");
text(12, 5, "TODAY", { left: 64, top: 190, width: 420, height: 30 }, { fontSize: 16, bold: true, color: C.coral });
box(12, 6, { left: 64, top: 250, width: 390, height: 72 }, C.fog, { radius: 16 });
text(12, 7, "Market analysis", { left: 88, top: 250, width: 342, height: 72 }, { fontSize: 22, bold: true });
box(12, 8, { left: 124, top: 356, width: 390, height: 72 }, C.fog, { radius: 16 });
text(12, 9, "Property research", { left: 148, top: 356, width: 342, height: 72 }, { fontSize: 22, bold: true });
box(12, 10, { left: 64, top: 462, width: 390, height: 72 }, C.fog, { radius: 16 });
text(12, 11, "Review conversations", { left: 88, top: 462, width: 342, height: 72 }, { fontSize: 22, bold: true });
text(12, 12, "HANDOFFS", { left: 490, top: 344, width: 150, height: 40 }, { fontSize: 15, bold: true, color: C.coral, alignment: "center" });
box(12, 13, { left: 532, top: 388, width: 70, height: 8 }, C.coral);
text(12, 14, "WITH THE PLATFORM", { left: 682, top: 190, width: 460, height: 30 }, { fontSize: 16, bold: true, color: C.blue });
box(12, 15, { left: 682, top: 238, width: 534, height: 310 }, C.navy, { radius: 24 });
const after13 = ["MARKET", "EVIDENCE", "DECISION", "NEXT ACTION"];
for (let i = 0; i < after13.length; i += 1) {
  box(12, 16 + i * 2, { left: 718, top: 270 + i * 62, width: 12, height: 12 }, i === 3 ? C.mint : C.blue2, { radius: 6 });
  text(12, 17 + i * 2, after13[i], { left: 756, top: 256 + i * 62, width: 380, height: 40 }, { fontSize: 22, bold: true, color: C.white });
}

// Slide 14
clearSlide(13, C.white);
label(13, 0, "What we learned");
text(13, 1, "Regional insight can travel across the business", { left: 64, top: 76, width: 1120, height: 72 }, { fontSize: 42, bold: true });
footer(13, 2, 3, 4, "Shared evidence | Sector-specific goals, rules, and measures");
// Connectors first so they remain behind the nodes.
const spokes14 = [
  { left: 626, top: 188, width: 6, height: 150 },
  { left: 434, top: 274, width: 180, height: 6 },
  { left: 648, top: 274, width: 180, height: 6 },
  { left: 434, top: 470, width: 180, height: 6 },
  { left: 648, top: 470, width: 180, height: 6 },
  { left: 626, top: 430, width: 6, height: 150 },
];
for (let i = 0; i < spokes14.length; i += 1) box(13, 5 + i, spokes14[i], C.fog);
box(13, 11, { left: 490, top: 314, width: 280, height: 160 }, C.blue, { radius: 28 });
text(13, 12, "REGIONAL\nSIGNALS", { left: 514, top: 330, width: 232, height: 128 }, { fontSize: 32, bold: true, color: C.white, alignment: "center", lineSpacing: 0.9 });
const nodes14 = [
  { x: 500, y: 176, w: 260, t: "MARKETING", c: C.paleBlue },
  { x: 94, y: 238, w: 300, t: "MERCHANDISING", c: C.amber },
  { x: 866, y: 238, w: 300, t: "SERVICES", c: C.mint },
  { x: 94, y: 432, w: 300, t: "PARTNERSHIPS", c: C.mint },
  { x: 866, y: 432, w: 300, t: "OPERATIONS", c: C.coral },
  { x: 500, y: 556, w: 260, t: "CLINICS", c: C.paleBlue },
];
let e14 = 13;
for (const node of nodes14) {
  box(13, e14++, { left: node.x, top: node.y, width: node.w, height: 72 }, node.c, { radius: 18 });
  text(13, e14++, node.t, { left: node.x + 14, top: node.y, width: node.w - 28, height: 72 }, { fontSize: 19, bold: true, alignment: "center" });
}

// Slide 15
clearSlide(14, C.navy);
label(14, 0, "Live demo", C.blue, true);
text(14, 1, "Seattle: one guided path from market to next action", { left: 64, top: 76, width: 1120, height: 72 }, { fontSize: 40, bold: true, color: C.white });
footer(14, 2, 3, 4, "Synthetic demo | Illustrative submarkets | Not a recommendation", true);
const demo15 = [
  { n: "01", t: "START", s: "Open Seattle", c: C.blue },
  { n: "02", t: "PROPOSE", s: "Review submarkets", c: C.blue2 },
  { n: "03", t: "CONFIRM", s: "Approve geography", c: C.mint },
  { n: "04", t: "COMPARE", s: "See drivers + gaps", c: C.amber },
  { n: "05", t: "ADVANCE", s: "Open a candidate", c: C.coral },
];
let e15 = 5;
for (let i = 0; i < demo15.length; i += 1) {
  const d = demo15[i];
  const x = 64 + i * 230;
  box(14, e15++, { left: x, top: 218, width: 206, height: 326 }, i === 0 ? C.blue : "#182747", { radius: 22, line: { style: "solid", fill: i === 0 ? C.blue : "#405174", width: 1 } });
  text(14, e15++, d.n, { left: x + 20, top: 238, width: 60, height: 32 }, { fontSize: 16, bold: true, color: d.c });
  text(14, e15++, d.t, { left: x + 20, top: 318, width: 166, height: 54 }, { fontSize: 24, bold: true, color: C.white });
  text(14, e15++, d.s, { left: x + 20, top: 418, width: 166, height: 74 }, { fontSize: 18, color: C.paleBlue });
}

// Slide 16
clearSlide(15, C.navy);
text(15, 0, "THE ASK", { left: 64, top: 48, width: 300, height: 30 }, { fontSize: 16, bold: true, color: C.mint });
text(15, 1, "Pilot the regional\ninsights capability.", { left: 64, top: 158, width: 900, height: 180 }, { fontSize: 58, bold: true, color: C.white, lineSpacing: 0.9 });
text(15, 2, "Choose a few sectors. Reuse the regional evidence.\nKeep each team’s decision rules local.", { left: 68, top: 400, width: 800, height: 90 }, { fontSize: 24, color: C.paleBlue, lineSpacing: 1.05 });
box(15, 3, { left: 1038, top: 0, width: 242, height: 720 }, C.blue);
text(15, 4, "CVC", { left: 1038, top: 290, width: 242, height: 110 }, { fontSize: 42, bold: true, color: C.white, alignment: "center" });

for (let index = 0; index < 16; index += 1) {
  const slide = presentation.slides.getItem(index);
  slide.speakerNotes.textFrame.setText(notes[index]);
  slide.speakerNotes.setVisible(true);
}

const output = await PresentationFile.exportPptx(presentation);
await output.save(OUTPUT);
console.log(OUTPUT);
