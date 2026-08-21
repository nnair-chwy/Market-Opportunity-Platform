"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AdaptiveMarketWorkspace } from "@/components/decision-workflow/AdaptiveMarketWorkspace";
import { RecommendedQuestionTypeahead } from "@/components/decision-workflow/RecommendedQuestionTypeahead";
import { OpeningFindingsControl } from "@/components/insight-discovery/OpeningFindingsControl";
import { DataRefreshControl } from "@/components/sharing/DataRefreshControl";
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
import { listStarterQuestions, type PreviousInvestigationQuestion } from "@/lib/questions";
import type { CurrentDataDiscoveryRun } from "@/lib/insight-discovery";

type SavedPacketPreview = PreviousInvestigationQuestion & {
  id: string;
  title: string;
  savedAt: string;
};

type AdaptiveEvaluationWorkspaceProps = {
  question: string;
  savedPackets: SavedPacketPreview[];
  onQuestionChange: (value: string) => void;
  onSubmit: (
    perspectiveId?: PerspectiveId,
    activeViewId?: PerspectiveViewId,
    geographicContexts?: readonly SelectedGeographicContext[],
  ) => void;
  onDiscoverInsights: (findingId?: string, run?: CurrentDataDiscoveryRun) => void;
  onPerspectiveChange: (perspectiveId: PerspectiveId) => void;
  onOpenSaved: () => void;
  onOpenSavedPacket: (id: string) => void;
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
  onDiscoverInsights,
  onPerspectiveChange,
  onOpenSaved,
  onOpenSavedPacket,
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
  const [layerManagerOpen, setLayerManagerOpen] = useState(false);
  const [mapResetRequest, setMapResetRequest] = useState(0);
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
      selectedGeographicContexts,
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
              className="adaptive-map-reset-trigger"
              type="button"
              onClick={() => setMapResetRequest((request) => request + 1)}
              aria-label="Reset map to national view"
            >
              <span aria-hidden="true">↶</span> Reset
            </button>
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

      <section className="adaptive-platform-capability" aria-label="Current capability and product vision">
        <div>
          <strong>What works now</strong>
          <p>Three approved questions route to deterministic local evidence, visible source and quality metadata, explicit unknowns, and a reviewable action packet.</p>
        </div>
        <div>
          <strong>Product vision</strong>
          <p>Scale the same governed question-to-evidence workflow across market, clinic, marketing, pricing, and competitive decisions without automating the final business decision.</p>
        </div>
      </section>

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
              <RecommendedQuestionTypeahead
                value={question}
                perspectiveId={perspectiveId}
                activeViewId={activeView.viewId}
                selectedGeographicContexts={selectedGeographicContexts}
                previousInvestigations={savedPackets}
                onChange={onQuestionChange}
                onOpenPrevious={onOpenSavedPacket}
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
            <div className="adaptive-starter-questions" aria-label="Demo questions">
              {listStarterQuestions(perspectiveId).map((starter) => (
                <button key={starter.id} type="button" onClick={() => onQuestionChange(starter.question)}>
                  {starter.question}
                </button>
              ))}
            </div>
            <small className="adaptive-composer-note">
              The map changes to fit the question, not a fixed score.
            </small>
          </form>
        </div>
      </div>

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
        onGeographicContextSelect={onGeographicContextSelect}
        resetRequest={mapResetRequest}
        openingControls={(
          <>
            <OpeningFindingsControl
              onOpenDiscovery={onDiscoverInsights}
            />
            <DataRefreshControl />
            {savedPackets.length > 0 ? (
              <button
                className="adaptive-opening-tool adaptive-saved-trigger"
                type="button"
                onClick={onOpenSaved}
                aria-label={`Open ${savedPackets.length} saved action ${savedPackets.length === 1 ? "packet" : "packets"}`}
                title={`Latest: ${savedPackets[0]?.title ?? "Saved action packet"}`}
              >
                <span aria-hidden="true">↗</span>
                <strong>Saved</strong>
                <small>{savedPackets.length}</small>
              </button>
            ) : null}
          </>
        )}
      />
    </section>
  );
}
