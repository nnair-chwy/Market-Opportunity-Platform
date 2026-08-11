import fs from "node:fs/promises";

const root = "/Users/nnair/Documents/Retail and Clinic Location Evaluator/.codex-ppt-remake";
const bySlide = new Map();
for (let slide = 1; slide <= 16; slide += 1) {
  const number = String(slide).padStart(2, "0");
  const layout = JSON.parse(
    await fs.readFile(`${root}/template-inspect/layouts/source-slide-${number}.layout.json`, "utf8"),
  );
  bySlide.set(
    slide,
    layout.elements.map((element) => element.aid).filter((id) => id?.startsWith("sh/")),
  );
}

const roles = [
  "opening thesis",
  "problem and pivot",
  "product definition",
  "four-stage funnel",
  "broad-to-local process",
  "guided submarket analysis",
  "analyst experience",
  "decision separation",
  "sequence example",
  "prototype boundary",
  "production prerequisites",
  "responsible AI roles",
  "workflow before and after",
  "regional capability expansion",
  "live demo guide",
  "closing ask",
];

const outputSlides = Array.from({ length: 16 }, (_, index) => {
  const slide = index + 1;
  return {
    outputSlide: slide,
    sourceSlide: slide,
    narrativeRole: roles[index],
    reuseMode: "duplicate-slide",
    editTargets: [
      {
        action: "rewrite-and-reposition",
        shapeIds: bySlide.get(slide) ?? [],
        reason: "The user explicitly requested a complete visual restyle with less on-slide text.",
      },
    ],
  };
});

const map = { outputSlides, omittedSourceSlides: [] };
await fs.writeFile(`${root}/template-frame-map.json`, `${JSON.stringify(map, null, 2)}\n`);
