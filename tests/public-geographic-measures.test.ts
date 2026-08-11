import assert from "node:assert/strict";
import test from "node:test";
import { matchPublicMarketMeasure, publicMarketMeasureScores, rankedPublicMarkets } from "../lib/evaluation/geographic-measures.ts";
import { publicMarkets } from "../lib/data/public-market-ui.ts";

test("public measures produce deterministic national CBSA layers",()=>{
  const scores=publicMarketMeasureScores("market_population");
  assert.equal(Object.keys(scores).length,publicMarkets.filter((market)=>market.acs?.metrics.total_population.raw_value!==null).length);
  assert.equal(rankedPublicMarkets("market_population",1)[0].market.cbsa_code,"35620");
  assert.equal(scores["35620"],100);
});

test("questions select measures from the declarative catalog",()=>{
  assert.equal(matchPublicMarketMeasure("Where are the densest U.S. markets?")?.id,"market_density");
  assert.equal(matchPublicMarketMeasure("Compare median income across cities")?.id,"market_income");
});
