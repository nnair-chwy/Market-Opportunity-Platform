import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type Catalog = {
  snapshotId: string;
  scoringEligibility: string;
  files: Array<{
    originalFile: string;
    renamedFile: string;
    datasetRole: string;
    sha256: string;
  }>;
};

const catalog = JSON.parse(
  await readFile("data/contracts/google-ads/export-catalog.json", "utf8"),
) as Catalog;

test("catalogs all U.S. Google Ads exports under descriptive unique names", () => {
  assert.equal(catalog.snapshotId, "2026-07-14_2026-08-12");
  assert.equal(catalog.scoringEligibility, "none");
  assert.equal(catalog.files.length, 16);
  assert.equal(new Set(catalog.files.map((file) => file.originalFile)).size, 16);
  assert.equal(new Set(catalog.files.map((file) => file.renamedFile)).size, 16);

  for (const file of catalog.files) {
    assert.match(file.renamedFile, /^[a-z0-9-]+_[a-z0-9-]+(?:_[a-z0-9-]+)*\.csv$/);
    assert.doesNotMatch(file.renamedFile, /^(Location|Matched locations) report/);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
});

test("separates performance, drill-down, scope, and conversion semantics", () => {
  const roles = new Set(catalog.files.map((file) => file.datasetRole));
  assert.deepEqual(
    [...roles].sort(),
    [
      "configured_scope",
      "conversion_semantics_only",
      "drill_down",
      "primary_validation",
      "program_drill_down",
      "reconciliation",
    ],
  );

  assert.equal(
    catalog.files.filter((file) => file.datasetRole === "primary_validation").length,
    2,
  );
  assert.equal(
    catalog.files.filter((file) => file.datasetRole === "conversion_semantics_only").length,
    2,
  );
});
