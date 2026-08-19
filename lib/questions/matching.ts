import type { PerspectiveId, PerspectiveViewId } from "../perspectives/contracts.ts";
import {
  REGISTERED_QUESTIONS,
  type QuestionSupportLevel,
  type RegisteredQuestion,
} from "./registry.ts";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "do", "does", "for", "have", "how", "i", "in",
  "is", "of", "on", "or", "our", "that", "the", "this", "to", "we", "what",
  "where", "which", "with",
]);

export type QuestionGeographicContext = {
  cbsaCode: string;
  cbsaName: string;
};

export type PreviousInvestigationQuestion = {
  id: string;
  question: string;
  savedAt: string;
  title?: string;
  perspectiveId?: PerspectiveId;
  viewId?: PerspectiveViewId;
  selectedGeographicContexts?: readonly QuestionGeographicContext[];
};

export type QuestionSuggestionKind = "previous_investigation" | "registered_question";

export type QuestionSuggestion = {
  id: string;
  question: string;
  title: string;
  kind: QuestionSuggestionKind;
  perspectiveId?: PerspectiveId;
  viewId?: PerspectiveViewId;
  investigationType: string;
  supportLevel: QuestionSupportLevel;
  supportSummary: string;
  score: number;
  scoreBreakdown: {
    text: number;
    perspective: number;
    view: number;
    geography: number;
    support: number;
    recency: number;
  };
  savedAt?: string;
  registeredQuestionId?: string;
};

export type QuestionSuggestionGroups = {
  previousInvestigations: QuestionSuggestion[];
  recommendedQuestions: QuestionSuggestion[];
  relatedQuestions: QuestionSuggestion[];
};

export type RankQuestionSuggestionsInput = {
  query: string;
  activePerspectiveId?: PerspectiveId;
  activeViewId?: PerspectiveViewId;
  selectedGeographicContexts?: readonly QuestionGeographicContext[];
  previousInvestigations?: readonly PreviousInvestigationQuestion[];
  registry?: readonly RegisteredQuestion[];
  now?: Date;
  limitPerGroup?: number;
  limitTotal?: number;
  minimumMeaningfulCharacters?: number;
  supportOverrides?: Readonly<Record<string, {
    supportLevel: QuestionSupportLevel;
    supportSummary?: string;
  }>>;
};

export function normalizeQuestionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeToken(value: string): string {
  if (value.length > 5 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 5 && value.endsWith("ing")) return value.slice(0, -3);
  if (value.length > 4 && value.endsWith("s")) return value.slice(0, -1);
  return value;
}

export function tokenizeQuestion(value: string): string[] {
  return Array.from(new Set(
    normalizeQuestionText(value)
      .split(" ")
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
      .map(normalizeToken),
  ));
}

export function questionTextSimilarity(query: string, candidate: string): number {
  const normalizedQuery = normalizeQuestionText(query);
  const normalizedCandidate = normalizeQuestionText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedQuery === normalizedCandidate) return 1;

  const queryTokens = tokenizeQuestion(normalizedQuery);
  const candidateTokens = tokenizeQuestion(normalizedCandidate);
  if (!queryTokens.length || !candidateTokens.length) return 0;
  const candidateSet = new Set(candidateTokens);
  const overlap = queryTokens.filter((token) => candidateSet.has(token)).length;
  const coverage = overlap / queryTokens.length;
  const jaccard = overlap / new Set([...queryTokens, ...candidateTokens]).size;
  const phrase = normalizedCandidate.includes(normalizedQuery) ? 0.2 : 0;
  const prefixMatches = queryTokens.filter((queryToken) =>
    candidateTokens.some((candidateToken) =>
      queryToken.length >= 3 && candidateToken.length >= 3 &&
      (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)),
    ),
  ).length;
  const prefixCoverage = prefixMatches / queryTokens.length;
  return Math.min(1, coverage * 0.55 + jaccard * 0.25 + prefixCoverage * 0.2 + phrase);
}

function supportScore(level: QuestionSupportLevel): number {
  if (level === "available_now") return 10;
  if (level === "partial_answer") return 5;
  return 0;
}

