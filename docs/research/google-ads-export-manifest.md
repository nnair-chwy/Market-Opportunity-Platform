# Google Ads geographic export manifest and usage instructions

**Snapshot window:** 2026-07-14 through 2026-08-12

**Exported:** 2026-08-13

**Account time zone:** Eastern Time

**Currency:** USD for U.S. exports

**Production approval:** Not established

This manifest maps the local Google Ads CSV snapshots used for discovery. The
verified, descriptively named copies live under ignored
`data/approved/google-ads/2026-07-14_2026-08-12/raw/` and must not be committed
to Git. `data/contracts/google-ads/export-catalog.json` retains the original
download-name mapping, file roles, row profiles, and hashes.

## Export set

### Configured-target exports

These files explain campaign targeting and scope. They do not show unbiased
regional demand.

| Local file | Account and grain | Detail rows | SHA-256 | Use |
| --- | --- | ---: | --- | --- |
| `cvc_configured-targets_by-campaign-adgroup_us.csv` | Vet Clinic Search; target x campaign x ad group | 5,960 | `7d5f7c4a9541fbf6e6071a8f18a1942bb30d84a95ef9e98f18065fc80e9a6037` | Validate clinic-market ZIP/radius scope and exclusions |
| `careplus_configured-targets_by-campaign-adgroup_us.csv` | CarePlus; target x campaign x ad group | 658 | `1063c31143d73769281a231e0778961f814ada931c8aa586cfa97647e25aa783` | Validate state eligibility and campaign scope |
| `connect-with-a-vet_configured-targets_by-campaign-adgroup_us.csv` | Connect with a Vet; target x campaign x ad group | 41 | `d11e0c8b2fcb9c4d918842ce3e4acc069fdaa78bb6f98a0ac4bff2dee6219ff3` | Validate state eligibility and campaign scope |
| `get-real_configured-targets_by-campaign-adgroup_us.csv` | Get Real; target x campaign x ad group | 13,269 | `11c5043a380da4d3a12f84b26e7bca4772548ef6b66f1a8c4609640e262a0336` | Validate metro/local program scope after the program is defined |

The initial Canada diagnostic is intentionally absent. Exclude it from the
U.S. evaluator.

### Matched-location exports

| Local file | Account, geography, and view | Rows | Distinct locations | Campaigns | SHA-256 | Use |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `retail_matched-dma_account-summary_us.csv` | Main Search/Shopping; DMA; account | 217 | 217 | — | `34e1955c7818507be69a4bdfae07e698ec8185756d9581a2ed2b50747a03c657` | DMA totals and reconciliation |
| `pharmacy_matched-dma_account-summary_us.csv` | Pharmacy; DMA; account | 211 | 211 | — | `a8bf9d8b30031c88511a7180612bc0f1e3986b5737498efd15918356d1437e8b` | Separate RX DMA totals and reconciliation |
| `pharmacy_matched-dma-campaign-conversion-action_us.csv` | Pharmacy; DMA x campaign x conversion action | 65,720 | 211 | 26 | `fd1655268a73bb2e02d8b5adbdeb65ebf08be3ca5bb4baf696c0b0da4ec80301` | Conversion-action vocabulary and distribution only |
| `pharmacy_matched-postal_account-summary_us.csv` | Pharmacy; postal; account | 24,507 | 24,507 | — | `70a08ea9b5aa894c1c9e86e7d03d673d5e6145beb6c09a155315f7040d49221d` | RX local drill-down; aggregate thin outcomes upward |
| `retail_matched-postal_account-summary_us.csv` | Main Search/Shopping; postal; account | 25,862 | 25,861 | — | `17489d4d850ca044d1cd763c0dee1629b05b3836c08652fcfdfb9aca106271bd` | Fine local context inside a qualified DMA |
| `retail_matched-dma-campaign-conversion-action_us.csv` | Main Search/Shopping; DMA x campaign x conversion action | 1,562,452 | 214 | 659 | `f309dc24924e43caad0c3505ce1a55f2336a5301fdd8c9478336870c1e0d5e64` | Conversion-action vocabulary and distribution only |
| `cvc_matched-postal-campaign_us.csv` | Vet Clinic Search; postal x campaign | 3,983 | 2,333 | 29 nonblank | `d6a866cbd25f34dd7220e5321a2ba30ffba88db58eae784e364933745fb3d31d` | Diagnose local CVC delivery against campaign scope |
| `careplus_matched-postal-campaign_us.csv` | CarePlus; postal x campaign | 67,446 | 20,204 | 7 nonblank | `14127337e208a7f57ff2a78420c810e7f3761cb5e56675a23c1caee9d32d053e` | Sub-state context after eligibility and volume gates |
| `connect-with-a-vet_matched-postal-campaign_us.csv` | Connect with a Vet; postal x campaign | 5,708 | 4,869 | 14 nonblank | `a24aee2bb8720221b53050dcec7f2f1492128656d0a1583c7813e2df9c43dc72` | Telehealth context after eligibility and volume gates |
| `get-real_matched-postal-campaign_us.csv` | Get Real; postal x campaign | 110,004 | 18,855 | 9 nonblank | `0ce3d0ecc9387dc3d6f4ab384c2a23ebc98da22bc13816e3baeac565c98fac26` | Program-specific local context only |
| `pharmacy_matched-dma-campaign-performance_us.csv` | Pharmacy; DMA x campaign | 4,603 | 211 | 24 | `0e728fde0aee43cd299582ee4a489a24c2f46909bcafb2eb54cbd43ca387d74d` | Primary manual RX DMA performance validation |
| `retail_matched-dma-campaign-performance_us.csv` | Main Search/Shopping; DMA x campaign | 89,859 | 215 | 479 | `e76736c302048dfc229e8c2552340c25a7d4977add401a98227da72d3d8e387c` | Primary manual retail DMA performance validation |

