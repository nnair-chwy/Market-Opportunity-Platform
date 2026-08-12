import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const component=fs.readFileSync(new URL("../components/evaluation-workspace/EvaluationWorkspace.tsx",import.meta.url),"utf8");
const overview=fs.readFileSync(new URL("../components/evaluation-workspace/WorkspaceOverview.tsx",import.meta.url),"utf8");
const styles=fs.readFileSync(new URL("../components/evaluation-workspace/evaluation-workspace.module.css",import.meta.url),"utf8");
const evidenceDrop=fs.readFileSync(new URL("../components/evaluation-workspace/EvidenceDropField.tsx",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");

test("entry is one map-first workspace without fixed demo navigation",()=>{
  assert.match(page,/EvaluationWorkspace/);
  assert.match(component,/WorkspaceOverview/);
  assert.match(component,/Evaluation question/);
  assert.doesNotMatch(component,/Evaluation definitions|Seattle|Clinic performance review|Market Intelligence/);
  assert.match(styles,/min-height:100svh/);
});

test("question submission switches to a map and progress split",()=>{
  assert.match(component,/started \? styles\.running : styles\.landing/);
  assert.match(component,/Evaluation progress/);
  for(const cue of ["Understand the question","Match compatible evidence","Prepare the map view","Check decision boundaries","Invite analyst follow-up"])assert.match(component,new RegExp(cue));
  assert.match(styles,/grid-template-columns:minmax\(0,1fr\) minmax\(390px,470px\)/);
  assert.match(component,/Ask AI a follow-up/);
  assert.match(component,/Close evaluation progress/);
  assert.match(component,/Show evaluation progress/);
});

test("map supplies swipe and translucent layer comparison",()=>{
  assert.match(overview,/type CompareMode = "single" \| "swipe" \| "blend"/);
  assert.match(overview,/type="range"/);
  assert.match(overview,/clipPath: `inset/);
  assert.match(overview,/setSplit\(Number\(event\.target\.value\)\)/);
  assert.match(overview,/opacity=\{0\.5\}/);
  assert.match(styles,/\.blendLayer\{z-index:7\}/);
  assert.match(overview,/Blue and red overlap at 50% opacity/);
  assert.match(overview,/PALETTES\.red/);
});

test("available map views are governed public context and footprint",()=>{
  for(const cue of ["Clinic footprint","Population","Households","Household income","Housing units","Density","Pet ownership"])assert.match(overview,new RegExp(cue));
  assert.match(overview,/currentClinics/);
  assert.match(overview,/MODERN_ANIMAL_REGIONS/);
  assert.match(overview,/publicMarketGeographicArtifact/);
  assert.doesNotMatch(overview,/syntheticMarketSnapshot|SYN-MARKET-ATTRACTIVENESS/);
  assert.match(overview,/viewsForQuestion/);
  assert.match(overview,/Households \+ income/);
  assert.match(overview,/Suggested views for this evaluation/);
  assert.match(overview,/onClick=\{\(\) => applyView\(view\)\}/);
  assert.match(component,/evaluationQuestion=\{started \? displayQuestion : undefined\}/);
});

test("compact evidence upload remains available",()=>{
  assert.match(component,/EvidenceDropField/);
  assert.match(component,/composerOpen/);
  assert.match(component,/<input[^>]+onFocus=\{\(\) => setComposerOpen\(true\)\}/);
  assert.match(evidenceDrop,/Drop CSV or Excel/);
  assert.match(evidenceDrop,/Local staging only/);
  assert.match(evidenceDrop,/\.csv,\.xlsx,\.xls/);
});

test("each evaluation step can collect staged human evidence",()=>{
  assert.match(component,/const \[evidenceStep, setEvidenceStep\] = useState<number \| null>\(null\)/);
  assert.match(component,/className=\{styles\.stepTrigger\}/);
  assert.match(component,/aria-expanded=\{expanded\}/);
  assert.match(component,/Add human context/);
  assert.match(component,/<EvidenceDropField acceptDocuments/);
  assert.match(evidenceDrop,/PDF|Word|Text/);
  assert.match(styles,/\.progressHeader\{[^}]*padding-top:32px/);
  assert.match(styles,/\.progressSteps em\{[^}]*min-width:50px[^}]*text-align:center/);
});

test("map context and view controls form adjacent compact tiles while the key expands from the map corner",()=>{
  assert.match(overview,/mapToolbar/);
  assert.match(overview,/mapTitle/);
  assert.match(overview,/mapViewBar/);
  assert.match(overview,/layerControls/);
  assert.match(overview,/const \[indexOpen, setIndexOpen\] = useState\(false\)/);
  assert.match(overview,/mapLegend/);
  assert.match(overview,/aria-expanded=\{indexOpen\}/);
  assert.match(overview,/aria-controls="map-index-key"/);
  assert.match(overview,/Show map key/);
  assert.match(styles,/\.mapIndex\{position:absolute;right:18px;bottom:92px/);
  assert.match(styles,/\.mapToolbar\{position:absolute;top:14px;left:18px;right:18px;display:grid;grid-template-columns:minmax\(180px,230px\) minmax\(0,1fr\)/);
  assert.match(styles,/\.questionShelf\{position:static/);
  assert.match(styles,/\.layerControls\{display:flex;flex:0 0 auto;align-items:end;gap:6px;margin-left:auto/);
  assert.match(styles,/\.activeView/);
  assert.doesNotMatch(component,/brandPill|fileDock/);
});

test("comparison views keep primary and secondary layers distinct",()=>{
  assert.match(overview,/const effectiveSecondaryLayer = secondaryLayer === activeLayer/);
  assert.match(overview,/view\.secondary !== view\.primary/);
});

test("liquid glass follows migration palette and accessibility boundaries",()=>{
  assert.match(styles,/font-family:"Avenir Next"/);
  for(const token of ["#18264b","#2e67e8","#2e9b70","#61708a"])assert.match(styles,new RegExp(token));
  assert.match(styles,/backdrop-filter:blur\(22px\)/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(overview,/aria-valuetext/);
});
