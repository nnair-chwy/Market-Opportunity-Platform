import { publicMarkets } from "../data/public-market-ui.ts";
import { currentClinics } from "../locations/map-data.ts";
import type { EvaluationPlan } from "./contracts.ts";
import type { AnalysisBrief } from "./analysis-brief.ts";

export type InvestigationLead = {
  id: string;
  marketIds: string[];
  title: string;
  observation: string;
  businessMeaning: string;
  method: string;
  sampleSize: number;
  strength: string;
  challenge: string;
  nextEvidence: string;
};

export type MarketInvestigation = {
  version: "1.0.0";
  planId: string;
  originalQuestion: string;
  perspectiveId: "cvc" | "marketing" | "pricing";
  geography: "CBSA";
  period: string;
  dataSnapshotLabel: string;
  dataSnapshotVersion: string;
  readiness: {
    label: "Partial answer" | "Context only";
    summary: string;
    missing: string[];
  };
  toolsRun: string[];
  measuresExamined: string[];
  comparisonsExamined: number;
  screeningScope: {
    marketUniverse: number;
    eligibleCohort: string;
    eligibleComparisons: number;
    allMarketPairs: number;
    selectionRule: string;
    executionMode: "deterministic_local_snapshot";
  };
  leads: InvestigationLead[];
  rejectedPatterns: string[];
  limitations: string[];
  sourceIds: string[];
  allowedUse: "market_context_only";
  scoringEligibility: "none";
  formula?: Array<{ id: string; label: string; weightPercent: number }>;
};

export type InvestigationFollowUp = {
  id: string;
  leadId: string;
  question: string;
  answer: string;
};

type MarketRow = {
  id: string;
  name: string;
  population: number;
  households: number;
  income: number;
  density: number;
  clinicCount: number;
};

