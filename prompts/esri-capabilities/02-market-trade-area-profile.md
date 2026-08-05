# Implementation prompt 2: Market and trade-area profile

You are working in:

`/Users/nnair/Documents/Retail and Clinic Location Evaluator`

Implement an analyst-facing, non-scored market and trade-area profile using the supplied Esri-derived fixture foundation created by implementation prompt 1.

This is the second of three sequential capabilities. It must build on the portfolio data-readiness contracts, provenance, source manifest, site identities, and reviewed or explicitly synthetic site-to-trade-area crosswalk. Do not create a parallel ingestion or evidence system.

Do not commit changes. Preserve all unrelated work in the repository.

## Fixed product decisions

- Modify the current repository and deliver a complete working implementation.
- The intended user is a clinic real-estate or site-selection analyst.
- Use supplied Esri records when they are safe and interpretable.
- Use synthetic fallback values whenever required definitions, approvals, dates, units, or relationships are missing.
- Keep supplied and synthetic evidence visibly distinct.
- Keep all Esri market and trade-area evidence non-scored.
- Do not rank markets or sites.
- Do not treat a trade area as a CBSA, drive-time polygon, service area, or radius unless its method is explicitly documented.
- Do not infer that a larger or smaller metric is favorable without an approved definition.
- Implement adapters, contracts, UI, tests, documentation, decision-log updates, and visual verification.

## Sequential prerequisite

Before editing, verify that prompt 1 has produced:

- a versioned Esri-derived fixture manifest;
- a field catalog;
- safe site identities;
- portfolio readiness records;
- a site-to-trade-area crosswalk;
- rejected or review records;
- source and synthetic evidence labels.

If these outputs do not exist or do not meet prompt 1 acceptance criteria:

1. Do not silently recreate them differently.
2. Document the gap.
3. Implement the missing shared foundation according to prompt 1 or use a clearly isolated synthetic fallback package that follows the prompt 1 contracts.
4. Keep the real-data path disabled until it passes the prerequisite checks.

## Supplied source fields to evaluate

Prioritize the high-coverage trade-area fields:

- `Population`
- `Households`
- `Households with Pets`
- `Households with Pets Index`
- `Average Income`
- `Median Income`
- `Percent Income Over 75K`
- `Percent Income Over 100k`
- `Chewy Online Customers`
- `Chewy Online Autoship Customers`
- `Chewy Healthcare Sales`
- `CVC Customer Percent`
- `Square Miles`
- `Veterinary Clinic Count`
- `Pet Households Per Clinic`
- `Population Growth`
- age-band fields;
- income-band fields.

Treat these sparse fields cautiously:

- `Crime Rank`
- `Environmental Rank`
- `Labor Rank`
- `Approved Layer`
- `Use Status`
- `Brand`

Do not include a field merely because it exists. Each displayed field needs a safe interpretation, source, evidence status, unit or unknown-unit state, observation date or unknown-date state, geography label, quality status, sensitivity, and scoring eligibility of `none`.

## Mandatory reading before editing

Read completely:

1. `AGENTS.md`
2. all mandatory project files listed in `AGENTS.md`;
3. `docs/product/user-workflows.md`;
4. `docs/product/requirements.md`;
5. `docs/technical/architecture.md`;
6. `docs/technical/security-and-governance.md`;
7. `docs/research/source-registry.md`;
8. `data/README.md`;
9. the fixture manifest and contracts produced by prompt 1;
10. the current market UI, unified map, public Census context, workflow, location fixtures, and evidence components;
11. tests covering Census context, map behavior, market workflow, location navigation, evidence presentation, and malformed data.

Reuse the existing adapter, fixture, market-context, and evidence patterns. If implementation requires a new dependency or a material architecture change, present the proposed change and pause for explicit user approval before proceeding.

## Prerequisite audit

Before implementation, determine and record:

1. Which trade-area records safely link to the demo sites.
2. Whether the `ESRI ID` to `ESRI_ID` link has been reviewed or remains provisional.
3. Which sites have multiple linked trade-area records.
4. Which trade-area records have missing site names.
5. Whether each linked trade area is primary, custom, scenario, comparison, or unknown.
6. Whether the trade-area geography method is known.
7. Whether metric observation dates are known.
8. Whether units and denominators are known.
9. Whether Chewy metrics are approved for an internal demo.
10. Whether any linked record contains precise customer or restricted information.
11. Which records require synthetic fallback.
12. How the selected site relates to the existing CBSA market assignment.

Do not conflate file receipt date with metric observation date.

## Required data design

Create or extend a non-scored trade-area evidence contract.

Each observation must preserve:

- site ID;
- trade-area ID;
- trade-area role;
- source field;
- canonical metric ID;
- display label;
- raw value or `null`;
- unit or `null`;
- source ID;
- source snapshot ID;
- observation date or `null`;
- file receipt date;
- geographic grain;
- geography method or `unknown`;
- evidence status;
- quality status;
- sensitivity;
- allowed use;
- transformation version;
- scoring eligibility fixed to `none`;
- limitations and warnings.

If the existing `MetricObservation` contract requires a non-null observation date, do not fabricate one. Either:

- create a separate context-observation contract that permits unknown dates; or
- explicitly reject the supplied observation from the real-data display and substitute a synthetic observation with a documented synthetic date.

Document the choice and its consequences.

## Required deterministic transformation

Build a deterministic adapter that:

- reads only the prompt 1 fixture package at application build time;
- never reads the raw external exports in the browser;
- joins sites to trade areas only through the reviewed or explicitly synthetic crosswalk;
- supports one-to-many trade-area relationships without silently selecting a record;
- labels unknown trade-area roles;
- preserves nulls;
- rejects non-finite values;
- validates percentage fields against documented rules;
- validates age-band totals when all bands are present;
- flags income-band totals outside the documented tolerance;
- verifies `Pet Households Per Clinic` only when both source inputs exist and the formula is confirmed;
- applies no hidden geography calculation;
- calculates no market or site score;
- provides stable, deterministic ordering;
- emits visible warnings for unknown unit, unknown date, unknown geography method, sparse coverage, or synthetic fallback.

Do not derive population density from `Square Miles` unless the area unit and method are confirmed. If demonstrated synthetically, label the calculation and inputs as synthetic.

## UI integration

Integrate the capability into the existing market-first workflow.

The analyst must be able to:

1. Select a market.
2. See the existing public Census CBSA context.
3. See a separate section for linked site trade-area evidence.
4. Select among multiple sites or trade-area variants when present.
5. Navigate from the market to the linked location.
6. Inspect source, evidence status, date, geography, sensitivity, and warnings for each metric.
7. See missing or excluded metrics.
8. Identify whether the display uses supplied data, synthetic fallback, or both.

Use clear labels:

- `Public CBSA context`
- `Esri-reported local trade-area evidence`
- `Synthetic demonstration trade area`
- `Trade-area method unknown`
- `Observation date unknown`
- `Not used for scoring`

Do not overlay or visually imply that the CBSA polygon and trade-area evidence represent the same boundary.

If actual trade-area geometry is unavailable or unsafe to include, do not draw an invented polygon. Show the evidence in a profile panel and use a clearly synthetic geometry only when the demo requires a visual boundary.

## Profile sections

Organize the profile for analyst use:

### Market and household context

- population;
- households;
- households with pets;
- household-with-pets index;
- income measures;
- age and income distributions when valid.

### Chewy demand context

- online customers;
- autoship customers;
- healthcare sales;
- CVC customer percent.

These values must be marked internal or restricted as appropriate. Do not expose them in public screenshots, logs, or external map providers.

### Veterinary supply context

- veterinary clinic count;
- pet households per clinic;
- visible coverage limitation.

Do not convert missing clinic counts to zero.

### Risk and labor context

- crime rank;
- environmental rank;
- labor rank.

Show these only when definitions and direction are known. Otherwise display them as unavailable or synthetic.

### Evidence quality

