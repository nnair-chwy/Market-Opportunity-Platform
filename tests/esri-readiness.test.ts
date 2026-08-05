import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  buildEsriDemo,
  type BuildArguments,
} from "../scripts/build-esri-demo.ts";
import { calculatePortfolioReadiness } from "../lib/esri-demo/readiness.ts";
import type {
  EsriDemoManifest,
  EsriSiteIdentity,
  EsriSiteTradeAreaLink,
  EsriTradeAreaRecord,
  PortfolioSiteReadiness,
  ReadinessEvidenceState,
} from "../lib/esri-demo/types.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const fixtureRoot = path.join(
  repositoryRoot,
  "data/sample/esri/2026-07-30",
);

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(fixtureRoot, filename), "utf8"),
  ) as T;
}

function csv(headers: string[], rows: string[][]) {
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");
}

async function createSmallSources(root: string) {
  await mkdir(root, { recursive: true });
  const clinicHeaders = [
    "clinic_id",
    "clinic_key",
    "golden_clinic_id",
    "objectid",
    "latitude",
    "longitude",
    "phone",
  ];
  const clinicRows = [
    ["clinic-1", "key-1", "gold-1", "1", "40.1", "-73.1", "555-0100"],
    ["clinic-2", "key-2", "gold-2", "2", "40.1", "-73.1", "555-0101"],
  ];
  const masterHeaders = [
    "GlobalID",
    "ESRI ID",
    "Site Code",
    "Site Name",
    "Brand",
    "Longitude",
    "Latitude",
    "State",
    "Market Name",
    "CBSA ID",
    "CBSA Name",
    "Open Status",
    "Open Year",
    "Open Quarter",
    "Site Square Foot",
    "Center Type",
    "Parking Type",
    "Main Street Visibility",
    "Center Ingress/Egress",
    "Landlord Name",
    "Base Rent",
  ];
  const masterRows = [
    [
      "{11111111-1111-1111-1111-111111111111}",
      "101",
      "A",
      "Alpha Site",
      "Chewy Vet Care",
      "-73.95",
      "40.72",
      "NY",
      "New York",
      "35620",
      "New York-Newark-Jersey City, NY-NJ",
      "Open",
      "2025",
      "Q1",
      "4000",
      "Neighborhood",
      "Surface",
      "Visible",
      "Signalized",
      "Restricted landlord",
      "100000",
    ],
    [
      "{22222222-2222-2222-2222-222222222222}",
      "",
      "B",
      "Alpha Site",
      "Modern Animal",
      "-73.95",
      "40.72",
      "NY",
      "New York",
      "35620",
      "New York-Newark-Jersey City, NY-NJ",
      "In Development",
      "2026",
      "Q2",
      "",
      "",
      "",
      "",
      "",
      "Restricted landlord 2",
      "200000",
    ],
  ];
  const clinicFull = path.join(root, "clinic-full.csv");
  const clinicDemo = path.join(root, "clinic-demo.csv");
  const masterFull = path.join(root, "master-full.csv");
  const masterDemo = path.join(root, "master-demo.csv");
  const tradeAreas = path.join(root, "trade-areas.xlsx");
  await Promise.all([
    writeFile(clinicFull, csv(clinicHeaders, clinicRows)),
    writeFile(clinicDemo, csv(clinicHeaders.slice(0, 6), clinicRows.map((row) => row.slice(0, 6)))),
    writeFile(masterFull, csv(masterHeaders, masterRows)),
    writeFile(masterDemo, csv(masterHeaders.slice(0, 19), masterRows.map((row) => row.slice(0, 19)))),
  ]);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("trade areas");
  sheet.addRow([
    "GlobalID",
    "ESRI_ID",
    "Site Name",
    "Population",
    "Households",
    "Households with Pets",
  ]);
  sheet.addRow([
    "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}",
    101,
    "Alpha Site",
    10000,
    4000,
    2500,
  ]);
  await workbook.xlsx.writeFile(tradeAreas);
  return {
    clinicFull,
    clinicDemo,
    masterFull,
    masterDemo,
    tradeAreas,
  };
}

test("checked-in Esri fixture reconciles source and output manifests", async () => {
  const manifest = await readJson<EsriDemoManifest>("manifest.json");
  assert.equal(manifest.snapshot_id, "esri-demo-2026-07-30");
  assert.deepEqual(
    manifest.sources.map(({ row_count, field_count }) => [
      row_count,
      field_count,
    ]),
    [
      [36461, 90],
      [36461, 25],
      [71, 84],
      [71, 49],
      [592, 70],
    ],
  );
  assert.equal(manifest.counts.source_sites, 71);
  assert.equal(manifest.counts.source_linked_sites, 67);
  assert.equal(manifest.counts.synthetic_fallback_sites, 4);
  assert.equal(manifest.counts.one_to_many_site_links, 1);
  assert.equal(manifest.scoring_eligibility, "none");
  for (const output of manifest.outputs) {
    const contents = await readFile(path.join(repositoryRoot, output.path));
    assert.equal(sha256(contents), output.sha256);
  }
});

test("fixture keeps stable real site identities and explicit synthetic fallbacks", async () => {
  const sites = await readJson<EsriSiteIdentity[]>("site-identities.json");
  const links = await readJson<EsriSiteTradeAreaLink[]>(
    "site-trade-area-crosswalk.json",
  );
  const tradeAreas = await readJson<EsriTradeAreaRecord[]>("trade-areas.json");
  assert.equal(new Set(sites.map((site) => site.site_id)).size, 71);
  assert.ok(sites.every((site) => site.site_name && Number.isFinite(site.latitude)));
  assert.ok(
    sites.every((site) => site.site_id.startsWith("esri-site-")),
  );
  assert.deepEqual(
    sites.map((site) => site.site_name),
    [...sites.map((site) => site.site_name)].sort((a, b) => a.localeCompare(b)),
  );
  assert.equal(
    links.filter((link) => link.link_state === "synthetic_fallback").length,
    4,
  );
  assert.equal(tradeAreas.filter((record) => record.is_synthetic).length, 4);
  assert.ok(
    tradeAreas
      .filter((record) => record.is_synthetic)
      .every(
        (record) =>
          record.source_id === "SYN-ESRI-FALLBACK-001" &&
          record.evidence_status === "Hypothesis" &&
          record.scoring_eligibility === "none",
      ),
  );
});

