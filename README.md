# Market Intelligence Evaluation Workspace

Clinic-first research and product foundation for a transparent geographic decision-support workspace.

The intended workflow starts with a geographic business question, assembles approved or explicitly synthetic evidence, calculates reproducible results, compares entities at a compatible geographic grain, and produces a verifiable decision or next-action packet for human review. Clinic location evaluation remains the first supported vertical.

This repository now includes an interactive frontend prototype for reviewing the user workflow. It can use public Census context, synthetic demo cases, and owner-approved aggregate local-demo evidence built from the supplied General Regional, Clinic, and Google Ads CSV files. Production integrations, scoring criteria, shared persistence, and decision authority remain unapproved.

## Start here

- [Project context](PROJECT_CONTEXT.md)
- [MVP scope](docs/product/mvp-scope.md)
- [Source registry](docs/research/source-registry.md)
- [Claim ledger](docs/research/claim-ledger.md)
- [Open questions](docs/product/open-questions.md)
- [Architecture](docs/technical/architecture.md)
- [Evaluation plan](docs/evaluation/evaluation-plan.md)

## Current status

- Scope: market intelligence workspace, with clinic evaluation as the first vertical
- Data: public Census, synthetic fixtures, and a local normalized snapshot of approved aggregate demo files; national SEO is intentionally excluded from regional normalization
- Implementation: frontend workflow prototype in review
- Decision authority: human real-estate and clinic leaders
- Material dependency: status and ownership of the existing internal site-selection MVP

The local demo currently supports named-market clinic context, regional
customer and sales context, Google Ads context, two-to-five-market descriptive
clinic comparisons, multi-source evidence, named-market source coverage, and a
fixed Hypothesis-only regional growth-test screen. The exact synthetic clinic
starter remains available after explicit confirmation. Generic “this market”
or “this clinic” wording does not silently select a real geography or clinic.

## Build the normalized local snapshot

Keep the raw CSV files outside Git. Point the build at the folder that contains
`General Regional`, `Clinic`, and `Google Ads`:

```sh
MARKET_DATA_DIR="/Users/nnair/Downloads/Market_Data" pnpm data:build:normalized-market
```

The build writes versioned Parquet tables, a DuckDB database, a manifest, and a
coverage report to `.local-data/normalized-market-data`. It does not copy raw
CSV files or the source directory path. The API accepts only the registered
queries `supported_regions`, `regional_context_by_cbsa`,
`clinic_context_by_cbsa`, `google_ads_context_by_cbsa`, and
`normalization_coverage`, plus the isolated `growth_test_screening`
calculation. Google Ads CBSA mappings are explicitly labeled as demo
inferences, not provider-stable joins. Descriptive normalized results have no
ranking eligibility; the isolated growth screen is explicitly Hypothesis-only.

Executed facts, periods, sources, warnings, actions, and calculation versions
are retained in `reviewable-action-packet-v2`. Saved v2 packets reopen without
replanning or rerunning evidence.

## Evidence labels

- **Confirmed:** explicitly supported by a current primary source
- **Reported:** explicitly stated in interview or meeting notes but not yet validated with a primary owner or system
- **Derived:** reasoned from confirmed evidence, but not directly stated
- **Hypothesis:** plausible and testable, but not yet supported
- **Unknown:** requires access, owner confirmation, or measurement
