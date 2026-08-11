# Data partner outreach for geographic market intelligence

## What is connected now

The national workspace uses a versioned public layer rather than a prototype business score:

- U.S. Census CBSA universe and boundaries: 917 metropolitan and micropolitan markets.
- U.S. Census 2020–2024 ACS 5-year context: population, households, median household income, housing units, and derived population density.
- A dated AVMA state pet-ownership table remains available for explicitly labeled state-level exploration.

The five CBSA measures are declared in one catalog and share the same map, percentile operator, ranking, market drawer, source metadata, and report summary. Synthetic market attractiveness, Seattle zones, and clinic fixtures remain regression/demo cases and must not be presented as production evidence.

## Recommended conversations

The [Third Party Data Access inventory](https://chewyinc.atlassian.net/wiki/spaces/CDG/pages/4666163590/Third+Party+Data+Access) confirms that Chewy already has several live Snowflake access paths. It is an application-access inventory, not a dataset catalog, so it proves that a governed connection route exists but does not prove that any market metric is available or approved for this prototype.

Relevant live routes include Alation (Data Governance) for discovery and lineage, DBT (EDS) for analytics-ready transformations, Omni (Site Analytics) as a governed semantic/BI proof of concept, Sigma (Merchandising Analytics), Tableau (EDS), Mixpanel and Eppo (Site Analytics). N8N is listed as live but inactive; Zeta is pending; Salesforce Ads is pending deprecation. Those statuses should be verified before selecting an integration path.

### 1. David Lee and the SEO team

Start with David Lee, identified as SEO owner in the [SEO Knowledge Graph PRD](https://chewyinc.atlassian.net/wiki/spaces/MAR/pages/5172297796/SEO+Knowledge+Graph+PRD). The [SEO Tools and Codex File Catalog](https://chewyinc.atlassian.net/wiki/spaces/MAR/pages/4749001177/SEO+Tools+and+Codex+File+Catalog) documents Conductor, GSC/Botify, the SEO Metric Predictor, and SEO experimentation tooling.

Request a governed location-keyword contract rather than an unrestricted export:

- keyword/query, location ID and geography type, device, observation date;
- rank, search volume, intent/topic, landing page, SERP feature;
- source system, extraction time, coverage and limitations;
- permission to join only to approved CBSA, DMA, state, or ZIP crosswalks.

Use case to learn: which words, questions, and product needs vary materially by location, and which variation is stable enough to inform localized content or ad-message tests?

### 2. Ralph in Real Estate Research/GIS, with Matt Merrill

Internal discovery material identifies Ralph as the research/GIS partner and Matt Merrill as the early site-selection owner. See [Local Market Intelligence & Action Platform](https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5396499979/Local+Market+Intelligence+Action+Platform) and [Matt Merrill](https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5397676830/Matt+Merrill).

Request:

- governed trade-area and drive-time polygons with version and method;
- competitor/veterinary supply, current locations, candidate properties, site access and signage;
- lease, permitting, staffing, broker and inspection evidence with dates and owners;
- the actual criteria used to advance a market, submarket and site, including where judgment overrides a model.

Use case to learn: how a national screen becomes a local site decision, and which evidence must be inspected before a location can advance.

### 3. MSO Analytics & Measurement, MarTech, and Data Science/AI

The [MSO status report](https://chewyinc.atlassian.net/wiki/spaces/MAR/pages/5363041451/2026-07-31+MSO+Status+Report) names active measurement, data-model, geo-test, MMM, Hubble/Performance IQ, and Creative Understanding work.

Request:

- campaign exposure, spend, reach, frequency, audience, creative ID and outcome by approved geography and time;
- geo-experiment assignment, holdout definition, lift estimate and uncertainty;
- creative/message attributes and the reviewed interpretation of their performance;
- the canonical campaign, geography and time keys used by the certified data layer.

Use case to learn: where location changes channel efficiency or creative/message response, and whether the platform should recommend a test rather than a launch.

### 4. Brand Marketing and Consumer Insights

Use the [Brand Marketing Hub](https://chewyinc.atlassian.net/wiki/spaces/GTM/pages/4441506026/FY26+Brand+Marketing+Hub) to identify the current initiative owner; do not infer a person from the prototype.

Request market-level aided/unaided awareness, message testing, sample definition and size, field dates, confidence intervals, creative/copy variants and reviewed conclusions.

Use case to learn: what wording resonates differently by market, and when the evidence only supports a new local test.

### 5. Data Governance and EDS / Certified Data Layer owners

Start with Data Governance through Alation to locate existing certified assets, then EDS/DBT owners to publish a narrow governed Snowflake view. Use an existing approved read surface—Omni, Sigma or Tableau—where appropriate instead of creating a new broad-access service account. Request a view keyed to stable geography IDs, not direct access to arbitrary raw tables. The view should expose metric name/version, entity grain, geography, time grain, value/unit, source, freshness, evidence status, access policy and approved joins.

Use case to learn: whether customer, order, clinic, campaign and SEO data can be compared at a common grain without leaking sensitive detail or creating false precision.

## First three useful pilots

1. **Local search and language:** Compare Census market context with governed local keyword topics, then generate message-test hypotheses—not final copy claims.
2. **Campaign measurement readiness:** Show where baseline awareness and search intent exist, then identify markets eligible for a geo test with explicit holdouts.
3. **Clinic decision recursion:** Run the same evaluation protocol at market, submarket and candidate-site grain, while keeping final investment approval human-only.

## Minimum data contract

Every new source should provide: entity ID, geography type and ID, observation window, metric ID and version, raw value and unit, source ID, extraction time, evidence status, permission boundary, missingness, and a concise limitation. A source without compatible grain or lineage can be displayed as missing evidence, but cannot enter a score.
