import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("market selection opens a synchronized public-evidence drawer",async()=>{
  const source=await readFile(new URL("../components/evaluation-workspace/MarketLocationArtifact.tsx",import.meta.url),"utf8");
  assert.match(source,/MarketDetailDrawer/);
  assert.match(source,/Selected Census market/);
  assert.match(source,/PUBLIC_MARKET_MEASURES\.map/);
  assert.match(source,/What this can support/);
  assert.match(source,/measure\.sourceUrl/);
  assert.doesNotMatch(source,/Ask AI about this market|prompt\.trim/);
  assert.match(source,/onChooseMarket=\{setSelectedCode\}/);
});
