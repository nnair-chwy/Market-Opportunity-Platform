# Agent data-source guide

Read this guide before proposing an evaluation plan, ingestion path, derived
metric, or model. The source registry is the authoritative index; this guide
explains what each source can contribute and what it cannot justify.

## How the research files work together

- `source-registry.md` identifies a source and records its reliability and use.
- `claim-ledger.md` records an evidence-backed statement, its status, and the
  product consequence. It prevents an agent from turning a plausible idea into
  a fact.
- `open-questions.md` records unresolved ownership, definition, governance, and
  feasibility decisions. A P0 question can block ingestion or modeling even
  when a file is technically available.
- This guide helps an agent choose candidate sources before it writes a plan.

Availability has a specific meaning:

| State | Meaning |
| --- | --- |
| Connected | A governed or explicitly bounded repository artifact is available for its stated use |
| Workspace only | A live view or local file was observed, but no production connector or reuse approval exists |
| Reference only | The source informs requirements or definitions but is not a model input |
| Access unconfirmed | Do not plan an ingestion as if the source can be queried or exported |
| Synthetic | Prototype behavior only; never present as real evidence |

## Planning rules

1. Start with the decision and outcome, not with the largest available file.
2. Select sources whose geography, time, population, and outcome are compatible.
3. Preserve `Confirmed`, `Reported`, `Derived`, `Hypothesis`, and `Unknown`.
4. Keep missing, zero, suppressed, stale, and unavailable values distinct.
5. Require stable IDs and a versioned crosswalk; do not join geography by fuzzy
   name matching.
6. Do not use a reference document, dashboard listing, or access-confirmed UI as
   proof that production ingestion is approved.
7. Do not train or score on a field until its owner, definition, observation
   window, allowed use, and leakage risks are resolved.

## Source-by-source briefs

### SRC-001 — Vet Clinic Site Selection plan

- **State:** Reference only.
- **Provides:** Evidence of an existing site-selection MVP plan, candidate
  features, historical validation, predictive modeling, weights, and ranking.
- **Use when:** Checking roadmap overlap, intended outcomes, or ownership.
- **Do not use as:** A dataset, approved model specification, or proof the plan
  is active.
- **Before modeling:** Resolve OQ-001 through OQ-005.

### SRC-002 — Vet Care reports and dashboards directory

- **State:** Reference only; underlying data access is not established.
- **Provides:** A directory of customer, appointment, operational, sales,
  prescription, inventory, membership, finance, network, market, and clinic
  reporting.
- **Use when:** Locating a potential governed outcome or performance owner.
- **Do not use as:** Row-level data or a confirmed API/export path.
- **Before ingestion:** Approve the exact metric, grain, maturity window, owner,
  and export.

### SRC-003 — Healthcare meeting notes

- **State:** Reference only; claims are Reported.
- **Provides:** Interview evidence about current site-selection inputs, Esri,
  ownership, and manual work.
- **Use when:** Drafting discovery questions or identifying likely source owners.
- **Do not use as:** A production requirement or numeric model input.
- **Before implementation:** Validate each relevant statement with the named
  operational owner.

### SRC-004 — CVC Site Experience GTM Playbook

- **State:** Reference only.
- **Provides:** Launch-marketing workflow, a 30-minute drive-time targeting
  concept, booking/click-through measures, guardrails, and a pointer to current
  launch dates.
- **Use when:** Defining Marketing or launch-evaluation workflow and outcomes.
- **Do not use as:** Campaign performance data, an approved site trade area, or
  a current opening-date table.
- **Before ingestion:** Pair with an approved campaign export and current Site
  Pipeline data.

### SRC-005 — CVC Clinic Creation Runbook

- **State:** Reference only.
- **Provides:** One deterministic system-creation workflow and validation steps.
- **Use when:** Separating site evaluation from downstream opening execution.
- **Do not use as:** Market, demand, or site-performance evidence.

### SRC-006 — First Clinic Opening Risk Plan

- **State:** Historical reference only.
- **Provides:** Launch dependencies, monitoring points, risks, and rollback
  thinking from an earlier opening.
- **Use when:** Designing visible constraints, guardrails, and audit history.
- **Do not use as:** Proof that current owners, thresholds, or processes are the
  same.

### SRC-007 — CVC Atlanta Sites Understanding

- **State:** Reference only; qualitative evidence.
- **Provides:** Local awareness, preferences, switching triggers, availability,
  cost, reviews, trust, and contextual research around an underperforming site.
- **Use when:** Identifying questions a numeric evaluation may miss.
- **Do not use as:** A numeric feature, label, or universal Atlanta conclusion.
- **Modeling treatment:** Retain as qualitative evidence or an investigation
  prompt unless a governed coding protocol is approved.

