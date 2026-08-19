import type { PerspectiveId } from "../perspectives/contracts.ts";
import type { AutonomousInsight } from "./current-data-discovery.ts";

export const DISCOVERY_FINDING_SELECTION_VERSION = "discovery-finding-selection-v1" as const;
export const PRIMARY_DISCOVERY_DIGEST_LIMIT = 5 as const;

const DEPARTMENT_ORDER: readonly PerspectiveId[] = ["marketing", "pricing", "cvc"];

export type DiscoveryFindingSuppressionReason =
  | "missing_identity"
  | "missing_evidence_lineage"
  | "missing_explanation"
  | "missing_validation_step"
  | "inconsistent_signal_count"
  | "weak_uncorroborated_signal"
  | "duplicate_finding";

export type DiscoveryFindingQuality = {
  qualified: boolean;
  reasons: DiscoveryFindingSuppressionReason[];
  distinctMarketCount: number;
  distinctSourceCount: number;
  distinctHypothesisCount: number;
};

export type DiscoveryFindingSelectionCounts = {
  investigated: number;
  qualified: number;
  primary: number;
  additional: number;
  suppressed: number;
};

export type DiscoveryFindingSelection = {
  version: typeof DISCOVERY_FINDING_SELECTION_VERSION;
  primaryDigest: AutonomousInsight[];
  additionalFindings: AutonomousInsight[];
  suppressedFindings: Array<{
    finding: AutonomousInsight;
    reasons: DiscoveryFindingSuppressionReason[];
  }>;
  counts: {
    global: DiscoveryFindingSelectionCounts;
    byDepartment: Record<PerspectiveId, DiscoveryFindingSelectionCounts>;
  };
};

