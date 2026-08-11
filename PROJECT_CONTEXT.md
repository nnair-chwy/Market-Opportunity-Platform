# Project context

## Product direction

This repository is transitioning from a clinic location evaluator to a
Market Intelligence Evaluation Workspace. The workspace evaluates geographic
business questions and produces a verifiable decision or next-action packet.
Clinic market and site evaluation remains the first reusable vertical and
regression fixture.

## Problem

Geographic business questions combine market, customer, operational,
performance, and real-estate evidence at different geographic grains. The
research indicates that parts of the process can be standardized, but final
decisions still require accountable business judgment and, for some use
cases, physical inspection or human approval.

## Opportunity

Create a repeatable question-first workflow that:

1. interprets a geographic business question into a validated evaluation;
2. assembles approved or explicitly synthetic evidence;
3. calculates transparent, versioned geographic metrics and comparisons;
4. explains findings, missing data, contrary evidence, and sensitivity; and
5. produces a source-linked draft decision or next-action packet for human review.

## Important overlap

An internal `Vet Clinic Site Selection` plan already proposes a baseline predictive model, feature importance analysis, data-driven weighting, and candidate ranking using historical data for approximately 30 to 50 clinics. Before development begins, the team must determine whether this repository will extend that work, provide its decision-support interface, prototype around it, or stop to avoid duplication. See `CLM-001` and `OQ-001`.

## MVP posture

Until overlap and data access are resolved, this repository defines a synthetic-data prototype. It does not claim that production data is available or that a model can reliably predict clinic performance.

## Intended users

- Market, growth, clinic, and site-selection analysts
- CVC analytics and business partners
- Business reviewers comparing geographic entities or candidate sites
- Data or engineering partners validating inputs and calculations

## Human decision boundary

The product prepares evidence, comparisons, explanations, and draft actions. It
does not approve spend, campaigns, hiring, leases, clinic openings, or other
material business actions, and it does not replace physical inspection or
expert judgment.

## Research date

Initial consolidation: July 24, 2026.
