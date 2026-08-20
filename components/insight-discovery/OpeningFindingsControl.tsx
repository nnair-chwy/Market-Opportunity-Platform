"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrentDataDiscoveryRun } from "@/lib/insight-discovery";
import { findingPresentation } from "@/lib/insight-discovery/finding-presentation";
import type { PerspectiveId } from "@/lib/perspectives";

const TEAM_LABELS: Record<PerspectiveId, string> = {
  marketing: "Marketing",
  pricing: "Pricing",
  cvc: "CVC",
};

export function OpeningFindingsControl({
  onOpenDiscovery,
}: {
  onOpenDiscovery: (findingId?: string, run?: CurrentDataDiscoveryRun) => void;
}) {
  const [run, setRun] = useState<CurrentDataDiscoveryRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<"all" | PerspectiveId>("all");
  const [showAll, setShowAll] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/insight-discovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then(async (response) => {
        const payload = await response.json() as CurrentDataDiscoveryRun | { message?: string };
        if (!response.ok || !("findings" in payload)) {
          throw new Error("message" in payload ? payload.message : "Findings are unavailable.");
        }
        if (!cancelled) setRun(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Findings are unavailable.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function closeOutside(event: MouseEvent) {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("mousedown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("mousedown", closeOutside);
    };
  }, [open]);

  const teamFindings = useMemo(
    () => run?.findings.filter((finding) => team === "all" || finding.department === team) ?? [],
    [run, team],
  );
  const findings = useMemo(
    () => showAll
      ? teamFindings
      : (run?.primaryFindings.filter((finding) => team === "all" || finding.department === team) ?? []),
    [run, showAll, team, teamFindings],
  );
  const importanceCounts = useMemo(() => ({
    priority: run?.findings.filter((finding) => finding.importance.tier === "priority_now").length ?? 0,
    validate: run?.findings.filter((finding) => finding.importance.tier === "validate_next").length ?? 0,
  }), [run]);

  return (
    <div className="adaptive-findings-control" ref={controlRef}>
      <button
        className="adaptive-opening-tool adaptive-findings-trigger"
        type="button"
        aria-label={run ? `Open ${run.findings.length} findings` : "Open findings"}
        aria-expanded={open}
        aria-controls="adaptive-findings-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="adaptive-findings-box-icon" aria-hidden="true" />
        <strong>Findings</strong>
        <small aria-label={run ? `${run.findings.length} available` : "Loading finding count"}>
          {run?.findings.length ?? "…"}
        </small>
      </button>

      {open ? (
        <section id="adaptive-findings-panel" className="adaptive-findings-panel" aria-label="Findings inbox">
          <header>
            <div className="adaptive-findings-heading">
              <span>Evidence inbox</span>
              <div className="adaptive-findings-filters" role="tablist" aria-label="Filter findings by team">
                {(["all", "marketing", "pricing", "cvc"] as const).map((item) => {
                  const count = item === "all"
                    ? run?.findings.length ?? 0
                    : run?.findings.filter((finding) => finding.department === item).length ?? 0;
                  return (
                    <button key={item} type="button" role="tab" aria-selected={team === item} onClick={() => setTeam(item)}>
                      {item === "all" ? "All" : TEAM_LABELS[item]} <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" aria-label="Close findings" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="adaptive-findings-list" aria-live="polite">
            {!run && !error ? <p role="status">Reviewing the current approved data…</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {findings.map((finding) => {
              const presentation = findingPresentation(finding);
              return <article key={finding.insightId} data-importance={finding.importance.tier}>
                <div className="adaptive-finding-heading-row">
                  <div className="adaptive-finding-heading-tags">
                    <span className="adaptive-finding-team">{TEAM_LABELS[finding.department]}</span>
                    <span className="adaptive-finding-importance" data-tier={finding.importance.tier}>
                      <strong>{presentation.recommendationLabel}</strong>
                    </span>
                  </div>
                  <small>{finding.marketName}</small>
                </div>
                <h3>{finding.headline}</h3>
                <div className="adaptive-finding-value" data-status={finding.businessValue.status}>
                  <span>{presentation.valueStatus}</span>
                  <strong>{presentation.signalConfidence} signal · {presentation.decisionReadiness}</strong>
                </div>
                <p><b>{presentation.recommendationType === "data_quality" ? "Data-owner task:" : "Recommended move:"}</b> {presentation.recommendedMove}</p>
                <button
                  className="adaptive-finding-open"
                  type="button"
                  onClick={() => {
                    onOpenDiscovery(finding.insightId, run ?? undefined);
                    setOpen(false);
                  }}
                  aria-label={`Open finding: ${finding.headline}`}
                >
                  View <span aria-hidden="true">→</span>
                </button>
              </article>;
            })}
          </div>

          <footer>
            <span>{run ? `${importanceCounts.priority} priority now · ${findings.length} in focus · ${run.findings.length} total` : "Preparing findings"}</span>
            <div>
              {run && teamFindings.length > findings.length ? (
                <button type="button" onClick={() => setShowAll(true)}>Show all {teamFindings.length}</button>
              ) : showAll ? (
                <button type="button" onClick={() => setShowAll(false)}>Show focus</button>
              ) : null}
              <button type="button" onClick={() => onOpenDiscovery()}>Run discovery →</button>
            </div>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
