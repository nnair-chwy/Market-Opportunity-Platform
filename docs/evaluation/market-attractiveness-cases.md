# Market attractiveness evaluation cases

These cases protect the deterministic synthetic screening baseline. They do not
validate real-world market quality.

| Case | Expected result |
| --- | --- |
| Load the versioned snapshot | Exactly 917 records load with unique prototype market IDs |
| Validate configuration | Metric weights total 100 and reconcile to dimension weights |
| Recalculate twice | Results, ranks, fingerprints, and sensitivity summaries are identical |
| Score bounds | Every metric, subscore, and overall score is between 0 and 100 |
| Contribution audit | Visible metric contributions sum to the overall score |
| Cohort isolation | Metropolitan and micropolitan ranks each begin at one and are contiguous |
| Lower-is-better metric | Lower clinic density receives a higher normalized score than higher clinic density, all else equal |
| Cohort winsorization | The same metric has cohort-specific lower and upper bounds |
| Tie handling | Equal scores sort by market name, then prototype market ID |
| Missing configured input | Calculation fails with an explicit field path; no zero substitution or reweighting occurs |
| Source-prefixed values | `source_*` values are retained for provenance but are never configured or scored |
| Negative growth | Negative year-over-year growth is accepted as a valid finite value |
| Invalid negative input | Negative counts, rates, shares, or densities fail validation |
| Sensitivity | Twelve fixed scenarios report best and worst cohort rank without mutating baseline inputs |
| UI boundary language | Ranking view states synthetic prototype, screening rank, and not a recommendation |
| Detail disclosure | Expanded row shows raw value, direction, transform, normalized score, weight, and contribution |

Before accepting a new configuration, add cases for the affected metric,
direction, transform, normalization rule, missing-data behavior, and sensitivity
behavior.
