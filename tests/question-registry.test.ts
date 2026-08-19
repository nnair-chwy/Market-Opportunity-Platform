import assert from "node:assert/strict";
import test from "node:test";

import {
  QUESTION_TEXT,
  REGISTERED_QUESTIONS,
  listStarterQuestions,
  normalizeQuestionText,
  questionTextSimilarity,
  rankQuestionSuggestions,
  tokenizeQuestion,
} from "../lib/questions/index.ts";

test("the consolidated registry owns curated starters and configured demo text", () => {
  assert.equal(REGISTERED_QUESTIONS.length, 15);
  assert.equal(listStarterQuestions("cvc").length, 2);
  assert.equal(listStarterQuestions("marketing").length, 2);
  assert.equal(listStarterQuestions("pricing").length, 2);
  assert.equal(
    REGISTERED_QUESTIONS.find((item) => item.id === "demo-atlanta-market-context")?.question,
    QUESTION_TEXT.demoMarketContext,
  );
  assert.equal(
    REGISTERED_QUESTIONS.find((item) => item.id === "demo-synthetic-clinic-performance")?.question,
    QUESTION_TEXT.demoClinicPerformance,
  );
  assert.equal(
    REGISTERED_QUESTIONS.find((item) => item.id === "demo-regional-growth-test")?.question,
    QUESTION_TEXT.demoGrowthTest,
  );
  assert.equal(new Set(REGISTERED_QUESTIONS.map((item) => item.id)).size, REGISTERED_QUESTIONS.length);
  assert.ok(REGISTERED_QUESTIONS.every((item) => item.requiredEvidence.length > 0));
  assert.ok(REGISTERED_QUESTIONS.every((item) => item.supportSummary.length > 0));
  assert.deepEqual(
    [
      QUESTION_TEXT.goldenMarketingValidation,
      QUESTION_TEXT.goldenPricingInvestigation,
      QUESTION_TEXT.goldenCvcAccessInvestigation,
    ].map((question) => REGISTERED_QUESTIONS.find((item) => item.question === question)?.supportLevel),
    ["partial_answer", "partial_answer", "partial_answer"],
  );
  assert.deepEqual(
    new Set(REGISTERED_QUESTIONS.map((item) => item.supportLevel)),
    new Set(["available_now", "partial_answer", "more_evidence_required"]),
  );
});

test("normalization and token similarity are punctuation and inflection tolerant", () => {
  assert.equal(normalizeQuestionText("  Competitor-Availability?!  "), "competitor availability");
  assert.deepEqual(tokenizeQuestion("Which regions have competitors?"), ["region", "competitor"]);
  assert.ok(
    questionTextSimilarity("competitor availability regions", QUESTION_TEXT.pricingAvailabilityDifferences) > 0.6,
  );
  assert.equal(questionTextSimilarity("veterinary workforce", QUESTION_TEXT.marketingResponseComparison), 0);
});

test("ranking uses text, active perspective, and active view deterministically", () => {
  const result = rankQuestionSuggestions({
    query: "paid search response",
    activePerspectiveId: "marketing",
    activeViewId: "paid_search_response",
    now: new Date("2026-08-18T12:00:00Z"),
  });
  assert.equal(result.recommendedQuestions[0].id, "marketing-response-concentration");
  assert.ok(result.recommendedQuestions.every((item) => item.perspectiveId === "marketing"));
  assert.ok(result.recommendedQuestions.every((item) => item.viewId === "paid_search_response"));
  assert.ok(result.recommendedQuestions[0].scoreBreakdown.perspective > 0);
  assert.ok(result.recommendedQuestions[0].scoreBreakdown.view > 0);
});

