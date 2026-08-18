# Connection contract

Use this checklist for a new data family.

## Source registration

- dataset ID and table name
- environment variable and default file path
- source ID and registry reference
- expected grain and stable key
- owner, approval state, sensitivity, and retention
- allowed use and AI exposure
- evidence status
- known limitations and prohibited interpretations

## Snapshot contract

- snapshot, manifest, and transformation versions
- source file and SHA-256
- expected and actual row counts
- schema, grain, and date range
- duplicate-key count
- quality warnings and rejected-row count
- source IDs, sensitivity, and allowed use

## Evidence contract

Every returned fact needs an evidence ID, metric ID, geography ID/label, value, unit, typed period, source ID, snapshot ID, evidence status, quality status, allowed use, sensitivity, and warning or limitation.

## Packet contract

Every draft packet needs the original question, resolved geography, deterministic findings, evidence facts and source IDs, missing evidence, missing approvals, warnings, limitations, calculation versions, proposed validation action, owner, approval state, and a draft-only human-review disclaimer.

## Required tests

1. Source schema and key validation
2. Snapshot manifest, hash, and row-count validation
3. Exact geography routing
4. Deterministic query replay
5. Missing and restricted evidence behavior
6. Evidence-to-packet provenance
7. Bounded AI wording that cannot introduce unsupported facts
