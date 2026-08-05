# MVP scope

## Provisional product wedge

Build a transparent market-first decision-support workflow that reviews a
market before comparing a small set of candidate clinic locations using
approved structured inputs and producing a reviewable evidence brief.

This scope is provisional until the owner of the existing internal site-selection plan confirms whether this work should extend, interface with, or stop in favor of that effort.

## In scope

- Load synthetic candidate-site and metric data
- Navigate separate Markets and Locations workspaces
- Color public CBSA boundaries from higher to lower synthetic attractiveness
  scores only when an exact `SRC-014` CBSA identifier is available; unmatched
  records remain visibly unscored
- Keep market map and browser selection synchronized in both directions
- Ask AI questions about one selected synthetic market result, and compare two
  to five same-cohort results in analyst selection order using only the supplied
  structured evidence
- Present a non-persistent `Save comparison` affordance that never implies a
  record was stored
- Preserve a stable parent-market relationship for evaluable locations
- Block location evaluation until the parent market is Current or Evaluated
- Keep market workflow state separate from public context and location results
- Validate required fields, types, ranges, freshness, and provenance
- Calculate deterministic metric normalizations
- Apply an explicitly approved and versioned weight configuration
- Display raw values, normalized values, contributions, and total scores
- Compare candidates side by side
- Limit the visible Locations workspace to Candidate briefs and Compare
  locations, with readiness checks embedded in the bounded review flow
- Show missing data and quality warnings
- Run simple weight-sensitivity tests
- Produce a structured evaluation result
- Optionally generate a plain-language brief from the structured result
- Record the model, rule, data, and prompt versions used
- Prepare a bounded, source-linked candidate review packet from approved
  `SRC-017`, `SRC-014`, `SRC-015`, `SRC-016`, and explicitly synthetic fixture
  evidence
- Pause for analyst confirmation instead of selecting among ambiguous
  trade-area relationships
- Keep agent-run state process-local and clearly labeled as non-durable
- Invoke the deterministic scoring engine only after application policy
  confirms a separately valid scoring input and configuration

The Candidate Review Agent prepares evidence for review. It does not resolve
`CLM-001`, approve production use of `SRC-017`, turn public context into a
scoring input, or make a site, lease, or opening decision.

### Seattle market deep-dive demo

The MVP also includes one bounded Seattle-only demonstration for CBSA `42660`.
It proposes seven synthetic, analyst-defined submarkets, pauses for explicit
segmentation confirmation, and only then runs a deterministic comparison. The
output uses the phrase “priority under demo criteria,” shows contributions,
missing inputs, and weight sensitivity, and attaches fictional broker research
leads. Approximate public city-center hubs generate overlapping illustrative
areas on the persistent map. Those areas are presentation-only and never enter
calculations.

This demonstration does not establish an approved submarket definition, rank
real Seattle opportunities, verify brokers, authorize outreach, recommend
market entry, select property, or make a lease decision.

## First demonstration

The demonstration should use three to five synthetic candidate sites and a small feature set, such as:

- customer-demand index;
- competitor count;
- population-density index;
- drive-time coverage;
- foot-traffic proxy;
- staffing-feasibility flag; and
- one qualitative local-market note.

These are demonstration fields, not approved production criteria.

## Exit criteria

The documentation phase is ready for implementation when:

- overlap ownership is resolved;
- one user and decision point are named;
- the outcome metric is defined;
- the initial criteria and weights are approved;
- a safe data path is identified;
- human decision rights are documented; and
- the evaluation plan has an owner.

## Invalidation

Stop or re-scope if:

- an active team already owns an equivalent interface and workflow;
- approved data cannot support even a retrospective evaluation;
- reviewers cannot agree on the decision and outcome being supported; or
- the prototype would be interpreted as an autonomous site recommendation.
