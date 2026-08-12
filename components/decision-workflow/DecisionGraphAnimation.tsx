"use client";

import { useId, useMemo } from "react";

export type DecisionGraphPhase = "running" | "packet" | "compare" | "saved";

export type DecisionGraphStep = {
  id: string;
  label: string;
  detail?: string;
  result?: string;
};

export type DecisionGraphAction = {
  id: string;
  title: string;
};

export type DecisionGraphAnimationProps = {
  activeStep: number;
  phase: DecisionGraphPhase;
  question: string;
  selectedActionId: string;
  onSelectNode?: (nodeId: string) => void;
  steps?: DecisionGraphStep[];
  actions?: DecisionGraphAction[];
};

type GraphNode = {
  id: string;
  kind: "question" | "step" | "action" | "packet";
  label: string;
  detail?: string;
  x: number;
  y: number;
  stepIndex?: number;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: "flow" | "action" | "settle";
};

const VIEW_W = 1200;
const VIEW_H = 900;

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function stepLayout(count: number, index: number) {
  const mid = (count - 1) / 2;
  const t = count <= 1 ? 0 : (index - mid) / Math.max(mid, 1);
  const x = 280 + index * (count > 4 ? 118 : 140);
  const y = 420 + Math.sin(t * Math.PI) * 150 + (index % 2 === 0 ? -36 : 42);
  return { x, y };
}

function actionLayout(count: number, index: number) {
  const spread = Math.min(220, 520 / Math.max(count, 1));
  const startY = 450 - ((count - 1) * spread) / 2;
  return {
    x: 980,
    y: startY + index * spread,
  };
}

