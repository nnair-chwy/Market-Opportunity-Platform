# Local approved data

This directory is the agent-readable local data plane. Start with
`../contracts/local-approved-source-inventory.json`, then read the source
package contract named in that inventory before opening a file.

Available local packages:

- Google Ads 2026-07-14 through 2026-08-12;
- Snowflake Pricing 2026-08-17;
- Semrush SEO 2026-08-14;
- Zeus UI 2026-08-18;
- checked-in derived map, pricing-economics, and golden-question aggregate
  snapshots.

Raw/local source directories are ignored by Git. Do not add their files to a
commit. Do not treat local presence as production connection, reuse approval,
scoring eligibility, or action authority. Preserve the source grain, dates,
null semantics, unmatched rows, and allowed-use fields in the adjacent
contracts.

Verify all manifest-backed files with:

```bash
node --experimental-strip-types scripts/verify-local-approved-sources.ts
```

Rebuild the local inventory with:

```bash
LOCAL_SOURCE_INVENTORY_GENERATED_AT=2026-08-18T21:30:00.000Z \
  node --experimental-strip-types scripts/build-local-approved-source-inventory.ts
```

Rebuilding discovers new files but does not approve them. New or changed files
remain review-required until a data steward adds an exact path-and-SHA-256
receipt to `data/contracts/local-source-approval-registry.json`; rerun the
inventory and discovery commands after that review.

The current GIS account cannot access the two project-relevant CVC dashboard
items, and the general demographics app did not expose a verified downloadable
artifact. The minimized `data/sample/esri/2026-07-30` fixture remains the only
approved agent-readable GIS evidence. Never retain portal access tokens.