- source snapshot;
- evidence status;
- unknown definitions;
- missing observation dates;
- trade-area relationship state;
- sparse fields;
- synthetic substitutions;
- follow-up owner or source.

## Comparison behavior

Allow a small, bounded descriptive comparison across linked site trade areas.

Requirements:

- compare raw values only;
- show units and missingness;
- show different geography methods prominently;
- warn when dates or methods are not comparable;
- do not sort by a composite value;
- do not declare a winner;
- do not use favorable or unfavorable colors without approved directionality;
- do not calculate or imply a market score.

## Demo behavior

The completed demo must let an analyst:

1. Choose a market containing one or more demo sites.
2. View public CBSA context and clearly separate Esri-derived local evidence.
3. Select a site and inspect its linked trade area.
4. See pet-household, demographic, demand, and veterinary-supply evidence when available.
5. Open metric provenance and quality details.
6. Switch between multiple trade-area variants without the system silently choosing one.
7. Compare two or three trade-area profiles descriptively.
8. See visible warnings for missing, sparse, unconfirmed, or synthetic data.
9. Navigate to the portfolio readiness record or linked location.
10. Confirm that the view contains no score, rank, or recommendation.

## Documentation and decision records

Update:

- `data/README.md`;
- `docs/technical/data-contracts.md`;
- `docs/technical/architecture.md`;
- `docs/product/user-workflows.md`;
- `docs/product/requirements.md`;
- `docs/research/source-registry.md` if the prompt 1 source entry needs refinement;
- `docs/research/claim-ledger.md` only for claims directly supported by the supplied files;
- `docs/product/open-questions.md`;
- a new ADR if separating CBSA context from internal trade-area evidence is a material architecture or product decision.

Explicitly document:

- CBSA and trade-area separation;
- non-scored use;
- unknown observation dates;
- unknown geography method;
- supplied versus synthetic evidence;
- one-to-many trade-area relationships;
- internal-data handling.

## Tests

Add focused tests for:

- trade-area contract validation;
- reviewed, provisional, synthetic, unassigned, and one-to-many crosswalk states;
- preservation of null values;
- missing date and unit behavior;
- age-band and income-band quality checks;
- sparse competition and risk metrics;
- supplied versus synthetic labels;
- separation from public Census context;
- no scoring eligibility;
- no hidden composite or ranking;
- metric provenance detail;
- comparison comparability warnings;
- malformed fixture behavior;
- restricted-value redaction;
- navigation between market, readiness, and location views;
- accessibility and keyboard operation.

Run:

- focused tests;
- `pnpm lint`;
- the full repository test command;
- `pnpm build`.

## Visual verification

Inspect the application at desktop and narrow widths.

Verify:

- public CBSA and Esri trade-area evidence are visually distinct;
- long metric and warning labels are readable;
- unknown and synthetic states cannot be missed;
- multiple trade-area selection is understandable;
- units, dates, evidence statuses, and source details are visible;
- no restricted details appear in screenshots, browser logs, page source, or external map requests;
- charts, if used, display missing values as gaps rather than zero;
- no color implies site quality or recommendation;
- existing market and location behavior remains intact.

## Completion criteria

Complete only when:

- the UI consumes the shared prompt 1 fixture package;
- real and synthetic paths are both deterministic and explicit;
- the analyst can inspect local trade-area evidence alongside, but separate from, CBSA context;
- source, date, geography, quality, sensitivity, and missingness are visible;
- one-to-many and unresolved links remain visible;
- no score, rank, recommendation, or hidden geographic calculation exists;
- tests, lint, build, and visual verification pass;
- documentation and any required ADR are updated;
- no unrelated changes are modified or committed.

## Final response

Report:

- what was implemented;
- where the adapter, contracts, fixture, UI, tests, and docs live;
- which supplied fields are displayed;
- which supplied fields were rejected or replaced synthetically and why;
- unresolved definitions, dates, units, and geography questions;
- tests, lint, build, and visual verification results;
- confirmation that the capability is non-scored;
- confirmation that no commit was created.