function buildGraph(
  question: string,
  steps: DecisionGraphStep[],
  actions: DecisionGraphAction[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const questionNode: GraphNode = {
    id: "question",
    kind: "question",
    label: "Question",
    detail: truncate(question || "Waiting for a question", 72),
    x: 120,
    y: 420,
  };

  const stepNodes: GraphNode[] = (steps.length
    ? steps
    : [
        { id: "seed-interpret", label: "Interpret" },
        { id: "seed-resolve", label: "Resolve" },
        { id: "seed-assemble", label: "Assemble" },
      ]
  ).map((step, index) => {
    const point = stepLayout(Math.max(steps.length, 3), index);
    return {
      id: step.id,
      kind: "step" as const,
      label: step.label,
      detail: step.detail,
      x: point.x,
      y: point.y,
      stepIndex: index,
    };
  });

  const actionNodes: GraphNode[] = (actions.length
    ? actions
    : [{ id: "action-draft", title: "Draft action path" }]
  ).map((action, index) => {
    const point = actionLayout(Math.max(actions.length, 1), index);
    return {
      id: action.id,
      kind: "action" as const,
      label: action.title,
      x: point.x,
      y: point.y,
    };
  });

  const packetNode: GraphNode = {
    id: "action-packet",
    kind: "packet",
    label: "Action packet",
    detail: "Ready for accountable review",
    x: 1120,
    y: 420,
  };

  const nodes = [questionNode, ...stepNodes, ...actionNodes, packetNode];
  const edges: GraphEdge[] = [];

  if (stepNodes[0]) {
    edges.push({
      id: "e-question-first",
      from: "question",
      to: stepNodes[0].id,
      kind: "flow",
    });
  }

  for (let index = 0; index < stepNodes.length - 1; index += 1) {
    edges.push({
      id: `e-step-${index}`,
      from: stepNodes[index].id,
      to: stepNodes[index + 1].id,
      kind: "flow",
    });
  }

  const lastStep = stepNodes[stepNodes.length - 1];
  if (lastStep) {
    for (const action of actionNodes) {
      edges.push({
        id: `e-action-${action.id}`,
        from: lastStep.id,
        to: action.id,
        kind: "action",
      });
    }
  }

  for (const action of actionNodes) {
    edges.push({
      id: `e-packet-${action.id}`,
      from: action.id,
      to: "action-packet",
      kind: "settle",
    });
  }

  return { nodes, edges };
}

function nodeById(nodes: GraphNode[], id: string) {
  return nodes.find((node) => node.id === id);
}

function curvePath(from: GraphNode, to: GraphNode) {
  const dx = to.x - from.x;
  const c1x = from.x + dx * 0.38;
  const c2x = from.x + dx * 0.62;
  const lift = Math.max(28, Math.abs(to.y - from.y) * 0.18);
  const c1y = from.y + (to.y < from.y ? -lift : lift * 0.35);
  const c2y = to.y + (to.y < from.y ? lift * 0.35 : -lift);
  return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
}

function edgeVisible(
  edge: GraphEdge,
  nodes: GraphNode[],
  activeStep: number,
  settled: boolean,
  seedMode: boolean,
) {
  const from = nodeById(nodes, edge.from);
  const to = nodeById(nodes, edge.to);
  if (!from || !to) return false;

  if (edge.kind === "flow") {
    if (from.kind === "question") return activeStep >= 0 || settled || seedMode;
    const fromIndex = from.stepIndex ?? -1;
    if (seedMode && !settled && activeStep < 0) return fromIndex === 0;
    return settled || activeStep > fromIndex;
  }

  if (edge.kind === "action" || edge.kind === "settle") {
    return settled;
  }

  return false;
}

function nodeStatus(
  node: GraphNode,
  activeStep: number,
  settled: boolean,
  selectedActionId: string,
  seedMode: boolean,
): "hidden" | "pending" | "active" | "complete" | "selected" {
  if (node.kind === "question") {
    if (seedMode && activeStep < 0 && !settled) return "active";
    return settled || activeStep >= 0 ? "complete" : "active";
  }

  if (node.kind === "step") {
    const index = node.stepIndex ?? 0;
    if (seedMode && !settled && activeStep < 0) return "pending";
    if (settled || activeStep > index) return "complete";
    if (activeStep === index) return "active";
    if (activeStep + 1 === index) return "pending";
    return activeStep >= index - 1 ? "pending" : "hidden";
  }

  if (node.kind === "action") {
    if (!settled) return "hidden";
    if (node.id === selectedActionId || (!selectedActionId && node.id === "action-draft")) return "selected";
    return "complete";
  }

  if (node.kind === "packet") {
    if (!settled) return "hidden";
    return "selected";
  }

  return "hidden";
}

export function DecisionGraphAnimation({
  activeStep,
  phase,
  question,
  selectedActionId,
  onSelectNode,
  steps = [],
  actions = [],
}: DecisionGraphAnimationProps) {
  const reactId = useId();
  const gradientId = `decision-graph-glow-${reactId.replace(/:/g, "")}`;
  const settled = phase === "packet" || phase === "compare" || phase === "saved";
  const seedMode = steps.length === 0;

  const { nodes, edges } = useMemo(
    () => buildGraph(question, steps, actions),
    [actions, question, steps],
  );

  const visibleEdges = edges.filter((edge) =>
    edgeVisible(edge, nodes, activeStep, settled, seedMode),
  );

  const statusLabel = settled
    ? phase === "saved"
      ? "Action path saved"
      : phase === "compare"
        ? "Compare path ready"
        : "Action path ready"
    : seedMode
      ? "Interpreting decision path"
      : activeStep < 0
        ? "Preparing decision graph"
        : `Tracing step ${Math.min(activeStep + 1, Math.max(steps.length, 1))}`;

  return (
    <div
      className={`decision-graph-animation ${settled ? "is-settled" : "is-running"} phase-${phase}`}
      aria-label="Animated decision graph"
      data-graph-phase={phase}
      data-active-step={activeStep}
      data-selected-action={selectedActionId || undefined}
    >
      <div className="decision-graph-toolbar">
        <span>Decision graph</span>
        <small>{statusLabel}</small>
      </div>

      <svg
        className="decision-graph-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-labelledby={`${gradientId}-title`}
      >
        <title id={`${gradientId}-title`}>
          {settled
            ? "Settled decision graph showing the selected action path"
            : "Decision graph building as the workflow advances"}
        </title>
        <defs>
          <radialGradient id={`${gradientId}-bg`} cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="rgba(120, 184, 255, 0.22)" />
            <stop offset="55%" stopColor="rgba(70, 120, 180, 0.08)" />
            <stop offset="100%" stopColor="rgba(20, 36, 58, 0)" />
          </radialGradient>
          <linearGradient id={`${gradientId}-edge`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7eb6ff" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#4f8fff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#9fd0ff" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={`${gradientId}-settle`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3d8bfd" />
            <stop offset="100%" stopColor="#1f6feb" />
          </linearGradient>
          <filter id={`${gradientId}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gradientId}-bg)`} />

        <g className="decision-graph-grid" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <line
              key={`v-${index}`}
              x1={100 + index * 90}
              y1={80}
              x2={100 + index * 90}
              y2={820}
              className="decision-graph-grid-line"
            />
          ))}
          {Array.from({ length: 9 }, (_, index) => (
            <line
              key={`h-${index}`}
              x1={60}
              y1={120 + index * 80}
              x2={1140}
              y2={120 + index * 80}
              className="decision-graph-grid-line"
            />
          ))}
        </g>

        <g className="decision-graph-edges">
          {visibleEdges.map((edge) => {
            const from = nodeById(nodes, edge.from);
            const to = nodeById(nodes, edge.to);
            if (!from || !to) return null;
            const path = curvePath(from, to);
            const isPrimary =
              settled
              && (
                edge.kind === "flow"
                || (
                  (edge.kind === "action" || edge.kind === "settle")
                  && (
                    !selectedActionId
                    || edge.to === selectedActionId
                    || edge.from === selectedActionId
                  )
                )
              );
            return (
              <g
                key={edge.id}
                className={`decision-graph-edge kind-${edge.kind} ${isPrimary ? "is-primary" : "is-secondary"}`}
              >
                <path d={path} className="decision-graph-edge-base" />
                <path
                  d={path}
                  className="decision-graph-edge-flow"
                  style={{ animationDelay: `${(edge.id.length % 5) * 0.12}s` }}
                />
                {!settled && edge.kind === "flow" ? (
                  <circle className="decision-graph-packet" r="4.5">
                    <animateMotion
                      dur={`${1.6 + (edge.id.length % 4) * 0.22}s`}
                      repeatCount="indefinite"
                      path={path}
                      keyPoints="0;1"
                      keyTimes="0;1"
                      calcMode="linear"
                    />
                  </circle>
                ) : null}
              </g>
            );
          })}
        </g>

        <g className="decision-graph-nodes">
          {nodes.map((node) => {
            const status = nodeStatus(node, activeStep, settled, selectedActionId, seedMode);
            if (status === "hidden") return null;
            const interactive = Boolean(onSelectNode) && (node.kind === "step" || node.kind === "action");
            const width = node.kind === "question" || node.kind === "packet" ? 168 : 150;
            const height = node.kind === "question" ? 78 : 68;
            const label = truncate(node.label, node.kind === "action" ? 28 : 26);
            const detail = node.detail ? truncate(node.detail, 34) : undefined;

            return (
              <g
                key={node.id}
                className={`decision-graph-node kind-${node.kind} status-${status}`}
                transform={`translate(${node.x}, ${node.y})`}
                filter={status === "active" || status === "selected" ? `url(#${gradientId}-soft)` : undefined}
              >
                {status === "active" || status === "selected" ? (
                  <circle className="decision-graph-node-halo" r={node.kind === "packet" ? 58 : 52} />
                ) : null}
                <foreignObject x={-width / 2} y={-height / 2} width={width} height={height}>
                  <div className="decision-graph-node-host">
                    <button
                      type="button"
                      className="decision-graph-node-card"
                      disabled={!interactive}
                      aria-current={status === "active" || status === "selected" ? "step" : undefined}
                      onClick={() => {
                        if (interactive) onSelectNode?.(node.id);
                      }}
                    >
                      <strong>{label}</strong>
                      {detail ? <span>{detail}</span> : null}
                    </button>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="decision-graph-legend" aria-hidden="true">
        <span><i className="legend-complete" />Complete</span>
        <span><i className="legend-active" />Active</span>
        <span><i className="legend-path" />Action path</span>
      </div>
    </div>
  );
}
