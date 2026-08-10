export type StateDogOwnership = {
  fips: string;
  code: string;
  name: string;
  householdRate: number | null;
  relativeScore: number | null;
  rank: number | null;
  catHouseholdRate: number | null;
  catRelativeScore: number | null;
  catRank: number | null;
  medianHouseholdIncome: number;
  incomeRelativeScore: number;
  dogIncomeProxyScore: number | null;
  dogIncomeProxyRank: number | null;
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

const HOUSEHOLD_RATES: Record<string, number> = {
  AL: 46.9, AZ: 43.0, AR: 51.6, CA: 40.1, CO: 47.2, CT: 24.0, DE: 42.2, DC: 22.5,
  FL: 39.8, GA: 36.7, ID: 58.3, IL: 31.0, IN: 49.4, IA: 36.3, KS: 43.1, KY: 46.5,
  LA: 38.3, ME: 35.9, MD: 30.2, MA: 28.9, MI: 41.9, MN: 35.5, MS: 51.0, MO: 45.1,
  MT: 51.9, NE: 47.1, NV: 36.8, NH: 23.7, NJ: 29.1, NM: 39.4, NY: 27.0, NC: 41.3,
  ND: 44.3, OH: 37.9, OK: 47.7, OR: 37.8, PA: 38.9, RI: 25.8, SC: 45.3, SD: 32.1,
  TN: 47.0, TX: 43.4, UT: 36.2, VT: 28.3, VA: 35.6, WA: 42.8, WV: 49.6, WI: 33.6,
  WY: 36.0,
};

const CAT_HOUSEHOLD_RATES: Record<string, number> = {
  AL: 26.1, AZ: 26.4, AR: 34.8, CA: 22.9, CO: 27.1, CT: 26.7, DE: 24.1, DC: 16.4,
  FL: 24.2, GA: 20.4, ID: 33.3, IL: 21.0, IN: 37.5, IA: 35.6, KS: 32.4, KY: 32.2,
  LA: 19.0, ME: 43.6, MD: 18.6, MA: 23.5, MI: 31.2, MN: 26.5, MS: 29.1, MO: 28.6,
  MT: 22.8, NE: 30.9, NV: 23.1, NH: 36.4, NJ: 18.9, NM: 25.2, NY: 21.1, NC: 26.5,
  ND: 24.8, OH: 30.7, OK: 28.4, OR: 30.0, PA: 28.9, RI: 16.7, SC: 25.2, SD: 26.6,
  TN: 30.9, TX: 20.5, UT: 24.7, VT: 44.6, VA: 23.9, WA: 30.5, WV: 37.7, WI: 32.4,
  WY: 30.0,
};

const MEDIAN_HOUSEHOLD_INCOME: Record<string, number> = {
  AL:63999,AK:92788,AZ:79964,AR:60773,CA:99122,CO:95470,CT:95781,DE:84954,DC:109870,FL:74568,
  GA:77353,HI:100389,ID:77800,IL:83390,IN:71957,IA:75059,KS:74275,KY:63726,LA:60756,ME:74733,
  MD:103678,MA:103960,MI:72875,MN:89062,MS:56447,MO:70702,MT:72509,NE:76475,NV:78260,NH:99031,
  NJ:103556,NM:64059,NY:85974,NC:72388,ND:76657,OH:71389,OK:65039,OR:83011,PA:77971,RI:87796,
  SC:69324,SD:75081,TN:69595,TX:78476,UT:95166,VT:81203,VA:93170,WA:98141,WV:59608,WI:77485,WY:76176,
};

const ranked = Object.entries(HOUSEHOLD_RATES).sort((a, b) => b[1] - a[1]);
const rankByCode = new Map(ranked.map(([code], index) => [code, index + 1]));
const scoreByCode = new Map(ranked.map(([code], index) => [code, Math.round((1 - index / (ranked.length - 1)) * 100)]));
const catRanked = Object.entries(CAT_HOUSEHOLD_RATES).sort((a, b) => b[1] - a[1]);
const catRankByCode = new Map(catRanked.map(([code], index) => [code, index + 1]));
const catScoreByCode = new Map(catRanked.map(([code], index) => [code, Math.round((1 - index / (catRanked.length - 1)) * 100)]));
const incomeRanked = Object.entries(MEDIAN_HOUSEHOLD_INCOME).sort((a, b) => b[1] - a[1]);
const incomeScoreByCode = new Map(incomeRanked.map(([code], index) => [code, Math.round((1 - index / (incomeRanked.length - 1)) * 100)]));
const crossoverScores = Object.keys(HOUSEHOLD_RATES).map((code) => [code, Math.round(Math.sqrt((scoreByCode.get(code) ?? 0) * (incomeScoreByCode.get(code) ?? 0)))] as const).sort((a, b) => b[1] - a[1]);
const crossoverRankByCode = new Map(crossoverScores.map(([code], index) => [code, index + 1]));
const crossoverScoreByCode = new Map(crossoverScores);

export const stateDogOwnership: readonly StateDogOwnership[] = STATE_IDENTITIES.map(([fips, code, name]) => ({
  fips,
  code,
  name,
  householdRate: HOUSEHOLD_RATES[code] ?? null,
  relativeScore: scoreByCode.get(code) ?? null,
  rank: rankByCode.get(code) ?? null,
  catHouseholdRate: CAT_HOUSEHOLD_RATES[code] ?? null,
  catRelativeScore: catScoreByCode.get(code) ?? null,
  catRank: catRankByCode.get(code) ?? null,
  medianHouseholdIncome: MEDIAN_HOUSEHOLD_INCOME[code],
  incomeRelativeScore: incomeScoreByCode.get(code) ?? 0,
  dogIncomeProxyScore: crossoverScoreByCode.get(code) ?? null,
  dogIncomeProxyRank: crossoverRankByCode.get(code) ?? null,
}));

export const stateDogOwnershipSource = {
  sourceId: "AVMA-PDS-2017-2018-T16",
  title: "AVMA Pet Ownership & Demographics Sourcebook, 2017-2018 edition, Table 16",
  observedAt: "2016-12-31",
  evidenceStatus: "Confirmed public survey estimate",
  url: "https://ebusiness.avma.org/Files/ProductDownloads/2019%20ECO-PetDemoUpdateErrataFINAL-20190501.pdf",
  scoreFormula: "Percentile rank of the reported state dog-owning-household rate; highest reported state = 100.",
  limitation: "State survey estimates are dated and are not Chewy customer counts, current dog population, or a clinic-opening recommendation. Alaska and Hawaii were not reported in this table.",
} as const;

export const statePetMarketSources = {
  ownership: stateDogOwnershipSource,
  income: {
    sourceId: "SRC-016-ACS-STATE-INCOME-2024",
    title: "2020-2024 ACS 5-year estimate, median household income (B19013_001E)",
    observedAt: "2024-12-31",
    evidenceStatus: "Confirmed public estimate",
    url: "https://api.census.gov/data/2024/acs/acs5/groups/B19013.html",
  },
  crossoverFormula: "Geometric mean of the state dog-ownership percentile and median-household-income percentile.",
  crossoverLimitation: "Income is an ability-to-pay proxy, not observed willingness to pay. A production WTP evaluation requires approved price-response, transaction, or survey evidence at a compatible geographic grain.",
} as const;