test("readiness distinguishes requiredness and every supported evidence state", async () => {
  const sites = await readJson<EsriSiteIdentity[]>("site-identities.json");
  const links = await readJson<EsriSiteTradeAreaLink[]>(
    "site-trade-area-crosswalk.json",
  );
  const tradeAreas = await readJson<EsriTradeAreaRecord[]>("trade-areas.json");
  const sourceSite = sites.find((site) =>
    links.some(
      (link) =>
        link.site_id === site.site_id && link.link_state === "source_provided",
    ),
  )!;
  const sourceLinks = links.filter((link) => link.site_id === sourceSite.site_id);
  const states: ReadinessEvidenceState[] = [
    "unavailable",
    "missing",
    "rejected",
    "restricted",
    "stale",
    "unresolved_link",
  ];
  for (const state of states) {
    const result = calculatePortfolioReadiness({
      site: sourceSite,
      links: sourceLinks,
      tradeAreas,
      requirementOverrides: { population: state },
    });
    assert.equal(result.evidence_states.population, state);
    assert.ok(result.issues.some((issue) => issue.state === state));
  }
  const current = calculatePortfolioReadiness({
    site: { ...sourceSite, workflow_stage: "current_location" },
    links: sourceLinks,
    tradeAreas,
  });
  assert.equal(current.evidence_states.site_square_feet, "not_required");
  assert.ok(
    current.issues.some(
      (issue) => issue.field_or_relationship === "trade_area_observation_date",
    ),
  );
  assert.ok(
    current.issues.some(
      (issue) => issue.field_or_relationship === "trade_area_method",
    ),
  );
});

test("small repository-style sources rebuild reproducibly and fail closed", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "esri-readiness-"));
  const sourcePaths = await createSmallSources(path.join(temporary, "sources"));
  const builtAt = "2026-07-30T23:55:00.000Z";
  const args = (rootDir: string): BuildArguments => ({
    ...sourcePaths,
    rootDir,
    builtAt,
  });
  const rootA = path.join(temporary, "build-a");
  const rootB = path.join(temporary, "build-b");
  await buildEsriDemo(args(rootA));
  await buildEsriDemo(args(rootB));
  const outputNames = [
    "manifest.json",
    "field-catalog.json",
    "portfolio-readiness.json",
    "site-identities.json",
    "site-trade-area-crosswalk.json",
    "trade-areas.json",
    "rejected-or-review-records.json",
  ];
  for (const filename of outputNames) {
    const relative = path.join("data/sample/esri/2026-07-30", filename);
    assert.equal(
      await readFile(path.join(rootA, relative), "utf8"),
      await readFile(path.join(rootB, relative), "utf8"),
    );
  }
  const builtManifest = JSON.parse(
    await readFile(
      path.join(rootA, "data/sample/esri/2026-07-30/manifest.json"),
      "utf8",
    ),
  ) as EsriDemoManifest;
  assert.equal(builtManifest.counts.clinic_repeated_coordinate_groups, 1);
  const review = JSON.parse(
    await readFile(
      path.join(
        rootA,
        "data/sample/esri/2026-07-30/rejected-or-review-records.json",
      ),
      "utf8",
    ),
  ) as Array<{ issue_code: string }>;
  assert.ok(review.some((record) => record.issue_code === "duplicate_site_name"));
  assert.ok(
    review.some((record) => record.issue_code === "repeated_site_coordinate"),
  );
  assert.ok(
    review.some((record) => record.issue_code === "missing_source_trade_area"),
  );
  const protectedOutputs = await Promise.all(
    [
      "site-identities.json",
      "portfolio-readiness.json",
      "site-trade-area-crosswalk.json",
      "trade-areas.json",
    ].map((filename) =>
      readFile(
        path.join(rootA, "data/sample/esri/2026-07-30", filename),
        "utf8",
      ),
    ),
  );
  assert.doesNotMatch(
    protectedOutputs.join("\n"),
    /555-010|Restricted landlord/,
  );

  const mismatchedDemo = await readFile(sourcePaths.clinicDemo, "utf8");
  await writeFile(
    sourcePaths.clinicDemo,
    mismatchedDemo.replace("clinic-1", "changed-clinic"),
  );
  await assert.rejects(
    () => buildEsriDemo(args(path.join(temporary, "projection-failure"))),
    /not a row-for-row projection/,
  );
});

test("checked-in readiness records remain non-scored and expose follow-up provenance", async () => {
  const records =
    await readJson<PortfolioSiteReadiness[]>("portfolio-readiness.json");
  assert.equal(records.length, 71);
  assert.ok(records.every((record) => record.scoring_eligibility === "none"));
  assert.ok(
    records.every(
      (record) =>
        record.provenance.calculation ===
        "available_required_evidence / expected_required_evidence",
    ),
  );
  assert.ok(records.some((record) => record.readiness_state === "blocked"));
  assert.ok(records.some((record) => record.readiness_state === "needs_review"));
  assert.ok(
    records
      .filter((record) => record.issues.length)
      .every((record) => record.follow_up_items.length === record.issues.length),
  );
});