Campaign counts describe nonblank values in the data rows and are not a
current active-campaign inventory. Paused campaigns are included by the report
filters.

## Important export behavior

Google warns that adding a conversion segment drops basic performance fields
from the download. That behavior is visible in the two segmented files:

- only 4 of 65,720 Pharmacy rows retain nonzero impressions; and
- only 5 of 1,562,452 main-account rows retain nonzero impressions.

Therefore, never calculate CTR, CPC, CPA, or spend efficiency from the two
`*-conversion-action_us.csv` files. Use the two
`*-campaign-performance_us.csv` files for DMA x campaign performance, and use
the segmented files only to identify and quantify approved conversion actions.
Prefer the governed first-party outcome source for actual evaluation.

## Geography ladder

Use the smallest geography that remains compatible with the decision and data
quality. More detail is context, not automatically more evidence.

1. **DMA x campaign:** default comparable Marketing layer. Join campaign
   taxonomy and first-party outcomes here.
2. **Postal account summary:** local drill-down inside a qualified DMA. It can
   reveal concentration or contradiction but cannot assign the pattern to a
   category or campaign.
3. **Postal x campaign:** use for explicitly regional programs such as CVC,
   CarePlus, telehealth, or Get Real. Require program eligibility and adequate
   volume.
4. **Configured target:** use only to explain intended scope, exclusions, and
   campaign design.

The main and Pharmacy postal summaries each retain approximately 90% of their
DMA clicks, impressions, cost, and conversions. The unresolved remainder must
stay visible and must not be allocated to ZIPs.

Postal density differs sharply:

- main retail has substantial response volume across many postal rows and is
  useful for descriptive drill-down;
- Pharmacy has broad click coverage but sparse postal conversions, so outcome
  comparisons usually need DMA or another aggregated geography;
- approximately 23% of CVC postal-campaign rows, 18% of CarePlus rows, 4% of
  telehealth rows, and 1% of Get Real rows contain a nonzero reported
  conversion in this 30-day snapshot.

These observations support volume and stability gates. They do not establish
the numeric thresholds; the accountable metric owner must approve those.

## Parsing contract

1. Preserve the first two lines as report title and date-range metadata. The
   third line is the CSV header.
2. Treat postal codes as five-character strings, including leading zeroes.
3. Parse commas in numeric values, percent signs, em dashes, `--`, and blanks
   explicitly. Do not silently turn missing or inapplicable values into zero.
4. Preserve `Currency code`, `Added/Excluded`, campaign name, raw matched-
   location text, report view, geography type, account cohort, and export hash.
5. Recompute rates from eligible totals. Do not average row-level CTR,
   conversion rate, CPC, or cost per conversion.
6. Keep the raw Google location label. UI CSVs do not provide the stable Google
   geo-target constant needed for a production join; use an approved mapping or
   API field rather than fuzzy matching names.
7. Reconcile DMA totals, postal resolved totals, and unresolved geography for
   every snapshot.
8. Keep configured targets, matched locations, physical presence, and location
   interest as separate evidence types. The UI matched export does not by
   itself prove physical residence.

## How an agent should form a recommendation

1. State the business decision and compatible outcome: order/new-customer
   measures for retail, N2Rx/RX orders for Pharmacy, and total appointments for
   CVC.
2. Select a comparable entity/funnel/tactic cohort with campaign taxonomy.
3. Establish a DMA pattern with the relevant retail or Pharmacy
   `*-campaign-performance_us.csv`, preferably the governed `vw_spend_by_dma`
   equivalent and first-party outcomes.
4. Use postal context only inside that qualified market. Look for sustained
   concentration, internal contradictions, unresolved coverage, and thin rows.
5. For CVC or another regional program, reconcile postal delivery with the
   configured-target export and the approved clinic/program market.
6. Add non-ad evidence: population context, customer/order penetration,
   appointments, operations, competition, organic/direct substitution, and
   any service or eligibility constraint.
7. Produce an investigation or controlled-test recommendation with an owner,
   expected outcome, guardrails, rollback condition, and confidence. Do not
   claim causal lift from observational efficiency.

Examples of bounded recommendation language:

- **Retail:** “Investigate a category-specific test in this DMA; response is
  sustained in the comparable cohort and several postal areas reinforce the
  pattern, but first-party new-customer and population-normalized demand still
  need validation.”
- **Pharmacy:** “Prioritize an RX acquisition diagnostic at DMA grain; postal
  clicks are broad but conversions are too sparse for ZIP ranking. Validate
  N2Rx and prescription completion before action.”
- **CVC:** “Review delivery and appointment substitution for this clinic-market
  campaign; matched ZIP response conflicts with configured scope. Do not change
  spend until total appointments, clinic maturity, and operational stability
  are reviewed.”

## Production handoff

The local files are validation fixtures. Production planning should first
confirm access and stewardship for `vw_spend_by_dma`, the first-party DMA
session/outcome sources, `campaign_d`, and maintained DMA mappings. Build a new
Google Ads API path only for an approved gap such as physical-presence
semantics, stable geo IDs, finer-grain CVC validation, or missing account
coverage.
