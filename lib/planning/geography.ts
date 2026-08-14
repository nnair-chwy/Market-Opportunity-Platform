import marketUniverseJson from "../../data/public/census/cbsa-universe/2023-07/markets.json" with { type: "json" };
import type { CbsaMarket, CbsaUniverseSnapshot } from "../data/cbsa-universe/types.ts";
import {
  geographyResolutionSchema,
  type GeographyResolution,
  type RequestedPlace,
  type PlanningIntent,
} from "./contracts.ts";

const universe = marketUniverseJson as CbsaUniverseSnapshot;

type PlaceCandidate = {
  cbsaCode: string;
  cbsaName: string;
  cbsaType: CbsaMarket["cbsa_type"];
  matchName: string;
};

type PlaceIndexEntry = {
  key: string;
  candidates: PlaceCandidate[];
};

const IGNORED_PLACE_TOKENS = new Set([
  "united",
  "states",
  "america",
  "market",
  "markets",
  "metro",
  "city",
  "cities",
  "area",
  "areas",
  "region",
  "regions",
  "clinic",
  "clinics",
  "care",
  "chewy",
  "vet",
  "veterinary",
  "campaign",
  "growth",
  "population",
  "density",
  "income",
  "household",
  "housing",
  "peer",
  "peers",
  "next",
  "new",
  "future",
  "local",
  "national",
  "public",
  "census",
]);

function buildPlaceIndex(markets: readonly CbsaMarket[]): PlaceIndexEntry[] {
  const byKey = new Map<string, PlaceCandidate[]>();
  const add = (rawName: string, candidate: PlaceCandidate) => {
    const key = rawName.trim().toLowerCase();
    if (key.length < 3 || IGNORED_PLACE_TOKENS.has(key)) return;
    const existing = byKey.get(key) ?? [];
    if (!existing.some((item) => item.cbsaCode === candidate.cbsaCode)) {
      existing.push(candidate);
      byKey.set(key, existing);
    }
  };

  for (const market of markets) {
    const base: PlaceCandidate = {
      cbsaCode: market.cbsa_code,
      cbsaName: market.cbsa_name,
      cbsaType: market.cbsa_type,
      matchName: market.cbsa_name,
    };
    const lead = market.cbsa_name.split(/[-,]/)[0]?.trim() ?? "";
    add(lead, { ...base, matchName: lead });
    for (const city of market.principal_cities) {
      add(city.name, {
        ...base,
        matchName: city.name,
      });
    }
  }

  return [...byKey.entries()]
    .map(([key, candidates]) => ({ key, candidates }))
    .sort((left, right) => right.key.length - left.key.length || left.key.localeCompare(right.key));
}

const PLACE_INDEX = buildPlaceIndex(universe.markets);

const US_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

function normalizeStateHint(value: string | null | undefined): string | null {
  if (!value) return null;
  const hint = value.trim().toUpperCase();
  return US_STATE_CODES.has(hint) ? hint : null;
}

function normalizedPlaceTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !IGNORED_PLACE_TOKENS.has(token));
}

function samePlaceText(left: string, right: string): boolean {
  const leftTokens = normalizedPlaceTokens(left);
  const rightTokens = normalizedPlaceTokens(right);
  if (!leftTokens.length || !rightTokens.length) return false;
  return leftTokens.every((token) => rightTokens.includes(token))
    || rightTokens.every((token) => leftTokens.includes(token));
}

/**
 * AI may propose human-readable geography text, but the question and the
 * checked-in CBSA universe remain the source of truth for what can resolve.
 */
export function normalizeRequestedPlaces(
  question: string,
  requestedPlaces: readonly RequestedPlace[],
): RequestedPlace[] {
  const extracted = extractRequestedPlaces(question);
  if (!requestedPlaces.length) return extracted;

  return requestedPlaces.slice(0, 5).map((place) => {
    const match = extracted.find((candidate) => samePlaceText(place.name, candidate.name));
    if (!match) return { name: place.name.trim(), stateHint: normalizeStateHint(place.stateHint) };
    return {
      name: match.name,
      stateHint: normalizeStateHint(place.stateHint) ?? match.stateHint,
    };
  });
}

function scoreCandidates(
  candidates: readonly PlaceCandidate[],
  stateHint: string | null,
): PlaceCandidate[] {
  const withHint = stateHint
    ? candidates.filter((candidate) =>
        candidate.cbsaName.toUpperCase().includes(`, ${stateHint}`)
        || candidate.cbsaName.toUpperCase().endsWith(` ${stateHint}`)
        || candidate.cbsaName.toUpperCase().includes(`-${stateHint}`)
        || candidate.cbsaName.toUpperCase().includes(` ${stateHint}-`)
        || candidate.cbsaName.toUpperCase().includes(` ${stateHint},`))
    : candidates;
  const pool = withHint.length ? withHint : [...candidates];
  const metros = pool.filter((candidate) => candidate.cbsaType === "metropolitan");
  if (metros.length === 1) return metros;
  if (metros.length > 1) return metros;
  return [...pool];
}

