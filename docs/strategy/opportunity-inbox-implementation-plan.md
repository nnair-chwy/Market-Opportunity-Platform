# Opportunity Inbox proof-of-concept implementation plan

- Status: In progress, core demonstration implemented
- Original horizon: Ten working days
- Current implementation review: August 6, 2026
- Data posture: Fictional synthetic evidence only

## Purpose

Build a working Opportunity Inbox demonstration in ten working days. The proof
of concept will use one market, Seattle CBSA `42660`, and synthetic data to
demonstrate one playbook from each initial sector:

1. customer acquisition and marketing;
2. Pet Health and CVC; and
3. competitive and local ecosystem changes.

The demonstration shows the workflow from passive synthetic data intake through
opportunity discovery, sector-specific action preparation, stakeholder-message
preview, and outcome definition. Marketing and Pet Health currently retain
human review. The ecosystem closure playbook automatically prepares a bounded
ActionPacket without a human validation or approval gate. It is not intended to
be production-ready or connected to real business data.

## Demonstration outcome

The working demonstration must visibly complete this flow:

```text
Synthetic data arrives
  -> deterministic validation and regional rules run
  -> opportunity candidates are created
  -> supporting, contradicting, and missing evidence are assembled
  -> sector policy chooses the next bounded workflow
     -> Marketing or Pet Health: human review remains available
     -> Ecosystem closure: deterministic ActionPacket is prepared automatically
  -> AI optionally rewrites validated output into concise stakeholder language
  -> Outlook-ready or Slack-ready preview is generated
  -> a simulated delivery receipt is stored
  -> no message or business action is executed
```

The application, not AI, owns validation, geography, calculations, thresholds,
deduplication, permitted actions, workflow state, and delivery status.

## Evidence and decision boundaries

- All demonstration observations must be labeled `Hypothesis` or `Derived`.
- No card may imply that its Seattle findings are real.
- Missing values remain `null` and are never silently converted to zero.
- Supporting, contradicting, stale, missing, and rejected evidence remain
  visibly distinct.
- AI may summarize validated evidence and rewrite a deterministic ActionPacket.
- AI may not create evidence, change thresholds, choose geography, send a
  message, launch an experiment, or make a final business decision.
- Reviewer decisions remain separate from Marketing and Pet Health
  opportunities. The ecosystem ActionPacket has no review receipt because it
  contains no human approval gate.
- Simulated delivery receipts remain separate from system-generated output and
  never imply that a message or business action occurred.

## Demonstration playbooks

### 1. Customer acquisition and marketing

**Synthetic situation:** Seattle category interest increases while synthetic
Chewy penetration and marketing reach remain below their configured comparison
baselines.

**Supporting evidence:**

- category-interest change;
- penetration gap;
- eligible marketing-reach gap; and
- delivery and inventory availability.

**Contradicting evidence:**

- recent campaign saturation;
- weak conversion quality;
- insufficient eligible audience;
- delivery or inventory constraints; or
- stale or incomplete observations.

**Permitted response:** Prepare a controlled regional acquisition-test brief
for Marketing review.

**Proposed outcome:** Incremental new customers or orders under an approved
experiment design, with acquisition-cost and service guardrails.

### 2. Pet Health and CVC

**Synthetic situation:** Appointment interest near a Seattle clinic increases
while usable capacity remains available and awareness is below its configured
baseline.

**Supporting evidence:**

- appointment-interest change;
- staffed appointment capacity;
- awareness or referral engagement; and
- approved clinic geography.

**Contradicting evidence:**

- insufficient staffed capacity;
- long waits or service limitations;
- demand outside the approved clinic geography;
- pharmacy-only engagement; or
- stale schedule data.

**Permitted response:** Prepare localized awareness, referral, capacity-review,
or expansion-research options for CVC review.

**Proposed outcome:** Qualified bookings or completed visits, capacity
utilization, wait time, cancellations, and service guardrails.

### 3. Competitive and local ecosystem changes

**Synthetic situation:** A Seattle pet retailer permanently closes while local
category demand remains stable.

**Detection evidence:**

- a synthetic reported closure event;
- stable relevant demand;
- no reported replacement competitor; and
- an event inside the configured detection window.

