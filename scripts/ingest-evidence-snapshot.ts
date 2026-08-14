import { ingestSnapshot, snapshotReadiness } from "../lib/evidence-snapshot/index.ts";

const result = await ingestSnapshot();
console.log(JSON.stringify({ ...result, readiness: await snapshotReadiness() }, null, 2));
