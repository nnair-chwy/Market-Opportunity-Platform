import { createServer } from "node:http";
import { executeEvaluationPlanEvidence } from "../lib/planning/execute-plan.ts";

const server = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/execute") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "error", message: "Not found." }));
    return;
  }

  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk: string) => {
    body += chunk;
    if (body.length > 1_000_000) request.destroy(new Error("Request body is too large."));
  });
  request.on("end", () => {
    void (async () => {
      try {
        const result = await executeEvaluationPlanEvidence(JSON.parse(body), {
          snapshotDir: process.env.CLINIC_MARKET_SNAPSHOT_DIR,
          databasePath: process.env.DUCKDB_PATH,
          normalizedSnapshotDir: process.env.NORMALIZED_MARKET_DATA_DIR,
        });
        response.writeHead(result.status === "failed" ? 422 : 200, {
          "cache-control": "no-store",
          "content-type": "application/json",
        });
        response.end(JSON.stringify(result));
      } catch {
        response.writeHead(500, { "cache-control": "no-store", "content-type": "application/json" });
        response.end(JSON.stringify({ status: "error", message: "The local evidence service failed unexpectedly." }));
      }
    })();
  });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The local evidence service could not resolve its port.");
  process.send?.({ port: address.port });
});