**Typed situation and operating evidence:**

- fictional retailer identity and exact synthetic location;
- separate verification status, permanence, effective date, and fictional
  source-verification record;
- exact Seattle synthetic geography eligibility;
- delivery coverage and nearby synthetic CVC presence;
- campaign saturation and inventory constraints;
- nearby competing-retailer context.

**Contradicting evidence:**

- unverified or temporary closure;
- duplicate reporting;
- replacement competitor;
- falling relevant demand;
- wrong geography; or
- expired event window.

**Prepared response:** Deterministically assemble an ActionPacket with an
`advance`, `stop`, or `blocked` disposition. For the qualifying fixture, prepare
a synthetic 14-day regional acquisition and clinic-awareness test plan owned by
the fictional Seattle Market Expansion Lead with a calculated 48-hour deadline.
The packet has no human validation or approval step.

**Proposed outcome:** Synthetic incremental qualified customer or booking
response relative to a versioned synthetic pre-event baseline, with acquisition
cost, inventory, delivery, campaign saturation, clinic capacity, wait-time, and
cancellation guardrails. Every target and threshold remains fictional
configuration.

## Product experience

### Discovery activity

Show:

- last completed scan;
- next automatic scan;
- source batches processed;
- observations accepted, rejected, or quarantined;
- opportunity candidates created; and
- duplicate candidates suppressed.

The demonstration may scan synthetic fixture batches every 30 to 60 seconds
while the application is open. It must also include a `Run discovery` control
for a predictable live demonstration.

### Opportunity Inbox

Show:

- three sector cards;
- region and sector;
- short detected change;
- accountable stakeholder;
- workflow state;
- evidence completeness;
- detection time; and
- expiration time.

The ecosystem card also shows the system disposition, prepared course of
action, accountable synthetic owner, calculated deadline, blockers, and packet
version.

Support filters for sector and review state.

### Opportunity detail

Show:

- why the card appeared;
- the exact deterministic rule that qualified it;
- baseline and comparison context;
- supporting evidence;
- contradicting evidence;
- missing or stale evidence;
- AI-generated or deterministic stakeholder summary;
- permitted review options or the prepared ecosystem course of action;
- source IDs and evidence labels; and
- input, playbook, prompt, and result versions.

For ecosystem opportunities, lead with the ActionPacket:

- completed deterministic analysis;
- remaining blockers;
- ordered synthetic actions;
- advance and stop conditions;
- measurable outcome and guardrails;
- visible assumptions; and
- packet provenance.

### Review and communication

For Marketing and Pet Health, support:

- approve for routing;
- dismiss with a required reason;
- request more evidence;
- assign an accountable stakeholder;
- generate an Outlook-ready message;
- generate a Slack-ready message;
- record a simulated delivery receipt; and
- display an audit timeline.

For ecosystem closure, support:

- automatic ActionPacket preparation;
- no approve, dismiss, request-evidence, or free-text investigation controls;
- direct Outlook-ready and Slack-ready simulated previews;
- retained simulated delivery receipts; and
- an activity record that does not imply approval, routing, or execution.

The proof of concept prepares communication but does not send a real message.

## Core contracts

### `SignalEvent`

Minimum fields:

- `signal_event_id`;
- `batch_id`;
- `sector`;
- `region_id`;
- `observed_at`;
- `received_at`;
- `source_id`;
- `evidence_status`;
- `sensitivity`;
- `allowed_use`;
- `payload_version`; and
- validated, rejected, or quarantined state.

### `EvidenceObservation`

Minimum fields:

- `observation_id`;
- `metric_id` or event type;
- raw value or `null`;
- unit;
- regional grain;
- source ID;
- observation date;
- evidence status;
- quality status;
- freshness state;
- sensitivity;
- allowed use; and
- calculation version when derived.

### `EcosystemContextObservation`

Minimum fields:

- stable observation and typed field IDs;
- discriminated string, boolean, number, or date value, including `null`;
- unit where applicable;
- source ID;
- evidence and quality status;
- observation and receipt times;
- sensitivity and allowed use;
- payload version; and
- validated, rejected, or quarantined state.

The contract keeps retailer identity, synthetic location, dates, verification,
and operational checks out of numeric-only signal fields.