function recencyScore(savedAt: string | undefined, now: Date): number {
  if (!savedAt) return 0;
  const timestamp = Date.parse(savedAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  return Math.max(0, 12 - Math.min(12, ageDays / 7));
}

function geographyScore(
  candidate: readonly QuestionGeographicContext[] | undefined,
  selected: readonly QuestionGeographicContext[] | undefined,
): number {
  if (!selected?.length) return 0;
  if (!candidate?.length) return 3;
  const selectedCodes = new Set(selected.map((item) => item.cbsaCode));
  const selectedNames = new Set(selected.flatMap((item) => tokenizeQuestion(item.cbsaName)));
  const matches = candidate.some((item) =>
    selectedCodes.has(item.cbsaCode) || tokenizeQuestion(item.cbsaName).some((token) => selectedNames.has(token)),
  );
  return matches ? 12 : 0;
}

function registeredGeographies(question: RegisteredQuestion): QuestionGeographicContext[] | undefined {
  return question.geographicContext?.cbsaCodes.map((cbsaCode, index) => ({
    cbsaCode,
    cbsaName: question.geographicContext?.placeNames[index] ?? "",
  }));
}

function rankParts(input: {
  query: string;
  question: string;
  perspectiveId?: PerspectiveId;
  viewId?: PerspectiveViewId;
  geographies?: readonly QuestionGeographicContext[];
  supportLevel: QuestionSupportLevel;
  savedAt?: string;
  activePerspectiveId?: PerspectiveId;
  activeViewId?: PerspectiveViewId;
  selectedGeographicContexts?: readonly QuestionGeographicContext[];
  now: Date;
}) {
  const text = questionTextSimilarity(input.query, input.question) * 100;
  const perspective = input.activePerspectiveId && input.perspectiveId === input.activePerspectiveId ? 18 : 0;
  const view = input.activeViewId && input.viewId === input.activeViewId ? 14 : 0;
  const geography = geographyScore(input.geographies, input.selectedGeographicContexts);
  const support = supportScore(input.supportLevel);
  const recency = recencyScore(input.savedAt, input.now);
  return { text, perspective, view, geography, support, recency };
}

function totalScore(parts: QuestionSuggestion["scoreBreakdown"]): number {
  return Number(Object.values(parts).reduce((sum, value) => sum + value, 0).toFixed(4));
}

function sortSuggestions(items: QuestionSuggestion[]): QuestionSuggestion[] {
  return items.sort((left, right) =>
    right.score - left.score ||
    (right.savedAt ? Date.parse(right.savedAt) : 0) - (left.savedAt ? Date.parse(left.savedAt) : 0) ||
    left.question.localeCompare(right.question) ||
    left.id.localeCompare(right.id),
  );
}

function meaningfulLength(value: string): number {
  return normalizeQuestionText(value).replace(/\s/g, "").length;
}

export function rankQuestionSuggestions(input: RankQuestionSuggestionsInput): QuestionSuggestionGroups {
  const minimum = input.minimumMeaningfulCharacters ?? 3;
  const empty = { previousInvestigations: [], recommendedQuestions: [], relatedQuestions: [] };
  if (meaningfulLength(input.query) < minimum) return empty;

  const now = input.now ?? new Date();
  const limit = Math.max(1, input.limitPerGroup ?? 5);
  const registry = input.registry ?? REGISTERED_QUESTIONS;
  const previousByQuestion = new Map<string, PreviousInvestigationQuestion>();
  for (const item of input.previousInvestigations ?? []) {
    const key = normalizeQuestionText(item.question);
    const existing = previousByQuestion.get(key);
    if (!existing || Date.parse(item.savedAt) > Date.parse(existing.savedAt)) {
      previousByQuestion.set(key, item);
    }
  }

  const previous = Array.from(previousByQuestion.values()).map((item): QuestionSuggestion => {
    const registered = registry.find((candidate) => normalizeQuestionText(candidate.question) === normalizeQuestionText(item.question));
    const supportLevel = registered?.supportLevel ?? "partial_answer";
    const parts = rankParts({
      ...input,
      now,
      question: item.question,
      perspectiveId: item.perspectiveId ?? registered?.perspectiveId,
      viewId: item.viewId ?? registered?.viewId,
      geographies: item.selectedGeographicContexts,
      supportLevel,
      savedAt: item.savedAt,
    });
    return {
      id: item.id,
      question: item.question,
      title: item.title ?? "Previous investigation",
      kind: "previous_investigation",
      perspectiveId: item.perspectiveId ?? registered?.perspectiveId,
      viewId: item.viewId ?? registered?.viewId,
      investigationType: registered?.investigationType ?? "Previous investigation",
      supportLevel,
      supportSummary: registered?.supportSummary ?? "Open the saved findings or run the question again with the current context.",
      score: totalScore(parts),
      scoreBreakdown: parts,
      savedAt: item.savedAt,
      registeredQuestionId: registered?.id,
    };
  }).filter((item) => item.scoreBreakdown.text > 0 || item.scoreBreakdown.perspective > 0);

  const registered = registry.map((item): QuestionSuggestion => {
    const support = input.supportOverrides?.[item.id];
    const supportLevel = support?.supportLevel ?? item.supportLevel;
    const parts = rankParts({
      ...input,
      now,
      question: item.question,
      perspectiveId: item.perspectiveId,
      viewId: item.viewId,
      geographies: registeredGeographies(item),
      supportLevel,
    });
    return {
      id: item.id,
      question: item.question,
      title: item.description,
      kind: "registered_question",
      perspectiveId: item.perspectiveId,
      viewId: item.viewId,
      investigationType: item.investigationType,
      supportLevel,
      supportSummary: support?.supportSummary ?? item.supportSummary,
      score: totalScore(parts),
      scoreBreakdown: parts,
      registeredQuestionId: item.id,
    };
  }).filter((item) => item.scoreBreakdown.text > 0 || item.scoreBreakdown.perspective > 0);

  const recommended = registered.filter((item) =>
    item.perspectiveId === input.activePerspectiveId &&
    (!input.activeViewId || item.viewId === input.activeViewId),
  );
  const recommendedIds = new Set(recommended.map((item) => item.id));
  const related = registered.filter((item) => !recommendedIds.has(item.id));

  const grouped = {
    previousInvestigations: sortSuggestions(previous).slice(0, limit),
    recommendedQuestions: sortSuggestions(recommended).slice(0, limit),
    relatedQuestions: sortSuggestions(related).slice(0, limit),
  };

  if (input.limitTotal === undefined) return grouped;

  const totalLimit = Math.max(1, input.limitTotal);
  const visible = new Set(
    [
      ...grouped.previousInvestigations,
      ...grouped.recommendedQuestions,
      ...grouped.relatedQuestions,
    ]
      .sort((left, right) =>
        right.score - left.score ||
        left.question.localeCompare(right.question) ||
        left.id.localeCompare(right.id),
      )
      .slice(0, totalLimit),
  );

  return {
    previousInvestigations: grouped.previousInvestigations.filter((item) => visible.has(item)),
    recommendedQuestions: grouped.recommendedQuestions.filter((item) => visible.has(item)),
    relatedQuestions: grouped.relatedQuestions.filter((item) => visible.has(item)),
  };
}
