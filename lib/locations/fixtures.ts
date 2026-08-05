import type {
  LocationCategory,
  LocationDisplay,
  LocationFixtureResult,
} from "./types.ts";

const currentLocations = [
  {
    site_id: "cvc-fountain-oaks",
    site_name: "Fountain Oaks",
    market: "Atlanta",
    region_code: "GA",
    category: "current",
    location_status: "Open",
    evidence_status: "Confirmed",
    evaluation_state: "Not applicable",
    is_synthetic: false,
    source_ids: ["SRC-009"],
    map_position: {
      x_percent: 77.5,
      y_percent: 64.5,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: null,
    data_notes: [
      "Clinic name and market are fixture snapshots based on SRC-009.",
      "Map placement is synthetic and does not represent an approved street-level coordinate.",
      "Public clinic presence does not indicate clinic performance.",
    ],
  },
  {
    site_id: "cvc-the-triangle",
    site_name: "The Triangle",
    market: "Austin",
    region_code: "TX",
    category: "current",
    location_status: "Open",
    evidence_status: "Confirmed",
    evaluation_state: "Not applicable",
    is_synthetic: false,
    source_ids: ["SRC-009"],
    map_position: {
      x_percent: 51,
      y_percent: 75,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: null,
    data_notes: [
      "Clinic name and market are fixture snapshots based on SRC-009.",
      "Map placement is synthetic and does not represent an approved street-level coordinate.",
      "Public clinic presence does not indicate clinic performance.",
    ],
  },
  {
    site_id: "cvc-highlands-ranch",
    site_name: "Highlands Ranch",
    market: "Denver",
    region_code: "CO",
    category: "current",
    location_status: "Open",
    evidence_status: "Confirmed",
    evaluation_state: "Not applicable",
    is_synthetic: false,
    source_ids: ["SRC-009"],
    map_position: {
      x_percent: 42.8,
      y_percent: 42.2,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: null,
    data_notes: [
      "Clinic name and market are fixture snapshots based on SRC-009.",
      "Map placement is synthetic and does not represent an approved street-level coordinate.",
      "Public clinic presence does not indicate clinic performance.",
    ],
  },
  {
    site_id: "cvc-plantation",
    site_name: "Plantation",
    market: "South Florida",
    region_code: "FL",
    category: "current",
    location_status: "Open",
    evidence_status: "Confirmed",
    evaluation_state: "Not applicable",
    is_synthetic: false,
    source_ids: ["SRC-009"],
    map_position: {
      x_percent: 88.4,
      y_percent: 88.5,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: null,
    data_notes: [
      "Clinic name and market are fixture snapshots based on SRC-009.",
      "Map placement is synthetic and does not represent an approved street-level coordinate.",
      "Public clinic presence does not indicate clinic performance.",
    ],
  },
] satisfies readonly LocationDisplay[];

const potentialLocations = [
  {
    site_id: "syn-potential-nashville-east",
    site_name: "Nashville East",
    market: "Nashville",
    region_code: "TN",
    category: "potential",
    location_status: "Candidate",
    evidence_status: "Hypothesis",
    evaluation_state: "Ready",
    is_synthetic: true,
    source_ids: ["SYN-LOC-001"],
    map_position: {
      x_percent: 70.5,
      y_percent: 59,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: null,
    data_notes: [
      "Synthetic candidate for workflow demonstration.",
      "Candidate-pipeline access from SRC-012 is not confirmed.",
    ],
  },
  {
    site_id: "syn-potential-raleigh-north",
    site_name: "Raleigh North",
    market: "Raleigh",
    region_code: "NC",
    category: "potential",
    location_status: "Candidate",
    evidence_status: "Unknown",
    evaluation_state: "Needs data",
    is_synthetic: true,
    source_ids: ["SYN-LOC-002"],
    map_position: {
      x_percent: 84.2,
      y_percent: 58.5,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: null,
    data_notes: [
      "Synthetic candidate for workflow demonstration.",
      "One or more evidence fields are unavailable.",
    ],
  },
  {
    site_id: "syn-potential-sacramento-central",
    site_name: "Sacramento Central",
    market: "Sacramento",
    region_code: "CA",
    category: "potential",
    location_status: "Candidate",
    evidence_status: "Reported",
    evaluation_state: "In review",
    is_synthetic: true,
    source_ids: ["SYN-LOC-003"],
    map_position: {
      x_percent: 10.2,
      y_percent: 41.5,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: null,
    data_notes: ["Synthetic candidate for workflow demonstration."],
  },
] satisfies readonly LocationDisplay[];

const evaluatedLocations = [
  {
    site_id: "syn-evaluated-tampa-westshore",
    site_name: "Tampa Westshore",
    market: "Tampa",
    region_code: "FL",
    category: "evaluated",
    location_status: "Previously evaluated",
    evidence_status: "Derived",
    evaluation_state: "Evaluated",
    is_synthetic: true,
    source_ids: ["SYN-LOC-004", "SYN-EVAL-001"],
    map_position: {
      x_percent: 84.2,
      y_percent: 81.8,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: {
      value: 78,
      max_value: 100,
      version: "CVC-SYN-v0.1",
    },
    data_notes: [
      "Synthetic candidate and deterministic demonstration score.",
      "The score is decision support, not a site recommendation.",
    ],
  },
  {
    site_id: "syn-evaluated-columbus-north",
    site_name: "Columbus North",
    market: "Columbus",
    region_code: "OH",
    category: "evaluated",
    location_status: "Previously evaluated",
    evidence_status: "Derived",
    evaluation_state: "Evaluated",
    is_synthetic: true,
    source_ids: ["SYN-LOC-005", "SYN-EVAL-002"],
    map_position: {
      x_percent: 72.8,
      y_percent: 47.8,
      evidence_status: "Hypothesis",
      is_synthetic: true,
    },
    score: {
      value: 71,
      max_value: 100,
      version: "CVC-SYN-v0.1",
    },
    data_notes: [
      "Synthetic candidate and deterministic demonstration score.",
      "The score is decision support, not a site recommendation.",
    ],
  },
  {
    site_id: "syn-evaluated-portland-market",
    site_name: "Portland Market Study",
    market: "Portland",
    region_code: "OR",
    category: "evaluated",
    location_status: "Previously evaluated",
    evidence_status: "Unknown",
    evaluation_state: "Unknown",
    is_synthetic: true,
    source_ids: ["SYN-LOC-006"],
    map_position: null,
    score: null,
    data_notes: [
      "Synthetic partial-data record.",
      "Map position and evaluation result are unavailable.",
    ],
  },
] satisfies readonly LocationDisplay[];

export const locationFixtures: readonly LocationDisplay[] = [
  ...currentLocations,
  ...potentialLocations,
  ...evaluatedLocations,
];

export function getLocationFixtures(
  category?: LocationCategory,
): readonly LocationDisplay[] {
  const matches = category
    ? locationFixtures.filter((location) => location.category === category)
    : locationFixtures;

  return matches.map((location) => ({
    ...location,
    source_ids: [...location.source_ids],
    data_notes: [...location.data_notes],
    map_position: location.map_position ? { ...location.map_position } : null,
    score: location.score ? { ...location.score } : null,
  }));
}

/**
 * Mimics an asynchronous provider without calling a source system.
 */
export async function loadLocationFixtures(
  category?: LocationCategory,
): Promise<LocationFixtureResult> {
  const locations = getLocationFixtures(category);
  const hasPartialData = locations.some(
    (location) =>
      location.evidence_status === "Unknown" || location.map_position === null,
  );

  return {
    locations,
    state: hasPartialData ? "partial" : "ready",
    message: hasPartialData
      ? "Some fixture locations contain unknown or unavailable fields."
      : null,
  };
}