const CVC_MARKET_TO_CBSA: Record<string, string> = {
  Atlanta: "Atlanta-Sandy Springs-Roswell, GA",
  Austin: "Austin-Round Rock-San Marcos, TX",
  "Colorado Springs": "Colorado Springs, CO",
  Dallas: "Dallas-Fort Worth-Arlington, TX",
  Denver: "Denver-Aurora-Centennial, CO",
  "Fort Collins": "Fort Collins-Loveland, CO",
  Houston: "Houston-Pasadena-The Woodlands, TX",
  Jacksonville: "Jacksonville, FL",
  Phoenix: "Phoenix-Mesa-Chandler, AZ",
  "South Florida": "Miami-Fort Lauderdale-West Palm Beach, FL",
  Tampa: "Tampa-St. Petersburg-Clearwater, FL",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function percentDifference(left: number, right: number) {
  return Math.abs(left - right) / ((left + right) / 2) * 100;
}

function marketRows(): MarketRow[] {
  const clinicCounts = new Map<string, number>();
  for (const clinic of currentClinics) {
    const cbsaName = CVC_MARKET_TO_CBSA[clinic.market];
    if (cbsaName) clinicCounts.set(cbsaName, (clinicCounts.get(cbsaName) ?? 0) + 1);
  }
  return publicMarkets.flatMap((market) => {
    const metrics = market.acs?.metrics;
    if (market.cbsa_type !== "metropolitan" || !metrics) return [];
    const population = metrics.total_population.raw_value;
    const households = metrics.household_count.raw_value;
    const income = metrics.median_household_income.raw_value;
    const density = metrics.population_density.raw_value;
    if ([population, households, income, density].some((value) => value === null)) return [];
    return [{
      id: market.cbsa_code,
      name: market.cbsa_name,
      population: population!,
      households: households!,
      income: income!,
      density: density!,
      clinicCount: clinicCounts.get(market.cbsa_name) ?? 0,
    }];
  });
}

function contextDistance(left: MarketRow, right: MarketRow) {
  return Math.sqrt(
    Math.log(right.population / left.population) ** 2
    + Math.log(right.households / left.households) ** 2
    + Math.log(right.income / left.income) ** 2
    + Math.log((right.density + 1) / (left.density + 1)) ** 2,
  );
}

function baseInvestigation(plan: EvaluationPlan, perspectiveId: MarketInvestigation["perspectiveId"]): Omit<MarketInvestigation, "readiness" | "toolsRun" | "measuresExamined" | "comparisonsExamined" | "screeningScope" | "leads" | "rejectedPatterns" | "limitations" | "sourceIds"> {
  return {
    version: "1.0.0",
    planId: plan.planId,
    originalQuestion: plan.originalQuestion,
    perspectiveId,
    geography: "CBSA",
    period: "2020–2024 ACS 5-year estimate",
    dataSnapshotLabel: "Checked-in SRC-009 clinic footprint and SRC-016 ACS context",
    dataSnapshotVersion: "SRC-009-footprint+SRC-016-acs-2024",
    allowedUse: "market_context_only",
    scoringEligibility: "none",
  };
}

function cvcInvestigation(plan: EvaluationPlan, rows: MarketRow[]): MarketInvestigation {
  const footprint = rows.filter((row) => row.clinicCount > 0);
  const outsideFootprint = rows.filter((row) => row.clinicCount === 0);
  const closestPeers = footprint
    .map((base) => {
      const peer = [...outsideFootprint].sort((left, right) => contextDistance(base, left) - contextDistance(base, right))[0];
      return { base, peer, distance: contextDistance(base, peer) };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 5);
  const intensity = footprint
    .map((market) => ({ market, householdsPerClinic: market.households / market.clinicCount }))
    .sort((left, right) => right.householdsPerClinic - left.householdsPerClinic);
  const intensityValues = intensity.map((item) => item.householdsPerClinic).sort((a, b) => a - b);
  const middle = Math.floor(intensityValues.length / 2);
  const median = intensityValues.length % 2
    ? intensityValues[middle]
    : (intensityValues[middle - 1] + intensityValues[middle]) / 2;
  const highest = intensity[0];

  const allLeads: InvestigationLead[] = [
    {
      id: "cvc-footprint-intensity-proxy",
      marketIds: [highest.market.id],
      title: `${highest.market.name} has the highest household base per published CVC clinic`,
      observation: `${formatNumber(highest.market.households)} households and ${highest.market.clinicCount} published CVC clinic${highest.market.clinicCount === 1 ? "" : "s"} produce ${formatNumber(highest.householdsPerClinic)} households per clinic—${(highest.householdsPerClinic / median).toFixed(1)}× the footprint-market median.`,
      businessMeaning: "Current footprint intensity differs materially across existing CVC markets, which makes this a useful validation lead rather than a market recommendation.",
      method: "ACS households divided by published CVC clinic count within current-footprint metros",
      sampleSize: footprint.length,
      strength: `${(highest.householdsPerClinic / median).toFixed(1)}× footprint median`,
      challenge: "This is not clinic access, capacity, utilization, or patient demand.",
      nextEvidence: "Add clinic capacity and maturity, approved trade areas, appointment demand, customer penetration, and veterinary supply.",
    },
    ...closestPeers.map(({ base, peer, distance }, index): InvestigationLead => ({
      id: `cvc-peer-contrast-${index + 1}`,
      marketIds: [base.id, peer.id],
      title: `${base.name} and ${peer.name} form a useful footprint contrast`,
      observation: `${base.name} has ${base.clinicCount} published CVC clinic${base.clinicCount === 1 ? "" : "s"}; ${peer.name} has none. Households differ ${percentDifference(base.households, peer.households).toFixed(1)}%, income ${percentDifference(base.income, peer.income).toFixed(1)}%, and density ${percentDifference(base.density, peer.density).toFixed(1)}%.`,
      businessMeaning: "The pair is a more credible investigation lead than a national extreme: similar public market structure, different current CVC footprint.",
      method: "Nearest peer on population, households, median income, and population density",
      sampleSize: rows.length,
      strength: `context distance ${distance.toFixed(2)}`,
      challenge: "Public-context similarity does not mean equal pet demand, clinic economics, veterinary supply, or real-estate feasibility.",
      nextEvidence: "Compare pet households, Chewy customer demand, veterinary capacity, trade-area access, property feasibility, and historical market decisions.",
    })),
  ];

  const requestedCodes = new Set(plan.geographyResolution.selectedCbsaCodes);
  const leads = requestedCodes.size
    ? allLeads.filter((lead) => lead.marketIds.some((marketId) => requestedCodes.has(marketId)))
    : allLeads;

  return {
    ...baseInvestigation(plan, "cvc"),
    readiness: {
      label: "Partial answer",
      summary: "The connected data can screen CVC footprint contrasts and structurally comparable metros. It cannot yet rank clinic opportunity or measure true access and demand.",
      missing: ["CBSA-level pet or customer demand", "Approved CVC trade areas and clinic capacity", "Veterinary supply and service capacity"],
    },
    toolsRun: ["Interpret the submitted question", "Check evidence compatibility", "Build the footprint cohort", "Screen comparable metro peers", "Challenge business meaning"],
    measuresExamined: ["Published CVC clinic count", "Population", "Households", "Median household income", "Population density"],
    comparisonsExamined: footprint.length * outsideFootprint.length,
    screeningScope: {
      marketUniverse: rows.length,
      eligibleCohort: `${footprint.length} metros with a mapped published CVC clinic × ${outsideFootprint.length} metros without one in the checked-in snapshot`,
      eligibleComparisons: footprint.length * outsideFootprint.length,
      allMarketPairs: rows.length * (rows.length - 1) / 2,
      selectionRule: "Keep each footprint metro's single nearest no-footprint peer, then show the five closest matches plus one footprint-intensity diagnostic.",
      executionMode: "deterministic_local_snapshot",
    },
    leads,
    rejectedPatterns: ["Obvious national income and density extremes", "Mechanical household and population correlations", "Households relabeled as pet demand", "State pet ownership assigned directly to metros"],
    limitations: ["Households are context, not pet demand; clinic points are footprint, not access or capacity.", "Population and households both enter the fixed distance, so market scale is represented twice; peer stability and alternate-match sensitivity are not yet tested.", "A zero means no mapped clinic in this checked-in snapshot, not verified absence from the market.", "Public context is not eligible to become a clinic recommendation score.", "These leads prioritize validation work; they do not explain causality or recommend a market."],
    sourceIds: ["SRC-009", "SRC-016"],
  };
}

function marketingInvestigation(plan: EvaluationPlan, rows: MarketRow[]): MarketInvestigation {
  const eligible = rows.filter((row) => row.population >= 500_000);
  const candidates = eligible
    .flatMap((left, index) => eligible.slice(index + 1).map((right) => ({ left, right, distance: contextDistance(left, right) })))
    .sort((left, right) => left.distance - right.distance);
  const used = new Set<string>();
  const peerPairs = candidates.filter(({ left, right }) => {
    if (used.has(left.id) || used.has(right.id)) return false;
    used.add(left.id);
    used.add(right.id);
    return true;
  }).slice(0, 5);
  const concentrationPair = candidates
    .filter(({ left, right }) => percentDifference(left.households, right.households) <= 12)
    .map(({ left, right }) => ({ dense: left.density >= right.density ? left : right, sparse: left.density >= right.density ? right : left }))
    .sort((left, right) => (right.dense.density / right.sparse.density) - (left.dense.density / left.sparse.density))[0];
  const leads: InvestigationLead[] = [
    ...peerPairs.map(({ left, right, distance }, index): InvestigationLead => ({
      id: `marketing-peer-pair-${index + 1}`,
      marketIds: [left.id, right.id],
      title: `${left.name} and ${right.name} are a plausible public-context peer pair`,
      observation: `Population differs ${percentDifference(left.population, right.population).toFixed(1)}%, households ${percentDifference(left.households, right.households).toFixed(1)}%, income ${percentDifference(left.income, right.income).toFixed(1)}%, and density ${percentDifference(left.density, right.density).toFixed(1)}%.`,
      businessMeaning: "The pair is structurally similar enough to prioritize for a test-and-control feasibility check instead of comparing arbitrary markets.",
      method: "Nearest large-metro peer on population, households, income, and density",
      sampleSize: eligible.length,
      strength: `context distance ${distance.toFixed(2)}`,
      challenge: "Public similarity does not establish comparable customers, baseline outcomes, media exposure, seasonality, or geographic independence.",
      nextEvidence: "Add pre-period outcomes, customer mix, media delivery and cost, campaign history, contamination risk, and outcome stability.",
    })),
    {
      id: "marketing-concentration-contrast",
      marketIds: [concentrationPair.dense.id, concentrationPair.sparse.id],
      title: `${concentrationPair.dense.name} and ${concentrationPair.sparse.name} have similar household scale but different concentration`,
      observation: `Households differ ${percentDifference(concentrationPair.dense.households, concentrationPair.sparse.households).toFixed(1)}%, while ${concentrationPair.dense.name} is ${(concentrationPair.dense.density / concentrationPair.sparse.density).toFixed(1)}× denser.`,
      businessMeaning: "This contrast is worth testing as a channel, reach, delivery, or creative hypothesis because equal audience scale may require different regional tactics.",
      method: "Largest density contrast among large metros within 12% household scale",
      sampleSize: eligible.length,
      strength: `${(concentrationPair.dense.density / concentrationPair.sparse.density).toFixed(1)}× density contrast`,
      challenge: "CBSA density does not measure reachable audience concentration, media efficiency, customer behavior, or campaign response.",
      nextEvidence: "Add ZIP-level customers and outcomes, reachable media audience, cost and frequency, and within-market concentration.",
    },
  ];

  return {
    ...baseInvestigation(plan, "marketing"),
    readiness: {
      label: "Partial answer",
      summary: "The connected data can find structurally comparable metros and concentration contrasts. It cannot assign a valid test/control market or regional strategy without Chewy outcomes and media evidence.",
      missing: ["Pre-period customer and outcome baselines", "Media exposure, cost, and campaign history", "Geographic independence and outcome stability checks"],
    },
    toolsRun: ["Interpret the submitted question", "Restrict to large metros", "Screen same-grain structural peers", "Test concentration contrasts", "Challenge experiment validity"],
    measuresExamined: ["Population", "Households", "Median household income", "Population density"],
    comparisonsExamined: candidates.length,
    screeningScope: {
      marketUniverse: rows.length,
      eligibleCohort: `${eligible.length} metropolitan markets with at least 500,000 residents and complete public-context inputs`,
      eligibleComparisons: candidates.length,
      allMarketPairs: rows.length * (rows.length - 1) / 2,
      selectionRule: "Sort all eligible public-context pairs, retain non-overlapping closest peers, and add one household-scale concentration contrast.",
      executionMode: "deterministic_local_snapshot",
    },
    leads,
    rejectedPatterns: ["National size and income extremes", "Mechanical population and household correlations"],
    limitations: ["Public market structure can prioritize validation but cannot establish marketing response, test validity, or causal lift.", "Population and households overlap as measures of market scale; alternate peer stability is not yet tested.", "No customer, media, cost, or conversion outcome is connected yet."],
    sourceIds: ["SRC-016"],
  };
}

function contextOnlyInvestigation(plan: EvaluationPlan, rows: MarketRow[]): MarketInvestigation {
  const pricing = plan.originalQuestion.match(/\b(price|pricing|elasticity|promo)\b/i);
  return {
    ...baseInvestigation(plan, pricing ? "pricing" : "marketing"),
    readiness: {
      label: "Context only",
      summary: "The connected public Census evidence can describe market context, but it cannot answer this question without a compatible business outcome or driver.",
      missing: ["A question-specific business measure at CBSA grain", "A compatible outcome or comparison baseline", "Historical evidence for stability"],
    },
    toolsRun: ["Interpret the submitted question", "Check evidence compatibility", "Suppress generic correlations", "Identify missing evidence"],
    measuresExamined: ["Population", "Households", "Median household income", "Housing units", "Population density"],
    comparisonsExamined: 0,
    screeningScope: {
      marketUniverse: rows.length,
      eligibleCohort: "No question-compatible business outcome is connected",
      eligibleComparisons: 0,
      allMarketPairs: rows.length * (rows.length - 1) / 2,
      selectionRule: "Suppress generic public-context patterns until a compatible business outcome or driver is available.",
      executionMode: "deterministic_local_snapshot",
    },
    leads: [],
    rejectedPatterns: ["Generic Census outliers", "Mechanical same-domain correlations"],
    limitations: ["No result is more useful than an irrelevant result.", "Public context is not eligible to become a recommendation score."],
    sourceIds: ["SRC-016"],
  };
}

export function runMarketInvestigation(plan: EvaluationPlan): MarketInvestigation {
  const rows = marketRows();
  if (plan.perspectiveId === "cvc") {
    return cvcInvestigation(plan, rows);
  }
  if (plan.perspectiveId === "marketing") {
    return marketingInvestigation(plan, rows);
  }
  return contextOnlyInvestigation(plan, rows);
}

export function runConfirmedMarketInvestigation(plan: EvaluationPlan, brief: AnalysisBrief): MarketInvestigation {
  if (brief.status !== "confirmed") throw new Error("Confirm the analysis brief before running the evaluation.");
  if (brief.planId !== plan.planId) throw new Error("The confirmed analysis brief does not belong to this plan.");
  const investigation = runMarketInvestigation(plan);
  return {
    ...investigation,
    formula: brief.considerations.flatMap((item) => item.weightPercent === null ? [] : [{
      id: item.id,
      label: item.label,
      weightPercent: item.weightPercent,
    }]),
  };
}

export function answerInvestigationFollowUp(lead: InvestigationLead, question: string) {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) return "";
  return `${lead.observation} ${lead.businessMeaning} Important boundary: ${lead.challenge} Best next check: ${lead.nextEvidence}`;
}
