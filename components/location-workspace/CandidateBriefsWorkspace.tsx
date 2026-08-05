"use client";

import { useState } from "react";
import { CandidateReviewAgent } from "@/components/agent-workspace";
import { CandidateEvidenceWorkspace } from "@/components/esri-candidate-brief";
import { esriCandidateEvidenceBriefs } from "@/lib/esri-demo";
import styles from "./candidate-briefs-workspace.module.css";

type CandidateBriefsWorkspaceProps = {
  initialSiteId?: string;
  onOpenMarket: (marketId: string) => void;
};

type CandidatePhase = "potential" | "agent" | "document";

export function CandidateBriefsWorkspace({
  initialSiteId,
  onOpenMarket,
}: CandidateBriefsWorkspaceProps) {
  const defaultSiteId =
    esriCandidateEvidenceBriefs.find((brief) => brief.site_id === initialSiteId)
      ?.site_id ?? esriCandidateEvidenceBriefs[0]?.site_id ?? "";
  const [selectedSiteId, setSelectedSiteId] = useState(defaultSiteId);
  const [phase, setPhase] = useState<CandidatePhase>("potential");

  if (phase === "agent") {
    return (
      <div className={styles.workflow}>
        <button className={styles.back} onClick={() => setPhase("potential")}>
          ← Potential locations
        </button>
        <CandidateReviewAgent
          key={selectedSiteId}
          siteId={selectedSiteId}
          onOpenBrief={(siteId) => {
            setSelectedSiteId(siteId);
            setPhase("document");
          }}
          onOpenMarket={onOpenMarket}
        />
      </div>
    );
  }

  if (phase === "document") {
    return (
      <div className={styles.workflow}>
        <button className={styles.back} onClick={() => setPhase("potential")}>
          ← Potential locations
        </button>
        <CandidateEvidenceWorkspace
          key={selectedSiteId}
          initialSiteId={selectedSiteId}
          initialMode="brief"
          showModeTabs={false}
          heading="Candidate brief document"
          onContinueReview={(siteId) => {
            setSelectedSiteId(siteId);
            setPhase("agent");
          }}
          onOpenMarket={onOpenMarket}
        />
      </div>
    );
  }

  return (
    <section className={styles.workspace} aria-labelledby="potential-locations-title">
      <header>
        <div>
          <p>Agentic candidate briefs</p>
          <h2 id="potential-locations-title">Potential locations</h2>
          <span>
            Choose a candidate, run the bounded evidence workflow, and review
            the resulting draft document.
          </span>
        </div>
        <strong>{esriCandidateEvidenceBriefs.length} available</strong>
      </header>

      <div className={styles.boundary} role="note">
        Candidate briefs assemble evidence for human review. They do not score,
        rank, recommend, or approve a location.
      </div>

      <div className={styles.list}>
        {esriCandidateEvidenceBriefs.map((brief) => (
          <article key={brief.site_id}>
            <div>
              <span>{brief.brand}</span>
              <h3>{brief.site_label}</h3>
              <p>{brief.parent_market.market_label ?? "Parent market unknown"}</p>
            </div>
            <dl>
              <div>
                <dt>Readiness</dt>
                <dd>{brief.readiness_state.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Missing</dt>
                <dd>{brief.missing_information.length}</dd>
              </div>
              <div>
                <dt>Conflicting</dt>
                <dd>{brief.conflicting_information.length}</dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <button
                onClick={() => {
                  setSelectedSiteId(brief.site_id);
                  setPhase("agent");
                }}
              >
                Prepare candidate brief
              </button>
              <button
                onClick={() => {
                  setSelectedSiteId(brief.site_id);
                  setPhase("document");
                }}
              >
                Open draft document
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
