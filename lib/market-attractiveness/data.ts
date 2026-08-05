import snapshotJson from "@/data/synthetic/market-attractiveness/v1/markets.json";
import { MARKET_ATTRACTIVENESS_CONFIGURATION } from "./config.ts";
import { scoreSyntheticMarkets } from "./scoring.ts";
import type { SyntheticMarketSnapshot } from "./types.ts";

export const syntheticMarketSnapshot =
  snapshotJson as SyntheticMarketSnapshot;

export const syntheticMarketAttractivenessResults = scoreSyntheticMarkets(
  syntheticMarketSnapshot,
  MARKET_ATTRACTIVENESS_CONFIGURATION,
);
