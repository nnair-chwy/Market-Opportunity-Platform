"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AdaptiveMarketWorkspace } from "@/components/decision-workflow/AdaptiveMarketWorkspace";
import {
  coerceSupportedMapMode,
  createDefaultActiveViews,
  getPerspective,
  getPerspectiveView,
  listPerspectives,
  listViewsForPerspective,
  resolveMapPresentation,
  selectPerspectiveView,
  type MapViewMode,
  type PerspectiveId,
  type PerspectiveViewId,
} from "@/lib/perspectives";
import type { WorkflowCategory } from "@/lib/workflow/market-workflow";
import type { SelectedGeographicContext } from "@/lib/planning/geographic-context";

type SavedPacketPreview = {
  id: string;
  title: string;
  savedAt: string;
};

const starterQuestions: Record<PerspectiveId, readonly [string, string]> = {
  cvc: [
    "What clinic footprint patterns are worth investigating?",
    "Which comparable metros have different CVC footprints, and what should we validate next?",
  ],
  marketing: [
    "What regional marketing patterns are worth investigating?",
    "Which comparable metros could support a test-and-control feasibility check?",
  ],
  pricing: [
    "What regional pricing patterns are worth investigating?",
    "Where might customer response to price or promotion differ, and what evidence would test it?",
  ],
};

type AdaptiveEvaluationWorkspaceProps = {
  question: string;
  savedPackets: SavedPacketPreview[];
  onQuestionChange: (value: string) => void;
  onSubmit: (perspectiveId?: PerspectiveId) => void;
  onPerspectiveChange: (perspectiveId: PerspectiveId) => void;
  onOpenSaved: () => void;
  selectedGeographicContexts: readonly SelectedGeographicContext[];
  onGeographicContextSelect: (context: SelectedGeographicContext) => void;
  onGeographicContextRemove: (cbsaCode: string) => void;
  geographicContextNotice?: string | null;
};

