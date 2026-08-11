import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

import { buildSlide01 } from "./slide-01.mjs";
import { buildSlide02 } from "./slide-02.mjs";
import { buildSlide06 } from "./slide-06.mjs";
import { buildSlide10 } from "./slide-10.mjs";
import { buildSlide11 } from "./slide-11.mjs";
import { buildSlide13 } from "./slide-13.mjs";
import { buildSlide15 } from "./slide-15.mjs";
import { buildSlide17 } from "./slide-17.mjs";
import { buildSlide18 } from "./slide-18.mjs";

const TMP_DIR = "/Users/nnair/Documents/Market Opportunity Platform/.tmp_leadership_deck";
const FINAL_PPTX = "/Users/nnair/Documents/Market Opportunity Platform/presentations/Market_Opportunity_Platform_Leadership_Deck.pptx";
const SCRIPT_SOURCE = "/Users/nnair/Documents/Market Opportunity Platform/presentations/Market_Opportunity_Platform_Leadership_Script.md";
const PLAN_SOURCE = "/Users/nnair/Documents/Market Opportunity Platform/docs/strategy/opportunity-inbox-implementation-plan.md";

function tx(run, fontSize = 24, options = {}) {
  return {
    runs: [{
      run,
      textStyle: {
        fontSize: `${fontSize}px`,
        bold: options.bold ?? false,
        color: options.color ?? "#000000",
        typeface: "Helvetica Neue",
      },
    }],
    paragraphStyle: { lineSpacingPercent: options.lineSpacingPercent ?? 95000 },
  };
}

function rich(runs, options = {}) {
  return {
    runs: runs.map((item) => ({
      run: item.run,
      textStyle: {
        fontSize: `${item.fontSize ?? 24}px`,
        bold: item.bold ?? false,
        color: item.color ?? "#000000",
        typeface: "Helvetica Neue",
      },
    })),
    paragraphStyle: { lineSpacingPercent: options.lineSpacingPercent ?? 95000 },
  };
}

function notes(slide, talkTrack, sources = [SCRIPT_SOURCE, PLAN_SOURCE]) {
  slide.speakerNotes.textFrame.setText(`${talkTrack}\n\n[Sources]\n${sources.map((source) => `- ${source}`).join("\n")}\n[/Sources]`);
  slide.speakerNotes.setVisible(true);
}

