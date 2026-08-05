import manifestJson from "@/data/synthetic/seattle-market-deep-dive/v1/manifest.json";
import submarketsJson from "@/data/synthetic/seattle-market-deep-dive/v1/submarkets.json";
import brokersJson from "@/data/synthetic/seattle-market-deep-dive/v1/brokers.json";
import { z } from "zod";
import {
  SEATTLE_BROKER_SOURCE_ID,
  SEATTLE_SUBMARKET_SOURCE_ID,
  brokerProfileSchema,
  seattleSubmarketSchema,
  type DemoBrokerProfile,
  type SeattleSubmarket,
} from "./types.ts";

export const seattleDeepDiveManifestSchema = z.object({
  schema_version: z.literal("1.0.0"),
  fixture_version: z.string().min(1),
  geometry_method_version: z.literal("illustrative-geodesic-hubs-v1"),
  parent_cbsa_code: z.literal("42660"),
  parent_market_name: z.literal("Seattle-Tacoma-Bellevue, WA"),
  reporting_date: z.string().date(),
  submarket_source_id: z.literal(SEATTLE_SUBMARKET_SOURCE_ID),
  broker_source_id: z.literal(SEATTLE_BROKER_SOURCE_ID),
  evidence_status: z.literal("Hypothesis"),
  allowed_use: z.literal("synthetic_prototype_only"),
  submarket_count: z.literal(7),
  broker_profile_count: z.number().int().positive(),
  public_context_source_ids: z.tuple([z.literal("SRC-014"), z.literal("SRC-015"), z.literal("SRC-016")]),
  limitations: z.array(z.string().min(1)).min(1),
}).strict();

export const seattleDeepDiveManifest = seattleDeepDiveManifestSchema.parse(manifestJson);

const baseSubmarkets = z.array(seattleSubmarketSchema).length(7).parse(submarketsJson);
if (new Set(baseSubmarkets.map((item) => item.submarket_id)).size !== baseSubmarkets.length) {
  throw new Error("Seattle deep-dive fixture contains duplicate submarket IDs.");
}
export const seattleSubmarkets: readonly SeattleSubmarket[] = baseSubmarkets.map((item) => ({
  ...item,
  source_id: SEATTLE_SUBMARKET_SOURCE_ID,
  evidence_status: "Hypothesis",
  allowed_use: "synthetic_prototype_only",
  scoring_eligibility: "synthetic_prototype_only",
  fixture_version: seattleDeepDiveManifest.fixture_version,
  last_updated_at: seattleDeepDiveManifest.reporting_date,
}));

const baseBrokers = z.array(brokerProfileSchema).parse(brokersJson);
if (baseBrokers.length !== seattleDeepDiveManifest.broker_profile_count) {
  throw new Error("Seattle broker fixture count does not match its manifest.");
}
export const seattleDemoBrokers: readonly DemoBrokerProfile[] = baseBrokers.map((item) => ({
  ...item,
  source_id: SEATTLE_BROKER_SOURCE_ID,
  evidence_status: "Hypothesis",
  scoring_eligibility: "none",
}));
