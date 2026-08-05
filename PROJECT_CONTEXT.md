# Project context

## Problem

Clinic-location evaluation combines geospatial, market, customer, operational, and real-estate evidence. The research indicates that parts of the process can be standardized, but final decisions still require human judgment and sometimes physical site visits.

## Opportunity

Create a repeatable workflow that:

1. assembles approved evidence for a candidate site;
2. calculates transparent location metrics;
3. compares candidates using approved, versioned criteria;
4. explains strengths, risks, missing data, and sensitivity to weights; and
5. preserves provenance for human review.

## Important overlap

An internal `Vet Clinic Site Selection` plan already proposes a baseline predictive model, feature importance analysis, data-driven weighting, and candidate ranking using historical data for approximately 30 to 50 clinics. Before development begins, the team must determine whether this repository will extend that work, provide its decision-support interface, prototype around it, or stop to avoid duplication. See `CLM-001` and `OQ-001`.

## MVP posture

Until overlap and data access are resolved, this repository defines a synthetic-data prototype. It does not claim that production data is available or that a model can reliably predict clinic performance.

## Intended users

- Clinic real-estate and site-selection analysts
- CVC analytics partners
- Business reviewers comparing candidate sites
- Data or engineering partners validating inputs and calculations

## Human decision boundary

The product prepares evidence and comparisons. It does not approve a site, authorize a lease, determine clinical strategy, or replace physical inspection and expert judgment.

## Research date

Initial consolidation: July 24, 2026.
