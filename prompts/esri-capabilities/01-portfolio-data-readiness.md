# Implementation prompt 1: Portfolio data-readiness capability

You are working in:

`/Users/nnair/Documents/Retail and Clinic Location Evaluator`

Implement an analyst-facing, non-scored portfolio data-readiness capability using a minimized fixture package derived from the supplied Esri exports. This is the first of three sequential capabilities. It must establish the shared ingestion, provenance, validation, and fixture foundation used by the later market-profile and candidate-brief capabilities.

Do not commit changes. Preserve all unrelated work in the repository.

## Fixed product decisions

- Modify the current repository and deliver a complete working implementation.
- The intended user is a clinic real-estate or site-selection analyst.
- Use the supplied Esri records as the primary source.
- Do not copy the raw exports wholesale into Git.
- Create a minimized, versioned, in-repository fixture package derived from the supplied records.
- If required definitions, approvals, or relationships are missing, fail closed for the real-data interpretation and create an explicitly synthetic fallback using the same contract.
- This capability measures evidence readiness and completeness only.
- It must not calculate site attractiveness, market attractiveness, a site score, a ranking, a recommendation, or a lease decision.
- Implement adapters, contracts, UI, tests, documentation, decision-log updates, and visual verification.
- Missing data remains `null` or visibly unknown. Never convert missing data to zero.
- Keep `Confirmed`, `Reported`, `Derived`, `Hypothesis`, and `Unknown` evidence distinct.

## Supplied source files

Read these files from their current locations:

- `/Users/nnair/Documents/Codex/2026-07-30/hwo/outputs/chewy_location_demo_data/clinic_locations_full.csv`
- `/Users/nnair/Documents/Codex/2026-07-30/hwo/outputs/chewy_location_demo_data/clinic_locations_demo.csv`
- `/Users/nnair/Documents/Codex/2026-07-30/hwo/outputs/chewy_location_demo_data/master_sites_full.csv`
- `/Users/nnair/Documents/Codex/2026-07-30/hwo/outputs/chewy_location_demo_data/master_sites_demo.csv`
- `/Users/nnair/Documents/trade ares field schema.xlsx`

The Excel filename is misleading. Treat it as a trade-area data export containing 592 records and 70 fields, not as a field-definition schema.

Use the existing analysis workbook as supporting context:

`outputs/esri-export-inventory/esri_data_inventory_and_cleaning_plan.xlsx`

Do not treat that workbook as a source system or substitute it for validation of the supplied files.

## Mandatory reading before editing

