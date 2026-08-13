import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const homepage = fs.readFileSync(
  new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url),
  "utf8",
);
const market = fs.readFileSync(
  new URL("../components/decision-workflow/AdaptiveMarketWorkspace.tsx", import.meta.url),
  "utf8",
);
const workflow = fs.readFileSync(
  new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url),
  "utf8",
);
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const catalog = fs.readFileSync(new URL("../lib/perspectives/catalog.ts", import.meta.url), "utf8");
const contracts = fs.readFileSync(
  new URL("../lib/perspectives/contracts.ts", import.meta.url),
  "utf8",
);

test("opening page renders the perspective dropdown with Pricing, Marketing, and CVC", () => {
  assert.match(homepage, /aria-label=\{`Perspective: \$\{activePerspective\.label\}`\}/);
  assert.match(homepage, /listPerspectives\(\)/);
  assert.match(homepage, /role="listbox"/);
  assert.match(homepage, /Perspectives/);
  assert.match(catalog, /label: "Pricing"/);
  assert.match(catalog, /label: "Marketing"/);
  assert.match(catalog, /label: "CVC"/);
});

test("each perspective renders its own view options and keeps per-perspective active state", () => {
  assert.match(homepage, /listViewsForPerspective\(perspectiveId\)/);
  assert.match(homepage, /createDefaultActiveViews/);
  assert.match(homepage, /activeViews\[perspectiveId\]/);
  assert.match(homepage, /setActiveViews\(\(current\) => \(\{ \.\.\.current, \[perspectiveId\]: viewId \}\)\)/);
  assert.match(homepage, /aria-label=\{`\$\{activePerspective\.label\} views`\}/);
  assert.match(catalog, /defaultViewId: "price_index"/);
  assert.match(catalog, /defaultViewId: "customer_demand"/);
  assert.match(catalog, /defaultViewId: "household_demand"/);
});

test("view changes drive map title, measure, legend, and evidence boundary", () => {
  assert.match(homepage, /activeView=\{activeView\}/);
  assert.match(market, /resolveMapPresentation\((?:activeView|view)\)/);
  assert.match(market, /presentation\.mapTitle/);
  assert.match(market, /presentation\.sourceLabel/);
  assert.match(market, /presentation\.evidenceBoundary/);
  assert.match(market, /presentation\.legend\.title/);
  assert.match(market, /data-measure=\{presentation\.measureId\}/);
  assert.match(market, /adaptive-opening-map-chrome/);
});

test("unavailable views fail safely and do not invent synthetic map values", () => {
  assert.match(market, /adaptive-view-unavailable/);
  assert.match(market, /presentation\.emptyState\.title/);
  assert.match(market, /mapBinding\.kind !== "unavailable"/);
  assert.match(catalog, /evidenceAvailability: "evidence_needed"/);
  assert.match(catalog, /mapBinding: \{ kind: "unavailable" \}/);
  assert.doesNotMatch(catalog, /syntheticValues|inventedScore|universalOpportunity/i);
});

test("typed perspective view contracts keep measures namespaced and non-scored for public context", () => {
  assert.match(contracts, /perspectiveId: perspectiveIdSchema/);
  assert.match(contracts, /activeMeasure: perspectiveMeasureIdSchema/);
  assert.match(contracts, /geographyGrain: geographyGrainSchema/);
  assert.match(contracts, /sourceIds:/);
  assert.match(contracts, /evidenceStatus: evidenceStatusSchema/);
  assert.match(contracts, /allowedUse: allowedUseSchema/);
  assert.match(contracts, /scoringEligibility: scoringEligibilitySchema/);
  assert.match(contracts, /legend: legendConfigurationSchema/);
  assert.match(contracts, /emptyState: emptyStateSchema/);
  assert.match(contracts, /supportedQuestionTypes:/);
  assert.match(contracts, /supportsComparison: z\.boolean\(\)/);
  assert.match(contracts, /supportsLayerMode: z\.boolean\(\)/);
  assert.match(contracts, /A view measure must stay inside its perspective namespace/);
  assert.match(contracts, /Public market context cannot become score-eligible/);
});

test("opening page stays responsive without horizontal overflow", () => {
  assert.match(css, /\.adaptive-opening[^{]*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.question-page:has\(\.adaptive-opening\) \.decision-content[^{]*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.adaptive-cvc-views[^{]*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(max-width: 1050px\)/);
});

test("governed planning, packets, AI summary, and persistence remain wired", () => {
  assert.match(workflow, /AdaptiveEvaluationWorkspace/);
  assert.match(workflow, /evaluationPlanResponseSchema\.safeParse/);
  assert.match(workflow, /setPhase\("interpreting"\)/);
  assert.match(workflow, /Save action packet/);
  assert.match(workflow, /Download full report/);
  assert.match(workflow, /Findings and proposed action/);
  assert.doesNotMatch(workflow, /AskAiPanel/);
  assert.match(workflow, /market-intelligence-action-packets/);
  assert.match(workflow, /window\.localStorage\.setItem/);
  assert.match(homepage, /adaptive-question-composer/);
  assert.match(homepage, /onSubmit/);
});
