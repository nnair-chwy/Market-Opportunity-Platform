# Snowflake CSV adapters

These adapters accept CSV text supplied by a controlled ingestion step. They do
not read Downloads directly and they do not make raw customer, prescription,
clinic-activity, or customer-address files part of the repository.

The adapters normalize keys, preserve nulls, retain provenance, return rejected
rows and warnings, and mark unresolved internal exports as `warning`. They do
not calculate scores, repair ambiguous geography, or authorize playbook use.
