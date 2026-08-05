import type {
  MarketAttractivenessResult,
  SyntheticMarketSnapshot,
} from "./types.ts";

export const MARKET_SCORE_COLORS = {
  notScored: "#d7dee8",
  // Stronger sequential blues so neighboring scores stay legible on the basemap.
  low: "#cfe8ff",
  lowMid: "#6eb3e8",
  mid: "#2b7fc4",
  highMid: "#0d4f8a",
  high: "#062445",
} as const;

/** MapLibre fill opacity for scored CBSA polygons in markets mode. */
export const MARKET_SCORE_FILL_OPACITY = 0.72;

// Stops denser through the typical synthetic score band (~25–75) for clearer gradients.
const COLOR_STOPS = [
  { score: 0, color: MARKET_SCORE_COLORS.low },
  { score: 20, color: MARKET_SCORE_COLORS.lowMid },
  { score: 40, color: MARKET_SCORE_COLORS.mid },
  { score: 60, color: MARKET_SCORE_COLORS.highMid },
  { score: 100, color: MARKET_SCORE_COLORS.high },
] as const;

function parseHex(value: string): [number, number, number] {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

export function marketScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return MARKET_SCORE_COLORS.notScored;
  }
  const bounded = Math.min(100, Math.max(0, score));
  const upperIndex = COLOR_STOPS.findIndex((stop) => stop.score >= bounded);
  if (upperIndex <= 0) return COLOR_STOPS[0].color;
  const lower = COLOR_STOPS[upperIndex - 1];
  const upper = COLOR_STOPS[upperIndex];
  const ratio = (bounded - lower.score) / (upper.score - lower.score);
  const lowerRgb = parseHex(lower.color);
  const upperRgb = parseHex(upper.color);
  return `#${lowerRgb
    .map((channel, index) =>
      toHex(channel + (upperRgb[index] - channel) * ratio),
    )
    .join("")}`;
}

export function marketScoresByCbsaCode(
  snapshot: SyntheticMarketSnapshot,
  results: readonly MarketAttractivenessResult[],
): Readonly<Record<string, number>> {
  const resultByPrototypeId = new Map(
    results.map((result) => [result.prototypeMarketId, result]),
  );
  const scores: Record<string, number> = {};

  for (const market of snapshot.markets) {
    if (!market.cbsa_code) continue;
    const result = resultByPrototypeId.get(market.prototype_market_id);
    if (!result) continue;
    if (scores[market.cbsa_code] !== undefined) {
      throw new Error(`Duplicate market score for CBSA ${market.cbsa_code}.`);
    }
    scores[market.cbsa_code] = result.overallScore;
  }

  return scores;
}

export function marketScoreMatchExpression(
  workspaceMode: "markets" | "locations",
  scores: Readonly<Record<string, number>>,
): readonly unknown[] {
  if (workspaceMode === "locations") return ["literal", "#e5e7eb"];
  const expression: unknown[] = ["match", ["get", "cbsa_code"]];
  for (const [cbsaCode, score] of Object.entries(scores)) {
    expression.push(cbsaCode, marketScoreColor(score));
  }
  expression.push(MARKET_SCORE_COLORS.notScored);
  return expression;
}
