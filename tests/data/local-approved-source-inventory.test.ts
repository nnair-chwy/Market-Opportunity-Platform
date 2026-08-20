import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventory = JSON.parse(
  await readFile(new URL("../../data/contracts/local-approved-source-inventory.json", import.meta.url), "utf8"),
);

test("local source inventory exposes the five contracted packages", () => {
  assert.deepEqual(
    inventory.packages.map((sourcePackage: { id: string }) => sourcePackage.id),
    [
      "google-ads-2026-07-14_2026-08-12",
      "snowflake-pricing-2026-08-17",
      "seo-keywords-2026-08-14",
      "zeus-ui-2026-08-18",
      "tableau-cvc-2026-08-20",
    ],
  );
  assert.equal(
    inventory.packages.reduce((total: number, sourcePackage: { fileCount: number }) => total + sourcePackage.fileCount, 0),
    56,
  );
  assert.ok(inventory.packages.every((sourcePackage: { gitTracked: boolean }) => sourcePackage.gitTracked === false));
});

test("inventory retains GIS permission blocks and no credentials", () => {
  assert.equal(inventory.gisDownloadStatus.cvcCustomerGeospatialDashboard, "permission_denied_no_download");
  assert.equal(inventory.gisDownloadStatus.cvcVetCompetitionDashboard, "permission_denied_no_download");
  const serialized = JSON.stringify(inventory).toLowerCase();
  assert.equal(serialized.includes("access_token="), false);
  assert.equal(serialized.includes("@chewy.com"), false);
});
