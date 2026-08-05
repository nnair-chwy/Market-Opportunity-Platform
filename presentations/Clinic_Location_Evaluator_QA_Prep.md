# Clinic Location Evaluator: anticipated questions

Use these as short, direct responses. Keep the distinction between prototype behavior, approved evidence, and future hypotheses explicit.

## Value, ownership, and scope

### 1. How is this different from the existing Vet Clinic Site Selection plan?

The existing plan appears focused on historical validation, predictive modeling, feature importance, weights, and ranking. This prototype focuses on the review workflow around those outputs: assembling evidence, validating quality and provenance, separating constraints from preferences, explaining differences, and recording the human decision. The relationship still needs to be confirmed with the plan owner. It may become a complementary interface, an extension, or work we should stop.

### 2. Is this duplicating work that already exists?

It could be, which is why ownership and status are the first validation gate. I am treating the existing plan as a real overlap risk, not assuming it is inactive. I would not move into production development until we know who owns it and whether this workflow is useful alongside it.

### 3. What problem does this solve that Esri or current dashboards do not?

Esri and dashboards may provide important source views. This product is the decision-review layer that brings approved observations into one candidate record, validates them consistently, keeps missingness visible, applies versioned rules, and preserves the evidence trail. It should link back to source systems rather than replace them.

### 4. Who is the primary user?

The proposed first user is a clinic real-estate or site-selection analyst preparing a small candidate comparison for business review. That user and the exact decision point still need owner confirmation.

### 5. When in the workflow would someone use it?

After a proposed address is confirmed and before a site is advanced for deeper diligence or approval. The analyst would assemble evidence, resolve warnings, run an approved comparison, test bounded sensitivity, and prepare a source-linked brief for review.

### 6. Is this only for clinics?

The prototype is clinic-first by design. The contracts may be reusable later, but expanding to retail or a broader real-estate platform would require separate ownership, criteria, data, and workflow validation.

### 7. What business impact can you defend today?

The defensible near-term impact is workflow standardization, earlier visibility into missing or rejected evidence, clearer explanation of score differences, and a more consistent handoff for expert review. I cannot yet defend savings, fewer site visits, faster openings, or improved clinic performance because we do not have those baselines.

### 8. Why use AI at all?

AI is useful for the unstructured part of the work: summarizing structured results, explaining differences, identifying missing or conflicting evidence, and drafting diligence questions. The scoring and screening logic do not need AI and remain deterministic.

### 9. Could this be built without AI?

Yes. The non-AI baseline is the core product: validated inputs, deterministic calculations, versioned scoring, visible constraints, comparison, and a structured brief. AI should only remain if it measurably improves explanation quality or reviewer efficiency over a deterministic template.

### 10. What would make you stop or change direction?

I would stop or rescope if an active team already owns the same interface and workflow, approved data cannot support even a retrospective comparison, reviewers cannot agree on the decision being supported, or the prototype is likely to be interpreted as an autonomous site recommendation.

## Data, method, and governance

### 11. Do we have enough historical data to build a predictive model?

Not yet confirmed. The existing plan references roughly 30 to 50 clinics, but we have not verified that an approved, comparable dataset exists. Before modeling, we need one outcome, a maturity window, decision-time feature snapshots, inclusion rules, and an honest validation design. A small interpretable baseline would come before a complex model.

### 12. Where will the data come from?

The safe progression is:

1. Synthetic candidate fixtures for scoring behavior.
2. Versioned public Census context with no scoring eligibility.
3. Approved manual clinic-level aggregates.
4. Read-only governed adapters to approved Esri, Snowflake, Tableau, or Site Pipeline sources.

Access and use rights must be documented before any production connector is built.

### 13. Are public demographic data enough to select a site?

No. Census statistical areas and ACS estimates provide market context. They are not trade areas, drive-time polygons, customer demand, lease evidence, or proof of site suitability. In the current prototype they have no scoring weight.

### 14. Who sets the weights, thresholds, and hard constraints?

The relevant business and functional owners do. The system validates and versions their approved configuration. AI cannot choose or change it, and a configuration change requires review, evaluation cases, and a decision record.

### 15. How do you prevent missing data from creating a misleading score?

Missing remains `null`, never an observed zero. Rejected and excluded inputs remain visible. The scoring policy must either fail the evaluation or explicitly exclude and renormalize according to an approved rule. A candidate cannot become ready until required evidence passes validation.

### 16. What happens if a candidate scores well but fails a hard constraint?

The constraint remains failed and the candidate is not treated as eligible. Hard constraints do not contribute weighted points, and a high preference score cannot override them.

### 17. How do you handle qualitative local-market research?

Qualitative evidence stays source-linked and unscored unless an approved rubric exists. AI may summarize it or turn it into diligence questions, but it may not silently convert comments into numeric points.

### 18. Could AI hallucinate or bias the recommendation?

AI does not generate the score or recommendation. It receives only structured results, warnings, approved qualitative evidence, and source metadata. Numeric claims must match the structured result, factual claims need source IDs, unsupported causal or financial claims are rejected, and the output is labeled as a draft for human review.

### 19. How will access and sensitive data be protected?

The prototype uses synthetic, public, or explicitly approved aggregate data. Customer-level data, precise customer coordinates, medical records, credentials, and copied internal reports stay out of Git and prompts. Future integrations must use least privilege and separate viewing from editing.

### 20. How will you know this improves decisions rather than creating another dashboard?

The first pilot measures the workflow against a baseline: preparation time, provenance coverage, missing-data issues found before review, reviewer time to understand differences, and factual corrections required. Only after those stages pass should we test retrospective outcomes or predictive value with an approved cohort and time-correct validation.

## Useful redirect when a question asks for an unsupported number

“I do not have a verified number for that yet, and I do not want to invent one. The pilot is designed to establish that baseline so we can quantify the value honestly.”

## Core sources

- `PROJECT_CONTEXT.md`
- `docs/product/mvp-scope.md`
- `docs/product/open-questions.md`
- `docs/product/user-workflows.md`
- `docs/technical/data-contracts.md`
- `docs/technical/ai-boundaries.md`
- `docs/evaluation/evaluation-plan.md`
- `docs/evaluation/success-metrics.md`
- `docs/research/claim-ledger.md`
- `docs/research/source-registry.md`