Read completely:

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/product/mvp-scope.md`
4. `docs/product/requirements.md`
5. `docs/product/user-workflows.md`
6. `docs/product/open-questions.md`
7. `docs/technical/data-contracts.md`
8. `docs/technical/ai-boundaries.md`
9. `docs/technical/security-and-governance.md`
10. `docs/technical/architecture.md`
11. `docs/research/claim-ledger.md`
12. `docs/research/source-registry.md`
13. `data/README.md`
14. `docs/decisions/README.md`

Inspect the current frontend, data adapters, evidence components, tests, and package scripts before proposing architecture changes. Reuse existing patterns wherever possible.

If implementation requires a new dependency or a material architecture change beyond the existing adapter, fixture, and React patterns, present the proposed change and pause for explicit user approval before proceeding.

## Mandatory prerequisite audit

Before implementation, produce a concise audit in your working notes covering:

1. Source file availability and SHA-256 hashes.
2. Actual row and column counts.
3. Whether each demo CSV is an exact row-for-row projection of its full CSV.
4. Candidate row keys and their uniqueness:
   - clinic: `clinic_id`, `clinic_key`, `golden_clinic_id`, and `objectid`
   - master site: `GlobalID`, `ESRI ID`, `Site Code`, and `Business ID`
   - trade area: `GlobalID`, `System ID`, and `ESRI_ID`
5. Duplicate rows, duplicate names, duplicate coordinates, and unnamed records.
6. Field coverage and all-null fields.
7. Fields that contain direct identifiers, employee details, commercially sensitive terms, or unapproved precise coordinates.
8. Missing field definitions, units, vintages, denominators, geography methods, and owners.
9. The current repository rules governing internal data.
10. Whether an existing source-registry entry can represent the supplied export. If not, add the next sequential source ID without renumbering existing entries.

Do not ask the user to repeat information already available in the files or repository.

## Fail-closed and synthetic-fallback behavior

The user has authorized use of the supplied records for this prototype, but this does not establish organizational governance approval for every field.

Apply these rules:

- Real supplied values may enter the in-repository fixture only when they are aggregate, non-customer-level, necessary for the demo, and not prohibited by `data/README.md`.
- Do not check in raw phone numbers, email addresses, account owners, employee identifiers, customer or pet identifiers, medical information, landlord identities, lease terms, rent values, or unrestricted copies of the raw source rows.
- Do not include precise customer coordinates under any circumstance.
- Treat precise pipeline or candidate-site coordinates as unapproved unless the source and repository evidence explicitly establish approval. If unapproved, use deterministic synthetic coordinates or public current-location coordinates and label them `Hypothesis` or `synthetic`.
- Do not invent a source observation date. The file-receipt date is not the metric observation date.
- Do not invent a trade-area method, radius, drive time, or geometry meaning.
- If the real field cannot be interpreted safely, retain its source-field metadata in the inventory but exclude its real values from the fixture.
- Create a synthetic counterpart with a clearly synthetic source ID, explicit synthetic observation date, documented generation method, and the same schema needed by the UI.
- The UI must clearly distinguish supplied `Reported` evidence from synthetic fallback data.

## Required fixture package

Create a versioned package under `data/sample/esri/2026-07-30/` unless an existing repository convention requires a more compatible but equally clear path. Document any deviation.

At minimum, include:

- `manifest.json`
- `field-catalog.json`
- `portfolio-readiness.json`
- `site-identities.json`
- `site-trade-area-crosswalk.json`
- `rejected-or-review-records.json`
- synthetic fallback records where required

The manifest must record:

- source filenames without copying source contents;
- source SHA-256 hashes;
- source row and column counts;
- receipt or extraction date;
- transformation version;
- build timestamp;
- output hashes and counts;
- retained and excluded fields;
- sensitivity and allowed use;
- scoring eligibility set to `none`;
- known limitations;
- unresolved prerequisites;
- whether each output value is supplied, derived, or synthetic.

Add a deterministic build script rather than manually crafting generated fixture files. Use the repository runtime and existing dependencies. The source paths must be supplied through explicit command-line arguments or a narrowly scoped input-directory option. Do not hard-code a user's absolute filesystem path into the build script. Tests must use small repository fixtures, not the external raw files.

Prefer the existing CSV and Excel tooling already available in the repository. Do not add a new dependency without first explaining why the existing runtime cannot support the requirement and obtaining explicit approval.

The build must write to temporary files first and replace final outputs only after validation succeeds.

## Required contracts

Introduce or extend TypeScript contracts for:

### Source snapshot

- stable snapshot ID;
- source ID;
- source filename;
- SHA-256;
- receipt date;
- source row and field counts;
- transformation version;
- sensitivity;
- allowed use;
- scoring eligibility;
- limitations.

### Field definition and readiness requirement

- canonical field ID;
- source field name;
- business label;
- definition status;
- source;
- unit or `null`;
- observation date or `null`;
- geographic grain or `unknown`;
- required workflow stage;
- sensitivity;
- allowed use;
- evidence status;
- quality rules;
- scoring eligibility fixed to `none`.

### Portfolio site readiness

- stable site ID;
- safe display label;
- brand or entity type when approved;
- workflow stage;
- source linkage state;
- trade-area linkage state;
- expected evidence count;
- available evidence count;
- missing count;
- warning count;
- rejected count;
- restricted count;
- stale count;
- readiness percentage;
- blocking issues;
- follow-up items;
- provenance.

Readiness percentage must be a deterministic completeness calculation, not a site-quality score. Label it accordingly in code and UI.

### Readiness issue

- issue ID;
- site ID;
- field or relationship;
- status;
- severity;
- reason;
- expected source or owner;
- evidence status;
- sensitivity;
- suggested follow-up;
- resolution state.

## Required deterministic rules

Implement and test:

- required-field coverage by workflow stage;
- explicit distinction between unavailable, missing, rejected, restricted, stale, and not-required;
- row-key uniqueness;
- invalid or unresolved site-to-trade-area relationships;
- duplicate source identifiers;
- duplicate names without automatic merging;
- repeated clinic coordinates without automatic deletion;
- missing observation dates;
- unknown units;
- unknown trade-area method;
- prohibited-field exclusion;
- output-manifest reconciliation;
- synthetic-fallback labeling;
- stable ordering and reproducible output.

Do not silently repair invalid joins or identity conflicts.

## Analyst-facing UI

Add a portfolio data-readiness view that fits the existing Markets and Locations workflow. Inspect the current application and choose the smallest coherent integration.

The view must provide:

- a clear title such as `Portfolio data readiness`;
- an explicit statement that readiness is not site attractiveness;
- summary counts for ready for research, needs review, and blocked;
- filters for brand or entity type, workflow stage, readiness state, and issue type when those values are available;
- a search control;
- a list or table of sites;
- deterministic readiness percentage;
- counts of missing, warning, rejected, restricted, and unresolved-link evidence;
- a selected-site detail panel;
- the expected source or owner for each missing item;
- source metadata and evidence status;
- visible synthetic labels;
- a link or action that moves the analyst into the market or location workflow when an approved relationship exists;
- accessible empty, loading, no-match, malformed-data, and restricted states.

Do not use green to imply that a site is attractive. If color is used, it must represent data readiness only and include a text label.

Reuse the existing evidence and missing-information components where appropriate. Do not create a second incompatible evidence system.

## Demo behavior

The completed demonstration must let an analyst:

1. Open the portfolio readiness view.
2. See how many records are ready for descriptive research, need review, or are blocked.
3. Filter to records with unresolved trade-area links.
4. Select a site and see exactly which fields or relationships are missing.
5. See the expected source or owner for each missing item.
6. Distinguish supplied `Reported` evidence from synthetic fallback evidence.
7. Navigate to the appropriate market or location context when available.
8. Confirm that no readiness state is presented as a site recommendation or score.

## Documentation and decision records

Update:

- `data/README.md` with the new fixture layout and rebuild command;
- `docs/technical/data-contracts.md`;
- `docs/technical/architecture.md`;
- `docs/product/user-workflows.md`;
- `docs/product/requirements.md`;
- `docs/research/source-registry.md`;
- `docs/research/claim-ledger.md` only where the supplied files support a new carefully bounded claim;
- `docs/product/open-questions.md` to record which questions remain unresolved, not to mark them resolved without evidence;
- the decision log with a new proposed or accepted ADR if fixture governance, readiness calculation, or architecture materially changes.

Do not state that organizational access, API integration, or production use has been approved.

## Tests

Add focused tests for:

- build reproducibility;
- source hash and row-count reconciliation;
- prohibited-field exclusion;
- stable IDs;
- duplicate-key and duplicate-name handling;
- repeated-coordinate handling;
- unresolved crosswalk handling;
- readiness-stage requiredness;
- each missingness state;
- synthetic fallback behavior;
- source and evidence labels;
- rendered readiness summary and selected-site detail;
- accessibility labels and keyboard navigation for new controls.

Run:

- focused tests during development;
- `pnpm lint`;
- the repository test command;
- `pnpm build`.

If the build requires a local-server permission already documented by the environment, use the approved workflow. Do not weaken tests to make them pass.

## Visual verification

Run the application and inspect the capability in a browser at desktop and narrow widths.

Verify:

- headers and values are not clipped;
- long issue descriptions wrap cleanly;
- filters are usable;
- readiness labels are visible without relying only on color;
- source and synthetic labels are readable;
- selected and focused states are accessible;
- no sensitive values appear in the UI, page source, console, logs, or generated fixture;
- existing market, location, address, map, evidence, and scoring-sandbox flows still work.

## Completion criteria

Complete only when:

- a deterministic, minimized, versioned fixture package exists in the repository;
- raw source files remain outside the repository;
- prohibited fields are absent from checked-in data;
- every retained field has provenance and a readiness interpretation;
- synthetic fallbacks are explicit;
- the portfolio readiness UI works for an analyst;
- no site score, ranking, or recommendation is created;
- tests, lint, build, and visual verification pass;
- documentation and any required ADR are updated;
- no unrelated changes are modified or committed.

## Final response

Report:

- what was implemented;
- exact fixture and UI locations;
- which supplied fields were retained or excluded;
- which prerequisites remain unresolved;
- real versus synthetic data used;
- tests, lint, build, and visual verification results;
- any remaining governance or interpretation risks;
- confirmation that no commit was created.
