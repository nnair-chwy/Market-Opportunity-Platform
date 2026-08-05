# Seattle market deep-dive evaluation cases

## Deterministic scoring

- Fixed fixture and configuration produce byte-equivalent structured results.
- Seven unique submarkets receive bounded scores and stable tie-breaking.
- Contributions reconcile to the visible total.
- A missing metric remains `null`, is listed as missing, reduces coverage, and
  causes only the remaining available weights to be visibly renormalized.
- Changing illustrative hub coordinates or radii does not change any score.
- Seven unique, finite hubs generate deterministic closed geodesic rings with
  explicit non-scoring metadata.
- Fixed plus-or-minus five-point weight scenarios produce best, worst, and
  range ranks without model involvement.

## Approval and policy

- A new run calls market context and proposed segmentation, then pauses.
- `compare_submarkets` is prohibited while segmentation is pending.
- Confirm resumes validation and permits comparison.
- Reject and leave-unresolved block without comparison or broker preparation.
- Unsupported tools, unsafe decision language, and step overflow fail safely.

## Evidence and interface

- `SRC-014`, `SRC-015`, and `SRC-016` are labeled `market_context_only` and
  non-scored.
- Synthetic submarkets and fictional brokers retain their source IDs, evidence
  state, allowed use, versions, and limitations.
- Waiting UI shows the illustrative-area warning, method version, synchronized
  legend, and confirmation controls but no rank.
- The overlay appears only for Seattle while the deep dive is open, and map,
  legend, priority cards, and ranking rows share one active submarket ID.
- Completed UI shows “priority under demo criteria,” contribution detail,
  missing inputs, sensitivity, fictional broker disclosure, and remaining work.
- Missing model configuration returns a controlled no-store response.