### `PlaybookDefinition`

Minimum fields:

- stable playbook ID and version;
- sector;
- eligible region types;
- required observations;
- baseline definitions;
- eligibility gates;
- supporting conditions;
- contradiction conditions;
- minimum evidence coverage;
- deduplication key;
- cooldown;
- expiration rule;
- permitted actions;
- accountable stakeholder role; and
- outcome and guardrail definitions.

### `Opportunity`

Minimum fields:

- stable opportunity ID;
- playbook and version;
- region ID and geography vintage;
- detected and expiration timestamps;
- current workflow state;
- triggering rule result;
- supporting evidence IDs;
- contradicting evidence IDs;
- missing and stale evidence IDs;
- evidence coverage;
- permitted actions;
- proposed owner;
- AI draft or unavailable state;
- input and calculation versions;
- separate human disposition where the sector workflow uses review;
- optional ecosystem ActionPacket; and
- optional validated ActionPacket explanation.

### `ActionPacket`

Minimum fields:

- packet, playbook, opportunity, input, evidence, and calculation versions;
- `advance`, `stop`, or `blocked` system disposition;
- recommended synthetic course of action;
- fictional accountable owner;
- versioned deadline calculation;
- structured situation and completed analysis;
- remaining blockers;
- ordered prepared actions;
- evaluated advance and stop conditions;
- measurable synthetic outcome;
- evaluated guardrails;
- assumptions; and
- complete source-ID set.

The packet is assembled deterministically before any model call. Known
contradictions produce `stop`, missing required evidence produces `blocked`, and
all required conditions passing produces `advance`.

### `ReviewDecision`

Minimum fields:

- decision ID;
- opportunity ID;
- prior and next state;
- decision type;
- reviewer;
- reason;
- requested evidence when applicable; and
- timestamp.

### `DeliveryReceipt`

Minimum fields:

- receipt ID;
- selected channel;
- intended stakeholder role;
- subject and message;
- simulated status;
- generated timestamp; and
- association with the parent opportunity record.

### `OutcomeObservation`

Minimum fields:

- opportunity ID;
- action or investigation type;
- owner;
- outcome definition;
- start and end dates;
- result source;
- result value or status; and
- evidence status.

## Technical design

### Shared platform modules

```text
lib/opportunity-inbox/
  contracts.ts
  fixtures.ts
  intake.ts
  baselines.ts
  playbooks.ts
  action-packets.ts
  evidence.ts
  explanations.ts
  lifecycle.ts
  national-monitoring.ts
  store.ts
```

The current proof of concept keeps these bounded concerns in the shared module
rather than creating empty directory abstractions. They can be split behind
stable interfaces if additional playbooks or providers justify it.

### User interface

```text
components/opportunity-inbox/
  OpportunityInbox.tsx
  opportunity-inbox.module.css
```

The current vertical slice intentionally uses one cohesive component. Split
components only when the Marketing and Pet Health packet designs establish
reusable UI boundaries.

### API routes

```text
app/api/opportunity-runs/route.ts
app/api/opportunities/[opportunityId]/review/route.ts
app/api/opportunities/[opportunityId]/delivery-preview/route.ts
```

### Synthetic inputs

```text
data/fixtures/opportunity-inbox/
  seattle-batch-01.synthetic.json
  seattle-batch-02.synthetic.json
  seattle-batch-invalid.synthetic.json
```

### Tests

```text
tests/opportunity-inbox.test.ts
tests/opportunity-inbox-rendered.test.mjs
```

## Deterministic discovery pipeline

Each discovery run must:

1. load the next synthetic fixture batch;
2. assign a stable batch ID and input version;
3. validate every signal event;
4. quarantine malformed or prohibited observations;
5. join observations to exact Seattle CBSA or approved clinic identifiers;
6. calculate configured baseline differences;
7. run all three versioned playbooks;
8. assemble supporting and contradicting evidence;
9. reject candidates that fail eligibility gates;
10. preserve insufficient evidence without imputation;
11. suppress duplicates using a stable deduplication key;
12. create or update opportunity records;
13. assemble a deterministic ActionPacket for ecosystem closure;
14. resolve its `advance`, `stop`, or `blocked` disposition;
15. optionally request AI wording for the validated packet;
16. preserve deterministic wording when AI is unavailable or rejected; and
17. record counts, versions, warnings, and run status.

