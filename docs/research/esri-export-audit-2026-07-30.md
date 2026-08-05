# Esri export prerequisite audit, 2026-07-30

This audit covers the five user-supplied `SRC-017` files. It records structural
and aggregate quality findings only. Raw rows and sensitive values remain
outside the repository.

## Source reconciliation

| File | SHA-256 | Rows | Fields |
| --- | --- | ---: | ---: |
| `clinic_locations_full.csv` | `0bedf47f67610dbe865e0ef29dc41a44132d5b01d883e54ba85c3e58658a7e21` | 36,461 | 90 |
| `clinic_locations_demo.csv` | `1ee2ee5db5f59260e4ff3b3cc1ddf651a172f22c1d7e3b7be2859cb9356328f8` | 36,461 | 25 |
| `master_sites_full.csv` | `d5886b0d4552411aeb1412636d85c67e46f1e14df40737fd899505f3067ce61b` | 71 | 84 |
| `master_sites_demo.csv` | `8eec79c95a6e218d13f4cdd8b50c9e8c5b8a26d55e93fe7ede365bed4c1a6fc2` | 71 | 49 |
| `trade ares field schema.xlsx` | `6d1e7a8bf463a99c7fbf2faf943ad08346c9d0c57b7c1309dbce84640f561312` | 592 | 70 |

Both demo CSVs are exact row-for-row, shared-column projections of their full
CSV. The XLSX is a populated trade-area export, not a schema workbook.

## Candidate keys

| Dataset and key | Populated | Unique | Duplicate groups | Finding |
| --- | ---: | ---: | ---: | --- |
| Clinic `clinic_id` | 36,461 | 36,461 | 0 | Stable candidate |
| Clinic `clinic_key` | 36,461 | 36,461 | 0 | Stable candidate; absent from demo projection |
| Clinic `golden_clinic_id` | 36,461 | 36,229 | 227 | Not unique |
| Clinic `objectid` | 36,461 | 36,461 | 0 | Export-specific candidate |
| Master `GlobalID` | 71 | 71 | 0 | Selected stable fixture key |
| Master `ESRI ID` | 67 | 67 | 0 | Four null values |
| Master `Site Code` | 46 | 46 | 0 | 25 null values |
| Master `Business ID` | 25 | 25 | 0 | 46 null values; excluded from fixture |
| Trade `GlobalID` | 592 | 592 | 0 | Stable trade-record candidate |
| Trade `System ID` | 590 | 590 | 0 | Two null values |
| Trade `ESRI_ID` | 302 | 298 | 4 | Relationship key, not a unique row key |

## Duplicate, missing, and coverage findings

- No full duplicate rows were found in any supplied file.
- Clinic names have 492 duplicated-name groups. Clinic coordinates have 889
  repeated-coordinate groups. These are retained as source diagnostics and
  never used to delete or merge records automatically.
- Master sites have two duplicated-name groups, no repeated-coordinate groups,
  and no unnamed rows.
- Trade areas have nine duplicated-name groups and two unnamed rows. The
  unnamed records are quarantined from the fixture crosswalk.
- `test_clinic_flag` is all null in the clinic full export.
- `Open Note`, `Site Front Size`, `created_user`, and `created_date` are all
  null in the master full export.
- All 71 master rows have real source coordinates. The user approved those
  site coordinates for this internal demo. Clinic coordinates are excluded.

## Sensitive and excluded fields

Clinic row values are entirely excluded. Their fields include phone, street,
account owner, healthcare-customer IDs and counts, and other account or
operational attributes.

Master values excluded from the fixture include address, lease term, rent
abatement, security deposit, base rent, rent increases, tenant allowance,
landlord identity, and business ID. The field catalog retains names and
exclusion reasons, not values.

Selected aggregate trade-area values are retained only where needed for the
demo contract. Aggregate Chewy and CVC measures remain internal and non-scored.
No customer or pet identifiers, precise customer coordinates, medical data,
employee data, credentials, lease values, or landlord identities are retained.

## Missing definitions and prerequisites

The exports do not establish metric observation dates, trade-area methods or
roles, authoritative units for every measure, denominators for all rates,
geography ownership, metric owners, refresh cadence, retention policy,
production access, or organizational governance approval.

`SRC-017` is therefore a new bounded source-registry entry. It represents the
received file snapshot only. It does not replace `SRC-010` or `SRC-011` and
does not prove that either dashboard or an Esri API is accessible.

## Market-profile prerequisite decision

- Sixty-seven master sites link to supplied trade-area records through exact
  source Esri IDs. These relationships remain provisional rather than reviewed.
- Shops at MacArthur Hills links to two supplied records. Both variants remain
  selectable and no primary is inferred.
- Two unnamed trade rows are quarantined.
- All supplied trade-area roles, construction methods, and observation dates
  remain unknown.
- The user approved aggregate Chewy measures for this internal demo. They
  remain internal, descriptive, and non-scored.
- The four records without source links use explicit synthetic trade-area
  contract fallbacks. They remain blocked on the real-data path.
- A site CBSA ID controls navigation to public market context only. It does not
  redefine the linked trade-area record as a CBSA.

## Candidate-evidence brief prerequisite decision

Five records are approved for the bounded brief demo:

| Demo record | Identity and coordinates | Parent market | Trade-area relationship |
| --- | --- | --- | --- |
| Shops at MacArthur Hills (Irving, TX) | Supplied `SRC-017`, user approved | Supplied CBSA 19100, provisional | Two supplied variants, review required |
| The Mix (Frisco, TX) | Supplied `SRC-017`, user approved | Supplied CBSA 19100, provisional | One supplied variant, provisional |
| London Square (Kendall, FL) | Supplied `SRC-017`, user approved | Supplied CBSA 33100, provisional | One supplied variant, provisional |
| 212 Miracle Mile (Coral Gables, FL) | Supplied `SRC-017`, user approved | Supplied CBSA 33100, provisional | One supplied variant, provisional |
| Barkin' Creek Dog Kitchen & Bath - Domain NORTHSIDE | Supplied `SRC-017`, user approved | Unassigned | Explicit synthetic fallback; real path blocked |

The first three records are the default analyst comparison. Their order is the
analyst selection order, not a rank.

The minimized physical-site evidence is safe for this internal demo only.
Retained values include site and usable square feet, design room count, center
name and type, site position and frontage, parking, visibility, ingress and
egress, green space, traffic volume, co-tenants, and multi-story indicator.
Definitions are partial, observation dates are unknown, and some numeric units
remain unknown. Closest-competitor name and distance are not displayed because
the competitor classification, calculation method, and distance unit are not
confirmed.

Lease, rent, deposit, tenant allowance, landlord, employee, account-owner,
phone, contact-preference, prescription, customer, and clinic-row values remain
excluded or redacted. The brief contains restriction labels, never those
values.

The supplied clinic layer represents source account rows and includes 889
repeated-coordinate groups. It does not provide an approved lifecycle rule,
physical-location deduplication rule, or trade-area inclusion method. The brief
therefore uses an isolated `SYN-CLINIC-LANDSCAPE-001` fallback that explicitly
separates source-account rows from estimated physical locations, retains a
repeated-coordinate count, labels corporate and independent counts as
synthetic, and marks the 2025-12-31 snapshot stale. No supplied clinic row is
used in the brief.

Trade-area values remain non-comparable until dates and geography methods are
confirmed. No approved qualitative field notes are available, so the brief
shows a stale synthetic inspection placeholder with no note text. Print output
uses only the minimized brief object, includes source and restriction labels,
and does not contain hidden restricted values.