test("selected geography promotes a registered geography-specific question", () => {
  const result = rankQuestionSuggestions({
    query: "show evidence",
    activePerspectiveId: "cvc",
    activeViewId: "household_demand",
    selectedGeographicContexts: [{ cbsaCode: "12060", cbsaName: "Atlanta-Sandy Springs-Roswell, GA" }],
    now: new Date("2026-08-18T12:00:00Z"),
  });
  assert.equal(result.recommendedQuestions[0].id, "demo-atlanta-market-context");
  assert.equal(result.recommendedQuestions[0].scoreBreakdown.geography, 12);
  assert.equal(result.recommendedQuestions[0].supportLevel, "partial_answer");
});

test("previous investigations are deduplicated and recency breaks otherwise equal ranking", () => {
  const previous = [
    {
      id: "old-duplicate",
      question: "Where is paid search response concentrated?",
      savedAt: "2026-07-01T00:00:00Z",
      perspectiveId: "marketing" as const,
      viewId: "paid_search_response" as const,
    },
    {
      id: "new-duplicate",
      question: "Where is paid search response concentrated?",
      savedAt: "2026-08-17T00:00:00Z",
      perspectiveId: "marketing" as const,
      viewId: "paid_search_response" as const,
    },
    {
      id: "older-peer",
      question: "Compare paid search response",
      savedAt: "2026-08-01T00:00:00Z",
      perspectiveId: "marketing" as const,
      viewId: "paid_search_response" as const,
    },
  ];
  const result = rankQuestionSuggestions({
    query: "paid search response",
    activePerspectiveId: "marketing",
    activeViewId: "paid_search_response",
    previousInvestigations: previous,
    now: new Date("2026-08-18T00:00:00Z"),
  });
  assert.equal(result.previousInvestigations.length, 2);
  assert.equal(result.previousInvestigations[0].id, "new-duplicate");
  assert.ok(result.previousInvestigations[0].scoreBreakdown.recency > result.previousInvestigations[1].scoreBreakdown.recency);
});

test("short input returns no suggestions and group limits are respected", () => {
  const short = rankQuestionSuggestions({ query: "a" });
  assert.deepEqual(short, {
    previousInvestigations: [],
    recommendedQuestions: [],
    relatedQuestions: [],
  });
  const limited = rankQuestionSuggestions({
    query: "compare market regional evidence",
    activePerspectiveId: "cvc",
    limitPerGroup: 1,
  });
  assert.ok(limited.previousInvestigations.length <= 1);
  assert.ok(limited.recommendedQuestions.length <= 1);
  assert.ok(limited.relatedQuestions.length <= 1);
});

test("a total suggestion limit keeps only the three highest-ranked results across groups", () => {
  const result = rankQuestionSuggestions({
    query: "paid search regional response",
    activePerspectiveId: "marketing",
    activeViewId: "paid_search_response",
    previousInvestigations: [
      {
        id: "saved-paid-search",
        question: "Compare paid search response by regional market",
        savedAt: "2026-08-18T00:00:00Z",
        perspectiveId: "marketing",
        viewId: "paid_search_response",
      },
    ],
    now: new Date("2026-08-18T12:00:00Z"),
    limitPerGroup: 5,
    limitTotal: 3,
  });
  const suggestions = [
    ...result.previousInvestigations,
    ...result.recommendedQuestions,
    ...result.relatedQuestions,
  ];

  assert.equal(suggestions.length, 3);
  assert.ok(suggestions.some((item) => item.id === "saved-paid-search"));
});

test("runtime capability state can override frozen catalog support", () => {
  const result = rankQuestionSuggestions({
    query: "increase paid search spend",
    activePerspectiveId: "marketing",
    activeViewId: "marketing_opportunity_by_region",
    supportOverrides: {
      "marketing-material-spend-change": {
        supportLevel: "partial_answer",
        supportSummary: "A controlled-test design is now available.",
      },
    },
  });
  assert.equal(result.recommendedQuestions[0].id, "marketing-material-spend-change");
  assert.equal(result.recommendedQuestions[0].supportLevel, "partial_answer");
  assert.equal(result.recommendedQuestions[0].supportSummary, "A controlled-test design is now available.");
});