Repeating the same batch with the same versions must produce the same result
without creating duplicate opportunities.

## Bounded AI design

For Marketing and Pet Health, AI may receive only:

- the validated opportunity contract;
- supporting and contradicting evidence selected by application code;
- missing and stale evidence;
- the approved playbook definition;
- permitted actions;
- source IDs; and
- the required response schema.

AI returns:

- a short headline;
- a two-sentence explanation;
- the most important uncertainty;
- one approved investigation or experiment suggestion; and
- a stakeholder-message draft.

For ecosystem closure, AI receives only the completed ActionPacket and
presentation instructions. It returns:

- a concise headline;
- a concise summary;
- the unchanged deterministic course of action;
- a synthetic limitation; and
- the unchanged complete source-ID set.

Application code must reject or downgrade output that:

- contains a number not present in the evidence packet;
- omits required source IDs;
- invents a source or event;
- changes a configured threshold;
- proposes an unapproved action;
- describes the synthetic result as real; or
- fails schema validation.

The ecosystem validator also rejects any changed course of action, changed
source set, or number absent from the ActionPacket.

Model timeout, provider error, missing configuration, invalid structure,
validation rejection, or other unavailability must not remove the opportunity
or packet. The application renders deterministic stakeholder language and keeps
the specific fallback state visible.

## Opportunity lifecycle

Marketing and Pet Health currently use the following demonstration states:

```text
detected
  -> validating
  -> needs_review
  -> approved_for_routing
  -> routed
  -> investigating
  -> actioned

Any active state may also move to:
  -> dismissed
  -> expired
```

Ecosystem closure uses a deterministic branch:

```text
detected
  -> prepared  when all configured conditions pass
  -> blocked   when required evidence is missing or Unknown
  -> stopped   when a configured contradiction is confirmed

Any retained ecosystem state may later move to:
  -> expired
```

Generating a simulated delivery preview does not change the ecosystem state to
approved or routed. No reviewer receipt is fabricated.

Marketing and Pet Health review transitions record prior and next state, actor,
reason, and timestamp on the versioned opportunity. Ecosystem state is computed
directly from the packet policy and evidence snapshot; it does not fabricate an
actor or review receipt.

## Current progress

| Area | Status on August 6, 2026 | Remaining work |
| --- | --- | --- |
| Contracts and fixtures | Complete for the three initial detectors and expanded ecosystem closure | Richer Marketing and Pet Health evidence contracts |
| Deterministic discovery | Complete | Add packet assembly only when each remaining sector playbook is defined |
| Opportunity Inbox UI | Complete for the current synthetic scope | Reuse the ecosystem packet pattern after sector-specific designs are approved |
| Ecosystem ActionPacket | Complete | Optional live provider smoke test and demonstration polish |
| Bounded ActionPacket AI | Complete with injected tests and deterministic fallback | Live call is optional and requires server configuration |
| Marketing and Pet Health review | Existing baseline complete | Decide whether these sectors retain review or move to automatic packets |
| Simulated communication | Complete | No real connector is planned for this proof of concept |
| National monitoring projection | Complete as synthetic non-scored operational context | Seattle remains the only market with playbook evidence |
| Outcome definition | Present in contracts and packets | Outcome-record creation and display are not implemented end to end |
| Reliability | Complete for the current implementation | Re-run full validation after each new sector packet |
| Demonstration preparation | Partial | Stable script, seeded states, failure walkthrough, and final rehearsal |

## Next decision and recommended sequence

Before expanding another sector, decide whether Marketing and Pet Health should
retain human review or follow the ecosystem's automatic ActionPacket lifecycle.
That choice changes their contracts, UI states, communication behavior, and
tests and should not be inferred from the ecosystem exception.

Recommended sequence:

1. review and accept the revised ecosystem scope and proposed ADRs;
2. finish the current vertical slice with process-local synthetic outcome-record
   creation and display;
3. complete Day 10 demonstration preparation and rehearse the fallback path;
4. define the Marketing situation, decision, evidence, conditions, outcome, and
   lifecycle before adding fields or code;
