import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

export function snapshotDirectory(): string {
  return resolve(process.env.EVIDENCE_SNAPSHOT_DIR?.trim() || "data/approved/snowflake/2026-08-11");
}

export function duckDbPath(): string {
  return resolve(process.env.DUCKDB_PATH?.trim() || ".local/evidence-snapshot.duckdb");
}

export async function openDuckDb(path = duckDbPath(), readOnly = false): Promise<{ instance: DuckDBInstance; connection: DuckDBConnection }> {
  if (path !== ":memory:" && !readOnly) await mkdir(dirname(path), { recursive: true });
  // Keep the native binding out of the browser/RSC dependency graph. This is a
  // server-only boundary and the package is loaded only when a query runs.
  const loadDuckDb = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<typeof import("@duckdb/node-api")>;
  const { DuckDBInstance } = await loadDuckDb("@duckdb/node-api");
  const instance = await DuckDBInstance.create(path, readOnly ? { access_mode: "READ_ONLY" } : undefined);
  return { instance, connection: await instance.connect() };
}

export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function closeDuckDb(handle: { instance: DuckDBInstance; connection: DuckDBConnection }) {
  handle.connection.closeSync();
  handle.instance.closeSync();
}
