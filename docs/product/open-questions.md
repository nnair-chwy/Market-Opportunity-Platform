# Open questions

Questions are ordered by their ability to invalidate or materially change the MVP.

| ID | Priority | Question | Proposed owner | Blocks |
| --- | --- | --- | --- | --- |
| OQ-001 | P0 | Is the June 2026 `Vet Clinic Site Selection` plan active, staffed, or implemented, and who owns it? | RASE / plan owner | Product scope |
| OQ-002 | P0 | Should this repo provide a comparison interface around that model, extend its research, or stop? | Site-selection business and technical owners | Product scope |
| OQ-003 | P0 | What exact decision and user should the first prototype support? | Real-estate analytics | Workflow |
| OQ-004 | P0 | What is the agreed clinic performance outcome, observation window, and maturity rule? | CVC Analytics and Finance | Data and evaluation |
| OQ-005 | P0 | Are historical site features and outcomes available for approximately 30 to 50 clinics? | Data steward | Feasibility |
| OQ-006 | P0 | Which data may be used in an MVP and at what aggregation level? | Data governance | Feasibility |
| OQ-007 | P1 | What criteria, thresholds, weights, and exclusions are used today? | Real-estate analytics | Scoring |
| OQ-008 | P1 | Which Esri layers exist, who owns them, and are export or API uses approved? | Ralph Torres / GIS owner | Integration |
| OQ-009 | P1 | Which Tableau metrics are suitable as outcomes and how are they defined? | CVC Analytics | Evaluation |
| OQ-010 | P1 | What real-estate, lease, staffing, regulatory, and physical-site constraints are mandatory? | Functional owners | Screening |
| OQ-011 | P1 | What audit record is required for a candidate evaluation and decision? | Business owner | Governance |
| OQ-012 | P2 | How should qualitative local-market research influence a comparison? | Consumer Insights | Interface |
| OQ-013 | P2 | Which historical sites are comparable enough for retrospective tests? | CVC Analytics | Evaluation |
| OQ-014 | P2 | What outcome would prove the workflow saves time or improves decision quality? | Product owner | Success metrics |
| OQ-015 | P0 | What evidence, reviewer, and decision rule are required to mark a market review complete? | Real-estate analytics | Market evaluation |
| OQ-016 | P1 | What approved source assigns candidate and current locations to a stable market geography? | GIS and data steward | Market-location relationship |
| OQ-017 | P1 | Which market workflow states require durable audit history and who may change them? | Business owner and governance | Persistence and access |
| OQ-018 | P0 | Who owns the supplied Esri exports and has organizational authority to approve their fields, retention, refresh, and production use? | GIS owner and data governance | Esri production use |
| OQ-019 | P0 | What method, role, and observation vintage applies to each supplied trade-area record? | GIS / Real Estate owner | Trade-area interpretation |
| OQ-020 | P1 | What are the approved definitions, units, denominators, and owners for the retained aggregate Esri metrics, including Chewy-specific measures? | Metric owners and data steward | Descriptive comparison |
| OQ-021 | P1 | How should the four missing source links, one one-to-many link, duplicated names, two unnamed trade rows, and state conflict be resolved? | GIS / Real Estate owner | Data readiness |
| OQ-022 | P1 | Is there an approved API or governed export path for refreshing this snapshot, and what audit history is required? | GIS owner and platform governance | Integration |
| OQ-023 | P1 | What are the approved definitions, units, observation dates, and refresh rules for the retained physical-site fields, including traffic volume, parking, frontage, visibility, and competitor distance? | Real Estate analytics and data steward | Candidate evidence comparison |
| OQ-024 | P1 | Which clinic lifecycle states, account-to-location identity rules, corporate classification, duplicate-coordinate treatment, and geography method are approved for a clinic-landscape summary? | GIS owner and data governance | Clinic landscape |
| OQ-025 | P1 | Who may print or distribute an internal candidate evidence brief, and what review or watermark is required before sharing it outside the analyst workflow? | Business owner and data governance | Print and sharing |
| OQ-026 | P1 | Which candidate-review runs and approval receipts require durable audit history, retention, and access controls? | Business owner and data governance | Agent persistence |
| OQ-027 | P0 | Which roles may confirm a trade-area relationship for evaluation, and does process-local confirmation have any authority beyond preparing a draft packet? | GIS / Real Estate owner and data governance | Approval authority |
| OQ-028 | P1 | Who owns the candidate-review tool contract, prompt changes, production monitoring, and failure-response process? | Product, engineering, and model-risk owners | Agent operations |
| OQ-029 | P0 | Who owns and approves the production Seattle submarket definition, boundary method, and change process? | GIS and Real Estate owners | Submarket interpretation |
| OQ-030 | P0 | Which governed measures, directions, weights, and missing-data rules may be used for real submarket prioritization? | Real Estate analytics and metric owners | Submarket scoring |
| OQ-031 | P1 | Which licensed broker source, verification process, retention policy, and outreach authority apply to real broker research? | Real Estate and data governance | Broker research |
| OQ-032 | P1 | Which market deep-dive runs and segmentation approvals require durable audit history and access controls? | Product owner and governance | Agent persistence |
| OQ-033 | P0 | Who owns and may approve access to the documented DMA views, campaign taxonomy, Google Ads geographic data, retention, refresh, and recommendation support for this workspace? | MSO data owner, Marketing data owner, and data governance | Google Ads pilot and production use |
| OQ-034 | P0 | Which conversion actions, values, attribution settings, and lag windows are approved for regional demand and acquisition-efficiency evidence? | Marketing measurement owner | Metric interpretation |
| OQ-035 | P1 | What campaign taxonomy and comparison rules control for channel, brand, category, audience, bid, budget, creative, promotion, inventory, and delivery differences? | Marketing channel owners | Regional comparability |
| OQ-036 | P1 | Should Marketing evaluation remain at Nielsen DMA grain, or what licensed and versioned relationship maps DMA/ZIP evidence to the product's CBSA market universe without pretending the geographies are equivalent? | MSO, GIS owner, and data governance | Geographic integration |
| OQ-037 | P1 | Which historical regional decisions or campaigns are suitable for a three-to-five-case shadow evaluation, and what outcome would validate usefulness? | Product and Marketing owners | Pilot evaluation |
| OQ-038 | P0 | What is the current completeness, freshness, production status, and SLA of `vw_spend_by_dma`, the first-party DMA session data, and their campaign joins, especially for app traffic? | MSO data engineering and analytics | Source readiness |
| OQ-039 | P0 | Which business outcomes should be joined by account and use case: orders, new customers, N2Rx, appointments, repeat-customer mix, or another governed outcome? | Marketing measurement, CVC Analytics, and Finance | Evaluation target |
| OQ-040 | P1 | Which Google accounts and taxonomy cohorts are explicitly excluded as test, inactive, remarketing, app-install, awareness-only, Canada, or vendor-funded evidence? | Paid Search, CVC Marketing, and MSO | Comparable campaign universe |
| OQ-041 | P0 | What minimum volume, stability window, unresolved-geography tolerance, privacy suppression, and aggregation fallback apply before DMA or postal Google Ads evidence may support a recommendation? | Marketing measurement, data governance, and product owner | Recommendation eligibility |
| OQ-042 | P0 | Who owns and approves access, export, retention, refresh, and model/recommendation use for the documented Pricing Snowflake tables? | Pricing Analytics, Pricing Science, data governance | Pricing source readiness |
| OQ-043 | P0 | What representative or rotating ZIP methodology, competitor/SKU coverage threshold, crawl freshness, and replication checks make competitor regional price evidence comparable? | Pricing Science and competitor-data owner | Geographic price interpretation |
| OQ-044 | P0 | What is the approved PSE-cost definition, history/restatement behavior, and relationship to loaded product, fulfillment, shipping, and geographic cost-to-serve? | Pricing Analytics and Finance | Margin interpretation |
| OQ-045 | P0 | Which governed view and fields provide a privacy-safe week x geography x category outcome for net sales, discounts, returns, product cost, fulfillment/shipping cost, and contribution profit? | Finance, ECOM data owner, and data governance | Regional commercial outcome |
| OQ-046 | P1 | Which Chewy price-history, price-driver, promotion, and action fields are stable enough to distinguish market conditions from prior pricing interventions? | Pricing Analytics and Pricing platform owner | Leakage and causal interpretation |
| OQ-047 | P1 | Where is the current monthly SKU elasticity output published, who owns it, and how must observed estimates, predicted values, autoship segments, and low-history SKUs be interpreted? | Pricing Science / model owner | Price-test sizing and segmentation |
