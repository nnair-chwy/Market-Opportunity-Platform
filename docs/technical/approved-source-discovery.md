# Approved source discovery

`approved-source-discovery-v1` turns newly exported tabular files into a
deterministic, reviewable source profile. It is a control-plane extension to
`data/contracts/local-approved-source-inventory.json`; it does not make an
unregistered file approved or executable.

## Run

```text
pnpm data:build:local-source-inventory
pnpm data:discover:approved-sources
pnpm data:validate:discovered-source-contracts
```

The second command writes `data/contracts/discovered-source-registry.json`.
It also writes `data/contracts/first-party-outcome-readiness.json`, which checks
every profile against versioned regional orders, new-customer, contribution,
clinic-capacity, appointment, and mature-clinic-performance contracts.
Set `SOURCE_DISCOVERY_GENERATED_AT` when a reproducible generated timestamp is
needed. Profiles contain no raw or sampled values.

## Safety and evidence boundary

- Only workspace-relative roots named by the local approved-source inventory
  are scanned.
- Parent traversal, resolved paths outside the workspace, and symbolic links
  are rejected or skipped.
- CSV, TSV, JSON/JSONL, XLSX, and Parquet are supported. Text reads and row
  samples are bounded; XLSX uses its first worksheet; no arbitrary SQL is
  accepted.
- Existing package sensitivity and allowed use are inherited. Name-based
  sensitivity detection may only raise the effective classification.
- A new physical file that is absent from the inventory is `Unknown`,
  `review_required`, and `profile_only` even though it is located below an
  approved root.
- A matched, non-excluded file is only `candidate_for_adapter`. It does not
  enter an evaluation until a reviewer validates grain, semantics, quality,
  and sensitivity and registers a typed adapter plus an allowlisted query.

Rebuilding the inventory never approves a newly arrived file. An unchanged
file retains approval only when package ID, workspace-relative path, and
SHA-256 exactly match the prior inventory. New files and changed bytes are
inventoried as `unregistered_file_requires_review`, so discovery can profile
them without making them queryable. A data steward may approve a new file only
by adding its exact package, path, SHA-256, reviewer, and review time to
`data/contracts/local-source-approval-registry.json`. Stale paths, duplicate
approvals, traversal, hash mismatches, and symbolic links fail closed.

## Profile contract

Each profile records format, size, inventory hash when available, columns and
sample-derived types, candidate row grain, geography, time grain, metric and
unit candidates, sensitivity signals, explicit uncertainties, and the next
integration step. Grain inference is intentionally a hypothesis until a
complete-file uniqueness check confirms it. Multiple geographic grains remain
alternatives and are never silently crosswalked.

Integration hook: server-side source selection can read the generated registry
and consider only profiles whose `integration.queryEligibility` is
`candidate_for_adapter`. Execution continues through the existing typed source
catalogs, normalized snapshots, and registered queries; the discovery registry
never exposes a raw-file query path.

The compact readiness summary is available to the product at
`GET /api/source-readiness`. The response contains outcome status, opaque
source IDs, missing evidence, and adapter candidacy; it does not expose source
paths, columns, hashes, or raw rows. A candidate still has
`allowedQuery: none_until_contract_review`. Only an existing typed adapter and
allowlisted query may make it executable.

## Full-file semantic validation

The third command validates every row of adapter candidates and writes
`data/contracts/semantic-source-contract-registry.json`. CSV, TSV, and Parquet
validation uses DuckDB aggregate scans so 175 MB exports do not enter JavaScript
memory. The validator returns only row counts, distinct-grain counts, missing
and invalid counts, and contract metadata. XLSX is bounded to 10 MB and 250,000
data rows; larger workbook candidates must be published as approved Parquet.
All formats are capped at 2 GB per candidate.

Validation checks the complete-file SHA-256 against the inventory, proves the
proposed grain key is unique, and validates every required geography, period,
context, and numeric metric field. Multiple candidate geographies or periods,
multiple fields for one outcome, direct identifiers, confidential/restricted
sensitivity, missing values, invalid values, duplicate keys, or a changed hash
fail closed and produce no semantic contract.

A passing `semantic-regional-outcome-source-v1` contract stores no raw rows and
remains `candidate_requires_owner_review` with
`none_pending_semantic_approval` query eligibility. It does not approve the
meaning of a metric, geography, period, cohort, small-cell rule, or allowed
business use.
