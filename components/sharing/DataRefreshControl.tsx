"use client";

import { useEffect, useState } from "react";

type RefreshStatus = {
  mode: "local" | "hosted";
  generatedAt: string;
  ready: number;
  gaps: number;
  sourceGroups: Array<{ label: string; status: "connected" | "partial" | "manual"; detail: string }>;
  message: string;
};

export function DataRefreshControl() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [busy, setBusy] = useState<"check" | "rebuild" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadStatus() {
    const response = await fetch("/api/data-refresh", { cache: "no-store" });
    if (!response.ok) throw new Error("Refresh status is unavailable.");
    setStatus(await response.json() as RefreshStatus);
  }

  useEffect(() => {
    if (!open || status) return;
    void loadStatus().catch((error) => setNotice(error instanceof Error ? error.message : "Refresh status is unavailable."));
  }, [open, status]);

  async function run(action: "check" | "rebuild") {
    setBusy(action);
    setNotice(action === "check" ? "Checking approved exports…" : "Building a new validated snapshot…");
    try {
      const response = await fetch("/api/data-refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as RefreshStatus & { message: string };
      setStatus(payload);
      setNotice(payload.message);
    } catch {
      setNotice("The refresh could not be completed. The current published snapshot is unchanged.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="data-refresh-control">
      <button className="adaptive-opening-tool data-refresh-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="data-refresh-panel">
        <span aria-hidden="true">↻</span><strong>Data</strong>
      </button>
      {open ? (
        <section id="data-refresh-panel" className="data-refresh-panel" aria-label="Data refresh center">
          <header><div><div className="section-label">Data refresh</div><h2>Update the evidence snapshot</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close data refresh">×</button></header>
          <p>The live site reads a validated, versioned snapshot. Private exports are refreshed only from the secure workspace; a failed check never replaces the published data.</p>
          {status ? <>
            <div className="data-refresh-summary"><strong>{status.ready} outcome families connected</strong><span>{status.gaps} still need a governed source</span><small>Snapshot checked {new Date(status.generatedAt).toLocaleString()}</small></div>
            <div className="data-refresh-sources">
              {status.sourceGroups.map((source) => <div key={source.label} data-status={source.status}><strong>{source.label}</strong><span>{source.status}</span><small>{source.detail}</small></div>)}
            </div>
          </> : <p role="status">Loading source status…</p>}
          <ol className="data-refresh-steps"><li>Confirm access to the source systems.</li><li>Place approved exports in the secure workspace.</li><li>Validate, rebuild, and publish a new snapshot.</li></ol>
          {notice ? <p className="data-refresh-notice" role="status">{notice}</p> : null}
          <footer>
            <button type="button" className="secondary-action" disabled={Boolean(busy)} onClick={() => void run("check")}>{busy === "check" ? "Checking…" : "Check new exports"}</button>
            <button type="button" className="primary-action" disabled={Boolean(busy) || status?.mode !== "local"} onClick={() => void run("rebuild")}>{busy === "rebuild" ? "Rebuilding…" : "Build validated snapshot"}</button>
          </footer>
          {status?.mode === "hosted" ? <small className="data-refresh-hosted-note">Hosted viewers can inspect freshness. Snapshot rebuilding stays administrator-only because the source systems and raw exports are private.</small> : null}
        </section>
      ) : null}
    </div>
  );
}
