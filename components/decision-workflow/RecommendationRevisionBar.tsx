"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type RecommendationRevisionBarProps = {
  recommendedPrompt: string;
  onRevise: (prompt: string) => void;
};

export function RecommendationRevisionBar({ recommendedPrompt, onRevise }: RecommendationRevisionBarProps) {
  const [prompt, setPrompt] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function submit(nextPrompt: string) {
    const normalized = nextPrompt.trim();
    if (!normalized) return;
    onRevise(normalized);
    setPrompt("");
  }

  if (!mounted) return null;

  return createPortal(
    <section className="recommendation-revision" aria-labelledby="recommendation-revision-title">
      <header>
        <div>
          <span>Analyst review</span>
          <strong id="recommendation-revision-title">What should the agent reconsider?</strong>
        </div>
        <small>A new draft keeps the previous recommendation intact.</small>
      </header>
      <form onSubmit={(event) => { event.preventDefault(); submit(prompt); }}>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Consider channel mix, trends, customer outcomes, market context…"
          aria-label="Direction for the next recommendation draft"
        />
        <button className="primary-action" type="submit" disabled={!prompt.trim()}>Refresh recommendation</button>
      </form>
      <button className="recommendation-follow-up" type="button" onClick={() => submit(recommendedPrompt)}>
        <span>Recommended follow-up</span>
        {recommendedPrompt}
      </button>
    </section>,
    document.body,
  );
}
