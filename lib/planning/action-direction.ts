import type { EvaluationPlan } from "./contracts.ts";

export type ActionDirection = "increase" | "decrease";
export type ActionDirectionGoalCheck = {
  requestedDirection: ActionDirection | null;
  status: "not_applicable" | "matched" | "missing" | "opposed" | "conflicting";
  explanation: string;
};

const MARKETING_INCREASE_GOAL = /\b(?:increase|raise|expand|add)\w*\b[^?.]{0,40}\b(?:spend|budget|investment)\b|\b(?:spend|invest)\w*\s+more\b|\b(?:receive|allocate)\w*\s+more\b[^?.]{0,30}\b(?:spend|budget)\b/i;
const MARKETING_DECREASE_GOAL = /\b(?:reduce|decrease|cut|lower|pull back)\w*\b[^?.]{0,40}\b(?:spend|budget|investment)\b/i;
const PRICING_INCREASE_GOAL = /\b(?:increase|raise|higher)\w*\b[^?.]{0,30}\b(?:price|pricing)\b|\b(?:price|pricing)\w*\b[^?.]{0,30}\b(?:increase|raise|higher)\w*\b/i;
const PRICING_DECREASE_GOAL = /\b(?:decrease|lower|cut|reduce)\w*\b[^?.]{0,30}\b(?:price|pricing)\b|\b(?:price|pricing)\w*\b[^?.]{0,30}\b(?:decrease|lower|cut|reduce)\w*\b/i;

const INCREASE_ANSWER = /\b(?:increase|raise|expand|add)\w*\b[^.!?]{0,45}\b(?:spend|budget|investment|price|pricing)\b|\b(?:spend|invest)\w*\s+more\b|\b(?:spend|price)[- ]increase test\b|\bincrease[- ](?:spend|price) test\b/i;
const DECREASE_ANSWER = /\b(?:reduce|decrease|cut|lower|pull back)\w*\b[^.!?]{0,45}\b(?:spend|budget|investment|price|pricing)\b|\boverpay\w*\b/i;
const PROTECTIVE_LANGUAGE = /\b(?:do not|don't|not proof|no proof|cannot call|before calling|should not|must not)\b/i;

export function requestedActionDirection(plan: EvaluationPlan): ActionDirection | null {
  const question = plan.originalQuestion;
  if (plan.perspectiveId === "marketing") {
    if (MARKETING_INCREASE_GOAL.test(question)) return "increase";
    if (MARKETING_DECREASE_GOAL.test(question)) return "decrease";
  }
  if (plan.perspectiveId === "pricing") {
    if (PRICING_INCREASE_GOAL.test(question)) return "increase";
    if (PRICING_DECREASE_GOAL.test(question)) return "decrease";
  }
  return null;
}

/** Checks asserted action direction while ignoring explicitly protective language. */
export function evaluateActionDirection(plan: EvaluationPlan, answerText: string): ActionDirectionGoalCheck {
  const requestedDirection = requestedActionDirection(plan);
  if (!requestedDirection) return {
    requestedDirection: null,
    status: "not_applicable",
    explanation: "The confirmed question does not request a directional spend or price lever.",
  };
  const assertedSentences = answerText
    .split(/[.!?;]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !PROTECTIVE_LANGUAGE.test(sentence));
  const asserted = assertedSentences.join(". ");
  const increase = INCREASE_ANSWER.test(asserted);
  const decrease = DECREASE_ANSWER.test(asserted);
  if (increase && decrease) return {
    requestedDirection,
    status: "conflicting",
    explanation: `The answer asserts both increase and decrease directions, so it does not give one bounded ${requestedDirection} recommendation aligned to the confirmed goal.`,
  };
  const matched = requestedDirection === "increase" ? increase : decrease;
  const opposed = requestedDirection === "increase" ? decrease : increase;
  if (opposed) return {
    requestedDirection,
    status: "opposed",
    explanation: `The confirmed goal asks where to ${requestedDirection}, but the answer asserts the opposite lever direction or an overpayment conclusion.`,
  };
  if (!matched) return {
    requestedDirection,
    status: "missing",
    explanation: `The answer retains relevant evidence but does not yet state a bounded ${requestedDirection} test recommendation aligned to the confirmed goal.`,
  };
  return {
    requestedDirection,
    status: "matched",
    explanation: `The bounded test recommendation preserves the confirmed ${requestedDirection} direction without representing a live lever change as executed.`,
  };
}
