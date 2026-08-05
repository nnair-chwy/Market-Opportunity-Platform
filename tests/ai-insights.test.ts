import assert from "node:assert/strict";
import test from "node:test";
import {
  ASK_AI_SYSTEM_INSTRUCTIONS,
  askAiRequestSchema,
  buildAskAiUserMessage,
  generateAskAiResponse,
  modelInsightSchema,
  validateModelInsight,
  type AskAiContext,
} from "../lib/ai/insights.ts";

const context: AskAiContext = {
  id: "market-12345",
  kind: "market",
  title: "Example market",
  subtitle: "Metropolitan market · current workflow",
  overview:
    "The market view contains approved public context and a separate workflow state.",
  insights: [
    {
      title: "Market scale",
      detail:
        "1,250,000 people in the 2020–2024 ACS estimate, at or above 75% of markets.",
      status: "Derived",
      sourceIds: ["SRC-016"],
      tone: "positive",
    },
    {
      title: "Review readiness",
      detail:
        "The market is current, so linked candidates may proceed to evidence review.",
      status: "Hypothesis",
      sourceIds: ["SYN-MARKET-WORKFLOW-001"],
      tone: "neutral",
    },
  ],
  warnings: ["ACS values are market context only and have no scoring weight"],
  limitations: [
    "CBSA boundaries are statistical areas, not trade areas",
  ],
};

const validOutput = {
  mode: "direct" as const,
  items: [
    {
      question: null,
      answer:
        "The public estimate shows 1,250,000 people for the 2020–2024 period.",
      evidenceStatus: "Derived" as const,
      sourceIds: ["SRC-016"],
    },
    {
      question: null,
      answer:
        "The current workflow state allows linked candidates to proceed to evidence review.",
      evidenceStatus: "Hypothesis" as const,
      sourceIds: ["SYN-MARKET-WORKFLOW-001"],
    },
  ],
  limitations: [
    "The public context does not establish a trade area or site recommendation.",
  ],
};

test("validates source-linked flexible answer items", () => {
  assert.deepEqual(validateModelInsight(validOutput, context), {
    ...validOutput,
    validationIssues: [],
  });
});

test("supports a question-and-answer list without model-generated numbering", () => {
  const output = modelInsightSchema.parse({
    mode: "qa_list",
    items: [
      {
        question: "What evidence supports market scale?",
        answer: "The supplied public estimate provides market-scale context.",
        evidenceStatus: "Derived",
        sourceIds: ["SRC-016"],
      },
      {
        question: "Is the public context a trade area?",
        answer: "No. The supplied limitation says it is not a trade area.",
        evidenceStatus: "Unknown",
        sourceIds: [],
      },
      {
        question: "Is readiness a final decision?",
        answer: "No. The workflow state only permits further evidence review.",
        evidenceStatus: "Hypothesis",
        sourceIds: ["SYN-MARKET-WORKFLOW-001"],
      },
    ],
    limitations: [],
  });

  assert.equal(output.mode, "qa_list");
  assert.equal(output.items.length, 3);
});

