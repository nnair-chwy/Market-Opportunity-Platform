import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";

const execFileAsync = promisify(execFile);
const CHECK_SCRIPTS = [
  "build-local-approved-source-inventory.ts",
  "discover-approved-sources.ts",
  "validate-discovered-source-contracts.ts",
  "verify-local-approved-sources.ts",
] as const;
const REBUILD_SCRIPTS = [
  "build-tableau-cvc-outcomes.ts",
  "build-tableau-new-customer-acquisition.ts",
  ...CHECK_SCRIPTS,
  "build-perspective-map-signals.ts",
  "build-pricing-economics-snapshot.ts",
  "build-golden-question-evidence.ts",
] as const;
let refreshInProgress = false;

function sendJson(response: import("node:http").ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readBody(request: import("node:http").IncomingMessage) {
  return await new Promise<string>((resolveBody, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body is too large."));
    });
    request.on("end", () => resolveBody(body));
    request.on("error", reject);
  });
}

async function refreshApprovedSnapshot(action: "check" | "rebuild") {
  const scripts = action === "rebuild" ? REBUILD_SCRIPTS : CHECK_SCRIPTS;
  for (const script of scripts) {
    const refreshEnvironment = await approvedRefreshEnvironment();
    await execFileAsync(process.execPath, ["--experimental-strip-types", resolve("scripts", script)], {
      cwd: process.cwd(),
      env: refreshEnvironment,
      timeout: 120_000,
      maxBuffer: 2_000_000,
    });
  }
}

async function approvedRefreshEnvironment(): Promise<NodeJS.ProcessEnv> {
  const inventory = JSON.parse(await readFile(resolve("data/contracts/local-approved-source-inventory.json"), "utf8")) as {
    packages?: Array<{ files?: Array<{ file?: string; agentUse?: string }> }>;
  };
  const approvedFiles = (inventory.packages ?? [])
    .flatMap((sourcePackage) => sourcePackage.files ?? [])
    .filter((file) => file.agentUse === "approved_local_source_file" && typeof file.file === "string")
    .map((file) => file.file as string);
  const findApproved = (pattern: RegExp) => {
    const candidate = approvedFiles.find((file) => pattern.test(file));
    return candidate ? resolve(candidate) : undefined;
  };
  return {
    ...process.env,
    MARKETING_POSTAL_EXPORT: process.env.MARKETING_POSTAL_EXPORT || findApproved(/retail_matched-postal_account-summary_us\.csv$/),
    PRICING_COMPETITOR_CATEGORY_EXPORT: process.env.PRICING_COMPETITOR_CATEGORY_EXPORT || findApproved(/competitor-price-geo_by-zip-competitor-category.*\.csv$/),
    PRICING_ECONOMICS_CATEGORY_EXPORT: process.env.PRICING_ECONOMICS_CATEGORY_EXPORT || findApproved(/pse-pricing-economics_by-us-category.*\.csv$/),
    ZCTA_GAZETTEER_FILE: process.env.ZCTA_GAZETTEER_FILE || resolve("data/public/census/zcta-gazetteer/2025/2025_Gaz_zcta_national.txt"),
  };
}

const server = createServer((request, response) => {
  if (request.method !== "POST" || (request.url !== "/execute" && request.url !== "/refresh")) {
    sendJson(response, 404, { status: "error", message: "Not found." });
    return;
  }

  void (async () => {
    try {
      const body = await readBody(request);
      if (request.url === "/refresh") {
        const parsed = JSON.parse(body) as { action?: unknown };
        if (parsed.action !== "check" && parsed.action !== "rebuild") {
          sendJson(response, 400, { status: "error", message: "Choose a supported refresh action." });
          return;
        }
        if (refreshInProgress) {
          sendJson(response, 409, { status: "busy", message: "A data refresh is already running. Wait for it to finish before starting another." });
          return;
        }
        refreshInProgress = true;
        try {
          await refreshApprovedSnapshot(parsed.action);
          console.info(JSON.stringify({ event: "approved_snapshot_refresh", action: parsed.action, status: "completed", generatedAt: new Date().toISOString() }));
          sendJson(response, 200, {
            status: "completed",
            message: parsed.action === "rebuild"
              ? "Insights refreshed from the approved CSV files. Reload the app to use every updated result."
              : "Approved CSV folders scanned and validated. The current insights were not rebuilt.",
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message.split("\n")[0] : "Unknown refresh error";
          console.warn(JSON.stringify({ event: "approved_snapshot_refresh", action: parsed.action, status: "failed", detail, generatedAt: new Date().toISOString() }));
          sendJson(response, 422, { status: "failed", message: `Refresh stopped safely: ${detail}` });
        } finally {
          refreshInProgress = false;
        }
        return;
      }

      try {
        const result = await executeEvaluationPlanEvidence(JSON.parse(body), {
          snapshotDir: process.env.CLINIC_MARKET_SNAPSHOT_DIR,
          databasePath: process.env.DUCKDB_PATH,
          normalizedSnapshotDir: process.env.NORMALIZED_MARKET_DATA_DIR,
        });
        sendJson(response, result.status === "failed" ? 422 : 200, result);
      } catch {
        sendJson(response, 500, { status: "error", message: "The local evidence service failed unexpectedly." });
      }
    } catch {
      sendJson(response, 400, { status: "error", message: "Enter a valid request." });
    }
  })();
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The local evidence service could not resolve its port.");
  process.send?.({ port: address.port });
});
