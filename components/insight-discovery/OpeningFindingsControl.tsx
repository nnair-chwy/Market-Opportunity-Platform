"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrentDataDiscoveryRun } from "@/lib/insight-discovery";
import type { PerspectiveId } from "@/lib/perspectives";

const TEAM_LABELS: Record<PerspectiveId, string> = {
  marketing: "Marketing",
  pricing: "Pricing",
  cvc: "CVC",
};

export function OpeningFindingsControl({
  onOpenDiscovery,
  onInvestigate,
}: {
  onOpenDiscovery: () => void;
  onInvestigate: (question: string) => void;
}) {
  const [run, setRun] = useState<CurrentDataDiscoveryRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<"all" | PerspectiveId>("all");
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

  const findings = useMemo(
    () => run?.findings.filter((finding) => team === "all" || finding.department === team) ?? [],
    [run, team],
  );

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
        <section id="adaptive-findings-panel" className="adaptive-findings-panel" aria-labelledby="adaptive-findings-title">
          <header>
            <div>
              <span>Evidence inbox</span>
              <h2 id="adaptive-findings-title">Findings worth a closer look</h2>
            </div>
            <button type="button" aria-label="Close findings" onClick={() => setOpen(false)}>×</button>
          </header>

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

          <div className="adaptive-findings-list" aria-live="polite">
            {!run && !error ? <p role="status">Reviewing the current approved data…</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {findings.map((finding) => (
              <article key={finding.insightId}>
                <div>
                  <span>{TEAM_LABELS[finding.department]}</span>
                  <small>{finding.marketName}</small>
                </div>
                <h3>{finding.headline}</h3>
                <p>{finding.analystInterpretation?.recommendedNextDecisionOrAction ?? finding.whyInteresting}</p>
                <button
                  type="button"
                  onClick={() => {
                    onInvestigate(finding.question);
                    setOpen(false);
                  }}
                >
                  Ask about this finding
                </button>
              </article>
            ))}
          </div>

          <footer>
            <span>{run ? `${findings.length} of ${run.findings.length} findings shown` : "Preparing findings"}</span>
            <button type="button" onClick={onOpenDiscovery}>Run discovery →</button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
