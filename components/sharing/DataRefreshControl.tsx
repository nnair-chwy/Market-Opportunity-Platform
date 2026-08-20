"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type RefreshStatus = {
  mode: "local" | "hosted";
  generatedAt: string;
  ready: number;
  gaps: number;
  inventoryGeneratedAt: string;
  csvFileCount: number;
  sourcePackages: Array<{
    id: string;
    label: string;
    snapshotDate: string | null;
    lastConnectedAt: string;
    sensitivity: string;
    allowedUse: string;
    totalBytes: number;
    csvFileCount: number;
    files: Array<{ name: string; bytes: number; status: "available" | "excluded"; statusDetail: string }>;
  }>;
  sourceGroups: Array<{ label: string; status: "connected" | "partial" | "manual"; detail: string }>;
  valueDataRequests: Array<{
    id: string;
    label: string;
    status: "available_now" | "available_partial" | "needs_geo_join" | "context_only";
    targetGrain: string;
    metrics: string[];
    valueUse: string;
    limitation: string;
    tableauUrl: string;
  }>;
  message: string;
};

export function DataRefreshControl() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [busy, setBusy] = useState<"check" | "rebuild" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function loadStatus() {
    const response = await fetch("/api/data-refresh", { cache: "no-store" });
    if (!response.ok) throw new Error("Refresh status is unavailable.");
    setStatus(await response.json() as RefreshStatus);
  }

  function togglePanel() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !status) {
      void loadStatus().catch((error) => setNotice(error instanceof Error ? error.message : "Refresh status is unavailable."));
    }
  }

  async function run(action: "check" | "rebuild") {
    setBusy(action);
    setNotice(action === "check" ? "Scanning approved CSV folders…" : "Finding new CSVs, validating them, and refreshing insights…");
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

  const panel = open ? (
    <div className="data-refresh-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section id="data-refresh-panel" className="data-refresh-panel" role="dialog" aria-modal="true" aria-labelledby="data-refresh-title">
        <header><div><div className="section-label">Data refresh</div><h2 id="data-refresh-title">Refresh the app&apos;s insight data</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close data refresh">×</button></header>
        <p>Refresh checks for newly exported CSVs, validates them, and rebuilds the findings used throughout the app. If validation fails, the current working data stays unchanged.</p>
        {status ? <>
          <div className="data-refresh-summary"><strong>{status.csvFileCount} CSV files inventoried</strong><span>{status.sourcePackages.length} source packages</span><small>Each file below is labeled available or excluded · Last connected {new Date(status.inventoryGeneratedAt).toLocaleString()}</small></div>
          <section className="data-refresh-inventory" aria-label="Existing CSV inventory">
            <div className="data-refresh-inventory-heading"><strong>Files currently available</strong><span>Open a source to review every file</span></div>
            {status.sourcePackages.map((sourcePackage) => (
              <details key={sourcePackage.id}>
                <summary><span><strong>{sourcePackage.label}</strong><small>{sourcePackage.snapshotDate ? `Data through ${new Date(`${sourcePackage.snapshotDate}T00:00:00`).toLocaleDateString()}` : "Snapshot date unavailable"}</small></span><span><b>{sourcePackage.csvFileCount} CSVs</b><small>{Math.round(sourcePackage.totalBytes / 1_000_000)} MB</small></span></summary>
                <div className="data-refresh-file-list">
                  {sourcePackage.files.map((file) => <div key={file.name} data-status={file.status}><span><strong>{file.name}</strong><small>{file.statusDetail}</small></span><span><b>{file.status}</b><small>{file.bytes < 1_000_000 ? `${Math.max(1, Math.round(file.bytes / 1_000))} KB` : `${Math.round(file.bytes / 1_000_000)} MB`}</small></span></div>)}
                </div>
              </details>
            ))}
          </section>
          <details className="data-refresh-readiness"><summary>Business-outcome connections</summary><div className="data-refresh-sources">{status.sourceGroups.map((source) => <div key={source.label} data-status={source.status}><strong>{source.label}</strong><span>{source.status}</span><small>{source.detail}</small></div>)}</div></details>
          <details className="data-refresh-readiness data-refresh-value-exports" open>
            <summary>Data connections and requests</summary>
            <p className="data-refresh-connection-guidance">Your only manual step is authentication. After access is available, the data agent downloads the approved aggregate, validates its geography and measures, registers it, and rebuilds the insight snapshot.</p>
            <div className="data-refresh-value-export-list">
              {status.valueDataRequests.map((source) => (
                <article key={source.id} data-status={source.status}>
                  <header><strong>{source.label}</strong><span>{source.status.replaceAll("_", " ")}</span></header>
                  <p>{source.valueUse}</p>
                  <small><b>Target grain:</b> {source.targetGrain}</small>
                  <small><b>Measures:</b> {source.metrics.join(", ")}</small>
                  <small><b>Limit:</b> {source.limitation}</small>
                  <a href={source.tableauUrl} target="_blank" rel="noreferrer">{source.status === "available_now" ? "Review authenticated source →" : "Authenticate in Tableau →"}</a>
                </article>
              ))}
            </div>
          </details>
        </> : <p role="status">Loading source status…</p>}
        <ol className="data-refresh-steps"><li>Authenticate to the approved source.</li><li>The agent downloads and validates the aggregate export.</li><li>The prior snapshot stays live until the new findings pass checks.</li></ol>
        {notice ? <p className="data-refresh-notice" role="status">{notice}</p> : null}
        <footer>
          <button type="button" className="primary-action" disabled={Boolean(busy) || status?.mode !== "local"} onClick={() => void run("rebuild")}>{busy === "rebuild" ? "Refreshing insights…" : "Refresh insights"}</button>
        </footer>
        {status?.mode === "hosted" ? <small className="data-refresh-hosted-note">The shared site can show connected data and open the authentication page, but it cannot borrow your private Tableau session. Once authenticated, run the secure data agent to complete download, validation, and publication.</small> : <small className="data-refresh-hosted-note">This usually takes a few minutes. Keep this window open until the refresh finishes.</small>}
      </section>
    </div>
  ) : null;

  return (
    <div className="data-refresh-control">
      <button className="adaptive-opening-tool data-refresh-trigger" type="button" onClick={togglePanel} aria-expanded={open} aria-controls="data-refresh-panel">
        <span aria-hidden="true">↻</span><strong>Data</strong>
      </button>
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