### SRC-008 — Staffing and location-configuration notes

- **State:** Reference only; claims are Reported.
- **Provides:** Possible staffing formulas and manual configuration effort.
- **Use when:** Identifying feasibility constraints or adjacent automation work.
- **Do not use as:** An approved staffing formula.
- **Before calculation:** Confirm formula, denominator, owner, and applicable
  clinic stages.

### SRC-009 — Public CVC locations

- **State:** Live public reference.
- **Provides:** Current public-facing clinic-location identity.
- **Use when:** Verifying public clinic presence or building a reviewed identity
  crosswalk.
- **Do not use as:** Pipeline status, opening readiness, capacity, performance,
  or proof that an address is suitable for geospatial scoring.
- **Refresh rule:** Read the live page rather than copying a permanent list.

### SRC-010 — CVC Customer Geospatial Analysis dashboard

- **State:** Access unconfirmed.
- **Potentially provides:** Customer and market overlays.
- **Use when:** Planning owner and access discovery only.
- **Do not assume:** Export, API, field definitions, licensed reuse, customer
  grain, or model eligibility.
- **Before ingestion:** Resolve OQ-008, OQ-018 through OQ-024, and privacy-safe
  aggregation.

### SRC-011 — CVC Vet Competition dashboard

- **State:** Access unconfirmed.
- **Potentially provides:** Veterinary-competition context.
- **Use when:** Planning GIS discovery and competitor-definition validation.
- **Do not assume:** Physical-location deduplication, corporate classification,
  lifecycle filters, geography method, export, or API access.

### SRC-012 — CVC Site Pipeline

- **State:** Access unconfirmed.
- **Potentially provides:** Current clinic dates and pipeline status.
- **Use when:** Designing a current launch cohort or maturity rule after access
  and ownership are confirmed.
- **Do not use as:** A performance outcome or site score.

### SRC-013 — U.S. Census Geocoder documentation

- **State:** Official public reference.
- **Provides:** Address-matching behavior and limitations.
- **Use when:** Labeling a U.S. address as Census-matched and requiring reviewer
  confirmation.
- **Do not infer:** Structure existence, deliverability, parcel identity,
  suitability, or a trade area from an interpolated coordinate.

### SRC-014 — July 2023 CBSA delineation files

- **State:** Connected, public, market-context only.
- **Provides:** Versioned metropolitan and micropolitan market IDs, names,
  principal cities, component counties, and state coverage.
- **Use when:** Establishing the U.S. mainland market-universe spine and exact
  five-digit CBSA joins.
- **Do not use as:** Demand, growth, ranking, scoring, trade area, or service
  area.
- **Model eligibility:** None.

### SRC-015 — 2024 CBSA cartographic boundary file

- **State:** Connected, public, market-context only.
- **Provides:** Display geometry and source land/water area joined by exact CBSA
  code.
- **Use when:** Rendering the validated public market universe.
- **Do not use as:** Drive-time, trade-area, service-area, or property geometry.
  Simplified browser polygons are not authoritative area calculations.
- **Model eligibility:** None.

### SRC-016 — 2024 ACS 5-year CBSA context

- **State:** Connected, public, market-context only.
- **Provides:** 2020–2024 period estimates for population, households, median
  household income, and housing units; density is deterministically derived.
- **Use when:** Supplying descriptive context beside an evaluation.
- **Do not infer:** Current point-in-time population or growth. Do not silently
  use context variables as a score or model input.
- **Model eligibility:** None until a separate decision explicitly changes the
  approved contract.

### SRC-017 — Supplied Esri internal-demo snapshot

- **State:** Connected only as a minimized internal-demo fixture.
- **Provides:** Approved stable site identity, selected physical-site evidence,
  provisional site/trade-area relationships, and selected aggregate trade-area
  context.
- **Use when:** Demonstrating evidence readiness, missingness, conflicts,
  comparisons, and human review.
- **Do not use as:** Production truth, a scored model input, a verified trade
  area, or a customer/clinic-level dataset. Raw exports remain outside Git.
- **Before modeling:** Confirm observation dates, methods, owners, outcomes,
  relationship ambiguities, and allowed use.

### SRC-018 — Google Ads geographic reporting

- **State:** Workspace only; live read-only manager access, sixteen U.S.
  30-day exports, and one Canada diagnostic are confirmed. Raw files stay
  outside Git.
- **Initial diagnostic:** The Canada Search/Shopping export at
  `/Users/xwang1/Downloads/Location report.csv` is not a U.S. evaluator input.
  It demonstrated file shape and sparse target/campaign combinations only.
