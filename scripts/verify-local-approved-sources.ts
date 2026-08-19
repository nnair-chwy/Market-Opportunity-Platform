import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const readJson = async (file: string) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const sha256 = async (file: string) => createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");

const google = await readJson("data/contracts/google-ads/export-catalog.json");
for (const item of google.files) {
  const file = `data/approved/google-ads/${google.snapshotId}/raw/${item.renamedFile}`;
  assert.equal(await sha256(file), item.sha256, file);
}
for (const item of google.excludedFiles) {
  const file = `data/approved/google-ads/${google.snapshotId}/excluded/${item.renamedFile}`;
  assert.equal(await sha256(file), item.sha256, file);
}

const snowflake = await readJson("data/contracts/pricing-snowflake/export-manifest.json");
for (const item of snowflake.exports) {
  const file = `${snowflake.rawDirectory}/${item.file}`;
  assert.equal(await sha256(file), item.sha256, file);
}

const seo = await readJson("data/contracts/seo-keywords/manifest.json");
for (const item of seo.files) {
  const file = `${seo.rawDirectory}/${item.renamedFile}`;
  assert.equal(await sha256(file), item.sha256, file);
}

const zeus = await readJson("data/contracts/zeus-ui/export-manifest.json");
for (const item of zeus.exports) {
  const file = `${zeus.localSnapshotDirectory}${item.file}`;
  assert.equal(await sha256(file), item.sha256, file);
}

console.log(`Verified ${google.files.length + google.excludedFiles.length + snowflake.exports.length + seo.files.length + zeus.exports.length} manifest-backed files.`);
