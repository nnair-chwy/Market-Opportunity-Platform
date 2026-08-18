import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CbsaMarket } from "../data/cbsa-universe/types.ts";
import { geographyResolutionSchema, type GeographyResolution } from "./contracts.ts";

const STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
const VALID_STATE_CODES = new Set([...Object.values(STATE_CODES), "DC"]);
const STOP_WORDS = new Set(["united", "states", "metro", "metropolitan", "micropolitan", "statistical", "area", "market", "dma"]);

export function normalizeState(value: string | null | undefined): string | null {
  const normalized = value?.normalize("NFKC").trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");
  if (!normalized) return null;
  if (STATE_CODES[normalized]) return STATE_CODES[normalized]!;
  const upper = normalized.toUpperCase();
  return VALID_STATE_CODES.has(upper) ? upper : null;
}

export function normalizeGeographyText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bft\.?\b/g, "fort")
    .replace(/\bst\.?\b/g, "saint")
    .replace(/\bmt\.?\b/g, "mount")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalizeGeographyText(value).split(" ").filter((token) => token && !STOP_WORDS.has(token) && !VALID_STATE_CODES.has(token.toUpperCase()) && !STATE_CODES[token]);
}

export function stateCodesFromText(value: string, explicit?: string | null): string[] {
  const found = new Set<string>();
  const explicitCode = normalizeState(explicit);
  if (explicitCode) found.add(explicitCode);
  const normalized = normalizeGeographyText(value);
  for (const [name, code] of Object.entries(STATE_CODES)) if (new RegExp(`\\b${name.replaceAll(" ", "\\s+")}\\b`).test(normalized)) found.add(code);
  for (const token of normalized.split(" ")) if (VALID_STATE_CODES.has(token.toUpperCase())) found.add(token.toUpperCase());
  return [...found].sort();
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left); const b = new Set(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / new Set([...a, ...b]).size;
}

function coverage(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length / left.length;
}

function emptyResolution(rawType: GeographyResolution["rawGeographyType"], rawValue: string | null, warning: string): GeographyResolution {
  return geographyResolutionSchema.parse({ rawGeographyType: rawType, rawGeographyValue: rawValue, normalizedGeographyValue: rawValue ? normalizeGeographyText(rawValue) : null, canonicalGeographyType: "unresolved", canonicalGeographyId: null, cbsaCode: null, cbsaName: null, stateCodes: [], method: "unresolved", confidence: "none", confidenceScore: 0, evidenceStatus: "Unknown", reviewStatus: "unmatched", demoUsable: false, candidateMarketIds: [], warnings: [warning] });
}

export type CbsaResolver = ReturnType<typeof createCbsaResolver>;

export async function loadCbsaMarkets(path = resolve("data/public/census/cbsa-universe/2023-07/markets.json")): Promise<CbsaMarket[]> {
  const snapshot = JSON.parse(await readFile(path, "utf8")) as { markets?: CbsaMarket[] };
  if (!Array.isArray(snapshot.markets) || !snapshot.markets.length) throw new Error("The checked-in Census CBSA universe is unavailable.");
  return snapshot.markets;
}

