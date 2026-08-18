export type StateDogOwnership = {
  fips: string;
  code: string;
  name: string;
  householdRate: number | null;
  relativePercentile: number | null;
};

const STATE_IDENTITIES = [
  ["01", "AL", "Alabama"], ["02", "AK", "Alaska"], ["04", "AZ", "Arizona"], ["05", "AR", "Arkansas"],
  ["06", "CA", "California"], ["08", "CO", "Colorado"], ["09", "CT", "Connecticut"], ["10", "DE", "Delaware"],
  ["11", "DC", "District of Columbia"], ["12", "FL", "Florida"], ["13", "GA", "Georgia"], ["15", "HI", "Hawaii"],
  ["16", "ID", "Idaho"], ["17", "IL", "Illinois"], ["18", "IN", "Indiana"], ["19", "IA", "Iowa"],
  ["20", "KS", "Kansas"], ["21", "KY", "Kentucky"], ["22", "LA", "Louisiana"], ["23", "ME", "Maine"],
  ["24", "MD", "Maryland"], ["25", "MA", "Massachusetts"], ["26", "MI", "Michigan"], ["27", "MN", "Minnesota"],
  ["28", "MS", "Mississippi"], ["29", "MO", "Missouri"], ["30", "MT", "Montana"], ["31", "NE", "Nebraska"],
  ["32", "NV", "Nevada"], ["33", "NH", "New Hampshire"], ["34", "NJ", "New Jersey"], ["35", "NM", "New Mexico"],
  ["36", "NY", "New York"], ["37", "NC", "North Carolina"], ["38", "ND", "North Dakota"], ["39", "OH", "Ohio"],
  ["40", "OK", "Oklahoma"], ["41", "OR", "Oregon"], ["42", "PA", "Pennsylvania"], ["44", "RI", "Rhode Island"],
  ["45", "SC", "South Carolina"], ["46", "SD", "South Dakota"], ["47", "TN", "Tennessee"], ["48", "TX", "Texas"],
  ["49", "UT", "Utah"], ["50", "VT", "Vermont"], ["51", "VA", "Virginia"], ["53", "WA", "Washington"],
  ["54", "WV", "West Virginia"], ["55", "WI", "Wisconsin"], ["56", "WY", "Wyoming"],
] as const;

// Restored from the prior adaptive-workspace branch. These are reported state
// survey estimates, not CBSA estimates and not a modeled pet-density measure.
const HOUSEHOLD_RATES: Record<string, number> = {
  AL: 46.9, AZ: 43.0, AR: 51.6, CA: 40.1, CO: 47.2, CT: 24.0, DE: 42.2, DC: 22.5,
  FL: 39.8, GA: 36.7, ID: 58.3, IL: 31.0, IN: 49.4, IA: 36.3, KS: 43.1, KY: 46.5,
  LA: 38.3, ME: 35.9, MD: 30.2, MA: 28.9, MI: 41.9, MN: 35.5, MS: 51.0, MO: 45.1,
  MT: 51.9, NE: 47.1, NV: 36.8, NH: 23.7, NJ: 29.1, NM: 39.4, NY: 27.0, NC: 41.3,
  ND: 44.3, OH: 37.9, OK: 47.7, OR: 37.8, PA: 38.9, RI: 25.8, SC: 45.3, SD: 32.1,
  TN: 47.0, TX: 43.4, UT: 36.2, VT: 28.3, VA: 35.6, WA: 42.8, WV: 49.6, WI: 33.6,
  WY: 36.0,
};

const ranked = Object.entries(HOUSEHOLD_RATES).sort((left, right) => right[1] - left[1]);
const percentileByCode = new Map(ranked.map(([code], index) => [code, Math.max(1, Math.round((1 - index / (ranked.length - 1)) * 100))]));

export const stateDogOwnership: readonly StateDogOwnership[] = STATE_IDENTITIES.map(([fips, code, name]) => ({
  fips,
  code,
  name,
  householdRate: HOUSEHOLD_RATES[code] ?? null,
  relativePercentile: percentileByCode.get(code) ?? null,
}));

export const stateDogOwnershipSource = {
  sourceId: "AVMA-PDS-2017-2018-T16",
  title: "AVMA Pet Ownership & Demographics Sourcebook, 2017–2018 edition, Table 16",
  observedAt: "2016-12-31",
  geography: "state",
  evidenceStatus: "reported_public_survey_estimate",
  allowedUse: "coarse_market_context_only",
  url: "https://ebusiness.avma.org/Files/ProductDownloads/2019%20ECO-PetDemoUpdateErrataFINAL-20190501.pdf",
  limitation: "The state estimates are dated and are not a CBSA pet count, Chewy customer count, current pet-owner density, or advertising recommendation. Alaska and Hawaii were not reported.",
} as const;
