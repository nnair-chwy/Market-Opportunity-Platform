import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  buildTradeAreaProfiles,
  comparisonWarnings,
  validateDistributionBands,
} from "../lib/esri-demo/trade-area-profile.ts";
import type {
  EsriDemoManifest,
  EsriSiteIdentity,
  EsriSiteTradeAreaLink,
  EsriTradeAreaRecord,
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

async function fixture() {
  const [manifest, sites, links, tradeAreas] = await Promise.all([
    json<EsriDemoManifest>("manifest.json"),
    json<EsriSiteIdentity[]>("site-identities.json"),
    json<EsriSiteTradeAreaLink[]>("site-trade-area-crosswalk.json"),
    json<EsriTradeAreaRecord[]>("trade-areas.json"),
  ]);
  return { manifest, sites, links, tradeAreas };
}

test("builds deterministic non-scored profiles from only the shared fixture", async () => {
  const input = await fixture();
  const profiles = buildTradeAreaProfiles(input);
  assert.equal(profiles.length, 71);
  assert.equal(
    profiles.flatMap((profile) => profile.variants).length,
    72,
  );
  assert.equal(
    profiles
      .flatMap((profile) => profile.variants)
      .filter((variant) => variant.relationship_review_state === "synthetic")
      .length,
    4,
  );
  assert.equal(
    profiles.filter((profile) => profile.variants.length > 1).length,
    1,
  );
  assert.ok(
    profiles.every(
      (profile) =>
        profile.scoring_eligibility === "none" &&
        profile.source_snapshot_id === "esri-demo-2026-07-30",
    ),
  );
  assert.deepEqual(
    profiles.map((profile) => profile.site_name),
    [...profiles.map((profile) => profile.site_name)].sort((a, b) =>
      a.localeCompare(b),
    ),
  );
});

test("preserves nulls and exposes unknown date, unit, method, and source formula", async () => {
  const profiles = buildTradeAreaProfiles(await fixture());
  const supplied = profiles
    .flatMap((profile) => profile.variants)
    .find((variant) => !variant.is_synthetic)!;
  const unknownUnit = supplied.observations.find(
    (observation) => observation.metric_id === "chewy_healthcare_sales",
  )!;
  assert.equal(unknownUnit.unit, null);
  assert.ok(unknownUnit.warnings.includes("Unit unknown"));
  assert.equal(unknownUnit.observed_at, null);
  assert.ok(unknownUnit.warnings.includes("Observation date unknown"));
  assert.equal(unknownUnit.geography_method, null);
  assert.ok(unknownUnit.warnings.includes("Trade-area method unknown"));
  const sourceFormula = supplied.observations.find(
    (observation) => observation.metric_id === "pet_households_per_clinic",
  )!;
  assert.ok(
    sourceFormula.warnings.includes(
      "Source formula is unconfirmed and was not recalculated",
    ),
  );
  assert.ok(
    supplied.observations
      .filter((observation) => observation.raw_value === null)
      .every((observation) => observation.warnings.includes("Value unavailable")),
  );
});

test("keeps provisional, review-required, synthetic, and unassigned links distinct", async () => {
  const input = await fixture();
  const baseSite = input.sites[0];
  const baseLink = input.links.find((link) => link.site_id === baseSite.site_id)!;
  const baseTradeArea = input.tradeAreas.find(
    (record) => record.trade_area_id === baseLink.trade_area_id,
  )!;
  const states = [
    ["source_provided", "provisional"],
    ["needs_review", "review_required"],
    ["synthetic_fallback", "synthetic"],
    ["unassigned", "unassigned"],
  ] as const;
  for (const [linkState, expected] of states) {
    const profile = buildTradeAreaProfiles({
      sites: [baseSite],
      links: [{ ...baseLink, link_state: linkState }],
      tradeAreas: [
        {
          ...baseTradeArea,
          is_synthetic: linkState === "synthetic_fallback",
          role:
            linkState === "synthetic_fallback" ? "synthetic_demo" : "unknown",
        },
      ],
      manifest: input.manifest,
    })[0];
    assert.equal(profile.variants[0].relationship_review_state, expected);
  }
});

test("validates percentage ranges and rejects malformed fixture relationships", async () => {
  const input = await fixture();
  const site = input.sites.find((candidate) =>
    input.links.some(
      (link) =>
        link.site_id === candidate.site_id &&
        link.link_state === "source_provided",
    ),
  )!;
  const link = input.links.find((candidate) => candidate.site_id === site.site_id)!;
  const record = input.tradeAreas.find(
    (candidate) => candidate.trade_area_id === link.trade_area_id,
  )!;
  const percentageIndex = record.metrics.findIndex(
    (metric) => metric.metric_id === "cvc_customer_percent",
  );
  const invalidPercentageRecord = {
    ...record,
    metrics: record.metrics.map((metric, index) =>
      index === percentageIndex ? { ...metric, raw_value: 140 } : metric,
    ),
  };
  const invalidProfile = buildTradeAreaProfiles({
    sites: [site],
    links: [link],
    tradeAreas: [invalidPercentageRecord],
    manifest: input.manifest,
  })[0];
  const invalidPercentage = invalidProfile.variants[0].observations.find(
    (observation) => observation.metric_id === "cvc_customer_percent",
  )!;
  assert.equal(invalidPercentage.quality_status, "rejected");

  await assert.rejects(
    async () =>
      buildTradeAreaProfiles({
        sites: [site],
        links: [{ ...link, trade_area_id: "missing-trade-area" }],
        tradeAreas: [record],
        manifest: input.manifest,
      }),
    /missing trade area/,
  );
  const nonFiniteRecord = {
    ...record,
    metrics: record.metrics.map((metric, index) =>
      index === 0 ? { ...metric, raw_value: Number.POSITIVE_INFINITY } : metric,
    ),
  };
  assert.throws(
    () =>
      buildTradeAreaProfiles({
        sites: [site],
        links: [link],
        tradeAreas: [nonFiniteRecord],
        manifest: input.manifest,
      }),
    /non-finite/,
  );
  const unapprovedMetricRecord = {
    ...record,
    metrics: [
      ...record.metrics,
      {
        ...record.metrics[0],
        metric_id: "unapproved_metric",
        source_field: "Unapproved Metric",
        label: "Unapproved metric",
      },
    ],
  };
  assert.throws(
    () =>
      buildTradeAreaProfiles({
        sites: [site],
        links: [link],
        tradeAreas: [unapprovedMetricRecord],
        manifest: input.manifest,
      }),
    /not approved for the profile contract/,
  );
});

test("distribution checks fail closed when bands are missing or invalid", () => {
  assert.deepEqual(validateDistributionBands({ values: [30, null, 70] }), {
    state: "incomplete",
    total: null,
  });
  assert.equal(
    validateDistributionBands({ values: [30, 20, 50] }).state,
    "accepted",
  );
  assert.equal(
    validateDistributionBands({ values: [30, 20, 40] }).state,
    "warning",
  );
  assert.equal(
    validateDistributionBands({ values: [30, Number.NaN, 70] }).state,
    "rejected",
  );
});

test("comparison warnings prevent unsupported temporal and geographic claims", async () => {
  const profiles = buildTradeAreaProfiles(await fixture());
  const supplied = profiles
    .flatMap((profile) => profile.variants)
    .filter((variant) => !variant.is_synthetic)
    .slice(0, 2);
  const warnings = comparisonWarnings(supplied);
  assert.ok(warnings.some((warning) => warning.includes("Observation dates")));
  assert.ok(warnings.some((warning) => warning.includes("Trade-area methods")));
  const synthetic = profiles
    .flatMap((profile) => profile.variants)
    .find((variant) => variant.is_synthetic)!;
  assert.ok(
    comparisonWarnings([supplied[0], synthetic]).some((warning) =>
      warning.includes("mixes supplied and synthetic"),
    ),
  );
});

test("profiles omit restricted fields and remain separate from Census context", async () => {
  const profiles = buildTradeAreaProfiles(await fixture());
  const serialized = JSON.stringify(profiles);
  assert.doesNotMatch(
    serialized,
    /Landlord Name|Base Rent|Lease Term|account_owner|phone/i,
  );
  assert.doesNotMatch(serialized, /total_population|cbsa_name|geometry/);
  assert.ok(
    profiles.every((profile) =>
      profile.unavailable_evidence.some(
        (item) => item.field_group === "Risk and labor context",
      ),
    ),
  );
  assert.doesNotMatch(
    serialized,
    /"score":|site_score|composite|ranking|winner|recommendation/i,
  );
});
