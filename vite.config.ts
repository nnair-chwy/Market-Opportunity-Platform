import vinext from "vinext";
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ command, mode }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const localEvidenceBindings = command === "serve"
    ? {
        vars: {
          NORMALIZED_MARKET_DATA_DIR: process.env.NORMALIZED_MARKET_DATA_DIR ?? resolve(process.cwd(), ".local-data/normalized-market-data"),
          CLINIC_MARKET_SNAPSHOT_DIR: process.env.CLINIC_MARKET_SNAPSHOT_DIR ?? resolve(process.cwd(), ".local-data/clinic-market-snapshot"),
          DUCKDB_PATH: process.env.DUCKDB_PATH ?? resolve(process.cwd(), ".local/evidence-snapshot.duckdb"),
          LOCAL_EVIDENCE_SERVICE_URL: process.env.LOCAL_EVIDENCE_SERVICE_URL ?? "",
        },
      }
    : {};

  return {
    // Vinext's development server and production build both optimize React
    // dependencies. Sharing one cache lets a build rewrite modules that an
    // already-running dev server still references, breaking hydration with
    // mismatched named exports. Keep each command isolated while preserving
    // the node_modules/.vite path expected by Vinext's CommonJS adapter.
    cacheDir: `node_modules/.vite/${command}-${mode}`,
    optimizeDeps: {
      // MapLibre 6 resolves its ESM worker with import.meta.url. Let the
      // browser load that worker directly instead of caching a stale path.
      exclude: ["maplibre-gl", "@duckdb/node-api"],
    },
    ssr: {
      external: ["@duckdb/node-api", "@duckdb/node-bindings"],
    },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      {
        name: "maplibre-worker-asset",
        apply: "build",
        generateBundle() {
          for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
            this.emitFile({
              type: "asset",
              fileName: `assets/${file}`,
              source: readFileSync(resolve("node_modules/maplibre-gl/dist", file), "utf8"),
            });
          }
        },
      },
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: { ...localBindingConfig, ...localEvidenceBindings },
      }),
    ],
  };
});