export function AdaptiveEvaluationWorkspace({
  question,
  savedPackets,
  onQuestionChange,
  onSubmit,
  onPerspectiveChange,
  onOpenSaved,
  selectedGeographicContexts = [],
  onGeographicContextSelect,
  onGeographicContextRemove,
  geographicContextNotice,
}: AdaptiveEvaluationWorkspaceProps) {
  const [perspectiveId, setPerspectiveId] = useState<PerspectiveId>("cvc");
  const [perspectiveExplicitlySelected, setPerspectiveExplicitlySelected] = useState(false);
  const [activeViews, setActiveViews] = useState(createDefaultActiveViews);
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapViewMode>("single");
  const [category, setCategory] = useState<WorkflowCategory>("all");
  const [includeMicropolitan, setIncludeMicropolitan] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const perspectives = listPerspectives();
  const activePerspective = getPerspective(perspectiveId);
  const views = listViewsForPerspective(perspectiveId);
  const activeViewId = activeViews[perspectiveId];
  const activeViewSelection = selectPerspectiveView(perspectiveId, activeViewId);
  const activeView =
    "status" in activeViewSelection
      ? getPerspectiveView(perspectiveId, activePerspective.defaultViewId)
      : activeViewSelection;
  const presentation = useMemo(() => resolveMapPresentation(activeView), [activeView]);
  const activeMapMode = coerceSupportedMapMode(mapMode, presentation);

  useEffect(() => {
    if (!perspectiveOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setPerspectiveOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPerspectiveOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [perspectiveOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(perspectiveExplicitlySelected ? perspectiveId : undefined);
  }

  function choosePerspective(next: PerspectiveId) {
    setPerspectiveId(next);
    setPerspectiveExplicitlySelected(true);
    setPerspectiveOpen(false);
    onPerspectiveChange(next);
    const nextView = getPerspectiveView(next, activeViews[next]);
    setMapMode((current) =>
      coerceSupportedMapMode(current, resolveMapPresentation(nextView)),
    );
  }

  function chooseView(viewId: PerspectiveViewId) {
    const selected = selectPerspectiveView(perspectiveId, viewId);
    if ("status" in selected) return;
    setActiveViews((current) => ({ ...current, [perspectiveId]: viewId }));
    setMapMode((current) =>
      coerceSupportedMapMode(current, resolveMapPresentation(selected)),
    );
  }

  return (
    <section
      className="adaptive-evaluation-workspace adaptive-opening"
      aria-labelledby="adaptive-workspace-title"
      data-perspective={perspectiveId}
      data-active-view={activeView.viewId}
      data-map-mode={activeMapMode}
    >
      <h1 id="adaptive-workspace-title" className="sr-only">
        Market Opportunity Platform
      </h1>

      <header className="adaptive-opening-nav">
        <div className="adaptive-perspective-shell" ref={dropdownRef}>
          <button
            className="adaptive-perspective"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={perspectiveOpen}
            aria-label={`Perspective: ${activePerspective.label}`}
            onClick={() => setPerspectiveOpen((open) => !open)}
          >
            <span>Perspective</span>
            <strong>{activePerspective.label}</strong>
            <b aria-hidden="true">⌄</b>
          </button>
          <ul
            className="adaptive-perspective-menu"
            role="listbox"
            aria-label="Perspectives"
            hidden={!perspectiveOpen}
          >
            {perspectives.map((perspective) => (
              <li key={perspective.perspectiveId} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={perspective.perspectiveId === perspectiveId}
                  className={
                    perspective.perspectiveId === perspectiveId ? "active" : undefined
                  }
                  onClick={() => choosePerspective(perspective.perspectiveId)}
                >
                  {perspective.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="adaptive-cvc-views adaptive-perspective-views"
          role="toolbar"
          aria-label={`${activePerspective.label} views`}
        >
          <span>{activePerspective.label} views</span>
          {views.map((view) => (
            <button
              key={view.viewId}
              type="button"
              className={view.viewId === activeView.viewId ? "active" : undefined}
              aria-pressed={view.viewId === activeView.viewId}
              data-evidence={view.evidenceAvailability}
              onClick={() => chooseView(view.viewId)}
            >
              {view.label}
            </button>
          ))}
        </div>

        <div className="adaptive-view-controls" data-view-a-control="true">
          <span>View A</span>
          <select
            aria-label="View A measure"
            value={activeView.viewId}
            onChange={(event) => chooseView(event.target.value as PerspectiveViewId)}
          >
            {views.map((view) => (
              <option key={view.viewId} value={view.viewId}>
                {view.label}
              </option>
            ))}
          </select>
          <div className="adaptive-mode-switch" role="group" aria-label="Map view mode">
            <button
              className={activeMapMode === "single" ? "active" : undefined}
              type="button"
              aria-pressed={activeMapMode === "single"}
              onClick={() => setMapMode("single")}
            >
              Single
            </button>
            <button
              className={activeMapMode === "compare" ? "active" : undefined}
              type="button"
              aria-pressed={activeMapMode === "compare"}
              disabled={!presentation.supportsComparison}
              title={
                presentation.supportsComparison
                  ? "Compare two to five regions"
                  : "Compare mode is not supported for this view"
              }
              onClick={() => setMapMode("compare")}
            >
              Compare
            </button>
            <button
              className={activeMapMode === "layer" ? "active" : undefined}
              type="button"
              aria-pressed={activeMapMode === "layer"}
              disabled={!presentation.supportsLayerMode}
              title={
                presentation.supportsLayerMode
                  ? "Toggle approved regional layers"
                  : "Layer mode is not supported for this view"
              }
              onClick={() => setMapMode("layer")}
            >
              Layer
            </button>
          </div>
        </div>
      </header>

      <AdaptiveMarketWorkspace
        opening
        activeView={activeView}
        mapMode={activeMapMode}
        category={category}
        onCategoryChange={setCategory}
        includeMicropolitan={includeMicropolitan}
        onIncludeMicropolitanChange={setIncludeMicropolitan}
        onGeographicContextSelect={onGeographicContextSelect}
      />

      <div className="adaptive-question-composer">
        <div className="adaptive-composer-input">
          <form onSubmit={submit}>
            <label htmlFor="adaptive-evaluation-goal">
              <strong>Evaluation question</strong>
            </label>
            {selectedGeographicContexts.length > 0 ? (
              <div className="adaptive-geographic-context" aria-label="Selected geographic context">
                <span className="adaptive-geographic-context-label">Geographic context</span>
                <div className="adaptive-geographic-context-chips">
                  {selectedGeographicContexts.map((context) => (
                    <span className="adaptive-geographic-context-chip" key={context.cbsaCode}>
                      <span>{context.cbsaName}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${context.cbsaName}`}
                        onClick={() => onGeographicContextRemove(context.cbsaCode)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="adaptive-composer-row">
              <textarea
                id="adaptive-evaluation-goal"
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
                placeholder="Ask a market, customer, clinic, or geographic question..."
              />
              <button className="primary-action" type="submit" disabled={!question.trim()}>
                Run decision graph <span aria-hidden="true">→</span>
              </button>
            </div>
            {geographicContextNotice ? (
              <small className="adaptive-geographic-context-notice" role="status">
                {geographicContextNotice}
              </small>
            ) : null}
            <div className="adaptive-starter-questions" aria-label={`${activePerspective.label} example questions`}>
              {starterQuestions[perspectiveId].map((starter) => (
                <button key={starter} type="button" onClick={() => onQuestionChange(starter)}>
                  {starter}
                </button>
              ))}
            </div>
            <small className="adaptive-composer-note">
              The map changes to fit the question, not a fixed score.
            </small>
          </form>
        </div>
      </div>

      {savedPackets.length > 0 ? (
        <div className="adaptive-recent-packets">
          <strong>Recent action packets</strong>
          {savedPackets.slice(0, 3).map((packet) => (
            <button type="button" key={packet.id} onClick={onOpenSaved}>
              <span>{packet.title}</span>
              <small>{packet.savedAt}</small>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