- **U.S. local files:**
  - `Location report (1).csv` — Vet Clinic Search, ZIP/radius target detail,
    SHA-256 `7d5f7c4a9541fbf6e6071a8f18a1942bb30d84a95ef9e98f18065fc80e9a6037`.
  - `Location report (2).csv` — CarePlus Search/Shopping, state target detail,
    SHA-256 `1063c31143d73769281a231e0778961f814ada931c8aa586cfa97647e25aa783`.
  - `Location report (3).csv` — Connect with a Vet Search/Shopping, state
    target detail, SHA-256
    `d11e0c8b2fcb9c4d918842ce3e4acc069fdaa78bb6f98a0ac4bff2dee6219ff3`.
  - `Location report (4).csv` — Get Real, metro and finer target detail,
    SHA-256 `11c5043a380da4d3a12f84b26e7bca4772548ef6b66f1a8c4609640e262a0336`.
- **Provides:** Configured location, campaign, ad group, impressions,
  interactions, interaction rate, cost, conversion rate, conversions, and cost
  per conversion.
- **Account inventory:**
  - **Primary U.S. demand source:** Chewy Search/Shopping, but its configured
    targets are primarily country-level. Use existing DMA reporting or matched
    and physical-location data rather than the target table.
  - **Direct CVC source:** Vet Clinic Search. Targets include clinic-market
    radii and ZIPs and are useful for validating clinic campaign scope.
  - **Adjacent health sources:** CarePlus and Connect with a Vet have meaningful
    state-level targeting. Pharmacy is country-targeted and needs DMA/matched
    reporting for geographic use.
  - **Conditional regional source:** Get Real includes metro-level campaigns;
    clarify its business program and outcome before combining it with core
    demand.
  - **Awareness/app sources:** Video and MAI measure different funnels and must
    not be compared directly with Search conversion efficiency.
  - **Vendor-funded sources:** Sponsored Ads Offsite and Symbiosys can support
    category or manufacturer investigation only with sponsorship controls.
  - **Exclude by default:** Canada for the U.S. evaluator; EC Search/Shopping
    test/development campaigns; inactive Promotions, Retargeting, DNU Sponsored
    Ads; and The Zoo manager with no running campaigns in the observed window.
- **Use when:** Profiling geographic campaign delivery, response, spend, and
  approved conversion efficiency; validating campaign target design; and
  designing a controlled Marketing test.
- **Do not infer:** Total demand, population penetration, organic behavior,
  causal lift, pricing power, customer residence, competitor activity, or site
  suitability.
- **Critical distinction:** The local CSVs are configured-target performance.
  Nationwide targets show only `United States`, but Google Ads has a separate
  `When and where ads showed > Matched locations` report and API physical-user
  views. Never blend target, physical-presence, and interest geography.
- **Before ingestion/modeling:** Resolve OQ-033 through OQ-037, establish a
  conversion-action dictionary and campaign taxonomy, approve reuse and
  retention, and resolve OQ-038 through OQ-040.
- **Detailed design:** See `google-ads-geographic-signal-export.md`.
- **Export inventory and usage:** See `google-ads-export-manifest.md`. Agents
  must follow its geography ladder and conversion-segment warning before using
  a local CSV.

### SRC-019 — Official Google Ads geographic documentation

- **State:** Official public reference.
- **Provides:** Semantics for configured targets, physical user location,
  location of interest, geographic view types, and API reporting resources.
- **Use when:** Designing and validating the SRC-018 contract.
- **Do not use as:** Account performance data or evidence that internal reuse is
  approved.

### SRC-020 — Internal DMA data product

- **State:** Documented internal candidate; workspace access to the tables is
  not yet confirmed.
- **Provides:** Google and other platform DMA data, cross-platform DMA-name
  parity, a maintained Nielsen DMA/ZIP mapping, and
  `vw_spend_by_dma` for spend, clicks, and impressions.
- **Use when:** Planning the primary geographic Marketing input and avoiding a
  redundant manual Google Ads pipeline.
- **Do not assume:** Sandbox objects are production, complete, licensed for this
  product, refreshed on an approved SLA, or accessible to this workspace.
- **Before ingestion:** Confirm owner, environment, data dictionary, refresh,
  history, account coverage, physical-versus-interest semantics, and access.

### SRC-021 — DMA first-party and third-party performance summary

- **State:** Completed phase-one internal analysis; candidate integration.
- **Provides:** A documented full join by date, campaign ID, and DMA between
  platform spend/clicks/impressions and web sessions, engaged and bounce
  sessions, add-to-cart, add-to-Autoship, Autoship orders, and orders.
- **Use when:** Building a weekly DMA panel and evaluating response beyond
  Google-attributed conversions.
- **Known gap:** Some web sessions lack DMA; app DMA is nearly blank in the
  documented source. Campaign/network fields depend on campaign taxonomy.
