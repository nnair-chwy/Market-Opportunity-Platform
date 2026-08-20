import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { compactSourceReadiness, loadFirstPartyOutcomeReadiness } from "@/lib/data-discovery/readiness-service";
import approvedInventory from "@/data/contracts/local-approved-source-inventory.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const CHECK_SCRIPTS = [
  "discover-approved-sources.ts",
  "validate-discovered-source-contracts.ts",
  "build-local-approved-source-inventory.ts",
  "verify-local-approved-sources.ts",
] as const;
const REBUILD_SCRIPTS = [
  ...CHECK_SCRIPTS,
  "build-consumer-insights-snapshot.ts",
  "build-perspective-map-signals.ts",
  "build-pricing-economics-snapshot.ts",
  "build-golden-question-evidence.ts",
] as const;

function isLocal(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function statusPayload(request: Request, message: string) {
  const report = compactSourceReadiness(await loadFirstPartyOutcomeReadiness());
  const ready = report.outcomes.filter((outcome) => outcome.status !== "gap").length;
  const gaps = report.outcomes.length - ready;
  const inventory = approvedInventory as {
    generatedAt: string;
    packages: Array<{
      id: string;
      sensitivity: string;
      allowedUse: string;
      fileCount: number;
      totalBytes: number;
      files: Array<{ file: string; bytes: number; agentUse: string }>;
    }>;
  };
  const sourcePackages = inventory.packages.map((sourcePackage) => {
    const csvFiles = sourcePackage.files.filter((file) => file.file.toLowerCase().endsWith(".csv"));
    const dateMatches = sourcePackage.id.match(/20\d{2}-\d{2}-\d{2}/g) ?? [];
    return {
      id: sourcePackage.id,
      label: sourcePackage.id.split("-20")[0].replaceAll("-", " "),
      snapshotDate: dateMatches.at(-1) ?? null,
      lastConnectedAt: inventory.generatedAt,
      sensitivity: sourcePackage.sensitivity,
      allowedUse: sourcePackage.allowedUse,
      totalBytes: sourcePackage.totalBytes,
      csvFileCount: csvFiles.length,
      files: csvFiles.map((file) => ({
        name: path.basename(file.file),
        bytes: file.bytes,
        status: file.agentUse === "approved_local_source_file" ? "available" as const : "excluded" as const,
        statusDetail: file.agentUse.replaceAll("_", " "),
      })),
    };
  });
  return {
    mode: isLocal(request) ? "local" as const : "hosted" as const,
    generatedAt: report.generatedAt,
    ready,
    gaps,
    inventoryGeneratedAt: inventory.generatedAt,
    csvFileCount: sourcePackages.reduce((total, sourcePackage) => total + sourcePackage.csvFileCount, 0),
    sourcePackages,
    sourceGroups: [
      { label: "Business outcomes", status: ready ? "partial" as const : "manual" as const, detail: `${ready} of ${report.outcomes.length} outcome families have connected evidence.` },
      { label: "Paid media & search", status: "connected" as const, detail: "Google Ads and approved search snapshots are checked before publication." },
      { label: "Pricing & product", status: "partial" as const, detail: "Zeus and pricing exports require a governed manual export today." },
      { label: "Clinics & market context", status: "partial" as const, detail: "Clinic, Esri, and Census snapshots retain source and geography boundaries." },
    ],
    message,
  };
}

export async function GET(request: Request) {
  return Response.json(await statusPayload(request, "Current published snapshot status."), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== "check" && body?.action !== "rebuild") return Response.json({ message: "Choose check or rebuild." }, { status: 400 });
  if (!isLocal(request)) {
    return Response.json(await statusPayload(request, "The hosted site cannot access private exports. Ask the data administrator to refresh them in the secure workspace, then publish the validated snapshot."), { status: 409 });
  }
  const scripts = body.action === "rebuild" ? REBUILD_SCRIPTS : CHECK_SCRIPTS;
  try {
    for (const script of scripts) {
      await execFileAsync(process.execPath, ["--experimental-strip-types", path.resolve("scripts", script)], { cwd: process.cwd(), timeout: 120_000, maxBuffer: 2_000_000 });
    }
    console.info(JSON.stringify({ event: "approved_snapshot_refresh", action: body.action, status: "completed", generatedAt: new Date().toISOString() }));
    return Response.json(await statusPayload(request, body.action === "rebuild" ? "Validated snapshot rebuilt. Restart the local app to load every updated artifact; publish only after review." : "Approved export check completed. The current snapshot was not replaced."));
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : "Unknown refresh error";
    console.warn(JSON.stringify({ event: "approved_snapshot_refresh", action: body.action, status: "failed", detail, generatedAt: new Date().toISOString() }));
    return Response.json({ ...(await statusPayload(request, `Refresh stopped safely: ${detail}`)) }, { status: 422 });
  }
}
