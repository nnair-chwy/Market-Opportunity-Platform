import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("active map includes one matching method and missing-data summary",async()=>{
  const source=await readFile(new URL("../components/evaluation-workspace/MarketLocationArtifact.tsx",import.meta.url),"utf8");
  assert.match(source,/How this map was made/);
  assert.match(source,/Census Core Based Statistical Area/);
  assert.match(source,/deeper blue means a higher percentile/);
  assert.match(source,/Best next data/);
  assert.doesNotMatch(source,/50% Chewy demand|synthetic campaign-opportunity/);
});
