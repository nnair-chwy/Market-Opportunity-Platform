"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { rankQuestionSuggestions, type PreviousInvestigationQuestion, type QuestionSuggestion, type QuestionSuggestionGroups } from "@/lib/questions";
import type { PerspectiveId, PerspectiveViewId } from "@/lib/perspectives";
import type { SelectedGeographicContext } from "@/lib/planning/geographic-context";

type RecommendedQuestionTypeaheadProps = {
  value: string;
  perspectiveId: PerspectiveId;
  activeViewId: PerspectiveViewId;
  selectedGeographicContexts: readonly SelectedGeographicContext[];
  previousInvestigations: readonly PreviousInvestigationQuestion[];
  onChange: (value: string) => void;
  onOpenPrevious: (id: string) => void;
};

const supportLabels = { available_now: "Available now", partial_answer: "Partial answer", more_evidence_required: "More evidence required" } as const;

function suggestionGroups(groups: QuestionSuggestionGroups) {
  return [
    { id: "previous", label: "Previous investigations", items: groups.previousInvestigations },
    { id: "recommended", label: "Recommended questions", items: groups.recommendedQuestions },
    { id: "related", label: "Related questions", items: groups.relatedQuestions },
  ].filter((group) => group.items.length > 0);
}

export function RecommendedQuestionTypeahead({ value, perspectiveId, activeViewId, selectedGeographicContexts, previousInvestigations, onChange, onOpenPrevious }: RecommendedQuestionTypeaheadProps) {
  const listboxId = useId();
  const blurTimer = useRef<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const groups = useMemo(() => rankQuestionSuggestions({ query: value, activePerspectiveId: perspectiveId, activeViewId, selectedGeographicContexts, previousInvestigations, limitPerGroup: 4, limitTotal: 3 }), [activeViewId, perspectiveId, previousInvestigations, selectedGeographicContexts, value]);
  const visibleGroups = suggestionGroups(groups);
  const suggestions = visibleGroups.flatMap((group) => group.items);
  const open = focused && suggestions.length > 0;

  function selectSuggestion(suggestion: QuestionSuggestion) {
    onChange(suggestion.question);
    setActiveIndex(-1);
    setFocused(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && open) { event.preventDefault(); setFocused(false); setActiveIndex(-1); return; }
    if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setFocused(true); setActiveIndex((current) => current < suggestions.length - 1 ? current + 1 : 0); return; }
    if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setFocused(true); setActiveIndex((current) => current > 0 ? current - 1 : suggestions.length - 1); return; }
    if (event.key === "Enter" && !event.shiftKey && open && activeIndex >= 0) { event.preventDefault(); selectSuggestion(suggestions[activeIndex]); }
  }

  return (
    <div className="recommended-question-typeahead">
      <textarea
        id="adaptive-evaluation-goal"
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        onChange={(event) => { onChange(event.target.value); setFocused(true); setActiveIndex(-1); }}
        onFocus={() => { if (blurTimer.current !== null) window.clearTimeout(blurTimer.current); setFocused(true); }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => { setFocused(false); setActiveIndex(-1); }, 120); }}
        onKeyDown={onKeyDown}
        placeholder="Ask a market, customer, clinic, or geographic question..."
      />
      {open ? (
        <div className="recommended-question-menu" id={listboxId} role="listbox" aria-label="Question suggestions">
          {visibleGroups.map((group) => (
            <section key={group.id} aria-labelledby={`${listboxId}-${group.id}`}>
              <strong id={`${listboxId}-${group.id}`}>{group.label}</strong>
              {group.items.map((suggestion) => {
                const index = suggestions.indexOf(suggestion);
                return (
                  <div className="recommended-question-option-row" key={`${group.id}-${suggestion.id}`}>
                    <button id={`${listboxId}-option-${index}`} className={index === activeIndex ? "active" : undefined} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectSuggestion(suggestion)}>
                      <span>{suggestion.question}</span>
                      <small><b>{suggestion.perspectiveId ?? "Saved"}</b><i>{suggestion.investigationType}</i><em data-support={suggestion.supportLevel}>{supportLabels[suggestion.supportLevel]}</em></small>
                      <p>{suggestion.supportSummary}</p>
                    </button>
                    {suggestion.kind === "previous_investigation" ? <button className="recommended-question-open-previous" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onOpenPrevious(suggestion.id)}>Open findings</button> : null}
                  </div>
                );
              })}
            </section>
          ))}
          <small className="recommended-question-hint">↑↓ choose · Enter fills the question · Shift+Enter adds a line · Esc closes</small>
        </div>
      ) : null}
    </div>
  );
}
