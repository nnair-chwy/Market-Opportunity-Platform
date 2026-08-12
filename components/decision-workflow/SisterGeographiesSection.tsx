"use client";

import type { SisterGeographySuggestion } from "@/lib/planning";

type SisterGeographiesSectionProps = {
  suggestions: readonly SisterGeographySuggestion[];
  onAskAbout: (suggestion: SisterGeographySuggestion) => void;
};

export function SisterGeographiesSection({
  suggestions,
  onAskAbout,
}: SisterGeographiesSectionProps) {
  if (!suggestions.length) return null;

  return (
    <section className="sister-geographies" aria-labelledby="sister-geographies-title">
      <div className="section-label" id="sister-geographies-title">Suggested follow-up geographies</div>
      <p>
        Deterministic sister geographies from the validated evaluation result’s
        geographic focus and SRC-014 public delineation facts. Listed as follow-up
        investigation options only — not recommendations, rankings, or equivalents of
        the current focus. Rule {suggestions[0].ruleId}: shared state coverage and
        matching CBSA type are shown as separate signals with no composite score.
      </p>
      <ul>
        {suggestions.map((market) => (
          <li key={market.cbsaCode}>
            <strong>{market.cbsaName}</strong>
            <p>{market.whySuggested}</p>
            <dl className="sister-geography-signals">
              {market.signals.map((signal) => (
                <div key={signal.id}>
                  <dt>{signal.label}</dt>
                  <dd>
                    {signal.value ?? "Unknown"}
                    <small>{signal.status} · {signal.sourceId}</small>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="sister-geography-uncertainty">
              <span>Evidence status: {market.evidenceStatus}</span>
              {market.uncertainty}
            </p>
            <button
              type="button"
              className="secondary-action"
              onClick={() => onAskAbout(market)}
            >
              Ask about this geography
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
