import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  CANDIDATE_COMPARISON_FIELD_ORDER,
  CANDIDATE_EVIDENCE_SECTION_ORDER,
  buildCandidateEvidenceBrief,
  buildCandidateEvidenceComparison,
} from "../lib/esri-demo/candidate-evidence.ts";
import { DEMO_CANDIDATE_SITE_IDS } from "../lib/esri-demo/candidate-evidence-fixtures.ts";
import { buildTradeAreaProfiles } from "../lib/esri-demo/trade-area-profile.ts";
import type {
  EsriDemoManifest,
  EsriFieldCatalogRecord,
  EsriSiteIdentity,
  EsriSiteTradeAreaLink,
  EsriTradeAreaRecord,
  PortfolioSiteReadiness,
} from "../lib/esri-demo/types.ts";

const fixtureRoot = path.resolve(
  import.meta.dirname,
  "../data/sample/esri/2026-07-30",
);

async function json<T>(filename: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(fixtureRoot, filename), "utf8"),
  ) as T;
}

const [
  esriDemoManifest,
  esriFieldCatalog,
  esriPortfolioReadiness,
  esriSiteIdentities,
  esriSiteTradeAreaCrosswalk,
  esriTradeAreas,
] = await Promise.all([
  json<EsriDemoManifest>("manifest.json"),
  json<EsriFieldCatalogRecord[]>("field-catalog.json"),
  json<PortfolioSiteReadiness[]>("portfolio-readiness.json"),
  json<EsriSiteIdentity[]>("site-identities.json"),
  json<EsriSiteTradeAreaLink[]>("site-trade-area-crosswalk.json"),
  json<EsriTradeAreaRecord[]>("trade-areas.json"),
]);
const esriTradeAreaProfiles = buildTradeAreaProfiles({
  manifest: esriDemoManifest,
  sites: esriSiteIdentities,
  links: esriSiteTradeAreaCrosswalk,
  tradeAreas: esriTradeAreas,
});

const commonInput = {
  manifest: esriDemoManifest,
  fieldCatalog: esriFieldCatalog,
  sites: esriSiteIdentities,
  readiness: esriPortfolioReadiness,
  links: esriSiteTradeAreaCrosswalk,
  profiles: esriTradeAreaProfiles,
};

const macArthurId = DEMO_CANDIDATE_SITE_IDS[0];
const mixId = DEMO_CANDIDATE_SITE_IDS[1];
const londonId = DEMO_CANDIDATE_SITE_IDS[2];
const barkinId = DEMO_CANDIDATE_SITE_IDS[4];

test("builds byte-equivalent briefs with stable section ordering and versions", () => {
  const first = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: macArthurId,
  });
  const second = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: macArthurId,
  });

  assert.deepEqual(first, second);
  assert.equal(first.brief_version, "candidate-evidence-brief-v1");
  assert.equal(first.generated_at, "2026-07-30T00:00:00.000Z");
  assert.deepEqual(
    first.sections.map((section) => section.section_id),
    CANDIDATE_EVIDENCE_SECTION_ORDER,
  );
  assert.deepEqual(first.source_snapshot_versions.slice(0, 2), [
    esriDemoManifest.snapshot_id,
    esriDemoManifest.transformation_version,
  ]);
  assert.equal(first.scoring_eligibility, "none");
});

test("keeps supplied, derived, and synthetic evidence visibly distinct", () => {
  const supplied = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: mixId,
  });
  const fallback = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: barkinId,
  });
  const suppliedOrigins = new Set(
    supplied.sections
      .flatMap((section) => section.observations)
      .map((item) => item.origin),
  );

  assert.deepEqual([...suppliedOrigins].sort(), [
    "derived",
    "supplied",
    "synthetic",
  ]);
  assert.equal(fallback.trade_area_relationship.review_state, "synthetic");
  assert.equal(fallback.parent_market.relationship_state, "unassigned");
  assert(
    fallback.sections
      .find((section) => section.section_id === "market_trade_area")
      ?.observations.every(
        (item) =>
          item.origin === "synthetic" && item.evidence_status === "Hypothesis",
      ),
  );
});

test("surfaces missing, unknown, stale, restricted, rejected, and conflicting evidence", () => {
  const brief = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: macArthurId,
  });
  const states = new Set(
    brief.sections
      .flatMap((section) => section.observations)
      .map((item) => item.evidence_state),
  );

  for (const state of [
    "missing",
    "unknown",
    "stale",
    "restricted",
    "rejected",
    "conflicting",
  ]) {
    assert(states.has(state as never), `Expected visible ${state} state`);
  }
  assert(brief.conflicting_information.length > 0);
  assert(brief.restrictions.every((item) => item.raw_value === null));
  assert(
    brief.restrictions
      .filter((item) => item.evidence_state === "restricted")
      .every((item) => item.is_redacted),
  );
});

test("physical-site evidence includes only minimized approved fields", () => {
  const brief = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: mixId,
  });
  const physical = brief.sections.find(
    (section) => section.section_id === "physical_site",
  );
  assert(physical);
  const fields = physical.observations.map((item) => item.field_id);

  assert(fields.includes("physical_site.site_square_feet"));
  assert(fields.includes("physical_site.usable_site_square_feet"));
  assert(fields.includes("physical_site.design_room_count"));
  assert(fields.includes("physical_site.co_tenants"));
  assert(!fields.some((field) => /lease|landlord|rent|address|business_id/.test(field)));
  assert(!fields.some((field) => /closest_competitor/.test(field)));
  assert(
    physical.observations.every(
      (item) =>
        item.source_id === "SRC-017" &&
        item.sensitivity === "internal" &&
        item.scoring_eligibility === "none",
    ),
  );
});

