# ADR-030: Configure three bounded question-to-evidence demo workflows

## Status

Superseded.

ADR-032 and ADR-033 supersede the configured market and growth behavior. The
synthetic clinic workflow remains the only configured demo plan.

Date proposed: 2026-08-17.

## Context

The original local demo design used one named Phoenix scenario and one clearly
synthetic clinic comparison. Later normalized-market routing made the hidden
Phoenix default unnecessary and unsafe for generic wording.

## Decision

Only the clinic-performance starter remains a configured scenario. It proposes
Synthetic South Clinic against all three checked-in synthetic clinics on
completed appointments at the shared 38-week maturity point and requires
reviewer confirmation. Generic “this market,” “this clinic,” and unspecified
regional-opportunity wording requires clarification. Phoenix is selected only
when Phoenix is named explicitly in the submitted question.

The configured plans remain distinct from ordinary question planning. Generic,
ambiguous, or blocked plans do not inherit the demo defaults. Growth execution
does not change the capability registry's production status. Google Ads stays
at matched-location label grain and is not joined to Phoenix.

The existing decision graph remains the root workflow. Executed results render
through one shared evidence-bundle view, and the existing reviewable action
packet carries the new response contract and provenance. The workflow stops at
human review and cannot launch campaigns, authorize spend, make final site
decisions, or represent synthetic clinic results as production evidence.

## Consequences

The synthetic clinic presentation question remains deterministic and
replayable. Market, comparison, source-coverage, multi-source, Google Ads, and
growth-screening questions now use ADR-031 and ADR-032 registered normalized
queries. No generic question inherits a hidden geography.

The demo is intentionally partial. Regional SEO is unregistered, pricing and
dedicated competitor files are unavailable, real clinic evidence cannot cross
the browser boundary, and Google Ads lacks a stable geography bridge.

## Alternatives considered

1. Change the general planner to silently treat “this market” as Phoenix.
   Rejected because unrelated questions would inherit a hidden geography.
2. Mark the growth capability production-connected. Rejected because test,
   measurement, geography, and launch approvals remain missing.
3. Create a separate landing app and packet format. Rejected because the
   existing decision graph and reviewable action packet are the product paths
   that should be demonstrated and extended.

## Evidence references

- `lib/demo/scenarios.ts`
- `lib/planning/execute-plan.ts`
- `lib/planning/evidence-bundle-view.ts`
- `components/evidence/EvidenceBundlePanel.tsx`
- `lib/planning/reviewable-packet.ts`
- `tests/question-evidence-replay.test.ts`
- `tests/evidence-bundle-rendered.test.mjs`