test("builds an intent-aware, question-first model request", () => {
  const request = {
    question: "What evidence is missing?",
    context,
  };
  const message = JSON.parse(buildAskAiUserMessage(request));

  assert.equal(message.userQuestion, request.question);
  assert.match(message.task, /Infer the analyst's task/);
  assert.match(message.task, /Do not summarize unrelated context/);
  assert.match(ASK_AI_SYSTEM_INSTRUCTIONS, /intended task from ordinary language/);
  assert.match(ASK_AI_SYSTEM_INSTRUCTIONS, /skeptical perspectives/);
  assert.match(ASK_AI_SYSTEM_INSTRUCTIONS, /Do not include list numbers/);
});

test("downgrades only an item with an unsupported source ID", () => {
  const output = validateModelInsight(
    {
      ...validOutput,
      items: [
        {
          ...validOutput.items[0],
          sourceIds: ["SRC-999"],
        },
        validOutput.items[1],
      ],
    },
    context,
  );

  assert.equal(output.items.length, 2);
  assert.equal(output.items[0].evidenceStatus, "Unknown");
  assert.deepEqual(output.items[0].sourceIds, []);
  assert.deepEqual(output.items[1], validOutput.items[1]);
  assert.deepEqual(output.validationIssues, ["unsupported_source"]);
  assert.match(output.limitations.at(-1) ?? "", /downgraded or removed/);
});

test("downgrades only an item with an unsupported numeric value", () => {
  const output = validateModelInsight(
    {
      ...validOutput,
      items: [
        {
          ...validOutput.items[0],
          answer: "The market has 1,300,000 people.",
        },
        validOutput.items[1],
      ],
    },
    context,
  );

  assert.equal(output.items[0].evidenceStatus, "Unknown");
  assert.doesNotMatch(output.items[0].answer, /1,300,000/);
  assert.deepEqual(output.items[1], validOutput.items[1]);
  assert.deepEqual(output.validationIssues, ["unsupported_number"]);
});

test("downgrades an uncited factual item to Unknown", () => {
  const output = validateModelInsight(
    {
      ...validOutput,
      items: [
        {
          question: null,
          answer: "The market requires more review.",
          evidenceStatus: "Confirmed",
          sourceIds: [],
        },
      ],
    },
    context,
  );

  assert.equal(output.items[0].evidenceStatus, "Unknown");
  assert.deepEqual(output.validationIssues, ["uncited_claim_downgraded"]);
});

test("does not allow a model to upgrade supplied evidence status", () => {
  const output = validateModelInsight(
    {
      ...validOutput,
      items: [
        {
          ...validOutput.items[0],
          evidenceStatus: "Confirmed",
        },
      ],
    },
    context,
  );

  assert.equal(output.items[0].evidenceStatus, "Unknown");
  assert.deepEqual(output.validationIssues, ["unsupported_evidence_status"]);
});

test("downgrades final site-selection language without discarding the response", () => {
  const output = validateModelInsight(
    {
      ...validOutput,
      items: [
        {
          question: null,
          answer: "I recommend selecting this location.",
          evidenceStatus: "Hypothesis",
          sourceIds: [],
        },
        validOutput.items[0],
      ],
    },
    context,
  );

  assert.equal(output.items[0].evidenceStatus, "Unknown");
  assert.doesNotMatch(output.items[0].answer, /recommend selecting/);
  assert.deepEqual(output.items[1], validOutput.items[0]);
  assert.deepEqual(output.validationIssues, ["prohibited_final_decision"]);
});

test("allows protective language that explicitly negates a recommendation", () => {
  const output = validateModelInsight(
    {
      ...validOutput,
      items: [
        {
          question: null,
          answer:
            "The available context does not recommend selecting this location.",
          evidenceStatus: "Unknown",
          sourceIds: [],
        },
      ],
    },
    context,
  );

  assert.match(output.items[0].answer, /does not recommend/);
  assert.deepEqual(output.validationIssues, []);
});

test("generates compatibility fields, versions, and token usage", async () => {
  const response = await generateAskAiResponse(
    {
      question: "What stands out?",
      context,
    },
    async () => ({
      output: validOutput,
      model: "gpt-5.6-terra",
      responseId: "resp_test",
      usage: {
        inputTokens: 1_500,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 200,
        reasoningTokens: 25,
        totalTokens: 1_700,
      },
    }),
  );

  assert.equal(response.mode, "direct");
  assert.equal(response.items.length, 2);
  assert.equal(response.claims.length, 2);
  assert.match(response.answer, /1,250,000 people/);
  assert.equal(response.metadata.model, "gpt-5.6-terra");
  assert.equal(response.metadata.responseId, "resp_test");
  assert.equal(response.metadata.resultVersion, "1.1.0");
  assert.equal(response.metadata.usage?.inputTokens, 1_500);
  assert.deepEqual(response.metadata.validationIssues, []);
});

test("preserves vague skeptical questions and requested QA items", async () => {
  const question =
    "what are 3 questions an analyst would have that makes them skeptical about dallas and how would you answer them";
  const response = await generateAskAiResponse(
    { question, context },
    async (request) => {
      assert.equal(request.question, question);
      return {
        output: {
          mode: "qa_list",
          items: ["scale", "readiness", "trade area"].map((topic) => ({
            question: `What ${topic} evidence should be reviewed?`,
            answer: "The supplied context requires additional analyst review.",
            evidenceStatus: "Hypothesis",
            sourceIds: ["SYN-MARKET-WORKFLOW-001"],
          })),
          limitations: [],
        },
        model: "gpt-5.6-terra",
        responseId: "resp_qa",
      };
    },
  );

  assert.equal(response.mode, "qa_list");
  assert.equal(response.items.length, 3);
  assert.equal(response.diligenceQuestions.length, 3);
});

test("bounds user questions before an API request is made", () => {
  const result = askAiRequestSchema.safeParse({
    question: "x".repeat(501),
    context,
  });

  assert.equal(result.success, false);
});
