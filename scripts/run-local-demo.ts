import { spawn } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const command = process.argv[2] === "start" ? "start" : "dev";
const forwardedArgs = process.argv.slice(3);
const evidenceEnvironment = {
  ...process.env,
  NORMALIZED_MARKET_DATA_DIR: resolve(process.env.NORMALIZED_MARKET_DATA_DIR?.trim() || ".local-data/normalized-market-data"),
  CLINIC_MARKET_SNAPSHOT_DIR: resolve(process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || ".local-data/clinic-market-snapshot"),
  DUCKDB_PATH: resolve(process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb"),
};

const evidenceServer = spawn(process.execPath, ["--experimental-strip-types", "scripts/local-evidence-server.ts"], {
  cwd: projectRoot,
  env: evidenceEnvironment,
  stdio: ["inherit", "inherit", "inherit", "ipc"],
});

const evidencePort = await new Promise<number>((resolvePort, reject) => {
  const timer = setTimeout(() => reject(new Error("The local evidence service did not become ready.")), 10_000);
  evidenceServer.once("error", reject);
  evidenceServer.once("exit", (code) => reject(new Error(`The local evidence service exited before startup (${code ?? "unknown"}).`)));
  evidenceServer.on("message", (message) => {
    if (!message || typeof message !== "object" || !("port" in message) || typeof message.port !== "number") return;
    clearTimeout(timer);
    resolvePort(message.port);
  });
});

const child = spawn("vinext", [command, ...forwardedArgs], {
  cwd: projectRoot,
  env: {
    ...evidenceEnvironment,
    LOCAL_EVIDENCE_SERVICE_URL: `http://127.0.0.1:${evidencePort}`,
    WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
  },
  stdio: "inherit",
});

function stopChildren() {
  child.kill("SIGTERM");
  evidenceServer.kill("SIGTERM");
}

child.on("error", (error) => {
  console.error("Unable to start the local demo server.", error);
  evidenceServer.kill("SIGTERM");
  process.exit(1);
});
child.on("exit", (code) => {
  evidenceServer.kill("SIGTERM");
  process.exit(code ?? 1);
});
process.on("SIGINT", stopChildren);
process.on("SIGTERM", stopChildren);
