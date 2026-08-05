# ADR-001: Clinic-first, documentation-first MVP

- Status: Proposed
- Date: 2026-07-24

## Context

The repository name allows retail and clinic evaluation, but the available evidence is strongest for clinic location selection. A current internal plan may already own predictive modeling and ranking. Data access, outcome definition, and Esri integration are unresolved.

## Decision

Begin with clinics only. Approve the research, scope, contracts, boundaries, and evaluation workflow before generating application code. Use synthetic data for the first implementation. Frame the product as transparent decision support, subject to an overlap decision with the existing internal plan.

## Alternatives

1. Build both retail and clinic workflows immediately.
2. Start coding a predictive model from assumed inputs.
3. Build an Esri-connected application before access is confirmed.
4. Build a synthetic evidence and comparison workflow after documentation approval.

Option 4 is proposed.

## Consequences

- Faster validation of the workflow with lower data risk
- Clear separation between deterministic scoring and AI explanation
- No immediate claim of production integration or predictive accuracy
- A required discovery gate before code
- Retail remains a possible later extension

## Evidence

SRC-001, SRC-002, SRC-003, SRC-007.
