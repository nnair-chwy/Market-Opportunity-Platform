"use client";

import { useEffect, useState } from "react";

type Readiness = {
  snapshotVersion: string;
  status: string;
  qualityWarningCount: number;
  knownIssues: string[];
  restrictedDatasetsExcluded: string[];
  tables: Array<{ tableName: string; dateRange: { min: string | null; max: string | null }; allowedUse: string }>;
  queryVersion: string;
  calculationVersion: string;
};

export function SnapshotEvidenceStatus() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/evidence-snapshot", { cache: "no-store" })
      .then((response) => response.json() as Promise<Readiness>)
      .then((value) => { if (active) setReadiness(value); })
      .catch(() => { if (active) setReadiness(null); });
    return () => { active = false; };
  }, []);
  if (!readiness) return <div className="snapshot-evidence-status" data-snapshot-state="loading">Loading governed evidence snapshot…</div>;
  const dates = readiness.tables.map((table) => table.dateRange).filter((range) => range.min || range.max);
  return (
    <section className="snapshot-evidence-status" data-snapshot-state={readiness.status} aria-label="Governed evidence snapshot status">
      <div><span>Evidence snapshot</span><strong>{readiness.snapshotVersion}</strong></div>
      <div><span>Readiness</span><strong>{readiness.status.replaceAll("_", " ")}</strong></div>
      <div><span>Observation window</span><strong>{dates.length ? `${dates[0]?.min ?? "Unknown"} to ${dates.at(-1)?.max ?? "Unknown"}` : "Not available"}</strong></div>
      <div><span>Quality warnings</span><strong>{readiness.qualityWarningCount.toLocaleString()}</strong></div>
      <div><span>Query / calculation</span><strong>{readiness.queryVersion} · {readiness.calculationVersion}</strong></div>
      <p>Approved sources available for this question are limited to registered aggregate evidence. Restricted datasets excluded: {readiness.restrictedDatasetsExcluded.join(", ") || "none"}.</p>
      {readiness.status === "blocked" || readiness.knownIssues.length ? <small>Blocked or unresolved evidence remains visible: {readiness.knownIssues.slice(0, 3).join("; ")}</small> : null}
    </section>
  );
}