5. implement the Marketing packet as the second sector-specific vertical slice;
6. apply the learned pattern to Pet Health only after its capacity and safety
   conditions are separately defined; and
7. keep production connectors, sends, execution, and real recommendations out of
   scope until OQ-033 and the broader governance questions are resolved.

## Ten-day delivery plan

### Days 1 and 2: contracts and fixtures

**Current status:** Complete for the original scope and expanded ecosystem
fixture.

Deliver:

- shared Zod contracts;
- three playbook definitions;
- two valid Seattle fixture batches;
- one malformed fixture batch;
- three qualifying opportunity cases;
- one stale case;
- one duplicate event;
- one contradiction case; and
- one missing-data case.

Exit criteria:

- all fixtures clearly identify synthetic evidence;
- valid fixtures pass schema validation;
- invalid observations are quarantined;
- stable IDs and versions reproduce; and
- no sensitive or customer-level data exists in fixtures.

### Days 3 and 4: discovery pipeline

**Current status:** Complete for the current three detectors and ecosystem
ActionPacket.

Deliver:

- fixture intake;
- deterministic validation;
- Seattle geography checks;
- baseline calculations;
- three playbook evaluators;
- contradiction checks;
- evidence assembly;
- deduplication;
- expiration; and
- process-local opportunity storage.

Exit criteria:

- the same batch and versions produce the same opportunities;
- reprocessing does not create duplicates;
- stale and malformed signals cannot create active opportunities; and
- every candidate retains its rule and evidence receipts.

### Days 5 and 6: Opportunity Inbox

**Current status:** Complete for the current synthetic experience, including
the national non-scored monitoring projection.

Deliver:

- discovery-activity panel;
- inbox list;
- sector and state filters;
- opportunity cards;
- opportunity detail;
- evidence and warning presentation;
- Seattle map context; and
- automatic and manual discovery runs.

Exit criteria:

- all three sectors are visible in one inbox;
- a reviewer can trace every card to its rule and evidence;
- contradicting and missing evidence are visible; and
- the interface never presents synthetic results as real findings.

### Day 7: bounded AI drafting

**Current status:** Complete for ecosystem ActionPacket wording. Marketing and
Pet Health still use deterministic opportunity-card fallback text.

Deliver:

- strict AI input and output schemas;
- approved prompt template;
- numeric and source validation;
- permitted-action validation;
- synthetic-data language enforcement; and
- deterministic fallback copy.

Exit criteria:

- AI cannot create or modify calculated values;
- unsupported claims are rejected or downgraded;
- the inbox still works without an AI response; and
- prompt, model, and template versions are visible.

### Day 8: review and communication

**Current status:** Partial. Existing Marketing and Pet Health review and all
simulated previews work. Ecosystem correctly bypasses review and remains
prepared, blocked, or stopped after preview generation. Owners are currently
configured by playbook rather than interactively assigned.

Deliver:

- approve, dismiss, and request-evidence actions;
- owner assignment;
- Outlook-ready preview;
- Slack-ready preview;
- simulated delivery receipt; and
- audit timeline.

Exit criteria:

- no real message is sent;
- every review action produces a receipt;
- dismissal requires a reason; and
- the generated message contains no restricted evidence.

### Day 9: evaluation and reliability

**Current status:** Complete for the current implementation. The latest full
validation passed the production build, 189 TypeScript tests, 38 rendered and
agent tests, TypeScript validation, lint with no errors, and diff checking.

Deliver:

- contract and fixture tests;
- playbook boundary tests;
- duplicate and replay tests;
- AI validation tests;
- lifecycle tests;
- rendered UI tests; and
- full build and lint validation.

Exit criteria:

- all scoped tests pass;
- duplicate batches do not create duplicate cards;
- expired cards leave the active inbox;
- missing values remain `null`;
- prohibited AI actions fail closed; and
- the non-AI demonstration path remains usable.

### Day 10: demonstration preparation

**Current status:** Partial and the next step in the original ten-day plan.

Deliver:

- stable demonstration fixture order;
- seeded empty or reviewed starting state;
- five-minute demonstration script;
- reset control;
- known failure fallback; and
- final scope and limitation labels.

