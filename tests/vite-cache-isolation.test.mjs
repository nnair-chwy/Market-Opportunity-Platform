import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("isolates Vite optimizer caches without bypassing Vinext interop", async () => {
  const config = await readFile(
    new URL("../vite.config.ts", import.meta.url),
    "utf8",
  );

  assert.match(config, /defineConfig\(async \(\{ command, mode \}\) =>/);
  assert.match(
    config,
    /cacheDir:\s*`node_modules\/\.vite\/\$\{command\}-\$\{mode\}`/,
  );
  assert.doesNotMatch(config, /cacheDir:\s*`\.cache\/vite\//);
});
