# Google Ads local evidence contract

Use `export-catalog.json` to identify the U.S. Google Ads export before opening
a raw CSV. The original Google filenames are not meaningful and must not be
used in plans, code, or analysis output.

The corresponding raw files are organized locally under:

```text
data/approved/google-ads/2026-07-14_2026-08-12/raw/
```

That directory is ignored by Git. It contains internal account data and is
limited to workspace validation. Run `pnpm data:organize:google-ads` to rebuild
it from the original downloads while verifying every SHA-256 hash.

## Agent routing

1. Start with `retail_matched-dma-campaign-performance_us.csv` for retail or
   `pharmacy_matched-dma-campaign-performance_us.csv` for RX.
2. Reconcile against the corresponding DMA account summary.
3. Use postal account summaries only to drill into a qualified DMA.
4. Use postal-by-campaign files only for CVC, CarePlus, Connect with a Vet, or
   Get Real program questions with an approved cohort and minimum-volume rule.
5. Use configured-target files to explain intended scope, not observed demand.
6. Use conversion-action files for outcome names and distribution only. They
   do not retain usable performance denominators.

Never blend configured targets, matched locations, physical presence, or
location interest. Never join a raw location label to CBSA or another market
by fuzzy name.