Exit criteria:

- the demonstration completes from intake to simulated stakeholder delivery;
- it can be reset and repeated predictably;
- every card is traceable to inputs and versions; and
- the presenter can explain what is real, derived, synthetic, proposed, and
  unavailable.

## Evaluation cases

At minimum, test these cases:

| Case | Expected result |
| --- | --- |
| Marketing support is complete | Create a Marketing opportunity |
| Marketing delivery constraint is present | Show contradiction and require review |
| CVC demand rises with usable capacity | Create a Pet Health opportunity |
| CVC demand rises without staffed capacity | Do not recommend awareness activation |
| Reported retailer closure with complete qualifying context | Create an ecosystem opportunity and an `advance` ActionPacket |
| Closure context is missing or `Unknown` | Preserve `null` and create a `blocked` ActionPacket |
| Closure is temporary or contradicted | Create a `stop` ActionPacket |
| Observation is stale | Do not create a current opportunity |
| Required observation is missing | Preserve `null` and show the gap |
| Batch is replayed | Do not create a duplicate opportunity |
| AI invents a number | Reject the draft and use deterministic fallback |
| AI changes the ecosystem action or source set | Reject the wording and use deterministic fallback |
| Reviewer dismisses a card | Record reason and remove it from the active inbox |
| Ecosystem preview is requested | Create a simulated receipt without approval or state change |
| Opportunity expires | Preserve history and remove it from the active inbox |

## Demonstration script

1. Open the Opportunity Inbox with an empty or previously reviewed state.
2. Show the discovery activity panel and next scheduled scan.
3. Run the next synthetic Seattle batch.
4. Show accepted, rejected, quarantined, and deduplicated observations.
5. Show the three new sector opportunities.
6. Open the ecosystem closure opportunity.
7. Show the typed fictional situation, deterministic completed analysis,
   `advance` disposition, owner, deadline, actions, conditions, outcome,
   guardrails, assumptions, and provenance.
8. Explain that AI only rewrites the validated packet and demonstrate the
   deterministic fallback state when provider access is absent.
9. Generate an Outlook-ready or Slack-ready preview without approval.
10. Show that the receipt is simulated, the state remains prepared, and no
    message or business action was executed.
11. Open Marketing or Pet Health to contrast the existing human-review path.
12. Show accepted, rejected, quarantined, duplicate, stale, and missing paths.
13. Show the audit timeline and outcome definition.
14. Explain that production adapters, rules, owners, persistence, access, and
    execution authority remain unresolved and out of scope.

## Explicitly out of scope

The two-week proof of concept will not include:

- real Snowflake, Esri, campaign, appointment, news, Outlook, or Slack
  integrations;
- real multi-market playbook evaluation beyond Seattle;
- production authentication or authorization;
- a production database;
- production scheduling infrastructure;
- learned prediction;
- universal market ranking;
- autonomous stakeholder communication;
- automated campaign execution;
- automatic clinic-capacity changes;
- real expansion recommendations; or
- production monitoring and incident response.

## Definition of done

The proof of concept is complete when:

1. a synthetic Seattle intake batch can be processed automatically or manually;
2. deterministic rules produce one opportunity from each of the three sectors;
3. stale, malformed, contradictory, missing, and duplicate cases behave as
   defined;
4. every card shows supporting and contradicting evidence, source IDs, versions,
   allowed actions, and expiration;
5. AI produces a bounded draft or the application uses a deterministic fallback;
6. Marketing and Pet Health allow a reviewer to approve, dismiss, or request
   evidence, while ecosystem produces a deterministic packet without approval;
7. the application can prepare an Outlook-ready or Slack-ready message;
8. a simulated delivery receipt and audit timeline are visible;
9. the demonstration can be reset and repeated predictably; and
10. all scoped tests, lint checks, and builds pass.

The current implementation satisfies the core technical criteria. Demonstration
preparation and end-to-end outcome-record display remain before the original
proof of concept is operationally complete.

## Review requirement

This document proposes a two-week proof-of-concept scope. It does not approve
production data, integrations, stakeholder communication, scoring policies, or
decision authority. Repository scope documents and decision records should be
updated only after user review of this plan.