- **Do not infer:** Missing DMA is zero demand, platform conversions equal
  business incrementality, or the phase-one view is production-ready.

### SRC-022 — Chewy Paid Search Geo Test 2026

- **State:** Current internal experiment plan with prior-test context.
- **Provides:** DMA dark, heavy-up, and BAU cell design; power and cooldown
  concepts; business KPIs; and controls for organic/direct substitution,
  auction pressure, and overlapping campaign changes.
- **Use when:** Designing causal evaluation, market-test candidates, guardrails,
  and a historical shadow case.
- **Do not use as:** A finalized budget, threshold, or proof branded search has
  no value. Many current assumptions remain provisional.

### SRC-023 — Campaign taxonomy fields

- **State:** Internal reference; current stewardship must be confirmed.
- **Provides:** Campaign ID plus country, entity, budget, program, channel,
  network, funnel, tactic, goal, platform, category, sub-category, and
  manufacturer type.
- **Use when:** Forming comparable cohorts and excluding incompatible campaigns.
- **Required exclusions:** Test/development, inactive, Canada, remarketing,
  app-install, awareness-only, vendor-funded, and incompatible entity/outcome
  cohorts unless the decision explicitly calls for them.

### SRC-024 — CVC brand-search optimization plan

- **State:** Current internal test plan; thresholds and authority unresolved.
- **Provides:** A clinic-market decision combining paid brand spend, organic and
  local substitution, auction pressure, repeat-customer rate, months open,
  appointment volume, and operational stability.
- **Use when:** Designing CVC market tests and recommendation guardrails.
- **Primary outcome:** Total appointments by clinic or market, not platform
  conversions alone.
- **Do not use as:** Permission to turn campaigns off, suppress customers, or
  define clinic maturity without owner approval.

### SYN-CLINIC-LANDSCAPE-001 — Synthetic clinic landscape

- **State:** Synthetic, stale, prototype only.
- **Provides:** A safe demonstration of source-account versus estimated
  physical-location counts, classification, lifecycle filtering, and repeated
  coordinates.
- **Do not present as:** Supplied clinic evidence or a geospatial calculation.

### SYN-SEATTLE-SUBMARKET-001 — Synthetic Seattle submarkets

- **State:** Synthetic, prototype only.
- **Provides:** Seven analyst-defined hypotheses, synthetic indexes, and
  deterministic overlapping display areas.
- **Do not present as:** Approved neighborhoods, trade areas, service areas, or
  real scoring evidence.

### SYN-SEATTLE-BROKER-001 — Synthetic broker directory

- **State:** Synthetic, prototype only.
- **Provides:** A safe workflow demonstration with fictional profiles and
  `demo://` contacts.
- **Do not use for:** Verification, selection, contact, or outreach.

## Recommended source combinations

### Public market-context plan

Use SRC-014 for the market spine, SRC-015 for display geometry, and SRC-016 for
non-scored descriptive context. Do not describe the combination as market
attractiveness.

### Candidate evidence plan

Use the minimized SRC-017 fixture for evidence-readiness and comparison
workflow. Add a governed outcome from a source discovered through SRC-002 only
after definition and approval. Do not train a site model on SRC-017 alone.

### Marketing geographic-signal plan

Start with SRC-020 and SRC-021: confirm access to the existing DMA spend and
first-party outcome views before creating any new ingestion. Use SRC-023 to
form comparable campaign cohorts. Use SRC-019 to validate three separate
SRC-018 concepts: physical presence, location of interest, and configured
targets. Treat the U.S. UI exports as validation fixtures, not the primary
pipeline. Resolve the DMA-to-CBSA relationship, then use SRC-022 for historical
shadow evaluation and controlled geo-test design before setting recommendation
thresholds.

### Clinic launch or performance plan

Use SRC-004 for workflow and guardrails, SRC-009 for reviewed public identity,
and an approved outcome export discovered through SRC-002. SRC-017 may add
descriptive site evidence. Current pipeline timing requires approved SRC-012
access. Use SRC-018 Vet Clinic target detail only for campaign-scope validation;
use SRC-024 to define total appointments, maturity, organic/local substitution,
competition, and rollback requirements. This plan is blocked until the outcome,
maturity window, clinic-market relationship, and owner are confirmed.

## Required plan output

An agent proposing ingestion or a model must state:

- decision, user, and outcome;
- selected source IDs and why each is eligible;
- availability and approval state;
- entity, geography, time, and population grain;
- stable keys and crosswalk versions;
- observation, prediction, and maturity windows;
- missingness, suppression, leakage, freshness, and quality rules;
- deterministic baseline before any learned model;
- training/evaluation split and historical shadow cases;
- unsupported claims and blocking open-question IDs; and
- human review, audit, monitoring, rollback, and allowed actions.
