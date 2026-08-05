# CVC performance aggregate CSV adapter

This adapter provides one source-neutral import path for an approved manual
aggregate export. The CSV may have been produced from an authorized Tableau
export or an authorized Snowflake-derived workflow. The adapter does not query,
scrape, authenticate to, or imply access to either system.

`SRC-002` documents that current CVC reports and dashboards exist. Access,
stable metric definitions, the primary outcome, the maturity rule, and
comparable-clinic rules remain unresolved. See `OQ-004`, `OQ-009`, and
`OQ-013`.

## Required columns

Columns may appear in any order:

1. `business_id`
2. `clinic_name`
3. `opening_date`
4. `observation_window_start`
5. `observation_window_end`
6. `weeks_since_opening`
7. `metric_id`
8. `aggregate_value`
9. `unit`
10. `source_id`
11. `extracted_at`
12. `quality_status`

Dates use `YYYY-MM-DD`. `weeks_since_opening` is a non-negative integer.
`aggregate_value` is a finite number. `quality_status` is `accepted`,
`warning`, or `rejected`.

Every row is one aggregate clinic, metric, and observation-window record.
Individual customer, appointment, employee, and medical-record fields are not
part of this contract. Only synthetic fixtures belong in Git.

## Comparison boundary

`completed_appointments`, `unique_customers`, and `net_sales` are candidate
outcomes only. Each remains `unapproved` until an owner supplies approval and a
versioned metric definition.

`prepareCvcPerformanceComparison` requires the caller to provide the outcome
and versioned maturity window. It filters deterministically and reports
blocking findings for missing approval, inconsistent units, incomparable
inclusive window lengths, and rejected records. It does not rank clinics or
choose a business definition.
