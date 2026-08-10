import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("campaign questions show governed public context without a made-up proxy score", async () => {
  const source = await readFile(new URL("../components/evaluation-workspace/MarketLocationArtifact.tsx", import.meta.url), "utf8");
  assert.match(source, /PUBLIC_MARKET_MEASURES/);
  assert.match(source, /marketScores=\{scores\}/);
  assert.match(source, /PublicRanking/);
  assert.doesNotMatch(source, /campaignScore|syntheticMarketAttractivenessResults/);
  assert.match(source, /It does not yet rank campaign opportunity/);
});
