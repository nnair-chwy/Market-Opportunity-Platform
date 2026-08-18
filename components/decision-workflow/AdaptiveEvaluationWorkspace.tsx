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
    "Where is paid search response concentrated, and which regions need validation?",
    "Which comparable metros have different paid search response percentiles?",
  ],
  pricing: [
    "Where does monitored competitor availability differ by region?",
    "Which comparable metros have different competitor-availability percentiles?",
  ],
};

type AdaptiveEvaluationWorkspaceProps = {
  question: string;
  savedPackets: SavedPacketPreview[];
  onQuestionChange: (value: string) => void;
  onSubmit: (perspectiveId?: PerspectiveId, activeViewId?: PerspectiveViewId) => void;
  onPerspectiveChange: (perspectiveId: PerspectiveId) => void;
  onOpenSaved: () => void;
};

export function AdaptiveEvaluationWorkspace({
  question,
  savedPackets,
  onQuestionChange,
  onSubmit,
  onPerspectiveChange,
  onOpenSaved,
}: AdaptiveEvaluationWorkspaceProps) {
  const [perspectiveId, setPerspectiveId] = useState<PerspectiveId>("cvc");
  const [perspectiveExplicitlySelected, setPerspectiveExplicitlySelected] = useState(false);
  const [activeViews, setActiveViews] = useState(createDefaultActiveViews);
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapViewMode>("single");
  const [layerManagerOpen, setLayerManagerOpen] = useState(false);
  const [comparisonViewId, setComparisonViewId] = useState<PerspectiveViewId | null>(null);
  const [category, setCategory] = useState<WorkflowCategory>("all");
  const [includeMicropolitan, setIncludeMicropolitan] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const perspectives = listPerspectives();
  const activePerspective = getPerspective(perspectiveId);
  const views = listViewsForPerspective(perspectiveId);
  const visibleViews = views.filter((view) => view.evidenceAvailability === "available");
  const activeViewId = activeViews[perspectiveId];
  const activeViewSelection = selectPerspectiveView(perspectiveId, activeViewId);
  const activeView =
    "status" in activeViewSelection
      ? getPerspectiveView(perspectiveId, activePerspective.defaultViewId)
      : activeViewSelection;
  const presentation = useMemo(() => resolveMapPresentation(activeView), [activeView]);
  const activeMapMode = coerceSupportedMapMode(mapMode, presentation);
  const compatibleComparisonViews = visibleViews.filter(
    (view) =>
      view.viewId !== activeView.viewId &&
      view.evidenceAvailability === "available" &&
      view.geographyGrain === activeView.geographyGrain &&
      view.mapBinding.kind === activeView.mapBinding.kind &&
      (view.mapBinding.kind === "census_percentile" || view.mapBinding.kind === "workspace_snapshot"),
  );
  const comparisonView = comparisonViewId
    ? compatibleComparisonViews.find((view) => view.viewId === comparisonViewId) ?? null
    : null;

  useEffect(() => {
    setActiveViews((current) => {
      const defaults = createDefaultActiveViews();
      const next = { ...current };
      let changed = false;
      for (const perspective of listPerspectives()) {
        if (!perspective.views.some((view) => view.viewId === current[perspective.perspectiveId])) {
          next[perspective.perspectiveId] = defaults[perspective.perspectiveId];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

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
    onSubmit(
      perspectiveExplicitlySelected ? perspectiveId : undefined,
      perspectiveExplicitlySelected ? activeView.viewId : undefined,
    );
  }

  function choosePerspective(next: PerspectiveId) {
    setPerspectiveId(next);
    setPerspectiveExplicitlySelected(true);
    setPerspectiveOpen(false);
    setComparisonViewId(null);
    onPerspectiveChange(next);
    const nextViewSelection = selectPerspectiveView(next, activeViews[next]);
    const nextView = "status" in nextViewSelection
      ? getPerspectiveView(next, getPerspective(next).defaultViewId)
      : nextViewSelection;
    if (!resolveMapPresentation(nextView).supportsLayerMode) {
      setLayerManagerOpen(false);
    }
    setMapMode((current) =>
      coerceSupportedMapMode(current, resolveMapPresentation(nextView)),
    );
  }

  function chooseView(viewId: PerspectiveViewId) {
    const selected = selectPerspectiveView(perspectiveId, viewId);
    if ("status" in selected) return;
    setActiveViews((current) => ({ ...current, [perspectiveId]: viewId }));
    setComparisonViewId(null);
    if (!resolveMapPresentation(selected).supportsLayerMode) {
      setLayerManagerOpen(false);
    }
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
          {visibleViews.map((view) => (
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
          <div className="adaptive-view-primary-row" data-view-row="a">
            <label htmlFor="adaptive-view-a-select">View A</label>
            <select
              id="adaptive-view-a-select"
              aria-label="View A measure"
              value={activeView.viewId}
              onChange={(event) => chooseView(event.target.value as PerspectiveViewId)}
            >
              {visibleViews.map((view) => (
                <option key={view.viewId} value={view.viewId}>
                  {view.label}
                </option>
              ))}
            </select>
            <div className="adaptive-mode-switch" role="group" aria-label="Analysis view">
              <button
                className={activeMapMode === "single" ? "active" : undefined}
                type="button"
                aria-pressed={activeMapMode === "single"}
                onClick={() => {
                  setMapMode("single");
                  setLayerManagerOpen(false);
                }}
              >
                Explore
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
                onClick={() => {
                  setMapMode("compare");
                  setLayerManagerOpen(false);
                  setComparisonViewId(null);
                }}
              >
                Compare regions
              </button>
            </div>
          </div>
          {comparisonView ? (
            <div className="adaptive-view-b-control" id="adaptive-view-b-control">
              <label htmlFor="adaptive-view-b-select">View B</label>
              <select
                id="adaptive-view-b-select"
                aria-label="View B measure"
                value={comparisonView.viewId}
                onChange={(event) =>
                  setComparisonViewId(event.target.value as PerspectiveViewId)
                }
              >
                {compatibleComparisonViews.map((view) => (
                  <option key={view.viewId} value={view.viewId}>{view.label}</option>
                ))}
              </select>
              <div>
                <strong>Compare views</strong>
                <small>Drag the divider on the map. Both sides use the same geography and cohort.</small>
              </div>
              <button type="button" onClick={() => setComparisonViewId(null)} aria-label="Remove View B">×</button>
            </div>
          ) : null}
          <div className="adaptive-view-secondary-actions" data-controls-owner={comparisonView ? "view-b" : "view-a"}>
            <button
              className={`adaptive-layer-trigger${layerManagerOpen ? " active" : ""}`}
              type="button"
              aria-expanded={layerManagerOpen}
              aria-controls="adaptive-map-layer-manager"
              disabled={!presentation.supportsLayerMode}
              title={
                presentation.supportsLayerMode
                  ? "Show or hide compatible map overlays"
                  : "Map layers are not available for this view"
              }
              onClick={() => setLayerManagerOpen((open) => !open)}
            >
              <span aria-hidden="true">◇</span> Map layers
            </button>
            <button
              className={`adaptive-add-view-trigger${comparisonView ? " active" : ""}`}
              type="button"
              aria-expanded={Boolean(comparisonView)}
              aria-controls="adaptive-view-b-control"
              disabled={!compatibleComparisonViews.length}
              title={
                compatibleComparisonViews.length
                  ? "Add a second compatible measure and compare with a draggable divider"
                  : "No second compatible view is available"
              }
              onClick={() => {
                setMapMode("single");
                setLayerManagerOpen(false);
                setComparisonViewId((current) =>
                  current ? null : compatibleComparisonViews[0]?.viewId ?? null,
                );
              }}
            >
              <span aria-hidden="true">＋</span>{comparisonView ? "Compare views" : "Add view"}
            </button>
          </div>
        </div>
      </header>

      <AdaptiveMarketWorkspace
        opening
        activeView={activeView}
        comparisonView={comparisonView}
        mapMode={activeMapMode}
        showLayerManager={layerManagerOpen}
        category={category}
        onCategoryChange={setCategory}
        includeMicropolitan={includeMicropolitan}
        onIncludeMicropolitanChange={setIncludeMicropolitan}
      />

      <div className="adaptive-question-composer">
        <div className="adaptive-composer-input">
          <form onSubmit={submit}>
            <label htmlFor="adaptive-evaluation-goal">
              <strong>Evaluation question</strong>
            </label>
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
