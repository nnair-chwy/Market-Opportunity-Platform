export const EVIDENCE_STATUSES = [
  "Confirmed",
  "Reported",
  "Derived",
  "Hypothesis",
  "Unknown",
] as const;

export const QUALITY_STATUSES = ["accepted", "warning", "rejected"] as const;
export const SENSITIVITIES = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
export const GEOGRAPHIC_GRAINS = [
  "point",
  "radius",
  "drive_time",
  "market",
  "other",
] as const;

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export type QualityStatus = (typeof QUALITY_STATUSES)[number];
export type Sensitivity = (typeof SENSITIVITIES)[number];
export type GeographicGrain = (typeof GEOGRAPHIC_GRAINS)[number];
export type IssueSeverity = "error" | "warning" | "info";
export type RecordKind =
  | "candidate"
  | "metric"
  | "qualitative_evidence"
  | "constraint"
  | "csv_row";

export type ValidationIssue = {
  code: string;
  severity: IssueSeverity;
  field: string;
  record: {
    kind: RecordKind;
    index: number;
    id?: string;
    candidateId?: string;
  };
  reason: string;
};

export type MetricObservation = {
  metric_id: string;
  raw_value: number | null;
  unit: string;
  source_id: string;
  observed_at: string;
  geography: GeographicGrain;
  quality_status: QualityStatus;
  sensitivity: Sensitivity;
  transformation?: string;
};

export type QualitativeEvidence = {
  evidence_id: string;
  summary: string;
  source_id: string;
  evidence_status: EvidenceStatus;
  observed_at: string;
  geography: GeographicGrain;
  quality_status: QualityStatus;
  sensitivity: Sensitivity;
  transformation?: string;
};

export type SiteConstraint = {
  constraint_id: string;
  status: "pass" | "fail" | "unknown";
  notes?: string;
  source_id: string;
  evidence_status: EvidenceStatus;
  observed_at: string;
  geography: GeographicGrain;
  quality_status: QualityStatus;
  sensitivity: Sensitivity;
  transformation?: string;
};

export type CandidateSite = {
  site_id: string;
  site_name: string;
  latitude?: number;
  longitude?: number;
  evaluation_date: string;
  metrics: MetricObservation[];
  qualitative_evidence: QualitativeEvidence[];
  constraints: SiteConstraint[];
};

export type MetricDefinition = {
  metricId: string;
  unit: string;
  minimum?: number;
  maximum?: number;
  allowedGeographies: readonly GeographicGrain[];
  freshnessDays: number;
};

export type ValidationOptions = {
  metricDefinitions: Readonly<Record<string, MetricDefinition>>;
  allowedSourceIds: ReadonlySet<string> | readonly string[];
  expectedMetricIds?: readonly string[];
  asOfDate?: string;
};

export type RejectedInput = {
  kind: Exclude<RecordKind, "csv_row">;
  index: number;
  id?: string;
  reasons: string[];
  input: unknown;
};

export type DataCoverageSummary = {
  expectedMetricCount: number;
  observedMetricCount: number;
  availableMetricCount: number;
  missingValueCount: number;
  zeroValueCount: number;
  rejectedMetricCount: number;
  staleMetricCount: number;
  warningMetricCount: number;
  coveragePercent: number;
  missingMetricIds: string[];
};

export type CandidateValidationResult = {
  recordIndex: number;
  candidateId?: string;
  input: unknown;
  candidate: CandidateSite | null;
  scoringCandidate: CandidateSite | null;
  acceptedForScoring: boolean;
  issues: ValidationIssue[];
  rejectedInputs: RejectedInput[];
  coverage: DataCoverageSummary;
};

export type ValidationBatchResult = {
  valid: boolean;
  candidates: CandidateValidationResult[];
  scoringCandidates: CandidateSite[];
  issues: ValidationIssue[];
  summary: {
    candidateCount: number;
    scoringCandidateCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
};

export type CsvRecord = Readonly<Record<string, string | undefined>>;

export type ParsedRecords = {
  records: unknown[];
  issues: ValidationIssue[];
};
