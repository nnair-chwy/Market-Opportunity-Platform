---
name: connect-data-to-platform
description: Connect a new local CSV, export, or approved structured source to the Market Opportunity Platform. Use when an agent must register a source, validate its grain and quality, build a versioned snapshot, expose deterministic evidence queries, route natural-language questions, or add evidence-backed action-packet insights. Do not use this skill to bypass governance, expose raw rows, invent geography joins, or make final business decisions.
---

# Connect Data to Platform

## Purpose

Use this skill to add one governed data family end to end:

`raw local file → source registry → validation/normalization → versioned snapshot → registered query → evidence bundle → draft action packet`

The result must be replayable, source-linked, explicit about missingness, and safe for bounded natural-language interpretation.

## Required project context

Before changing product behavior, read the repository documents required by `AGENTS.md`, especially the data source guide, data contracts, AI boundaries, claim ledger, and open questions. Inspect the active branch and worktree first. Preserve unrelated user changes.

Use the existing implementations as extension points:

- `lib/evidence-snapshot/source-registry.ts`
- `scripts/build-clinic-market-evidence-snapshot.ts`
- `lib/evidence-snapshot/execute.ts`
- `lib/planning/planner.ts`
- `lib/planning/execute-plan.ts`
- `lib/planning/reviewable-packet.ts`
- `lib/planning/packet-ai-summary.ts`

Read `references/connection-contract.md` when deciding what to register or what to return to the user.

## Workflow

### 1. Define intended use before touching the file

Record the decision or research question, source owner and approval state, population, geography, time window, expected grain, stable identifiers and crosswalks, sensitivity, retention, allowed use, browser/AI exposure, evidence status, and what the source cannot justify.

If ownership, metric definition, geography relationship, or allowed use is unresolved, keep the source staged or blocked. Do not infer approval from file availability.

### 2. Inspect the actual local inputs

Use `rg --files` and a read-only profile of the exact directory. Confirm filenames, headers, row counts, candidate keys, duplicate rates, nulls, date ranges, categorical values, and numeric types. Check for identifiers or precise coordinates that must not enter Git, browser responses, or AI context.

Do not silently repair names, dates, geography, or types. Preserve null, zero, suppressed, unavailable, and rejected as distinct states.

### 3. Register the source

Add a typed entry to the source registry with dataset ID, table name, environment override, default filename, source ID, grain, sensitivity, allowed use, and AI exposure. Add a source-status rule and a claim-ledger or decision-log entry when the new source changes an evidence boundary.

Use stable IDs and an approved versioned geography crosswalk. Never fuzzy-match a market at runtime. If a source has only labels, expose it as descriptive context and block joins or ranking that require stable geography IDs.

### 4. Build the smallest canonical snapshot

Extend the existing snapshot builder or create a narrowly scoped builder using the same conventions. It must parse through a typed adapter, validate required fields, key uniqueness, referential integrity, ranges, dates, and grain, normalize into canonical observations or a typed table, and attach source ID, source file, hash, snapshot version, transformation version, evidence status, quality status, sensitivity, allowed use, and warnings.

Produce a manifest with hashes and row counts, a quality report, and a source-status report. Retain rejected rows only in an audit output, excluding them from evidence responses. Keep raw input files outside Git. Prefer Parquet for approved analytical snapshots and DuckDB for local deterministic querying. Do not read raw CSVs at request time.

### 5. Add a registered deterministic query

Add a strict request and response contract. Query names and SQL remain application-controlled. Parameters must be normalized and exact. Returned evidence must include metric, geography, value, unit, period, source, snapshot version, evidence status, quality status, allowed use, sensitivity, and warning.

The executor must validate the manifest before querying, reject restricted output, preserve missingness, and return structured `complete`, `partial`, `blocked`, or `failed` states. Never let AI generate SQL or select unrestricted raw rows.

### 6. Connect natural-language routing

Update deterministic planner vocabulary, capability metadata, source-family mapping, requested metrics, and registered query selection. Add exact geography resolution using stable IDs. If an AI planner is used as fallback, constrain it to the supplied schema and validate its output through the deterministic planner.

Add tests for supported-question routing, ambiguous geography blocking, visible missing evidence, warning and evidence-label preservation, and restricted data exclusion from browser and AI responses.

### 7. Connect evidence to action packets

Build packet facts and proposed next steps from the executed evidence response, not from the plan alone. Include source IDs, snapshot and calculation versions, findings, contradictions, warnings, missing evidence, missing approvals, owner, and a validation-only proposed action.

The packet may recommend research, validation, or human review. It must not autonomously recommend a market, site, lease, opening, campaign, spend, hiring, or operational change. Keep `scoring_eligibility` and `allowed_use` visible. AI may improve wording only after deterministic packet assembly and must not add facts, numbers, sources, actions, approvals, or decisions.

### 8. Verify and report

Run the narrowest relevant build, query replay, contract tests, and lint. If UI behavior changes, verify the rendered question, geography, evidence, warnings, and packet controls. Report implemented files and commands, snapshot version, source IDs, row counts, quality findings, supported questions and query names, evidence and packet behavior, synthetic/reported/derived/blocked/unknown boundaries, unresolved approvals, and anything intentionally left unimplemented.

Do not claim a production connection when the result is only a local snapshot or synthetic fixture.

## Stop conditions

Return a blocked readiness result when source owner or allowed use is unknown, grain or metric definition is unresolved, stable geography IDs or an approved crosswalk are missing for a required join, validation finds duplicate keys or incompatible grains, restricted data would cross the browser or AI boundary, or the requested output is a final consequential business decision.

A blocked result must name the missing evidence, owner, required artifact, and next validation step.

## Completion standard

The connection is complete only when a fixed supported question can be replayed from the versioned snapshot through the registered query into a source-linked evidence bundle and draft action packet, with tests proving that warnings, missingness, and governance boundaries survive the path.
