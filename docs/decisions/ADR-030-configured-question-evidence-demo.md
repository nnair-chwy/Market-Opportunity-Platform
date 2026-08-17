# ADR-030: Configure three bounded question-to-evidence demo workflows

## Status

Proposed for repository-owner review.

Date proposed: 2026-08-17.

## Context

The local demo must answer one market-context, clinic-performance, and
growth-test question from the existing question-first product shell. The
ordinary planner correctly blocks missing production clinic and growth inputs,
but the user approved a named Phoenix scenario and a clearly synthetic clinic
comparison for demonstration.

## Decision

Recognize only the three exact approved starter questions as configured demo
scenarios. Market and growth evidence use Phoenix-Mesa-Chandler, AZ, with exact
key `cbsa:38060`. Clinic performance uses Synthetic South Clinic against all
three checked-in synthetic clinics on completed appointments at the shared
38-week maturity point.

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

The three presentation questions are deterministic and replayable against the
same local snapshot. Their defaults are visible, versioned, and testable rather
than inferred. Questions outside those exact scenarios retain existing planning
and blocking behavior.

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
