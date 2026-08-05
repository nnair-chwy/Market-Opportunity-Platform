import { evaluateSite } from "../scoring.ts";
import {
  SANDBOX_EXPECTED_WEIGHT_TOTAL,
  SANDBOX_SENSITIVITY_STEP,
  createSandboxConfiguration,
  initialSandboxDraft,
  sandboxCandidates,
  sandboxMetricControls,
  sandboxThresholdControls,
} from "./fixtures.ts";
import type {
  CandidateComparison,
  SandboxAnalysis,
  SandboxDraft,
  SandboxValidationIssue,
} from "./types.ts";

const EPSILON = 1e-9;

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 1e12) / 1e12;
}

export class SandboxValidationError extends Error {
  readonly issues: SandboxValidationIssue[];

  constructor(issues: SandboxValidationIssue[]) {
    super(issues.map((issue) => issue.message).join("\n"));
    this.name = "SandboxValidationError";
    this.issues = issues;
  }
}

export function cloneSandboxDraft(draft: SandboxDraft): SandboxDraft {
  return {
    weights: { ...draft.weights },
    thresholds: { ...draft.thresholds },
  };
}

export function createInitialSandboxDraft(): SandboxDraft {
  return cloneSandboxDraft(initialSandboxDraft);
}

export function resetSandboxDraft(): SandboxDraft {
  return createInitialSandboxDraft();
}

export function validateSandboxDraft(
  draft: SandboxDraft,
): SandboxValidationIssue[] {
  const issues: SandboxValidationIssue[] = [];
  let total = 0;

  for (const control of sandboxMetricControls) {
    const weight = draft.weights[control.metricId];
    if (!Number.isFinite(weight) || weight < 0) {
      issues.push({
        code: "invalid-weight",
        fieldId: control.metricId,
        message: `${control.label} weight must be a non-negative number.`,
      });
      continue;
    }
    total += weight;
    if (weight < control.minWeight || weight > control.maxWeight) {
      issues.push({
        code: "weight-out-of-bounds",
        fieldId: control.metricId,
        message: `${control.label} weight must stay between ${control.minWeight}% and ${control.maxWeight}%.`,
      });
    }
  }

  if (Math.abs(total - SANDBOX_EXPECTED_WEIGHT_TOTAL) > EPSILON) {
    issues.push({
      code: "invalid-weight-total",
      fieldId: "weight-total",
      message: `Preference weights total ${round(total)}%. They must total 100%.`,
    });
  }

  for (const control of sandboxThresholdControls) {
    const threshold = draft.thresholds[control.constraintId];
    if (!Number.isFinite(threshold)) {
      issues.push({
        code: "invalid-threshold",
        fieldId: control.constraintId,
        message: `${control.label} must be a finite number.`,
      });
    } else if (threshold < control.min || threshold > control.max) {
      issues.push({
        code: "threshold-out-of-bounds",
        fieldId: control.constraintId,
        message: `${control.label} must stay between ${control.min} and ${control.max} ${control.unit}.`,
      });
    }
  }

  return issues;
}

function assertValidDraft(draft: SandboxDraft): void {
  const issues = validateSandboxDraft(draft);
  if (issues.length > 0) throw new SandboxValidationError(issues);
}

function canonicalDraft(draft: SandboxDraft): string {
  return JSON.stringify({
    weights: sandboxMetricControls.map(({ metricId }) => [
      metricId,
      draft.weights[metricId],
    ]),
    thresholds: sandboxThresholdControls.map(({ constraintId }) => [
      constraintId,
      draft.thresholds[constraintId],
    ]),
  });
}

