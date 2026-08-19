import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

async function loadComponent(t, path, name) {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
    server: { hmr: false, middlewareMode: true },
  });
  t.after(() => vite.close());
  return (await vite.ssrLoadModule(path))[name];
}

const sectionIds = ["direct_answer", "evidence_findings", "contrary_evidence", "uncertainty", "missing_evidence", "source_and_version_notes", "permitted_next_action"];

test("answer panel defaults to answer, finding, readiness, and next validation while retaining audit detail", async (t) => {
  const AnswerCoveragePanel = await loadComponent(t, "/components/decision-workflow/AnswerCoveragePanel.tsx", "AnswerCoveragePanel");
  const coverage = {
    version: "investigation-coverage-v1",
    planId: "plan-copy",
    contractId: "contract-copy",
    investigationVersion: "1.0.0",
    overallStatus: "partial",
    coveredRequiredCount: 5,
    requiredCount: 7,
    sectionCoverage: sectionIds.map((itemId) => ({ itemId, label: itemId, required: true, status: itemId === "missing_evidence" ? "unsupported" : "covered", explanation: `Coverage explanation for ${itemId}.`, sourceIds: ["SRC-DECISION"], investigationLeadIds: ["lead-1"] })),
    domainCoverage: [{ itemId: "regional_outcomes", label: "Regional business outcomes", required: true, status: "unsupported", explanation: "Regional contribution is not connected.", sourceIds: [], investigationLeadIds: [] }],
    unmetRequiredItemIds: ["missing_evidence", "regional_outcomes"],
    permittedConclusion: "The available signal supports a bounded validation recommendation.",
    fallbackOutcome: "draft_for_review",
  };
  const answer = {
    version: "final-answer-composer-v1",
    planId: "plan-copy",
    contractId: "contract-copy",
    coverageVersion: "investigation-coverage-v1",
    status: "draft_for_review",
    title: "Best available draft answer",
    decisionBoundary: "Prepare evidence for review only.",
    strongestSupportedConclusion: coverage.permittedConclusion,
    sections: sectionIds.map((sectionId) => ({
      sectionId,
      label: sectionId === "direct_answer" ? "Direct answer" : sectionId.replaceAll("_", " "),
      supportStatus: sectionId === "missing_evidence" ? "unsupported" : "supported",
      content: sectionId === "direct_answer"
        ? "Philadelphia is the strongest paid-search validation lead in the current evidence."
        : sectionId === "evidence_findings"
          ? "Higher click and conversion cost make Philadelphia worth investigating, not an automatic spend increase."
          : sectionId === "permitted_next_action"
            ? "Validate regional orders, new customers, contribution, and incrementality before a bounded test."
            : sectionId === "missing_evidence"
              ? "Exact gap: regional contribution by compatible geography and period is missing."
              : sectionId === "source_and_version_notes"
                ? "Sources: SRC-DECISION. Snapshot: snapshot-technical-v7. Contract: answer-contract-v1."
                : `Technical ${sectionId} detail.`,
      sourceIds: ["SRC-DECISION"],
    })),
    unsupportedRequirementIds: ["regional_outcomes"],
    reviewRequiredBy: "Marketing Science",
    disclaimer: "Draft for review.",
  };
  const evaluation = {
    version: "answer-evaluation-v1",
    planId: "plan-copy",
    contractId: "contract-copy",
    overallStatus: "partial",
    passedCount: 5,
    criterionCount: 7,
    criteria: [{ criterionId: "answers_confirmed_question", label: "Answers the confirmed question", status: "pass", explanation: "Bound to the question.", evidenceIds: ["SRC-DECISION"] }],
    unmetCriterionIds: ["covers_domain_requirements"],
    nextPass: { status: "research_needed", question: "Which outcomes resolve the recommendation?", evidenceNeeded: ["Regional contribution"], completionRule: "Validate before testing." },
  };
  const html = renderToStaticMarkup(createElement(AnswerCoveragePanel, { coverage, answer, evaluation }));

  assert.match(html, /Useful answer; validate remaining gaps/);
  assert.match(html, /Findings and why they matter/);
  assert.match(html, /What to validate next/);
  assert.doesNotMatch(html, /Answer contract check/);
  const methodIndex = html.indexOf("Evidence and method: sources, limitations, and versions");
  assert.ok(methodIndex > html.indexOf("What to validate next"));
  assert.ok(html.indexOf("snapshot-technical-v7") > methodIndex);
  assert.ok(html.indexOf("Exact gap: regional contribution") > methodIndex);
  assert.ok(html.indexOf("SRC-DECISION", methodIndex) > methodIndex);
});

test("action handoff uses product readiness language and keeps baseline evidence accessible", async (t) => {
  const InsightActionPlanPanel = await loadComponent(t, "/components/decision-workflow/InsightActionPlanPanel.tsx", "InsightActionPlanPanel");
  const workstream = { id: "baseline", sequence: 1, title: "Confirm the baseline", owner: "Marketing Science", dueDate: "2026-08-24", action: "Reconcile the market baseline.", deliverable: "A comparable baseline.", completionCriteria: "All claims are source-linked.", kpi: "Comparable regional outcomes.", validationThreshold: "All required gates pass.", stopCondition: "Stop if evidence is incompatible.", status: "blocked_on_evidence" };
  const actionPlan = {
    version: "1.0.0", planId: "plan", leadId: "lead", marketName: "Philadelphia", decisionOwner: "Marketing Science", decisionDueDate: "2026-08-28",
    recommendation: "Prepare a bounded paid-search spend test; do not change live spend yet.", whyNow: "The current finding is worth validating.", whatThisInforms: ["Whether to test"], workstreams: [workstream],
    decisionRules: [{ disposition: "advance", rule: "Advance when gates pass." }, { disposition: "hold", rule: "Hold when incomplete." }, { disposition: "stop", rule: "Stop when guardrails fail." }],
    stakeholders: ["Paid Search"], longerTermConsiderations: ["Connect outcomes."], sourcePattern: "goal checked", lever: "paid_search_spend_test", actionReadiness: "outcome_missing", confidence: "Low", goalEvaluationStatus: "partial",
    baseline: { status: "partial", description: "High click cost with incomplete outcomes.", evidenceIds: ["SRC-ADS", "lead"] }, kpi: "Incremental contribution.", validationThreshold: "Pass the approved test threshold.", stopCondition: "Do not change spend without outcomes.", sensitivityAndContraryEvidence: "Campaign mix may explain the finding.",
  };
  const html = renderToStaticMarkup(createElement(InsightActionPlanPanel, { actionPlan }));
  assert.match(html, /Business outcome still needed · Low confidence/);
  assert.match(html, /Expected result/);
  assert.match(html, /Not yet a forecast/);
  assert.match(html, /How this result is calculated/);
  assert.match(html, /Sales growth %/);
  assert.match(html, /CCP gain %/);
  assert.match(html, /KPI/);
  assert.match(html, /Validation threshold/);
  assert.match(html, /Stop condition/);
  assert.doesNotMatch(html, /outcome_missing/);
  assert.ok(html.indexOf("SRC-ADS") > html.indexOf("What this informs and who needs to be involved"));
});
