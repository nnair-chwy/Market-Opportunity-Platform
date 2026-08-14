import { queryClinicMarketReadiness } from "../lib/clinic-market-readiness/query.ts";

const marketId = process.env.CLINIC_MARKET_ID?.trim() || process.argv[2];
const snapshotDir = process.env.CLINIC_MARKET_SNAPSHOT_DIR?.trim() || "data/approved/snowflake/2026-08-13-market-data";
const databasePath = process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb";
const snapshotVersion = process.env.CLINIC_MARKET_SNAPSHOT_VERSION?.trim() || "clinic-market-evidence-2026-08-13-v1";
if (!marketId) throw new Error("Provide a market ID as the first argument or set CLINIC_MARKET_ID.");
console.log(JSON.stringify(await queryClinicMarketReadiness({ snapshotVersion, marketId }, { snapshotDir, databasePath }), null, 2));
