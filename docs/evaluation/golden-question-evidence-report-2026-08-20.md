# Thursday golden-question evidence report

## Outcome

The integrated worktree now has a governed, reproducible four-lead aggregate
snapshot and an explicit source/capability gap matrix. **Marketing is the
strongest Thursday question**, followed by Pricing, then CVC. All findings stop
at investigation; none supports a material action.

## Application connection status

The snapshot is connected to the evaluation executor, not merely documented.
When a user asks one of the three national golden-question families without
preselecting a CBSA, the planner routes the request to the frozen snapshot and
returns a `partial` evidence response with stable source, snapshot, query, and
calculation versions.

- Marketing returns the Philadelphia and San Antonio candidate rows and
  source-linked metrics from `SRC-018`.
- Pricing returns the Kankakee candidate row from `SRC-025` and four national
  Zeus context measures from `SRC-036`: 250,000 exported product SKUs, 313,351
  UI product entries, 79.78% export coverage, and five current regular
  exceptions.
- CVC returns the Santa Clara supplied trade-area candidate from `SRC-017`.
- Every path carries the `investigation_leads_only_no_material_action`
  authority boundary and family-specific missing evidence and unknowns.

This connection does **not** mean that every source file is searched at runtime.
The application executes the reviewed aggregate snapshot built from those
files. It does not yet perform arbitrary CSV discovery, generate new SQL, or
join Zeus to a destination geography on demand.

The remaining release check is a clean browser run of all three paths, including
the downloaded packet. Use `thursday-manual-demo-checklist.md` and record any UI
copy, routing, rendering, or packet mismatch before the Thursday review.

## New evidence found or placed

- Local source consolidation: all 54 files from the approved source packages
  are now available inside the integrated worktree's ignored `data/approved/`
  paths: 17 Google Ads files (245,275,907 bytes), 19 Snowflake files
  (359,591,681 bytes), 15 SEO files (33,441,233 bytes), and three Zeus files
  (73,822,007 bytes). The tracked
  `data/contracts/local-approved-source-inventory.json` records every path,
  byte count, SHA-256 hash, contract, and allowed-use package. All 41 files with
  manifest-declared hashes verified exactly.

- Zeus: two sanitized 2026-08-18 files are stored locally under the ignored
  `data/approved/zeus-ui/2026-08-18/sanitized/` path. The product file has
  250,000 rows versus 313,351 UI entries; the regular-exception file has five
  current rows. `Category Owner` remains removed. Zeus fields are national SKU
  context and never localize Chewy outcomes.
- Snowflake: Dream Weaver override history/latest state and the Bungee
  competitor-match view are now cataloged. Safe aggregate discovery found
  1,623,421 override-history rows (~11,137 IDs), 12 latest overrides, and
  24,095,886 match rows (~487,753 IDs), latest `MATCH_TIME` 2026-02-03 12:28.
  No creator, payload, URL, SKU, address, customer, or order rows were exported.
- Snowflake regional outcome path: the candidate address join covered 952,017
  order lines for 2026-08-16, but returned one masked postal value and null
  state. This is recorded as blocked, not treated as regional coverage.
- GIS: the signed-in Data Dog House catalog documents Esri demographics/market
  potential, Placer.ai visitation, ChainXY opening/closure history, and
  Lightcast labor data. A current `CVC` dataset search returned no exposed
  match; direct checks of the documented Customer Geospatial and Vet
  Competition items returned permission denied, and the demographics app did
  not expose a verified downloadable artifact. No token or raw GIS record was
  saved. The minimized `data/sample/esri/2026-07-30` fixture remains the only
  agent-readable GIS evidence.
- Governed aggregate: `golden-question-evidence-2026-08-18-v1` contains two
  Marketing leads, one Pricing monitoring lead, and one CVC research lead. It
  is 6,392 bytes, contains no sensitive identifiers, and has SHA-256
  `fddba639e09ae61727e00f35857c14b37136465b76c6304692a09554bad35625`.

## Evidence-strength ranking and next authority step

1. **Marketing.** Promote from paid-search response lead to first-party
   validation candidate with an approved weekly DMA × comparable-campaign panel,
   stable DMA/campaign IDs, campaign taxonomy, first-party outcome definitions,
   lag/finality, unmatched coverage, and auction/budget/promotion/inventory
   controls.
2. **Pricing.** Promote from one-ZIP monitoring/data-quality lead to bounded
   commercial investigation with repeated approved representative-ZIP
   snapshots, reviewed match labels, matched-basket composition, scrape/config
   timing, price/override/promotion/inventory history, plus a privacy-safe weekly
   destination-geography outcome carrying orders, units, sales, discounts,
   returns and approved cost/contribution completeness.
