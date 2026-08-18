import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { consumerInsightsManifestSchema, consumerInsightsQuerySchema } from "../lib/consumer-insights/contracts.ts";
import { queryConsumerInsights } from "../lib/consumer-insights/queries.ts";

const snapshotDir = "data/approved/consumer-insights/chewy-brand-health-2024-dma-generation-v1";
const snapshotVersion = "chewy-brand-health-2024-dma-generation-v1";

async function localSnapshotAvailable() {
  try { await access(`${snapshotDir}/manifest.json`); return true; } catch { return false; }
}

test("validates consumer-insights query contracts and rejects unsupported shapes", () => {
  assert.equal(consumerInsightsQuerySchema.safeParse({ query: "brand_funnel_by_dma", snapshotVersion, dmaId: "DMA_BOSTON" }).success, true);
  assert.equal(consumerInsightsQuerySchema.safeParse({ query: "brand_funnel_by_dma", snapshotVersion, dmaId: "" }).success, false);
  assert.equal(consumerInsightsQuerySchema.safeParse({ query: "arbitrary_sql", snapshotVersion }).success, false);
});

test("validates the generated consumer-insights manifest and Parquet row counts", async (t) => {
  if (!(await localSnapshotAvailable())) { t.skip("Local confidential consumer-insights snapshot is not present."); return; }
  const manifest = consumerInsightsManifestSchema.parse(JSON.parse(await readFile(`${snapshotDir}/manifest.json`, "utf8")));
  assert.equal(manifest.snapshot_version, snapshotVersion);
  assert.equal(manifest.source_id, "SRC-033");
  assert.equal(manifest.scoring_eligibility, "none");
  assert.equal(manifest.outputs.find((item) => item.path.endsWith("dma_reference.parquet"))?.rowCount, 32);
  assert.equal(manifest.outputs.find((item) => item.path.endsWith("dma_market_profile.parquet"))?.rowCount, 32);
  assert.equal(manifest.outputs.find((item) => item.path.endsWith("dma_generation_funnel.parquet"))?.rowCount, 780);
});

test("executes registered consumer-insights queries with provenance and boundaries", async (t) => {
  if (!(await localSnapshotAvailable())) { t.skip("Local confidential consumer-insights snapshot is not present."); return; }
  const options = { snapshotDir, databasePath: ":memory:" };
  const profile = await queryConsumerInsights({ query: "consumer_insights_by_dma", snapshotVersion, dmaId: "DMA_BOSTON" }, options);
  assert.equal(profile.rows.length, 1);
  assert.equal(profile.rows[0].bdi, 191);
  assert.equal(profile.rows[0].cdi, 87);
  assert.equal(profile.sourceId, "SRC-033");
  assert.match(profile.evidenceBoundary, /Intuitive DMA-to-CBSA alignment/);
  const cbsaProfile = await queryConsumerInsights({ query: "consumer_insights_by_cbsa", snapshotVersion, cbsaCode: "14460" }, options);
  assert.equal(cbsaProfile.rows[0].dma_name, "Boston");
  assert.equal(cbsaProfile.rows[0].mapped_cbsa_code, "14460");

  const funnel = await queryConsumerInsights({ query: "brand_funnel_by_dma", snapshotVersion, dmaId: "DMA_BOSTON", brand: "Chewy" }, options);
  assert.equal(funnel.rows.length, 4);
  assert(funnel.rows.every((row) => row.brand === "Chewy"));
  assert.deepEqual(Object.fromEntries(funnel.rows.map((row) => [row.metric, row.value])), { Awareness: 80, Consideration: 48, Familiarity: 69, "Usage P12M": 41 });

  const drivers = await queryConsumerInsights({ query: "brand_relevance_drivers_by_dma", snapshotVersion, dmaId: "DMA_BOSTON", brand: "Chewy" }, options);
  assert.equal(drivers.rows.length, 12);
  assert(drivers.rows.every((row) => row.attribute));

  const generation = await queryConsumerInsights({ query: "brand_health_by_generation", snapshotVersion, dmaId: "DMA_BOSTON", segment: "Gen Z/Millennials", brand: "Chewy" }, options);
  assert.equal(generation.rows.length, 16);
  assert(generation.rows.some((row) => row.evidence_type === "funnel"));
  assert(generation.rows.some((row) => row.evidence_type === "driver"));

  const quality = await queryConsumerInsights({ query: "consumer_insights_source_quality", snapshotVersion }, options);
  assert.equal(quality.rows[0].scoring_eligibility, "none");
});
