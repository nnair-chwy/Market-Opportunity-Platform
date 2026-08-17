import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Catalog = {
  snapshotId: string;
  files: Array<{
    originalFile: string;
    renamedFile: string;
    sha256: string;
  }>;
};

const inputDir = resolve(
  process.env.GOOGLE_ADS_EXPORT_DIR?.trim() ?? "/Users/xwang1/Downloads",
);
const catalogPath = resolve("data/contracts/google-ads/export-catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog;
const outputDir = resolve(
  process.env.GOOGLE_ADS_SNAPSHOT_DIR?.trim()
    ?? `data/approved/google-ads/${catalog.snapshotId}/raw`,
);

await mkdir(outputDir, { recursive: true });

for (const file of catalog.files) {
  const source = resolve(inputDir, file.originalFile);
  const destination = resolve(outputDir, file.renamedFile);
  const bytes = await readFile(source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== file.sha256) {
    throw new Error(`${file.originalFile} does not match the catalog hash.`);
  }
  const title = bytes.subarray(0, 80).toString("utf8");
  if (!/^((Matched locations)|(Location)) report/.test(title)) {
    throw new Error(`${file.originalFile} is not a recognized Google Ads location report.`);
  }
  await copyFile(source, destination);
}

console.log(`Organized and verified ${catalog.files.length} Google Ads exports in ${outputDir}.`);