3. **CVC.** Promote from research lead to clinic-access investigation candidate
   with owner-approved trade-area method/vintage, stable site/physical-clinic
   identity, clinic lifecycle/deduplication, metric definitions/dates, current
   pipeline/maturity, and an approved privacy-safe access/outcome measure.

Detailed magnitudes, contrary evidence, caveats, owners, KPIs, and stop rules
are in `golden-question-geo-findings-2026-08-20.md`.

## Highest-value remaining gaps

1. Marketing first-party outcomes and comparable-campaign/intervention panel.
2. Pricing privacy-safe regional commercial outcome and approved unmasked
   order-geography view; no customer/address identifiers should leave Snowflake.
3. Pricing representative-ZIP, match-reliability, override-effective-time, and
   promotion/inventory timing contracts.
4. CVC metric/trade-area definitions and current clinic-access outcome.
5. An approved operational geography bridge. The current
   `zip-zcta-centroid-cbsa-v1` method is versioned and reproducible but remains
   an internal-shadow approximation.

## Delivered, deferred, and additional work

| Category | Result |
| --- | --- |
| Delivered as planned | Frozen evidence package; deterministic candidate selection; source/quality/coverage contracts; one strong Marketing path; bounded Pricing and CVC paths; contrary evidence; owners, validation steps, proposed KPI gates, and stop rules |
| Still required for release | Clean browser smoke run for all three perspectives; downloaded-packet reconciliation; owner review of thresholds and wording; final selection of report screenshots/findings |
| Deferred from the final vision | Connected regional orders/new customers/contribution; approved campaign taxonomy and intervention panel; Pricing local outcomes and intervention history; CVC capacity/appointments/maturity/economics; approved production crosswalk; recurring ingestion and enterprise approvals |
| Additional work beyond the original evidence plan | National Zeus product/exception context; Dream Weaver override discovery; Bungee match-state discovery; safe regional-outcome join probe; consolidated recommended-question registry and typeahead; best-available partial-answer behavior |

## Reproducible steps

From the repository root:

```bash
GOLDEN_QUESTION_EVIDENCE_GENERATED_AT=2026-08-18T20:57:36.861Z \
  node --experimental-strip-types scripts/build-golden-question-evidence.ts
shasum -a 256 data/approved/golden-question-evidence/current.json
node -e "JSON.parse(require('fs').readFileSync('data/approved/golden-question-evidence/current.json','utf8')); console.log('golden snapshot JSON OK')"
node -e "for (const f of ['data/contracts/golden-question-evidence/manifest.json','data/contracts/pricing-snowflake/source-catalog.json','data/contracts/pricing-snowflake/export-manifest.json','data/contracts/pricing-snowflake/validation-profile.json','data/contracts/zeus-ui/export-manifest.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('contract JSON OK')"
node --experimental-strip-types scripts/verify-local-approved-sources.ts
git diff --check
```

Run the two read-only Snowflake discovery files in a governed worksheet:

```text
data/contracts/pricing-snowflake/queries/10_regional-outcome-join-discovery.sql
data/contracts/pricing-snowflake/queries/11_pricing-controls-and-match-discovery.sql
```

Do not run the package wrapper in an offline fresh checkout until dependencies
are installed; the builder itself uses only Node built-ins.

## Files created

- `data/approved/README.md`
- `data/approved/golden-question-evidence/current.json`
- `data/contracts/golden-question-evidence/README.md`
- `data/contracts/golden-question-evidence/manifest.json`
- `data/contracts/local-approved-source-inventory.json`
- `data/contracts/zeus-ui/README.md`
- `data/contracts/zeus-ui/export-manifest.json`
- `data/contracts/pricing-snowflake/queries/10_regional-outcome-join-discovery.sql`
- `data/contracts/pricing-snowflake/queries/11_pricing-controls-and-match-discovery.sql`
- `docs/evaluation/golden-question-data-gap-matrix-2026-08-20.md`
- `docs/evaluation/golden-question-geo-findings-2026-08-20.md`
- `docs/evaluation/golden-question-evidence-report-2026-08-20.md`
- `scripts/build-golden-question-evidence.ts`
- `scripts/build-local-approved-source-inventory.ts`
- `scripts/verify-local-approved-sources.ts`
- `tests/data/golden-question-evidence.test.ts`

## Files updated

- `.gitignore`
- `package.json`
- `data/AGENT_START_HERE.md`
- `data/contracts/pricing-snowflake/README.md`
- `data/contracts/pricing-snowflake/available-data-matrix.md`
- `data/contracts/pricing-snowflake/export-manifest.json`
- `data/contracts/pricing-snowflake/source-catalog.json`
- `data/contracts/pricing-snowflake/validation-profile.json`
- `docs/research/claim-ledger.md`
- `docs/research/source-registry.md`

The existing Sheila/Nik strategy documents were not modified by this work.
Shared metric and geography meanings are explicitly queued for joint review in
the gap matrix rather than changed silently.