export function fingerprintSandboxDraft(draft: SandboxDraft): string {
  const input = canonicalDraft(draft);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function rankResults(
  results: ReturnType<typeof evaluateSite>[],
): Map<string, number | null> {
  const calculated = results
    .filter(
      (result): result is typeof result & { systemScore: number } =>
        result.systemScore !== null,
    )
    .sort(
      (left, right) =>
        right.systemScore - left.systemScore ||
        left.siteId.localeCompare(right.siteId),
    );
  const ranks = new Map<string, number | null>(
    results.map((result) => [result.siteId, null]),
  );
  calculated.forEach((result, index) => ranks.set(result.siteId, index + 1));
  return ranks;
}

function evaluateDraft(draft: SandboxDraft, scoringVersion: string) {
  const configuration = createSandboxConfiguration(draft, scoringVersion);
  return sandboxCandidates.map((candidate) =>
    evaluateSite(candidate.input, configuration),
  );
}

function boundedWeightScenarios(draft: SandboxDraft): SandboxDraft[] {
  const scenarios: SandboxDraft[] = [];
  for (const receiver of sandboxMetricControls) {
    for (const donor of sandboxMetricControls) {
      if (receiver.metricId === donor.metricId) continue;
      const receiverWeight = draft.weights[receiver.metricId];
      const donorWeight = draft.weights[donor.metricId];
      if (
        receiverWeight + SANDBOX_SENSITIVITY_STEP <= receiver.maxWeight &&
        donorWeight - SANDBOX_SENSITIVITY_STEP >= donor.minWeight
      ) {
        const scenario = cloneSandboxDraft(draft);
        scenario.weights[receiver.metricId] += SANDBOX_SENSITIVITY_STEP;
        scenario.weights[donor.metricId] -= SANDBOX_SENSITIVITY_STEP;
        scenarios.push(scenario);
      }
    }
  }
  return scenarios;
}

function boundedThresholdScenarios(draft: SandboxDraft): SandboxDraft[] {
  const scenarios: SandboxDraft[] = [];
  for (const control of sandboxThresholdControls) {
    for (const direction of [-1, 1]) {
      const next =
        draft.thresholds[control.constraintId] + control.step * direction;
      if (next < control.min || next > control.max) continue;
      const scenario = cloneSandboxDraft(draft);
      scenario.thresholds[control.constraintId] = next;
      scenarios.push(scenario);
    }
  }
  return scenarios;
}

export function analyzeSandbox(draft: SandboxDraft): SandboxAnalysis {
  assertValidDraft(draft);
  const original = createInitialSandboxDraft();
  const originalFingerprint = fingerprintSandboxDraft(original);
  const adjustedFingerprint = fingerprintSandboxDraft(draft);
  const originalResults = evaluateDraft(
    original,
    `synthetic-unapproved-${originalFingerprint}`,
  );
  const adjustedResults = evaluateDraft(
    draft,
    `synthetic-unapproved-${adjustedFingerprint}`,
  );
  const originalRanks = rankResults(originalResults);
  const adjustedRanks = rankResults(adjustedResults);

  const weightScenarios = boundedWeightScenarios(draft);
  const weightScenarioRanks = weightScenarios.map((scenario) =>
    rankResults(
      evaluateDraft(
        scenario,
        `synthetic-unapproved-${fingerprintSandboxDraft(scenario)}`,
      ),
    ),
  );
  const thresholdScenarios = boundedThresholdScenarios(draft);
  const thresholdScenarioResults = thresholdScenarios.map((scenario) =>
    evaluateDraft(
      scenario,
      `synthetic-unapproved-${fingerprintSandboxDraft(scenario)}`,
    ),
  );

  const comparisons: CandidateComparison[] = sandboxCandidates.map(
    (candidate, candidateIndex) => {
      const originalResult = originalResults[candidateIndex];
      const adjustedResult = adjustedResults[candidateIndex];
      const originalRank = originalRanks.get(candidate.siteId) ?? null;
      const adjustedRank = adjustedRanks.get(candidate.siteId) ?? null;
      const contributionChanges = sandboxMetricControls.map((control) => {
        const originalContribution =
          originalResult.metricContributions.find(
            ({ metricId }) => metricId === control.metricId,
          )?.contribution ?? null;
        const adjustedContribution =
          adjustedResult.metricContributions.find(
            ({ metricId }) => metricId === control.metricId,
          )?.contribution ?? null;
        return {
          metricId: control.metricId,
          label: control.label,
          original: originalContribution,
          adjusted: adjustedContribution,
          delta:
            originalContribution === null || adjustedContribution === null
              ? null
              : round(adjustedContribution - originalContribution),
        };
      });
      const adjustedConstraint = adjustedResult.constraintOutcome;

      return {
        siteId: candidate.siteId,
        name: candidate.name,
        originalResult,
        adjustedResult,
        originalRank,
        adjustedRank,
        rankChange:
          originalRank === null || adjustedRank === null
            ? null
            : originalRank - adjustedRank,
        contributionChanges,
        rankingSensitive: weightScenarioRanks.some(
          (ranks) => ranks.get(candidate.siteId) !== adjustedRank,
        ),
        constraintSensitive: thresholdScenarioResults.some(
          (results) =>
            results[candidateIndex].constraintOutcome !== adjustedConstraint,
        ),
      };
    },
  );

  return {
    configurationFingerprint: adjustedFingerprint,
    configurationVersion: `synthetic-unapproved-${adjustedFingerprint}`,
    configurationLabel: "Synthetic and unapproved",
    weightTotal: round(
      sandboxMetricControls.reduce(
        (total, { metricId }) => total + draft.weights[metricId],
        0,
      ),
    ),
    comparisons,
    sensitivityScenarioCount:
      weightScenarios.length + thresholdScenarios.length,
  };
}

