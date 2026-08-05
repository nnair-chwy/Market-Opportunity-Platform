import {
  CANDIDATE_OUTCOMES,
  type CvcAggregatePerformanceRecord,
  type CvcPerformanceComparisonConfig,
  type CvcPerformanceComparisonResult,
  type CvcPerformanceFinding,
  type MaturityFilterResult,
  type MaturityWindowRule,
} from "./types.ts";

const MILLISECONDS_PER_DAY = 86_400_000;

function finding(
  code: CvcPerformanceFinding["code"],
  severity: CvcPerformanceFinding["severity"],
  message: string,
  records: readonly CvcAggregatePerformanceRecord[] = [],
): CvcPerformanceFinding {
  return {
    code,
    severity,
    message,
    rowNumbers: [],
    businessIds: [...new Set(records.map((record) => record.business_id))].sort(),
    metricIds: [...new Set(records.map((record) => record.metric_id))].sort(),
  };
}

function validMaturityWindow(rule: MaturityWindowRule) {
  return (
    Number.isInteger(rule.minimumWeeksSinceOpening) &&
    Number.isInteger(rule.maximumWeeksSinceOpening) &&
    rule.minimumWeeksSinceOpening >= 0 &&
    rule.maximumWeeksSinceOpening >= rule.minimumWeeksSinceOpening &&
    rule.version.trim() !== ""
  );
}

function inclusiveWindowDays(record: CvcAggregatePerformanceRecord) {
  const start = Date.parse(`${record.observation_window_start}T00:00:00.000Z`);
  const end = Date.parse(`${record.observation_window_end}T00:00:00.000Z`);
  return Math.round((end - start) / MILLISECONDS_PER_DAY) + 1;
}

export function filterByMaturityWindow(
  records: readonly CvcAggregatePerformanceRecord[],
  rule: MaturityWindowRule,
): MaturityFilterResult {
  if (!validMaturityWindow(rule)) {
    return {
      included: [],
      excluded: [...records],
      findings: [
        finding(
          "invalid_maturity_rule",
          "error",
          "The maturity rule requires a non-empty version and an inclusive, non-negative integer week range.",
          records,
        ),
      ],
    };
  }

  const included: CvcAggregatePerformanceRecord[] = [];
  const excluded: CvcAggregatePerformanceRecord[] = [];
  const findings: CvcPerformanceFinding[] = [];

  for (const record of records) {
    if (
      record.opening_date !== null &&
      record.weeks_since_opening >= rule.minimumWeeksSinceOpening &&
      record.weeks_since_opening <= rule.maximumWeeksSinceOpening
    ) {
      included.push(record);
    } else {
      excluded.push(record);
      if (record.opening_date !== null) {
        findings.push(
          finding(
            "record_outside_maturity_window",
            "info",
            `Clinic "${record.business_id}" is outside maturity rule "${rule.version}" (${rule.minimumWeeksSinceOpening}-${rule.maximumWeeksSinceOpening} weeks, inclusive).`,
            [record],
          ),
        );
      }
    }
  }

  return { included, excluded, findings };
}

function comparisonFindings(
  records: readonly CvcAggregatePerformanceRecord[],
) {
  const findings: CvcPerformanceFinding[] = [];
  const missingOpeningDates = records.filter(
    (record) => record.opening_date === null,
  );
  if (missingOpeningDates.length > 0) {
    findings.push(
      finding(
        "missing_opening_date",
        "error",
        "Selected records include missing opening dates and cannot be maturity-filtered comparably.",
        missingOpeningDates,
      ),
    );
  }

  const recordsByKey = new Map<string, CvcAggregatePerformanceRecord[]>();
  for (const record of records) {
    const key = [
      record.business_id,
      record.observation_window_start,
      record.observation_window_end,
      record.metric_id,
    ].join("|");
    recordsByKey.set(key, [...(recordsByKey.get(key) ?? []), record]);
  }
  for (const duplicates of recordsByKey.values()) {
    if (duplicates.length > 1) {
      findings.push(
        finding(
          "duplicate_clinic_period",
          "error",
          "Selected records contain a duplicate clinic, metric, and observation period.",
          duplicates,
        ),
      );
    }
  }

  const units = [...new Set(records.map((record) => record.unit))].sort();
  if (units.length > 1) {
    findings.push(
      finding(
        "inconsistent_units",
        "error",
        `Selected records use inconsistent units: ${units.join(", ")}.`,
        records,
      ),
    );
  }

  const windowDays = [
    ...new Set(records.map((record) => inclusiveWindowDays(record))),
  ].sort((left, right) => left - right);
  if (windowDays.length > 1) {
    findings.push(
      finding(
        "incomparable_observation_windows",
        "error",
        `Selected records use incomparable inclusive observation-window lengths: ${windowDays.join(", ")} days.`,
        records,
      ),
    );
  }

  const rejected = records.filter(
    (record) => record.quality_status === "rejected",
  );
  if (rejected.length > 0) {
    findings.push(
      finding(
        "rejected_quality_record",
        "error",
        "Selected records include source-rejected quality statuses.",
        rejected,
      ),
    );
  }
  return findings;
}

export function prepareCvcPerformanceComparison(
  records: readonly CvcAggregatePerformanceRecord[],
  config: CvcPerformanceComparisonConfig,
): CvcPerformanceComparisonResult {
  const findings: CvcPerformanceFinding[] = [];
  if (!config.outcome) {
    findings.push(
      finding(
        "outcome_not_configured",
        "error",
        "A primary outcome must be explicitly configured before clinic comparison.",
      ),
    );
  }
  if (!config.maturityWindow) {
    findings.push(
      finding(
        "maturity_rule_not_configured",
        "error",
        "A versioned maturity-window rule must be explicitly configured before clinic comparison.",
      ),
    );
  }
  if (!config.outcome || !config.maturityWindow) {
    return {
      comparisonReady: false,
      included: [],
      excluded: [...records],
      findings,
    };
  }

  const selected = records.filter(
    (record) => record.metric_id === config.outcome?.metricId,
  );
  if (selected.length === 0) {
    findings.push(
      finding(
        "no_records_for_outcome",
        "error",
        `No imported records match configured outcome "${config.outcome.metricId}".`,
      ),
    );
  }
  if (!(config.outcome.metricId in CANDIDATE_OUTCOMES)) {
    findings.push(
      finding(
        "unsupported_candidate_outcome",
        "warning",
        `Outcome "${config.outcome.metricId}" is not one of the documented unapproved candidate outcomes.`,
        selected,
      ),
    );
  }
  if (
    !config.outcome.approvedBy ||
    !config.outcome.approvedAt ||
    !config.outcome.definitionVersion
  ) {
    findings.push(
      finding(
        "outcome_not_approved",
        "error",
        `Outcome "${config.outcome.metricId}" remains unapproved until approvedBy, approvedAt, and definitionVersion are supplied by an owner.`,
        selected,
      ),
    );
  }

  const maturity = filterByMaturityWindow(
    selected,
    config.maturityWindow,
  );
  findings.push(...maturity.findings);
  findings.push(...comparisonFindings(selected));

  return {
    ...maturity,
    comparisonReady: !findings.some((item) => item.severity === "error"),
    findings,
  };
}