function uniqueNonBlank(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function hasSubstantiveText(value: string) {
  return value.trim().length >= 24;
}

/**
 * A finding is digest-eligible only when it is traceable, explainable, testable,
 * and has at least one explicit corroboration path. A comparison across multiple
 * markets counts as corroboration even when it came from one registered screen.
 */
export function evaluateDiscoveryFindingQuality(finding: AutonomousInsight): DiscoveryFindingQuality {
  const markets = uniqueNonBlank(finding.marketIds);
  const sources = uniqueNonBlank(finding.sourceIds);
  const snapshots = uniqueNonBlank(finding.snapshotVersions);
  const hypotheses = uniqueNonBlank(finding.hypothesisIds);
  const reasons: DiscoveryFindingSuppressionReason[] = [];

  if (!finding.insightId.trim() || !finding.marketName.trim() || markets.length === 0) {
    reasons.push("missing_identity");
  }
  if (sources.length === 0 || snapshots.length === 0 || hypotheses.length === 0) {
    reasons.push("missing_evidence_lineage");
  }
  if (!hasSubstantiveText(finding.headline) || !hasSubstantiveText(finding.whyInteresting) || !hasSubstantiveText(finding.evidenceDetail)) {
    reasons.push("missing_explanation");
  }
  if (!hasSubstantiveText(finding.nextValidation) || !finding.question.trim()) {
    reasons.push("missing_validation_step");
  }
  if (!Number.isInteger(finding.signalCount) || finding.signalCount < 1 || finding.signalCount !== hypotheses.length) {
    reasons.push("inconsistent_signal_count");
  }
  if (finding.signalCount < 2 && sources.length < 2 && markets.length < 2) {
    reasons.push("weak_uncorroborated_signal");
  }

  return {
    qualified: reasons.length === 0,
    reasons,
    distinctMarketCount: markets.length,
    distinctSourceCount: sources.length,
    distinctHypothesisCount: hypotheses.length,
  };
}

function departmentIndex(department: PerspectiveId) {
  return DEPARTMENT_ORDER.indexOf(department);
}

function compareFindings(left: AutonomousInsight, right: AutonomousInsight) {
  const leftQuality = evaluateDiscoveryFindingQuality(left);
  const rightQuality = evaluateDiscoveryFindingQuality(right);
  return (right.decisionValue?.score ?? 0) - (left.decisionValue?.score ?? 0)
    || right.signalCount - left.signalCount
    || rightQuality.distinctSourceCount - leftQuality.distinctSourceCount
    || rightQuality.distinctMarketCount - leftQuality.distinctMarketCount
    || rightQuality.distinctHypothesisCount - leftQuality.distinctHypothesisCount
    || departmentIndex(left.department) - departmentIndex(right.department)
    || left.marketName.localeCompare(right.marketName)
    || left.insightId.localeCompare(right.insightId);
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function duplicateKeys(finding: AutonomousInsight) {
  const markets = uniqueNonBlank(finding.marketIds).sort().join("+");
  return [
    `market:${finding.department}:${markets}`,
    `claim:${finding.department}:${normalized(finding.headline)}:${normalized(finding.evidenceDetail)}`,
  ];
}

function emptyCounts(): DiscoveryFindingSelectionCounts {
  return { investigated: 0, qualified: 0, primary: 0, additional: 0, suppressed: 0 };
}

function buildCounts(
  findings: AutonomousInsight[],
  primaryDigest: AutonomousInsight[],
  additionalFindings: AutonomousInsight[],
  suppressedFindings: DiscoveryFindingSelection["suppressedFindings"],
) {
  const byDepartment = Object.fromEntries(DEPARTMENT_ORDER.map((department) => [department, emptyCounts()])) as Record<PerspectiveId, DiscoveryFindingSelectionCounts>;
  const global = emptyCounts();
  for (const finding of findings) {
    byDepartment[finding.department].investigated += 1;
    global.investigated += 1;
  }
  for (const finding of primaryDigest) {
    byDepartment[finding.department].qualified += 1;
    byDepartment[finding.department].primary += 1;
    global.qualified += 1;
    global.primary += 1;
  }
  for (const finding of additionalFindings) {
    byDepartment[finding.department].qualified += 1;
    byDepartment[finding.department].additional += 1;
    global.qualified += 1;
    global.additional += 1;
  }
  for (const { finding } of suppressedFindings) {
    byDepartment[finding.department].suppressed += 1;
    global.suppressed += 1;
  }
  return { global, byDepartment };
}

export function selectDiscoveryFindings(
  findings: AutonomousInsight[],
  options: { excludedPrimaryFindingIds?: readonly string[] } = {},
): DiscoveryFindingSelection {
  const intrinsicallyQualified: AutonomousInsight[] = [];
  const suppressedFindings: DiscoveryFindingSelection["suppressedFindings"] = [];
  for (const finding of findings) {
    const quality = evaluateDiscoveryFindingQuality(finding);
    if (quality.qualified) intrinsicallyQualified.push(finding);
    else suppressedFindings.push({ finding, reasons: quality.reasons });
  }

  const qualified: AutonomousInsight[] = [];
  const seenDuplicateKeys = new Set<string>();
  for (const finding of [...intrinsicallyQualified].sort(compareFindings)) {
    const keys = duplicateKeys(finding);
    if (keys.some((key) => seenDuplicateKeys.has(key))) {
      suppressedFindings.push({ finding, reasons: ["duplicate_finding"] });
      continue;
    }
    keys.forEach((key) => seenDuplicateKeys.add(key));
    qualified.push(finding);
  }

  const primaryDigest: AutonomousInsight[] = [];
  const selectedIds = new Set<string>();
  const excludedPrimaryFindingIds = new Set(options.excludedPrimaryFindingIds ?? []);
  const primaryCandidates = qualified.filter((finding) => !excludedPrimaryFindingIds.has(finding.insightId));
  // Preserve an overall portfolio view: take the strongest qualified finding
  // from each investigated department before filling the remaining digest
  // slots by global evidence strength.
  for (const department of DEPARTMENT_ORDER) {
    const strongest = primaryCandidates.find((finding) => finding.department === department);
    if (strongest && primaryDigest.length < PRIMARY_DISCOVERY_DIGEST_LIMIT) {
      primaryDigest.push(strongest);
      selectedIds.add(strongest.insightId);
    }
  }
  for (const finding of primaryCandidates) {
    if (primaryDigest.length >= PRIMARY_DISCOVERY_DIGEST_LIMIT) break;
    if (!selectedIds.has(finding.insightId)) {
      primaryDigest.push(finding);
      selectedIds.add(finding.insightId);
    }
  }
  const additionalFindings = qualified.filter((finding) => !selectedIds.has(finding.insightId));
  suppressedFindings.sort((left, right) => compareFindings(left.finding, right.finding));

  return {
    version: DISCOVERY_FINDING_SELECTION_VERSION,
    primaryDigest,
    additionalFindings,
    suppressedFindings,
    counts: buildCounts(findings, primaryDigest, additionalFindings, suppressedFindings),
  };
}
