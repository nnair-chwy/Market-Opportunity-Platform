export const CVC_PERFORMANCE_CSV_COLUMNS = [
  "business_id",
  "clinic_name",
  "opening_date",
  "observation_window_start",
  "observation_window_end",
  "weeks_since_opening",
  "metric_id",
  "aggregate_value",
  "unit",
  "source_id",
  "extracted_at",
  "quality_status",
] as const;

export type CvcPerformanceCsvColumn =
  (typeof CVC_PERFORMANCE_CSV_COLUMNS)[number];

export const CVC_PERFORMANCE_QUALITY_STATUSES = [
  "accepted",
  "warning",
  "rejected",
] as const;

export type CvcPerformanceQualityStatus =
  (typeof CVC_PERFORMANCE_QUALITY_STATUSES)[number];

export const CANDIDATE_OUTCOMES = {
  completed_appointments: {
    metricId: "completed_appointments",
    label: "Completed appointments",
    approvalStatus: "unapproved",
  },
  unique_customers: {
    metricId: "unique_customers",
    label: "Unique customers",
    approvalStatus: "unapproved",
  },
  net_sales: {
    metricId: "net_sales",
    label: "Net sales",
    approvalStatus: "unapproved",
  },
} as const;

export type CandidateOutcomeMetricId = keyof typeof CANDIDATE_OUTCOMES;

export type CvcAggregatePerformanceRecord = {
  business_id: string;
  clinic_name: string;
  opening_date: string | null;
  observation_window_start: string;
  observation_window_end: string;
  weeks_since_opening: number;
  metric_id: string;
  aggregate_value: number;
  unit: string;
  source_id: string;
  extracted_at: string;
  quality_status: CvcPerformanceQualityStatus;
};

export type CvcPerformanceFindingSeverity = "error" | "warning" | "info";

export type CvcPerformanceFindingCode =
  | "csv_syntax_error"
  | "duplicate_header"
  | "missing_column"
  | "unexpected_column"
  | "blank_required_field"
  | "invalid_date"
  | "invalid_number"
  | "invalid_quality_status"
  | "invalid_observation_window"
  | "missing_opening_date"
  | "duplicate_clinic_period"
  | "inconsistent_units"
  | "incomparable_observation_windows"
  | "unsupported_candidate_outcome"
  | "no_records_for_outcome"
  | "outcome_not_configured"
  | "outcome_not_approved"
  | "maturity_rule_not_configured"
  | "invalid_maturity_rule"
  | "record_outside_maturity_window"
  | "rejected_quality_record";

export type CvcPerformanceFinding = {
  code: CvcPerformanceFindingCode;
  severity: CvcPerformanceFindingSeverity;
  message: string;
  rowNumbers: number[];
  businessIds: string[];
  metricIds: string[];
};

export type CvcPerformanceImportResult = {
  sourceKind: "approved_manual_aggregate_csv";
  rowCount: number;
  records: CvcAggregatePerformanceRecord[];
  findings: CvcPerformanceFinding[];
  metadata: {
    sourceIds: string[];
    extractedAtDates: string[];
    aggregateGrain: "clinic";
    containsIndividualDetail: false;
  };
};

export type OutcomeSelection = {
  metricId: string;
  approvedBy?: string;
  approvedAt?: string;
  definitionVersion?: string;
};

export type MaturityWindowRule = {
  minimumWeeksSinceOpening: number;
  maximumWeeksSinceOpening: number;
  version: string;
};

export type CvcPerformanceComparisonConfig = {
  outcome?: OutcomeSelection;
  maturityWindow?: MaturityWindowRule;
};

export type MaturityFilterResult = {
  included: CvcAggregatePerformanceRecord[];
  excluded: CvcAggregatePerformanceRecord[];
  findings: CvcPerformanceFinding[];
};

export type CvcPerformanceComparisonResult = MaturityFilterResult & {
  comparisonReady: boolean;
};