export function createCbsaResolver(markets: CbsaMarket[]) {
  const byCode = new Map(markets.map((market) => [market.cbsa_code, market]));
  const byName = new Map<string, CbsaMarket[]>();
  for (const market of markets) {
    const key = normalizeGeographyText(market.cbsa_name);
    byName.set(key, [...(byName.get(key) ?? []), market]);
  }

  function selectedResolution(input: {
    rawType: GeographyResolution["rawGeographyType"];
    rawValue: string;
    market: CbsaMarket;
    method: GeographyResolution["method"];
    score: number;
    candidates: CbsaMarket[];
    warnings?: string[];
  }): GeographyResolution {
    const confidence = input.method === "source_cbsa_code" || input.method === "exact_cbsa_name" ? "exact" : input.score >= 0.82 ? "high" : input.score >= 0.62 ? "medium" : "low";
    const tied = input.candidates.length > 1;
    const reviewStatus = confidence === "exact" || (confidence === "high" && !tied) ? "auto_accepted" : tied ? "review_required" : "demo_inferred";
    const evidenceStatus = confidence === "exact" ? "Confirmed" : confidence === "high" ? "Derived" : "Hypothesis";
    const warnings = [...(input.warnings ?? [])];
    if (confidence === "medium" || confidence === "low") warnings.push("This CBSA assignment is an intuitive demo inference and requires review before production use.");
    if (tied) warnings.push("Multiple plausible CBSAs were found; the highest-scoring candidate is retained for the demo and requires review.");
    return geographyResolutionSchema.parse({ rawGeographyType: input.rawType, rawGeographyValue: input.rawValue, normalizedGeographyValue: normalizeGeographyText(input.rawValue), canonicalGeographyType: "cbsa", canonicalGeographyId: input.market.market_id, cbsaCode: input.market.cbsa_code, cbsaName: input.market.cbsa_name, stateCodes: input.market.state_codes, method: input.method, confidence, confidenceScore: Math.max(0, Math.min(1, input.score)), evidenceStatus, reviewStatus, demoUsable: true, candidateMarketIds: input.candidates.slice(0, 3).map((candidate) => candidate.market_id), warnings });
  }

  function resolveCode(code: string | null | undefined): GeographyResolution | null {
    const digits = code?.replace(/[^0-9]/g, "");
    if (!digits) return null;
    const market = byCode.get(digits.padStart(5, "0"));
    return market ? selectedResolution({ rawType: "cbsa_code", rawValue: code!, market, method: "source_cbsa_code", score: 1, candidates: [market] }) : null;
  }

  const labelCache = new Map<string, GeographyResolution>();

  function resolveLabelUncached(label: string | null | undefined, explicitState?: string | null, rawType: GeographyResolution["rawGeographyType"] = "cbsa_label"): GeographyResolution {
    const raw = label?.trim();
    if (!raw) return emptyResolution(rawType, null, "No geography label was supplied.");
    const normalized = normalizeGeographyText(raw);
    const exact = byName.get(normalized);
    if (exact?.length === 1) return selectedResolution({ rawType, rawValue: raw, market: exact[0]!, method: "exact_cbsa_name", score: 1, candidates: exact });

    const hints = stateCodesFromText(raw, explicitState);
    const labelTokens = tokens(raw);
    const scored = markets.map((market) => {
      const marketTokens = tokens(market.cbsa_name);
      const cityTokenSets = market.principal_cities.map((city) => tokens(city.name));
      const countyTokenSets = market.component_counties.map((county) => tokens(county.county_name.replace(/\bCounty\b/gi, "")));
      const bestCityCoverage = Math.max(0, ...cityTokenSets.map((cityTokens) => coverage(cityTokens, labelTokens)));
      const bestCountyCoverage = Math.max(0, ...countyTokenSets.map((countyTokens) => coverage(countyTokens, labelTokens)));
      const cityHits = cityTokenSets.filter((cityTokens) => coverage(cityTokens, labelTokens) === 1).length;
      const stateMatch = !hints.length ? 0.08 : hints.some((state) => market.state_codes.includes(state)) ? 0.24 : -0.45;
      const tokenScore = Math.max(jaccard(labelTokens, marketTokens), coverage(labelTokens, marketTokens) * 0.8);
      const score = Math.max(0, Math.min(1, tokenScore * 0.52 + bestCityCoverage * 0.25 + bestCountyCoverage * 0.12 + Math.min(cityHits, 2) * 0.05 + stateMatch));
      return { market, score, cityHits };
    }).filter((item) => item.score >= 0.35).sort((a, b) => b.score - a.score || a.market.cbsa_code.localeCompare(b.market.cbsa_code));
    const best = scored[0];
    if (!best) return emptyResolution(rawType, raw, "No plausible Census CBSA candidate was found.");
    const near = scored.filter((item) => best.score - item.score <= 0.045).map((item) => item.market);
    const method = best.cityHits > 0 && hints.length ? "principal_city_and_state" : "token_similarity_and_state";
    return selectedResolution({ rawType, rawValue: raw, market: best.market, method, score: best.score, candidates: near.length ? near : [best.market] });
  }

  function resolveLabel(label: string | null | undefined, explicitState?: string | null, rawType: GeographyResolution["rawGeographyType"] = "cbsa_label"): GeographyResolution {
    const key = `${rawType}|${explicitState ?? ""}|${label ?? ""}`;
    const cached = labelCache.get(key);
    if (cached) return cached;
    const result = resolveLabelUncached(label, explicitState, rawType);
    labelCache.set(key, result);
    return result;
  }

  function resolveState(value: string | null | undefined): GeographyResolution {
    const raw = value?.trim() || null;
    const state = normalizeState(raw);
    if (!state) return emptyResolution("state", raw, "The supplied state label could not be normalized.");
    return geographyResolutionSchema.parse({ rawGeographyType: "state", rawGeographyValue: raw, normalizedGeographyValue: state, canonicalGeographyType: "state", canonicalGeographyId: `state:${state}`, cbsaCode: null, cbsaName: null, stateCodes: [state], method: "state_only", confidence: "exact", confidenceScore: 1, evidenceStatus: "Confirmed", reviewStatus: "auto_accepted", demoUsable: true, candidateMarketIds: [], warnings: [] });
  }

  const national = (): GeographyResolution => geographyResolutionSchema.parse({ rawGeographyType: "national", rawGeographyValue: "United States", normalizedGeographyValue: "united states", canonicalGeographyType: "national", canonicalGeographyId: "country:US", cbsaCode: null, cbsaName: null, stateCodes: [], method: "national", confidence: "exact", confidenceScore: 1, evidenceStatus: "Confirmed", reviewStatus: "not_applicable", demoUsable: true, candidateMarketIds: [], warnings: ["National evidence cannot be attributed to a CBSA."] });

  return { markets, byCode, resolveCode, resolveLabel, resolveState, national };
}
