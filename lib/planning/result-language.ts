import type { AgenticEvidenceLifecycle, EvidenceExecutionResponse } from "../evidence-snapshot/contracts.ts";
import type { AnswerEvaluationReport } from "./answer-evaluation.ts";
import type { InvestigationCoverageReport } from "./investigation-coverage.ts";
import type { PacketAnswer } from "./reviewable-packet.ts";

export const RESULT_LANGUAGE_VERSION = "decision-result-language-v1" as const;

export function productLabel(value: string) {
  const dynamicSourceId = value.startsWith("dynamic:") ? value.slice("dynamic:".length) : null;
  const cleaned = (dynamicSourceId ?? value)
    .replace(/^normalized[._]/, "")
    .replace(/^synthetic[._]/, "")
    .replaceAll(/[._-]+/g, " ")
    .replace(/\bcbsa\b/gi, "market")
    .replace(/\bcpc\b/gi, "cost per click")
    .replace(/\bctr\b/gi, "click-through rate")
    .replace(/\byoy\b/gi, "year-over-year")
    .replace(/\s+/g, " ")
    .trim();
  const label = cleaned ? `${cleaned[0].toUpperCase()}${cleaned.slice(1)}` : "Evidence";
  return dynamicSourceId !== null ? `Newly discovered source investigation: ${label}` : label;
}

export function supportLabel(status: "supported" | "unsupported" | "blocked") {
  if (status === "supported") return "Supported";
  if (status === "unsupported") return "Needs validation";
  return "Not yet supported";
}

export function answerReadinessCopy(
  coverage: InvestigationCoverageReport,
  evaluation?: AnswerEvaluationReport,
) {
  const gapCount = Math.max(0, coverage.requiredCount - coverage.coveredRequiredCount);
  if (evaluation?.overallStatus === "pass") {
    return { label: "Ready for accountable review", confidence: "High", gapCount } as const;
  }
  if (coverage.overallStatus === "blocked" || evaluation?.overallStatus === "fail") {
    return { label: "Early finding; more evidence needed", confidence: "Low", gapCount } as const;
  }
  return { label: "Useful answer; validate remaining gaps", confidence: "Medium", gapCount } as const;
}

export function actionReadinessLabel(status: "ready_for_bounded_test" | "validation_required" | "outcome_missing" | "evidence_incompatible") {
  if (status === "ready_for_bounded_test") return "Ready to review a bounded test";
  if (status === "outcome_missing") return "Business outcome still needed";
  if (status === "evidence_incompatible") return "Evidence must remain separate";
  return "Validation required before testing";
}

export function evidenceResultCopy(result: EvidenceExecutionResponse, answer?: PacketAnswer) {
  const geographyLabels = [...new Set(result.evidenceBundle.map((item) => item.geographyLabel).filter(Boolean))];
  const gapCount = new Set([...result.missingEvidence, ...result.unknowns, ...result.qualityWarnings]).size;
  const status = result.status === "complete"
    ? "Evidence available"
    : result.status === "partial"
      ? "Evidence available with limits"
      : result.status === "blocked"
        ? "More evidence needed"
        : "Evidence run needs attention";
  return {
    status,
    answer: answer?.directAnswer ?? "The available evidence supports a bounded finding; review the finding and remaining validation needs below.",
    where: geographyLabels.length ? geographyLabels.slice(0, 4).join(" · ") : "The geography resolved in the confirmed question",
    finding: answer?.facts[0]
      ? `${answer.facts[0].metricLabel}: ${answer.facts[0].displayValue} for ${answer.facts[0].geographyLabel}.`
      : `${result.evidenceBundle.length} source-linked evidence item${result.evidenceBundle.length === 1 ? "" : "s"} returned for this question.`,
    gapCount,
  };
}

export function agenticResultCopy(lifecycle: AgenticEvidenceLifecycle) {
  const addedEvidenceCount = lifecycle.passes.reduce((total, pass) => total + pass.addedEvidenceCount, 0);
  const unmetCount = new Set(lifecycle.passes.flatMap((pass) => pass.unmetCriterionIds)).size;
  const readiness = lifecycle.finalAnswerStatus === "pass"
    ? "Answer checks passed"
    : lifecycle.finalAnswerStatus === "partial"
      ? "Useful answer with validation remaining"
      : "More evidence needed";
  return { readiness, addedEvidenceCount, unmetCount };
}
