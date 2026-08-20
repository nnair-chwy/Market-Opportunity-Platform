import { compactSourceReadiness, loadFirstPartyOutcomeReadiness } from "@/lib/data-discovery/readiness-service";
import approvedInventory from "@/data/contracts/local-approved-source-inventory.json";
import { TABLEAU_FIRST_PARTY_EXPORTS } from "@/lib/business-value/first-party-value-framework";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localEvidenceServiceUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function fileName(file: string) {
  return file.split(/[\\/]/).at(-1) ?? file;
}

async function statusPayload(message: string) {
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
        name: fileName(file.file),
        bytes: file.bytes,
        status: file.agentUse === "approved_local_source_file" ? "available" as const : "excluded" as const,
        statusDetail: file.agentUse.replaceAll("_", " "),
      })),
    };
  });
  return {
    mode: localEvidenceServiceUrl(process.env.LOCAL_EVIDENCE_SERVICE_URL) ? "local" as const : "hosted" as const,
    generatedAt: report.generatedAt,
    ready,
    gaps,
    inventoryGeneratedAt: inventory.generatedAt,
    csvFileCount: sourcePackages.reduce((total, sourcePackage) => total + sourcePackage.csvFileCount, 0),
    sourcePackages,
    sourceGroups: [
      { label: "Business outcomes", status: ready ? "partial" as const : "manual" as const, detail: `${ready} of ${report.outcomes.length} outcome families have validated adapter candidates; CVC appointments are connected for the approved historical period.` },
      { label: "Paid media & search", status: "connected" as const, detail: "Google Ads and approved search snapshots are checked before publication." },
      { label: "Pricing & product", status: "partial" as const, detail: "Zeus and pricing exports require a governed manual export today." },
      { label: "Clinics & market context", status: "connected" as const, detail: "CVC appointments and net sales are connected at Tableau metro × week × channel grain; capacity, maturity and the production crosswalk remain open." },
    ],
    valueDataRequests: TABLEAU_FIRST_PARTY_EXPORTS,
    message,
  };
}

export async function GET(request: Request) {
  void request;
  return Response.json(await statusPayload("Current published snapshot status."), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== "check" && body?.action !== "rebuild") return Response.json({ message: "Choose check or rebuild." }, { status: 400 });
  const localEvidenceService = localEvidenceServiceUrl(process.env.LOCAL_EVIDENCE_SERVICE_URL);
  if (!localEvidenceService) {
    return Response.json(await statusPayload("Refresh is available only from the secure data workspace. This shared site can show the latest published data but cannot access private exports."), { status: 409 });
  }
  try {
    const refreshResponse = await fetch(`${localEvidenceService}/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: body.action }),
    });
    const refreshResult = await refreshResponse.json() as { message?: unknown };
    const message = typeof refreshResult.message === "string" ? refreshResult.message : "The data refresh did not return a status.";
    return Response.json(await statusPayload(message), { status: refreshResponse.ok ? 200 : refreshResponse.status });
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : "The local data service is unavailable.";
    return Response.json(await statusPayload(`Refresh stopped safely: ${detail}`), { status: 503 });
  }
}
