# Synthetic market attractiveness scoring

Status: Prototype configuration for user review  
Configuration version: `market-attractiveness-synthetic-v1`  
Calculation version: `market-attractiveness-calculation-v1`  
Normalization version: `cohort-winsorized-percentile-v1`

## Intended use

This model ranks synthetic CBSA-like records for early market screening. It is
not a market-entry recommendation, site score, feasibility result, investment
decision, lease decision, or clinic-opening decision. All records are labeled
`Hypothesis` and `synthetic_prototype_only`.

Public Census CBSA context remains a separate non-scored dataset. The scorer
does not use `source_*` fields or combine public market-context values with
synthetic ranking inputs. For map presentation only, the build attaches an
official CBSA code when the synthetic market name exactly and uniquely matches
the July 2023 `SRC-014` universe. Renamed or otherwise unmatched markets retain
`null` and render as Not scored rather than using a heuristic match.

## Configuration

| Dimension | Metric | Direction | Transform | Weight |
| --- | --- | --- | --- | ---: |
| Chewy demand | Active customers per 1,000 households | Higher | None | 25% |
| Chewy demand | Active customer count | Higher | `log1p` | 12% |
| Chewy demand | Year-over-year active-customer growth | Higher | None | 8% |
| Market capacity | Total households | Higher | `log1p` | 15% |
| Market capacity | Average ZIP median household income | Higher | None | 10% |
| Veterinary opportunity | Clinics per 10,000 households | Lower | None | 10% |
| Veterinary opportunity | Veterinarians per 10,000 households | Higher | None | 5% |
| Veterinary opportunity | Corporate clinic share | Lower | None | 5% |
| Chewy clinic engagement | Practice Hub clinic share | Higher | None | 5% |
| Chewy clinic engagement | Clinic orders per clinic | Higher | `log1p` | 5% |

Dimension weights are Chewy demand 45%, market capacity 25%, veterinary
opportunity 20%, and Chewy clinic engagement 10%. Total configured weight is
100%.

The veterinary directions are visible, unapproved assumptions. Lower clinic
density may indicate whitespace or weak market support. Higher veterinarian
density may indicate workforce availability or stronger competition. Lower
corporate share may not imply lower total competitive intensity. Higher
Practice Hub engagement may represent traction or saturation.

## Calculation

1. Validate the configuration, evidence status, allowed use, IDs, and every
   configured metric. Missing configured values fail closed. Negative growth is
   valid; negative counts, rates, shares, and densities are rejected.
2. Split records into metropolitan and micropolitan cohorts.
3. Apply the configured transform. `log1p` limits the influence of market-scale
   and order-volume extremes while preserving order.
4. Winsorize each transformed metric at the cohort-specific 2nd and 98th
   percentiles.
5. Convert winsorized values to empirical percentile scores from 0 to 100.
   Ties receive their average rank percentile. Reverse the percentile for
   lower-is-better metrics.
6. Multiply each normalized score by its weight. Sum contributions into the
   four visible dimension subscores and the overall score.
7. Rank within cohort by overall score, then market name, then prototype market
   ID. Ranks are deterministic ordinals.

Every output exposes the raw value, transformed value, winsorized value and
bounds, normalized score, direction, transform, weight, contribution,
dimension subscore, overall score, cohort rank, configuration fingerprint, and
warnings.

## Sensitivity

The engine runs 12 fixed scenarios. In each scenario, five percentage points
move from one dimension to another while preserving the receiving and donating
dimensions' internal metric ratios. Baseline data and configuration are not
mutated.

Rank sensitivity is classified as:

- stable: best-to-worst rank range of 0 to 5;
- moderately sensitive: range of 6 to 20; or
- highly sensitive: range above 20.

## Known limitations and review questions

- All ranking inputs are synthetic and suitable only for prototype behavior.
- The versioned exact-name crosswalk links 802 of 917 synthetic records to a
  public CBSA boundary. The remaining 115 are not inferred and remain visibly
  unscored on the map.
- The customer reporting window and active-customer definition require owner
  confirmation.
- Average ZIP median income is not a CBSA household-income median.
- Clinic identity, corporate ownership, Practice Hub membership, order window,
  veterinarian definition, and deduplication rules require approval.
- The default directions and weights require business review before any use
  beyond demonstration.
- Feasibility, execution readiness, candidate-site evidence, cannibalization,
  capital cost, staffing constraints, and lease terms are outside this score.
