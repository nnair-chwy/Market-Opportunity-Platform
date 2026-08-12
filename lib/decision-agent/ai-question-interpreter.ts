import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { makeQuestionIntentDecisionReady, questionIntentSchema } from "./question-intent.ts";
import { decisionResearchContext } from "./research-guidance.ts";

const MODEL = "gpt-5.6-terra";

const INSTRUCTIONS = `Rewrite a broad marketing or clinic question as one highly specific, measurable decision proposal. Do not answer the question or invent observed results.
Return only the supplied QuestionIntent schema. Make every material assumption and ambiguity visible and editable.
Rules:
- decision names the business decision, not an analysis technique.
- Make a reasonable best-judgment proposal for stakeholder, entity, geography, period, outcome, denominator, and action. Never write "not yet defined," "not provided," "TBD," or tell the user to define a field.
- Put every inferred default in assumptions and phrase unresolved choices in ambiguities as "Confirm whether..." or "Confirm the...".
- Be concrete: name a planning horizon, observation window, proposed KPI, denominator, actionable geographic unit, shortlist size, and receiving decision makers.
- ideal_evidence names the business concepts, compatible entity or geographic grain, period, and metadata the evidence-planning agent should seek. It does not claim a source is available.
- evaluation_metrics names proposed outcome, driver, eligibility, diagnostic, and guardrail measures with formulas or denominators where applicable. Do not invent observed values or hidden scores.
- comparison_rules names the proposed cohort, baseline, compatibility rules, exclusions, and advancement boundary.
- For a multi-criteria screening decision, proposed_weights contains only preference criteria, totals exactly 100%, and explains the metric behind each criterion. Treat the weights as editable human assumptions. Keep pass/fail eligibility and guardrails out of the weights.
- For a causal test or single-outcome peer review, proposed_weights is empty because a weighted recommendation would be misleading.
- For a next-clinic question, use this plain-language decision: "Decide which 3–5 U.S. metro areas should move into detailed site research for the next CVC general-practice clinic." Default to a 12–24 month pipeline, sustainable demand and operating feasibility at 24 months, and advancing 3–5 markets to property diligence.
- For a broad marketing-spend question, default to mainland U.S. metropolitan markets, an 8-week paid-acquisition test, incremental new-customer conversion rate, and eligible reached prospects.
- action is a bounded next step and must preserve human approval.
- constraints include business and evidence boundaries.
- confirmation_status is always proposed.
- never approve spend, staffing, clinic closure, a site, or a lease.`;

export async function proposeQuestionIntentWithAi(question: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 20_000 });
  const response = await client.responses.parse({
    model: MODEL,
    reasoning: { effort: "low" },
    store: false,
    input: [{ role: "developer", content: INSTRUCTIONS }, { role: "developer", content: decisionResearchContext(question) }, { role: "user", content: question }],
    text: { format: zodTextFormat(questionIntentSchema, "question_intent") },
  });
  if (!response.output_parsed) throw new Error("The model returned no structured question intent.");
  const proposed = questionIntentSchema.parse({ ...response.output_parsed, confirmation_status: "proposed" });
  return makeQuestionIntentDecisionReady(question, proposed);
}
