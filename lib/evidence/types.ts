import type {
  EvidenceStatus,
  IssueSeverity,
  QualityStatus,
  Sensitivity,
} from "@/lib/data";

export type EvidenceDisposition =
  | "scored"
  | "missing"
  | "excluded"
  | "rejected"
  | "unscored";

export type ScoringRole =
  | "weighted"
  | "constraint"
  | "qualitative"
  | "unscored";

export interface EvidenceSource {
  sourceId: string;
  sourceLabel: string;
  evidenceStatus: EvidenceStatus;
  observedAt?: string | null;
  extractedAt?: string | null;
  geography?: string | null;
  aggregation?: string | null;
  qualityStatus: QualityStatus;
  sensitivity: Sensitivity;
  freshnessWarning?: string | null;
  /**
   * Set only after the integration layer has approved the destination.
   * Arbitrary source URLs are intentionally not part of this contract.
   */
  approvedSourceUrl?: string | null;
}

export interface MetricEvidence {
  metricId: string;
  metricLabel: string;
  sourceIds: readonly string[];
  unit?: string | null;
  rawValue?: number | string | null;
  normalizedValue?: number | null;
  weight?: number | null;
  contribution?: number | null;
  scoringRole: ScoringRole;
  disposition: EvidenceDisposition;
  statusReason?: string | null;
  freshnessWarning?: string | null;
}

export interface QualitativeEvidenceItem {
  evidenceId: string;
  summary: string;
  sourceIds: readonly string[];
  evidenceStatus: EvidenceStatus;
  qualityStatus: QualityStatus;
  sensitivity: Sensitivity;
  observedAt?: string | null;
  geography?: string | null;
}

export interface MissingInformationItem {
  itemId: string;
  label: string;
  status: "missing" | "unavailable" | "unknown" | "resolved";
  detail?: string | null;
  sourceId?: string | null;
  sensitivity?: Sensitivity;
}

export interface EvaluationWarning {
  warningId: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  metricIds?: readonly string[];
  sourceIds?: readonly string[];
  sensitivity?: Sensitivity;
}

export interface EvidenceSummary {
  totalSources: number;
  availableSources: number;
  restrictedSources: number;
  staleSources: number;
  scoredMetrics: number;
  missingMetrics: number;
  excludedMetrics: number;
  rejectedMetrics: number;
  unscoredMetrics: number;
  qualitativeItems: number;
  warningCount: number;
}

export interface StructuredEvidenceResult {
  evaluationId: string;
  candidateLabel: string;
  evaluatedAt?: string | null;
  sources?: readonly EvidenceSource[] | null;
  metrics?: readonly MetricEvidence[] | null;
  qualitativeEvidence?: readonly QualitativeEvidenceItem[] | null;
  missingInformation?: readonly MissingInformationItem[] | null;
  warnings?: readonly EvaluationWarning[] | null;
}

export type SourcePresentation = Omit<
  EvidenceSource,
  "approvedSourceUrl" | "sourceId" | "sourceLabel"
> & {
  sourceId: string;
  sourceLabel: string;
  approvedSourceUrl: string | null;
  isRestricted: boolean;
};
