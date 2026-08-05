# Test sites

Use synthetic sites only during the first implementation.

## Required cases

1. **Balanced site:** moderate values across all fields.
2. **High demand, high competition:** tests trade-offs.
3. **Low competition, weak demand:** tests whether competition dominates incorrectly.
4. **Missing foot traffic:** tests visible missingness.
5. **Stale customer evidence:** tests freshness rejection.
6. **Hard-constraint failure:** tests screening separately from scoring.
7. **Qualitative concern:** tests that narrative evidence remains visible but unscored.
8. **Near tie:** tests sensitivity to weight changes.
9. **Extreme outlier:** tests normalization and range controls.

## Address-entry cases

1. **Complete provider match:** preserves the input, standardized match, coordinates, provider version, source ID, and resolution time.
2. **No provider match:** displays an actionable error and creates no proposed location.
3. **Incomplete provider response:** fails closed instead of creating a partial marker.
4. **Duplicate address:** prevents a second current or proposed location record.
5. **Provider unavailable:** preserves the entered form and creates no proposed location.
6. **Reviewer edits match:** returns to address entry without creating a location.
7. **Confirmed proposed location:** appears under `Potential locations` as `Needs data`.
8. **No evidence loaded:** keeps `Run evaluation` disabled.

## Fixture rules

- Clearly label every record synthetic.
- Avoid real clinic addresses and customer distributions.
- Include expected warnings and score contributions.
- Version fixtures alongside calculation tests.

## Implemented frontend scoring cases

The frontend prototype currently includes these executable cases in `tests/scoring.test.ts`:

1. Complete synthetic Nashville inputs reproduce a score of `82`.
2. A missing foot-traffic observation is excluded and the score is normalized over the remaining `90%` weight, producing `71` for the synthetic Raleigh case.
3. An evaluation with no available metrics is rejected instead of producing a score.
4. Census address-response normalization preserves provider provenance and rejects unmatched or incomplete responses.

These cases validate demonstration behavior only. Production normalizations, weights, missing-data rules, and thresholds remain unapproved.