export function resolveRequestedPlace(place: RequestedPlace) {
  const key = place.name.trim().toLowerCase();
  const stateHint = normalizeStateHint(place.stateHint);
  const entry = PLACE_INDEX.find((item) => item.key === key);
  if (!entry) {
    return {
      requestedName: place.name.trim(),
      status: "unavailable" as const,
      cbsaCode: null,
      cbsaName: null,
      candidates: [],
    };
  }
  const scored = scoreCandidates(entry.candidates, stateHint);
  if (scored.length === 1) {
    return {
      requestedName: place.name.trim(),
      status: "resolved" as const,
      cbsaCode: scored[0].cbsaCode,
      cbsaName: scored[0].cbsaName,
      candidates: scored.map((item) => ({ cbsaCode: item.cbsaCode, cbsaName: item.cbsaName })),
    };
  }
  return {
    requestedName: place.name.trim(),
    status: "ambiguous" as const,
    cbsaCode: null,
    cbsaName: null,
    candidates: scored.slice(0, 8).map((item) => ({
      cbsaCode: item.cbsaCode,
      cbsaName: item.cbsaName,
    })),
  };
}

export function extractRequestedPlaces(question: string): RequestedPlace[] {
  const value = question.toLowerCase();
  const found: Array<RequestedPlace & { index: number }> = [];
  for (const entry of PLACE_INDEX) {
    if (entry.key.length < 4 && !["mesa", "knox"].includes(entry.key)) continue;
    const pattern = new RegExp(`\\b${entry.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const match = pattern.exec(value);
    if (!match || match.index === undefined) continue;
    const after = value.slice(match.index + match[0].length, match.index + match[0].length + 8);
    const stateMatch = /^(?:\s*,\s*|\s+)([a-z]{2})\b/.exec(after);
    const stateHint = stateMatch ? normalizeStateHint(stateMatch[1]) : null;
    found.push({
      name: entry.candidates[0]?.matchName ?? entry.key,
      stateHint,
      index: match.index,
    });
  }
  found.sort((left, right) => left.index - right.index || right.name.length - left.name.length);
  const unique: RequestedPlace[] = [];
  for (const item of found) {
    const normalized = item.name.trim().toLowerCase();
    if (unique.some((existing) => existing.name.toLowerCase() === normalized)) continue;
    // Skip overlapping shorter matches that start inside a longer already-accepted span.
    if (
      found.some(
        (other) =>
          other.index < item.index
          && other.index + other.name.length > item.index
          && other.name.length > item.name.length,
      )
    ) {
      continue;
    }
    unique.push({ name: item.name, stateHint: item.stateHint });
    if (unique.length >= 5) break;
  }
  return unique;
}

export function resolveGeography(
  intent: Pick<PlanningIntent, "requestedPlaces" | "requestedAction" | "clarificationRequired" | "clarificationReason" | "topic" | "geographyGrain">,
): GeographyResolution {
  const places = intent.requestedPlaces.map(resolveRequestedPlace);
  const resolved = places.filter((place) => place.status === "resolved");
  const ambiguous = places.filter((place) => place.status === "ambiguous");
  const unavailable = places.filter((place) => place.status === "unavailable");

  if (ambiguous.length || unavailable.length) {
    const labels = [...ambiguous, ...unavailable].map((place) => place.requestedName);
    return geographyResolutionSchema.parse({
      mode: ambiguous.length ? "clarification" : "unavailable",
      places,
      selectedCbsaCodes: [],
      message: ambiguous.length
        ? `Clarify which market is meant by ${labels.join(", ")}. Compatible CBSA options are listed for review.`
        : `${labels.join(", ")} could not be matched to the checked-in public CBSA universe.`,
    });
  }

  if (resolved.length >= 2 && resolved.length <= 5) {
    return geographyResolutionSchema.parse({
      mode: "compare",
      places,
      selectedCbsaCodes: resolved.map((place) => place.cbsaCode!),
      message: `Compare ${resolved.map((place) => place.cbsaName).join(", ")} in the analyst-specified order.`,
    });
  }

  if (resolved.length === 1) {
    return geographyResolutionSchema.parse({
      mode: "single",
      places,
      selectedCbsaCodes: [resolved[0].cbsaCode!],
      message: `Focus the workspace on ${resolved[0].cbsaName} (CBSA ${resolved[0].cbsaCode}).`,
    });
  }

  if (
    intent.clarificationRequired
    && intent.clarificationReason !== "none"
  ) {
    return geographyResolutionSchema.parse({
      mode: "clarification",
      places,
      selectedCbsaCodes: [],
      message: "The question still needs clarification before a market or portfolio scope can be selected.",
    });
  }

  if (
    intent.topic === "market_context"
    && (intent.requestedAction === "compare" || intent.requestedAction === "screen")
  ) {
    return geographyResolutionSchema.parse({
      mode: "needs_selection",
      places,
      selectedCbsaCodes: [],
      message: "No named market was requested. The national CBSA map is available; choose a market when selection is required.",
    });
  }

  return geographyResolutionSchema.parse({
    mode: "national",
    places,
    selectedCbsaCodes: [],
    message: "No named geography was requested. Showing the national CBSA context view.",
  });
}
