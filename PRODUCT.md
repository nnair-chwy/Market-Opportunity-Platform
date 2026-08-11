# Market Intelligence Evaluation Workspace

This is the product source of truth. Other files record research, tests, or historical decisions; when they conflict with this document, this document wins.

## Product in one sentence

An adaptable decision agent for geographic questions: ask a market question, inspect the evidence on a map, compare places at national and local levels, and receive a verifiable draft recommendation with missing data and human approvals made explicit.

## What it should do

1. Accept a plain-language goal such as “Where should Chewy test a dog-food awareness campaign?”
2. Break the goal into the minimum decision stages required: market, submarket, candidate site, or approval only when those levels actually apply.
3. Run the supported stage from governed public or internal evidence.
4. Put the most useful geographic result first: map, selected-market detail, comparison, then report.
5. Explain the result with observed inputs, calculation, sources, limitations, contrary evidence, and missing data.
6. Produce a draft action or research packet for a human—not an autonomous business approval.

## Stable user experience

**Ask → map → select a place → compare → understand why → improve the evidence → review the draft action.**

There is one workspace and one evaluation protocol. Clinic location, campaign analysis, market context, and clinic performance must not become separate hard-coded applications.

## What the map controls mean

The buttons above the national map change the **active evidence layer**:

- Population
- Households
- Median household income
- Housing units
- Population density

The selected layer controls the map colors, market ranking, selected-market drawer, and summary. Deeper blue means a higher percentile for that observed measure across U.S. Census markets. Switching layers is for inspecting evidence, not switching workflows, and the application must not silently combine layers into an “opportunity” score.

When a question needs multiple measures, the agent should propose a governed comparison formula, show it to the user, and run it only when the measures, compatible geography, weights, and allowed use are validated.

## What is connected now

- U.S. Census boundaries for 917 metropolitan and micropolitan statistical areas.
- U.S. Census 2020–2024 ACS population, households, median household income, housing units, and derived density.
- A dated AVMA state pet-ownership dataset for explicitly labeled exploration.
- Synthetic Seattle submarket and aggregate clinic fixtures for demonstrating recursive evaluation and human gates. They are not production evidence.

The prototype is **not connected to Snowflake yet**. Chewy already has approved Snowflake access paths through Alation, DBT, Omni, Sigma, and Tableau, but that inventory does not prove a particular dataset is available or approved.

## Next data connections

1. **Data Governance + EDS:** use Alation to find certified assets and DBT to publish one narrow geographic Snowflake view with CBSA, DMA, state, and ZIP keys.
2. **SEO — David Lee:** Conductor, SEMrush, GSC/Botify location-keyword evidence for local demand and language variation.
3. **Real Estate Research/GIS — Ralph, with Matt Merrill:** trade areas, drive times, competitors, site candidates, access, lease, permitting, and advancement criteria.
4. **MSO Analytics & Measurement / MarTech:** campaign exposure, spend, reach, frequency, outcome, geo-test assignments, and lift uncertainty.
5. **Brand Marketing / Consumer Insights:** market awareness and message-test evidence with sample sizes and confidence intervals.

Every new source needs a stable entity and geography ID, observation window, metric/version, value/unit, source, freshness, evidence status, permission boundary, missingness, and limitation.

## Current product boundary

- AI may interpret the goal, propose a decision graph, summarize evidence, and draft a next step.
- Application code validates capabilities and performs deterministic calculations.
- The product may recommend further analysis, a test, or human review.
- It may not invent missing data, hide synthetic evidence, claim causation without a valid design, approve spend, select a lease, or authorize a clinic opening.

## Current priorities

1. Keep the public-data map fully responsive to the active question and selected measure.
2. Connect one governed internal geographic view through the existing Snowflake ecosystem.
3. Add multi-measure evaluation only through a visible, validated formula contract.
4. Support national-to-local drill-down with the same schema and renderer.
5. Turn the visible findings into a concise cited report and draft action packet.

## Definition of a credible demo

The user can ask a supported geographic question, see the correct map layer update, click any market to inspect its real values and limitations, compare places, understand what the result does and does not mean, see exactly which internal data would improve it, and receive no fabricated recommendation.