test("clinic landscape separates source account rows from synthetic physical locations", () => {
  const brief = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: mixId,
  });
  const clinic = brief.sections.find(
    (section) => section.section_id === "clinic_landscape",
  );
  assert(clinic);
  const byField = new Map(
    clinic.observations.map((item) => [item.field_id, item]),
  );
  const accounts = byField.get("clinic_landscape.source_account_rows");
  const physical = byField.get(
    "clinic_landscape.estimated_physical_locations",
  );

  assert(accounts);
  assert(physical);
  assert.notEqual(accounts.raw_value, physical.raw_value);
  assert.equal(accounts.origin, "synthetic");
  assert.equal(physical.origin, "synthetic");
  assert.equal(accounts.evidence_state, "stale");
  assert(
    clinic.observations.some(
      (item) =>
        item.field_id ===
        "clinic_landscape.repeated_coordinate_rows_retained",
    ),
  );
  assert(
    brief.restrictions.some(
      (item) =>
        item.field_id === "constraints_diligence.supplied_clinic_rows" &&
        item.evidence_state === "rejected",
    ),
  );
});

test("generates deterministic open-ended follow-up questions from visible gaps", () => {
  const brief = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: macArthurId,
  });
  const repeated = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: macArthurId,
  });

  assert.deepEqual(brief.follow_up_questions, repeated.follow_up_questions);
  assert(brief.follow_up_questions.length >= 7);
  assert(
    brief.follow_up_questions.every(
      (item) =>
        item.question.endsWith("?") &&
        item.expected_source_or_owner.length > 0 &&
        item.source_observation_ids.length > 0,
    ),
  );
  assert(
    brief.follow_up_questions.some((item) =>
      item.question.includes("each linked trade-area variant"),
    ),
  );
  assert(
    brief.follow_up_questions.every(
      (item) =>
        !/(\bsign\b|lease this|open this|\bbest\b|\bwinner\b|recommend)/i.test(
          item.question,
        ),
    ),
  );
});

test("comparison preserves analyst selection order and exposes comparability warnings", () => {
  const comparison = buildCandidateEvidenceComparison({
    ...commonInput,
    siteIds: [londonId, macArthurId, mixId],
  });

  assert.deepEqual(comparison.candidate_order, [
    londonId,
    macArthurId,
    mixId,
  ]);
  assert.deepEqual(comparison.field_order, CANDIDATE_COMPARISON_FIELD_ORDER);
  assert.deepEqual(comparison.section_order, CANDIDATE_EVIDENCE_SECTION_ORDER);
  assert(comparison.comparability_warnings.length > 0);
  assert(
    comparison.comparability_warnings.some((item) =>
      item.includes("observation dates are unknown"),
    ),
  );
  assert(
    comparison.comparability_warnings.some((item) =>
      item.includes("trade-area methods are unknown"),
    ),
  );
  assert.equal(comparison.scoring_eligibility, "none");
});

test("comparison enforces two-to-five limits and rejects duplicates", () => {
  assert.throws(
    () =>
      buildCandidateEvidenceComparison({
        ...commonInput,
        siteIds: [mixId],
      }),
    /two to five/,
  );
  assert.throws(
    () =>
      buildCandidateEvidenceComparison({
        ...commonInput,
        siteIds: [mixId, mixId],
      }),
    /duplicate/,
  );
  assert.throws(
    () =>
      buildCandidateEvidenceComparison({
        ...commonInput,
        siteIds: [...DEMO_CANDIDATE_SITE_IDS, macArthurId],
      }),
    /two to five/,
  );
});

test("fails closed on malformed fixture identities, readiness, values, and variants", () => {
  assert.throws(
    () =>
      buildCandidateEvidenceBrief({
        ...commonInput,
        siteId: macArthurId,
        sites: [...esriSiteIdentities, esriSiteIdentities[0]],
      }),
    /Duplicate site identity/,
  );
  assert.throws(
    () =>
      buildCandidateEvidenceBrief({
        ...commonInput,
        siteId: macArthurId,
        readiness: esriPortfolioReadiness.filter(
          (item) => item.site_id !== macArthurId,
        ),
      }),
    /Missing readiness record/,
  );
  assert.throws(
    () =>
      buildCandidateEvidenceBrief({
        ...commonInput,
        siteId: mixId,
        sites: esriSiteIdentities.map((site) =>
          site.site_id === mixId
            ? {
                ...site,
                physical_evidence: {
                  ...site.physical_evidence,
                  site_square_feet: Number.NaN,
                },
              }
            : site,
        ),
      }),
    /non-finite/,
  );
  assert.throws(
    () =>
      buildCandidateEvidenceBrief({
        ...commonInput,
        siteId: mixId,
        tradeAreaId: "not-linked",
      }),
    /not linked/,
  );
});

test("serialized briefs contain no scoring outputs, recommendation fields, or hidden restricted values", () => {
  const brief = buildCandidateEvidenceBrief({
    ...commonInput,
    siteId: macArthurId,
  });
  const serialized = JSON.stringify(brief);

  assert.doesNotMatch(
    serialized,
    /"total_score"|"normalized_contribution"|"attractiveness_band"|"rank"|"predicted_performance"|"recommended_site"|"investment_recommendation"|"lease_recommendation"/,
  );
  assert.doesNotMatch(
    serialized,
    /phone|prescriptions_count|account_owner|rx_contact_preference|base_rent|security_deposit/i,
  );
  assert.match(serialized, /Restricted values are excluded/);
  assert.match(serialized, /scoring_eligibility":"none"/);
});
