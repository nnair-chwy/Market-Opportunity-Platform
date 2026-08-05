# Security and governance

## Data minimization

- Prefer aggregates at an approved geographic grain.
- Do not use precise customer coordinates in the prototype.
- Do not include PII, medical records, employee records, credentials, or restricted financial rows.
- Store only synthetic, public, de-identified, or explicitly approved
  minimized fixtures in Git. The `SRC-017` Esri fixture is approved only for
  this internal prototype and excludes clinic rows, customer coordinates,
  direct identifiers, employee fields, lease terms, rent, and landlord data.

## Access

- Apply least privilege to Esri, Tableau, Snowflake, Smartsheet, and source systems.
- Separate dashboard viewing, aggregate export, data-query, and editing permissions.
- Record the business purpose and owner for every data source.
- Do not bypass dashboard or API controls.

## Provenance

Every metric must identify its source, observation date, geography, transformation, and quality status. Every evaluation must preserve the versions used.

## AI governance

- Use only an approved model and endpoint for internal evidence.
- Do not send restricted fields to an LLM.
- Log metadata and validation outcomes without logging sensitive prompts.
- Require human review before a brief is distributed or used in a decision.

## Repository handling

This repository contains paraphrased internal research and links. It should remain private and follow Chewy repository and data-classification requirements. If the repo becomes public or externally shared, remove internal links and re-review every document.

## Evidence brief print boundary

Candidate evidence briefs and comparisons print only from the minimized
presentation contract. Restricted observations contain labels and `null`
values; supplied clinic rows, lease values, rent, landlord identity, direct
identifiers, customer, prescription, and other prohibited fields are absent
before React rendering. Browser print is an analyst convenience, not approval
to distribute the document. Distribution and retention remain blocked on
`OQ-025`.