function footer(n) {
  return tx(String(n).padStart(2, "0"), 13);
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(`${TMP_DIR}/renders`, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  let slide = buildSlide02(presentation, {
    title: tx("MARKET OPPORTUNITY PLATFORM", 24, { bold: true, color: "#3D8DFF" }),
    title2: tx("LEADERSHIP DISCUSSION", 24),
    title3: rich([
      { run: "Turn regional signals\n", fontSize: 72, bold: true },
      { run: "into accountable action", fontSize: 72, bold: true, color: "#3D8DFF" },
    ], { lineSpacingPercent: 88000 }),
  });
  notes(slide, "We started with a clinic location question and discovered a broader product. The goal is to help Chewy move from noticing a regional change to deciding what to do about it while there is still time to respond.");

  slide = buildSlide11(presentation, {
    footer1: footer(2),
    title: tx("The end product is the response, not the data layer", 39, { bold: true }),
    body1: {
      topic: tx("Evidence is infrastructure", 20, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Bringing signals, baselines, constraints, and provenance together is necessary.", 22),
      loremIpsumDolorSitAmetConsecteturAdipiscing2: tx("It is how the platform qualifies an opportunity, not the business outcome by itself.", 22),
    },
    body2: rich([
      { run: "PROCESS\n", fontSize: 18, bold: true, color: "#6B7280" },
      { run: "Qualify the signal", fontSize: 28, bold: true },
    ]),
    body3: rich([
      { run: "IMPACT\n", fontSize: 18, bold: true, color: "#3D8DFF" },
      { run: "Prepare the action", fontSize: 28, bold: true },
    ]),
    body4: {
      detailGoesHere: tx("Visible evidence and contradictions", 18),
      detailGoesHere2: tx("Approved rules and guardrails", 18),
      detailGoesHere3: tx("A defensible advance, block, or stop decision", 18),
    },
    body5: {
      detailGoesHere: tx("Named owner and deadline", 18),
      detailGoesHere2: tx("Bounded next steps", 18),
      detailGoesHere3: tx("Measurable outcome and learning", 18),
    },
  });
  notes(slide, "The value is not that the platform puts data in one place. Evidence assembly supports the product. The end product is an owned, time-bound course of action with an outcome, guardrails, and stop conditions.");

  slide = buildSlide17(presentation, {
    footer1: footer(3),
    title: tx("A shared inbox creates a repeatable path from change to action", 39, { bold: true }),
    label1: tx("DETECT", 18, { bold: true, color: "#3D8DFF" }),
    label2: tx("QUALIFY", 18, { bold: true, color: "#3D8DFF" }),
    label3: tx("ACT + LEARN", 18, { bold: true, color: "#3D8DFF" }),
    body1: {
      titleHere: tx("What changed?", 25, { bold: true }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Regional demand, capacity, coverage, or ecosystem signals enter a defined playbook.", 20),
    },
    body2: {
      titleHere: tx("Does it matter?", 25, { bold: true }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Rules test the baseline, supporting evidence, contradictions, readiness, and expiration.", 20),
    },
    body3: {
      titleHere: tx("What happens next?", 25, { bold: true }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("The platform prepares an owned action, measures the result, and improves the playbook.", 20),
    },
  });
  notes(slide, "The clinic use case exposed a pattern that extends beyond clinics. The shared capability is a regional opportunity workflow: detect, qualify, prepare the response, measure the result, and improve.");

  slide = buildSlide06(presentation, {
    footer1: footer(4),
    title: tx("One Seattle inbox, three sector-specific opportunities", 39, { bold: true }),
    body1: {
      titleHere: rich([{ run: "01\n", fontSize: 20, bold: true, color: "#3D8DFF" }, { run: "Growth + marketing\n", fontSize: 26, bold: true }]),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Rising category interest plus low reach prepares a controlled acquisition-test brief.", 20),
    },
    body2: {
      titleHere: rich([{ run: "02\n", fontSize: 20, bold: true, color: "#3D8DFF" }, { run: "Pet Health + CVC\n", fontSize: 26, bold: true }]),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Rising appointment interest plus available capacity prepares awareness or service-access options.", 20),
    },
    body3: {
      titleHere: rich([{ run: "03\n", fontSize: 20, bold: true, color: "#3D8DFF" }, { run: "Market ecosystem\n", fontSize: 26, bold: true }]),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("A verified local change plus operating readiness prepares a time-bound ActionPacket.", 20),
    },
  });
  notes(slide, "The proof of concept uses fictional synthetic Seattle evidence and three separate business playbooks. They share one regional inbox, but not one score, one outcome, or one decision rule.");

  slide = buildSlide11(presentation, {
    footer1: footer(5),
    title: tx("Marketing receives a testable acquisition brief, not a spend recommendation", 39, { bold: true }),
    body1: {
      topic: tx("SYNTHETIC GROWTH + MARKETING OPPORTUNITY", 19, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Category interest is increasing while customer penetration and eligible marketing reach remain below configured comparison baselines.", 22),
      loremIpsumDolorSitAmetConsecteturAdipiscing2: tx("Delivery, inventory, audience quality, and campaign saturation determine whether a test can advance.", 22),
    },
    body2: tx("Prepared action", 27, { bold: true }),
    body3: tx("Responsible success", 27, { bold: true }),
    body4: {
      detailGoesHere: tx("Controlled regional acquisition test", 18),
      detailGoesHere2: tx("Marketing review and approved holdout", 18),
      detailGoesHere3: tx("Time-bound, serviceable audience", 18),
    },
    body5: {
      detailGoesHere: tx("Incremental customers or orders", 18),
      detailGoesHere2: tx("Acquisition cost guardrail", 18),
      detailGoesHere3: tx("Stop if readiness or economics fail", 18),
    },
  });
  notes(slide, "The output is not spend more in Seattle. It is a controlled regional acquisition-test brief for Marketing review, with a measurable outcome and clear reasons not to proceed.");

  slide = buildSlide11(presentation, {
    footer1: footer(6),
    title: tx("Pet Health turns demand into a safe, capacity-aware next step", 39, { bold: true }),
    body1: {
      topic: tx("SYNTHETIC PET HEALTH + CVC OPPORTUNITY", 19, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Appointment interest is rising near a clinic while staffed capacity remains available and local awareness is below baseline.", 22),
      loremIpsumDolorSitAmetConsecteturAdipiscing2: tx("Wait time, service limitations, staffing, and approved clinic geography protect the customer and clinic experience.", 22),
    },
    body2: tx("Prepared options", 27, { bold: true }),
    body3: tx("Responsible success", 27, { bold: true }),
    body4: {
      detailGoesHere: tx("Localized awareness or referral test", 18),
      detailGoesHere2: tx("Capacity and service-access review", 18),
      detailGoesHere3: tx("CVC retains the decision", 18),
    },
    body5: {
      detailGoesHere: tx("Qualified bookings or completed visits", 18),
      detailGoesHere2: tx("Wait time and cancellation guardrails", 18),
      detailGoesHere3: tx("Block when demand cannot be served safely", 18),
    },
  });
  notes(slide, "The output is not open another clinic. It is a bounded awareness, referral, capacity, or service-access option for CVC review. The action stops when demand cannot be served safely.");

  slide = buildSlide18(presentation, {
    footer1: footer(7),
    title: tx("A verified local change becomes a time-bound ActionPacket", 39, { bold: true }),
    body1: {
      titleHere: tx("Verify the event", 25, { bold: true }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Confirm identity, location, permanence, effective date, source record, demand, and replacement competition.", 19),
    },
    body2: {
      titleHere: tx("Check readiness", 25, { bold: true }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Evaluate delivery, inventory, campaign saturation, clinic presence, blockers, and stop conditions.", 19),
    },
    body3: {
      titleHere: tx("Prepare the response", 25, { bold: true }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Create a synthetic 14-day acquisition and clinic-awareness plan with a fictional owner and 48-hour deadline.", 19),
    },
    label1: tx("SIGNAL", 18, { bold: true, color: "#3D8DFF" }),
    label2: tx("POLICY", 18, { bold: true, color: "#3D8DFF" }),
    label3: tx("ACTION", 18, { bold: true, color: "#3D8DFF" }),
  });
  notes(slide, "A fictional competitor closure is only an event. The prototype checks the full situation before preparing a response. When conditions pass, the deterministic packet contains ordered actions, an owner, deadline, outcome, guardrails, and advance or stop conditions.");

  slide = buildSlide10(presentation, {
    footer1: footer(8),
    title: tx("Every opportunity must be ready for an accountable decision", 39, { bold: true }),
    body1: tx("An inbox card is not an interesting fact. It is a business hypothesis tied to a permitted next action and a measurable outcome.", 26),
    body2: {
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("What changed?\nWhy might it matter?\nWhat supports or challenges it?\nWhat action is permitted?", 23),
      loremIpsumDolorSitAmetConsecteturAdipiscing2: tx("Who owns the next step?\nWhen does it expire?\nWhat defines success or stop?", 23),
    },
    label1: tx("CLEAR SIGNAL", 21, { bold: true }),
    label2: tx("NAMED OWNER", 21, { bold: true }),
    label3: tx("BOUNDED ACTION", 21, { bold: true }),
    label4: tx("MEASURE + STOP", 21, { bold: true, color: "#3D8DFF" }),
    label5: tx("AUDITABLE RESULT", 21, { bold: true }),
  });
  notes(slide, "Every card should answer seven practical questions: what changed, why it matters, what supports or challenges it, what action is permitted, who owns it, when it expires, and what defines success or stop.");

  slide = buildSlide15(presentation, {
    footer1: footer(9),
    title: tx("The intended impact is faster action with fewer false starts", 39, { bold: true }),
    body1: {
      titleHere: tx("Impact", 24, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("The platform should improve how Chewy responds to qualified regional opportunities and how the business learns from each result.", 22),
      quamUtMassaLuctusCursusNullamPharetra: tx("Business impact must be proven through a real pilot.", 22, { bold: true }),
    },
    label1: tx("01", 20, { bold: true, color: "#3D8DFF" }),
    body2: tx("Shorter time to disposition", 24, { bold: true }),
    label2: tx("02", 20, { bold: true, color: "#3D8DFF" }),
    body3: tx("More opportunities acted on before expiration", 24, { bold: true }),
    label3: tx("03", 20, { bold: true, color: "#3D8DFF" }),
    body4: tx("Fewer false starts and unsafe responses", 24, { bold: true }),
    label4: tx("04", 20, { bold: true, color: "#3D8DFF" }),
    body5: tx("Measured outcomes that improve future playbooks", 24, { bold: true }),
  });
  notes(slide, "The intended impact is shorter time to an accountable next step, more qualified opportunities reaching a decision before expiration, fewer false starts, explicit ownership, and a learning record that improves future playbooks. These outcomes are targets, not proven results.");

  slide = buildSlide13(presentation, {
    footer1: footer(10),
    title: tx("The prototype proves the controlled workflow, not production impact", 39, { bold: true }),
    body1: {
      titleGoesHere: tx("PROVES\nDeterministic qualification", 24, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Validation, geography, rules, contradictions, deduplication, and workflow state are application-owned.", 18),
    },
    body2: {
      titleGoesHere: tx("PROVES\nSector-specific action paths", 24, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Marketing and Pet Health retain review; ecosystem prepares a deterministic packet.", 18),
    },
    body3: {
      titleGoesHere: tx("PROVES\nBounded AI and communication", 24, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("AI can rewrite validated output. Outlook and Slack previews are simulated and nothing is sent.", 18),
    },
    body4: {
      titleGoesHere: tx("DOES NOT PROVE\nReal business lift", 24, { bold: true }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Production data, execution authority, real outcomes, and multi-market operations remain unresolved.", 18),
    },
  });
  notes(slide, "The current proof of concept uses fictional synthetic evidence. It proves the governed workflow and the ActionPacket pattern. It does not prove business lift, production readiness, or authority to execute real actions.");

  slide = buildSlide11(presentation, {
    footer1: footer(11),
    title: tx("Pilot one real regional decision where the business is ready to act", 39, { bold: true }),
    body1: {
      topic: tx("LEADERSHIP ASK", 19, { bold: true, color: "#3D8DFF" }),
      loremIpsumDolorSitAmetConsecteturAdipiscing: tx("Align on the product outcome: faster, more disciplined action on regional opportunities, not simply consolidated data.", 22),
      loremIpsumDolorSitAmetConsecteturAdipiscing2: tx("Select one bounded pilot with a real owner, decision window, permitted action, and measurable result.", 22),
    },
    body2: tx("The pilot needs", 27, { bold: true }),
    body3: tx("The pilot should prove", 27, { bold: true }),
    body4: {
      detailGoesHere: tx("One accountable owner", 18),
      detailGoesHere2: tx("Approved playbook and aggregate evidence", 18),
      detailGoesHere3: tx("Baseline, comparison, guardrails, and stop rules", 18),
    },
    body5: {
      detailGoesHere: tx("Faster time from signal to decision", 18),
      detailGoesHere2: tx("A better, measurable action", 18),
      detailGoesHere3: tx("Learning that improves the next response", 18),
    },
  });
  notes(slide, "The next step should be one bounded regional pilot, not a broad production rollout. Choose a use case where an accountable team is prepared to act, measure the result, and stop if the evidence or guardrails fail.");

  slide = buildSlide01(presentation, {
    title: tx("MARKET OPPORTUNITY PLATFORM", 24, { bold: true, color: "#3D8DFF" }),
    title2: rich([
      { run: "Detect. Qualify.\n", fontSize: 72, bold: true },
      { run: "Act. Measure. Improve.", fontSize: 72, bold: true, color: "#3D8DFF" },
    ], { lineSpacingPercent: 88000 }),
    title3: tx("Turn regional market changes into timely, accountable, and measurable action.", 25),
  });
  notes(slide, "Chewy does not only need another way to see what is happening in a market. Teams need a reliable way to decide what the change means, what to do next, who owns it, and how to know whether it worked.");

  for (const [index, currentSlide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(`${TMP_DIR}/renders/${stem}.png`, await presentation.export({ slide: currentSlide, format: "png", scale: 1 }));
    await fs.writeFile(`${TMP_DIR}/renders/${stem}.layout.json`, await (await currentSlide.export({ format: "layout" })).text());
  }

  await writeBlob(`${TMP_DIR}/renders/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL_PPTX);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
