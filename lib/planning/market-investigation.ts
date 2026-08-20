import { publicMarkets } from "../data/public-market-ui.ts";
import { currentClinics } from "../locations/map-data.ts";
import type { EvaluationPlan } from "./contracts.ts";
import type { AnalysisBrief } from "./analysis-brief.ts";
import { getApprovedWorkspaceSnapshotDataset } from "../perspectives/approved-workspace-snapshot.ts";
import type { WorkspaceSnapshotDataset, WorkspaceSnapshotDatasetId } from "../perspectives/workspace-snapshot.ts";
import { stateDogOwnership, stateDogOwnershipSource } from "../data/state-dog-ownership.ts";
import type { EvidenceReconciliationReport } from "./evidence-compatibility.ts";

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
  measureValue?: {
    label: string;
    rawValue: number;
    formattedValue: string;
    percentile: number;
    rangeMeaning: string;
  };
  supportingMeasures?: Array<{
    id: string;
    label: string;
    formattedValue: string;
    percentile: number;
    rangeMeaning: string;
    role: "cost" | "response" | "attributed_outcome" | "comparison" | "market_context";
  }>;
};

export type MarketInvestigation = {
  version: "1.0.0";
  planId: string;
  originalQuestion: string;
  perspectiveId: "cvc" | "marketing" | "pricing";
  geography: "CBSA" | "supplied_trade_area";
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
  portfolioPattern?: {
    headline: string;
    summary: string;
    implication: string;
    segments: Array<{
      label: string;
      eligibleMarkets: number;
      highCpcMarkets: number;
      dualPressureMarkets: number;
    }>;
  };
  mediaScope?: {
    included: string;
    excluded: string[];
    bundlingRule: string;
  };
  analystRevision?: {
    draftNumber: number;
    prompt: string;
    summary: string;
    effectOnRecommendation: string;
    recommendedFollowUp: string;
  };
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
  allowedUse: "market_context_only" | "internal_shadow_evaluation_only";
  scoringEligibility: "none";
  formula?: Array<{ id: string; label: string; weightPercent: number }>;
  evidenceStage: "signal" | "triangulated_finding";
  /** Present when multiple registered evidence observations were compatibility-checked. */
  reconciliation?: EvidenceReconciliationReport;
  nextPass: {
    status: "waiting_for_evidence" | "ready_to_run";
    question: string;
    evidenceNeeded: string[];
    completionRule: string;
  };
  investigationPath: Array<{
    id: string;
    label: string;
    purpose: string;
    contributionToAnswer: string;
    status: "completed" | "waiting_for_evidence" | "pending";
    sourceIds: string[];
    result: string;
  }>;
};

const CENSUS_REGION_BY_STATE: Record<string, "Northeast" | "Midwest" | "South" | "West"> = {
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast", VT: "Northeast", NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IN: "Midwest", IL: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest", IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", SD: "Midwest",
  DE: "South", DC: "South", FL: "South", GA: "South", MD: "South", NC: "South", SC: "South", VA: "South", WV: "South", AL: "South", KY: "South", MS: "South", TN: "South", AR: "South", LA: "South", OK: "South", TX: "South",
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West", UT: "West", WY: "West", CA: "West", OR: "West", WA: "West",
};

function broadRegionFor(stateCodes: string[]) {
  const regions = new Set(stateCodes.map((code) => CENSUS_REGION_BY_STATE[code]).filter(Boolean));
  return regions.size === 1 ? [...regions][0] : null;
}

type SnapshotInvestigationConfig = {
  measureName: string;
  highSignal: string;
  lowSignal: string;
  highMeaning: string;
  lowMeaning: string;
  challenge: string;
  nextEvidence: string;
  missing: string[];
  rejectedPatterns: string[];
  nextQuestion: string;
};

const SNAPSHOT_CONFIG: Partial<Record<NonNullable<EvaluationPlan["evidenceSelection"]["datasetId"]>, SnapshotInvestigationConfig>> = {
  marketing_paid_search_cpc: {
    measureName: "Paid search average cost per click",
    highSignal: "ad clicks cost more than in most measured regions",
    lowSignal: "ad clicks cost less than in most measured regions",
    highMeaning: "This is a cost-pressure lead for comparable-campaign review; it is not proof that Chewy is overpaying.",
    lowMeaning: "Lower CPC may reflect a different auction, campaign, query, device, or audience mix rather than superior efficiency.",
    challenge: "CPC alone does not measure conversion quality, incrementality, acquisition cost, sales, or contribution.",
    nextEvidence: "Compare campaign/search-term/device mix, auction and impression-share context, conversion definitions, orders, new customers, net sales, and contribution for a compatible cohort.",
    missing: ["Comparable campaign and auction cohorts", "Governed conversions and attributed outcomes", "Incrementality and contribution evidence"],
    rejectedPatterns: ["Calling high CPC overpayment", "Treating low CPC as acquisition efficiency", "Combining CPC with Census context into an opportunity score"],
    nextQuestion: "Did the higher click cost produce enough additional conversions, sales, new customers, or contribution to justify it?",
  },
  marketing_paid_search_ctr: {
    measureName: "Paid search click-through rate",
    highSignal: "more delivered ads turned into clicks than in most measured regions",
    lowSignal: "fewer delivered ads turned into clicks than in most measured regions",
    highMeaning: "This response-rate contrast can prioritize campaign diagnostics, but does not establish business value.",
    lowMeaning: "Lower CTR can flag a campaign, audience, placement, or query-mix review.",
    challenge: "CTR is conditioned on impressions and campaign delivery and does not measure conversion quality or incrementality.",
    nextEvidence: "Compare campaign, audience, creative, placement, query, device, conversion, and outcome mix for the same period.",
    missing: ["Comparable campaign taxonomy", "Governed conversion semantics", "Orders, new customers, sales, and contribution"],
    rejectedPatterns: ["Treating CTR as demand", "Treating CTR as causal lift", "Creating a cross-domain opportunity score"],
    nextQuestion: "Did the response-rate difference carry through to qualified conversions, sales, and incremental contribution?",
  },
  marketing_paid_search_impressions: {
    measureName: "Paid search impressions",
    highSignal: "paid search delivered more often than in most measured regions",
    lowSignal: "paid search delivered less often than in most measured regions",
    highMeaning: "Higher delivery identifies where the selected account was more exposed, not where demand or opportunity is higher.",
    lowMeaning: "Lower delivery can prioritize checks for budget, targeting, auction availability, or campaign scope.",
    challenge: "Impressions are not unique reach, addressable demand, awareness, or incremental exposure.",
    nextEvidence: "Add campaign scope, eligible impression share, budget limits, audience size, frequency, and downstream outcomes.",
    missing: ["Configured campaign scope", "Auction and eligible-impression context", "Reach, conversion, and outcome evidence"],
    rejectedPatterns: ["Relabeling impressions as reach", "Relabeling delivery as demand", "Recommending budget from volume alone"],
    nextQuestion: "Was delivery aligned with eligible demand, and did it produce incremental customers, sales, or contribution?",
  },
  marketing_paid_search_response: {
    measureName: "Paid search clicks",
    highSignal: "paid search generated more click volume than in most measured regions",
    lowSignal: "paid search generated less click volume than in most measured regions",
    highMeaning: "Higher matched-postal click volume is a response-volume lead, not a measure of total market demand.",
    lowMeaning: "Lower response volume can reflect delivery, campaign coverage, audience, or auction differences.",
    challenge: "Clicks are not unique customers, conversions, incrementality, sales, or contribution.",
    nextEvidence: "Add comparable delivery, campaign mix, governed conversions, customers, orders, sales, and contribution.",
    missing: ["Comparable campaign taxonomy", "Governed conversions", "Customer and commercial outcomes"],
    rejectedPatterns: ["Relabeling clicks as demand", "Treating volume as efficiency", "Recommending spend from clicks alone"],
    nextQuestion: "Did the additional click volume become qualified conversions, new customers, sales, or contribution?",
  },
  pricing_competitor_availability: {
    measureName: "Observed competitor availability",
    highSignal: "monitored competitors were available more often than in most measured regions",
    lowSignal: "monitored competitors were available less often than in most measured regions",
    highMeaning: "Higher monitored availability indicates a stronger observed competitive condition for validation.",
    lowMeaning: "Lower observed availability may reflect true availability or monitoring and assortment coverage gaps.",
    challenge: "Observed availability does not establish customer demand, Chewy price position, economics, or an authorized price action.",
    nextEvidence: "Join matched-SKU Chewy price, MAP and rules, observation freshness, sales, units, PSE cost, margin, elasticity, and prior actions.",
    missing: ["Matched Chewy and competitor SKU price", "Regional customer outcomes and economics", "MAP, elasticity, and action history"],
    rejectedPatterns: ["Treating availability as market share", "Treating low coverage as whitespace", "Authorizing a price change"],
    nextQuestion: "Did this competitive condition affect Chewy price position, units, sales, margin, or customer response?",
  },
  pricing_observed_equalized_price: {
    measureName: "Observed equalized competitor offer price",
    highSignal: "observed competitor offer prices were higher than in most measured regions",
    lowSignal: "observed competitor offer prices were lower than in most measured regions",
    highMeaning: "A higher observed offer level can prioritize matched-basket validation; it is not a Chewy price gap.",
    lowMeaning: "A lower observed offer level can prioritize competitive-pressure validation.",
    challenge: "The offer-row-weighted value mixes monitored products and categories and is not a matched-basket index or price recommendation.",
    nextEvidence: "Match products and units, compare Chewy price and promotion, then add MAP, sales, units, PSE cost, margin, elasticity, and observation stability.",
    missing: ["Matched product and unit-of-measure cohort", "Chewy price and promotion state", "Economics, elasticity, and customer outcomes"],
    rejectedPatterns: ["Calling the value a price gap", "Comparing unmatched baskets", "Recommending a regional price"],
    nextQuestion: "After matching products and units, did the regional price position affect Chewy units, sales, margin, or contribution?",
  },
  pricing_offer_observation_volume: {
    measureName: "Monitored competitor offer rows",
    highSignal: "competitor monitoring was deeper than in most measured regions",
    lowSignal: "competitor monitoring was thinner than in most measured regions",
    highMeaning: "Higher volume indicates deeper monitoring coverage, not stronger competition or demand.",
    lowMeaning: "Lower volume identifies evidence-coverage risk before a regional comparison.",
    challenge: "Observation count is not assortment quality, market share, price response, or business value.",
    nextEvidence: "Audit representative ZIPs, retailer/category coverage, freshness, match confidence, and repeated observations by SKU.",
    missing: ["Representative ZIP sampling", "Coverage and freshness thresholds", "SKU-match confidence"],
    rejectedPatterns: ["Treating observations as demand", "Treating volume as competitive intensity", "Scoring opportunity"],
    nextQuestion: "Is coverage representative and stable enough to support a matched competitive and commercial comparison?",
  },
  pricing_assortment_breadth: {
    measureName: "Observed competitor assortment breadth",
    highSignal: "the monitored competitor assortment was broader than in most measured regions",
    lowSignal: "the monitored competitor assortment was narrower than in most measured regions",
    highMeaning: "Higher observed breadth identifies a richer monitored assortment for comparison.",
    lowMeaning: "Lower observed breadth may be a monitoring gap or a true assortment contrast.",
    challenge: "Distinct-SKU observations may repeat across ZIPs and do not represent complete local assortment or customer choice.",
    nextEvidence: "Validate matched SKU coverage by retailer/category/ZIP, freshness, availability, Chewy assortment, sales, and customer demand.",
    missing: ["Matched SKU and retailer coverage", "Complete-assortment denominator", "Chewy sales and customer outcomes"],
    rejectedPatterns: ["Calling observed breadth complete assortment", "Inferring customer choice", "Creating an opportunity score"],
    nextQuestion: "Does the matched assortment difference correspond to Chewy availability, sales, substitution, margin, or customer behavior?",
  },
};

const CROSS_SYNTHESIS_DATASETS: Record<"pricing" | "marketing", WorkspaceSnapshotDatasetId[]> = {
  pricing: [
    "pricing_competitor_availability",
    "pricing_observed_equalized_price",
    "pricing_offer_observation_volume",
    "pricing_assortment_breadth",
  ],
  marketing: [
    "marketing_paid_search_cost",
    "marketing_paid_search_impressions",
    "marketing_paid_search_response",
    "marketing_paid_search_ctr",
    "marketing_paid_search_cpc",
    "marketing_paid_search_conversions",
    "marketing_paid_search_conversion_rate",
    "marketing_paid_search_cost_per_conversion",
  ],
};

function crossMeasureRole(datasetId: WorkspaceSnapshotDatasetId): NonNullable<InvestigationLead["supportingMeasures"]>[number]["role"] {
  if (/conversion/.test(datasetId)) return "attributed_outcome";
  if (/cost|cpc/.test(datasetId)) return "cost";
  if (/impressions|response|ctr/.test(datasetId)) return "response";
  return "comparison";
}

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
  stateCodes: string[];
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

function formatSnapshotValue(dataset: WorkspaceSnapshotDataset, value: number) {
  if (dataset.valueFormat === "currency") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  }
  if (dataset.valueFormat === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function percentileFor(value: number, orderedValues: number[]) {
  return Math.max(1, Math.round((orderedValues.filter((item) => item <= value).length / orderedValues.length) * 100));
}

function percentileMeaning(percentile: number) {
  if (percentile >= 81) return "Higher range (81st–100th percentile)";
  if (percentile >= 61) return "Above typical (61st–80th percentile)";
  if (percentile >= 41) return "Typical range (41st–60th percentile)";
  if (percentile >= 21) return "Below typical (21st–40th percentile)";
  return "Lower range (1st–20th percentile)";
}

function readableSnapshotPeriod(snapshotId: string) {
  const googleAds = /^google-ads-(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(snapshotId);
  const format = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  if (googleAds) return `${format(googleAds[1])} to ${format(googleAds[2])}`;
  const dated = /(\d{4}-\d{2}-\d{2})$/.exec(snapshotId);
  return dated ? `the snapshot dated ${format(dated[1])}` : "the connected snapshot period";
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
      stateCodes: market.state_codes,
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
    evidenceStage: "signal",
    nextPass: {
      status: "waiting_for_evidence",
      question: "Does a compatible second evidence source support, contradict, or explain this initial signal?",
      evidenceNeeded: ["A compatible business outcome", "A matched cohort and period", "A documented validation rule"],
      completionRule: "Promote a signal to a finding only when compatible evidence from another stage supports or contradicts the same market-level interpretation.",
    },
    investigationPath: [
      {
        id: "screen_selected_measure",
        label: "Screen the selected measure",
        purpose: "Find regional contrasts that are relevant to the user's question.",
        contributionToAnswer: "Produces a bounded signal and identifies which regions deserve validation; it does not yet answer the decision question.",
        status: "completed",
        sourceIds: [],
        result: "The connected source was screened using its approved geography, cohort, period, and interpretation boundary.",
      },
      {
        id: "connect_business_outcomes",
        label: "Connect business outcomes",
        purpose: "Test whether the signal carried through to the outcome the user actually cares about.",
        contributionToAnswer: "Adds conversions, customers, sales, margin, or contribution so the answer can distinguish expensive activity from poor economics.",
        status: "waiting_for_evidence",
        sourceIds: [],
        result: "Waiting for a compatible outcome source at the same geography, cohort, and period.",
      },
      {
        id: "test_explanation",
        label: "Test the explanation",
        purpose: "Check whether mix, eligibility, competition, timing, or operational constraints explain the observed difference.",
        contributionToAnswer: "Separates a plausible driver from a coincidental regional contrast and records contrary evidence.",
        status: "pending",
        sourceIds: [],
        result: "Runs after compatible outcomes are connected.",
      },
      {
        id: "update_answer",
        label: "Update the answer",
        purpose: "Combine supporting and contradicting evidence under the Answer Contract.",
        contributionToAnswer: "Explains how each investigation changed the conclusion and promotes the signal to a finding only when the evidence rule is met.",
        status: "pending",
        sourceIds: [],
        result: "No finding is authorized until the prior evidence stages are complete.",
      },
    ],
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
      title: `${highest.market.name} may be lightly covered relative to its household size`,
      observation: `This metro has ${formatNumber(highest.market.households)} households and ${highest.market.clinicCount} published CVC clinic${highest.market.clinicCount === 1 ? "" : "s"}—about ${formatNumber(highest.householdsPerClinic)} households for each listed clinic. That ratio is ${(highest.householdsPerClinic / median).toFixed(1)} times the median among metros where CVC already has a published clinic.`,
      businessMeaning: "Compared with other metros in CVC's published footprint, this market has an unusually large household base for each listed clinic. That makes it a priority for demand and capacity validation—not proof that another clinic is needed.",
      method: "ACS households divided by published CVC clinic count within current-footprint metros",
      sampleSize: footprint.length,
      strength: `${(highest.householdsPerClinic / median).toFixed(1)}× footprint median`,
      challenge: "This is not clinic access, capacity, utilization, or patient demand.",
      nextEvidence: "Add clinic capacity and maturity, approved trade areas, appointment demand, customer penetration, and veterinary supply.",
    },
    ...closestPeers.map(({ base, peer, distance }, index): InvestigationLead => ({
      id: `cvc-peer-contrast-${index + 1}`,
      marketIds: [base.id, peer.id],
      title: `${peer.name} has no published CVC clinic despite resembling ${base.name}`,
      observation: `${base.name} has ${base.clinicCount} published CVC clinic${base.clinicCount === 1 ? "" : "s"}, while ${peer.name} has none in the checked-in footprint. Their public context is similar: households differ ${percentDifference(base.households, peer.households).toFixed(1)}%, income ${percentDifference(base.income, peer.income).toFixed(1)}%, and density ${percentDifference(base.density, peer.density).toFixed(1)}%.`,
      businessMeaning: `Because ${peer.name} resembles a metro where CVC already operates, its lack of a published clinic is worth investigating. Pet demand, clinic access, economics, and veterinary capacity still decide whether the contrast matters.`,
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
      summary: "The connected data can find structurally comparable metros, and the opening map can describe matched-postal paid-search clicks. This investigator does not yet combine those signals and cannot assign a valid test/control market or regional strategy.",
      missing: ["A governed paid-search investigation operator", "Pre-period customer and outcome baselines", "Campaign, cost, conversion, geographic-independence, and outcome-stability definitions"],
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
    limitations: ["Public market structure can prioritize validation but cannot establish marketing response, test validity, or causal lift.", "Population and households overlap as measures of market scale; alternate peer stability is not yet tested.", "The matched-postal click snapshot is connected to the map but is not yet consumed by this investigation executor; governed customer outcomes, campaign semantics, cost, and conversion definitions remain unavailable."],
    sourceIds: ["SRC-016"],
  };
}

function marketingEfficiencyInvestigation(plan: EvaluationPlan, rows: MarketRow[]): MarketInvestigation {
  const datasets = {
    cpc: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_cpc"),
    cost: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_cost"),
    clicks: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_response"),
    impressions: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_impressions"),
    ctr: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_ctr"),
    conversions: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_conversions"),
    conversionRate: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_conversion_rate"),
    costPerConversion: getApprovedWorkspaceSnapshotDataset("marketing_paid_search_cost_per_conversion"),
  };
  const maps = Object.fromEntries(Object.entries(datasets).map(([key, dataset]) => [
    key,
    new Map(dataset.values.map((item) => [item.cbsaCode, item.rawValue])),
  ])) as Record<keyof typeof datasets, Map<string, number>>;
  const distributions = Object.fromEntries(Object.entries(datasets).map(([key, dataset]) => [
    key,
    dataset.values.map((item) => item.rawValue).sort((left, right) => left - right),
  ])) as Record<keyof typeof datasets, number[]>;
  const requestedCodes = new Set(plan.geographyResolution.selectedCbsaCodes);
  const candidates = rows.flatMap((market) => {
    const cpc = maps.cpc.get(market.id);
    const cost = maps.cost.get(market.id);
    const clicks = maps.clicks.get(market.id);
    const impressions = maps.impressions.get(market.id);
    const ctr = maps.ctr.get(market.id);
    const conversions = maps.conversions.get(market.id);
    const conversionRate = maps.conversionRate.get(market.id);
    const costPerConversion = maps.costPerConversion.get(market.id);
    if ([cpc, cost, clicks, impressions, ctr, conversions, conversionRate, costPerConversion].some((value) => value === undefined)) return [];
    return [{
      market,
      cpc: cpc!,
      cost: cost!,
      clicks: clicks!,
      impressions: impressions!,
      ctr: ctr!,
      conversions: conversions!,
      conversionRate: conversionRate!,
      costPerConversion: costPerConversion!,
      cpcPercentile: percentileFor(cpc!, distributions.cpc),
      ctrPercentile: percentileFor(ctr!, distributions.ctr),
      conversionRatePercentile: percentileFor(conversionRate!, distributions.conversionRate),
      costPerConversionPercentile: percentileFor(costPerConversion!, distributions.costPerConversion),
    }];
  });
  const peerComparedCandidates = candidates.map((item) => {
    const peers = candidates
      .filter((candidate) => candidate.market.id !== item.market.id)
      .sort((left, right) =>
        contextDistance(item.market, left.market) - contextDistance(item.market, right.market)
        || left.market.name.localeCompare(right.market.name),
      )
      .slice(0, 20);
    return {
      ...item,
      peerCount: peers.length,
      peerCpcPercentile: percentileFor(item.cpc, peers.map((peer) => peer.cpc).sort((left, right) => left - right)),
      peerCtrPercentile: percentileFor(item.ctr, peers.map((peer) => peer.ctr).sort((left, right) => left - right)),
      peerConversionRatePercentile: percentileFor(item.conversionRate, peers.map((peer) => peer.conversionRate).sort((left, right) => left - right)),
      peerCostPerConversionPercentile: percentileFor(item.costPerConversion, peers.map((peer) => peer.costPerConversion).sort((left, right) => left - right)),
    };
  });
  const highCostCohort = peerComparedCandidates
    .filter((item) => requestedCodes.size ? requestedCodes.has(item.market.id) : item.peerCpcPercentile >= 80)
    .sort((left, right) =>
      right.peerCostPerConversionPercentile - left.peerCostPerConversionPercentile
      || left.peerConversionRatePercentile - right.peerConversionRatePercentile
      || right.peerCpcPercentile - left.peerCpcPercentile
      || left.market.name.localeCompare(right.market.name),
    );
  const selected = requestedCodes.size ? highCostCohort : highCostCohort.slice(0, 5);
  const segmentLabels = ["Northeast", "Midwest", "South", "West"] as const;
  const portfolioSegments = segmentLabels.map((label) => {
    const eligible = peerComparedCandidates.filter((item) => broadRegionFor(item.market.stateCodes) === label);
    const highCpc = eligible.filter((item) => item.peerCpcPercentile >= 80);
    return {
      label,
      eligibleMarkets: eligible.length,
      highCpcMarkets: highCpc.length,
      dualPressureMarkets: highCpc.filter((item) => item.peerCostPerConversionPercentile >= 80).length,
    };
  });
  const dominantSegment = [...portfolioSegments].sort((left, right) =>
    (right.dualPressureMarkets / Math.max(1, right.eligibleMarkets)) - (left.dualPressureMarkets / Math.max(1, left.eligibleMarkets))
    || right.dualPressureMarkets - left.dualPressureMarkets
    || left.label.localeCompare(right.label),
  )[0];
  const dualPressureTotal = highCostCohort.filter((item) => item.peerCostPerConversionPercentile >= 80).length;
  const strongerConversionTotal = highCostCohort.filter((item) => item.peerConversionRatePercentile >= 61).length;
  const contextPopulation = rows.map((item) => item.population).sort((left, right) => left - right);
  const contextHouseholds = rows.map((item) => item.households).sort((left, right) => left - right);
  const contextDensity = rows.map((item) => item.density).sort((left, right) => left - right);
  const contextIncome = rows.map((item) => item.income).sort((left, right) => left - right);
  const leads = selected.map((item): InvestigationLead => {
    const efficiencyPressure = item.peerCostPerConversionPercentile >= 80 || item.peerConversionRatePercentile <= 20;
    const offsetsClickCost = item.peerCostPerConversionPercentile <= 50 && item.peerConversionRatePercentile >= 50;
    const title = efficiencyPressure
      ? `${item.market.name} has higher paid-search cost with weaker attributed conversion efficiency than comparable markets`
      : offsetsClickCost
        ? `${item.market.name}'s higher click cost is partly offset by stronger attributed conversion efficiency than comparable markets`
        : `${item.market.name} has mixed paid-search efficiency compared with similar markets`;
    const householdPercentile = percentileFor(item.market.households, contextHouseholds);
    const densityPercentile = percentileFor(item.market.density, contextDensity);
    const incomePercentile = percentileFor(item.market.income, contextIncome);
    const populationPercentile = percentileFor(item.market.population, contextPopulation);
    const singleStateOwnership = item.market.stateCodes.length === 1
      ? stateDogOwnership.find((state) => state.code === item.market.stateCodes[0] && state.householdRate !== null)
      : undefined;
    const conversionRateReading = item.peerConversionRatePercentile <= 40
      ? "weaker attributed conversion response"
      : item.peerConversionRatePercentile >= 61
        ? "stronger attributed conversion response"
        : "typical attributed conversion response";
    const recommendation = efficiencyPressure
      ? `Prioritize ${item.market.name} for a paid-search efficiency review. Before changing spend, determine whether targeting and auction mix explain the elevated acquisition cost and whether first-party outcomes justify the current investment.`
      : offsetsClickCost
        ? `Keep ${item.market.name}'s paid-search investment unchanged while validating whether its stronger attributed conversion efficiency and first-party outcomes justify the higher click cost.`
        : `Hold any spend change in ${item.market.name} until campaign mix and first-party outcomes explain the conflicting paid-search signals.`;
    return {
      id: `marketing-efficiency-${item.market.id}`,
      marketIds: [item.market.id],
      title,
      observation: `Compared with its ${item.peerCount} closest measured metros by population, households, income, and density, average CPC was ${formatSnapshotValue(datasets.cpc, item.cpc)} (P${item.peerCpcPercentile}), cost per attributed conversion was ${formatSnapshotValue(datasets.costPerConversion, item.costPerConversion)} (P${item.peerCostPerConversionPercentile}), and attributed conversion rate was ${formatSnapshotValue(datasets.conversionRate, item.conversionRate)} (P${item.peerConversionRatePercentile})—${conversionRateReading}.`,
      businessMeaning: recommendation,
      method: "Each market is compared with its 20 closest measured metros by population, households, median income, and density, then ordered transparently by peer-relative CPC, cost per attributed conversion, and attributed conversion rate; no blended score",
      sampleSize: candidates.length,
      strength: `${percentileMeaning(item.peerCpcPercentile)} peer-relative CPC · ${percentileMeaning(item.peerCostPerConversionPercentile)} peer-relative cost/attributed conversion`,
      challenge: "Platform-attributed conversions are not governed orders, new customers, incremental sales, or contribution. Campaign and conversion-action mix can explain the contrast.",
      nextEvidence: "Compare campaign, query, device, and conversion-action mix; then connect regional orders, new customers, sales, and contribution before changing spend.",
      measureValue: {
        label: datasets.cpc.valueLabel,
        rawValue: item.cpc,
        formattedValue: formatSnapshotValue(datasets.cpc, item.cpc),
        percentile: item.peerCpcPercentile,
        rangeMeaning: `Versus ${item.peerCount} structurally comparable metros · ${percentileMeaning(item.peerCpcPercentile)}`,
      },
      supportingMeasures: [
        { id: "cost", label: "Cost", formattedValue: formatSnapshotValue(datasets.cost, item.cost), percentile: percentileFor(item.cost, distributions.cost), rangeMeaning: percentileMeaning(percentileFor(item.cost, distributions.cost)), role: "cost" },
        { id: "ctr", label: "Click-through rate", formattedValue: formatSnapshotValue(datasets.ctr, item.ctr), percentile: item.peerCtrPercentile, rangeMeaning: `Peer-relative · ${percentileMeaning(item.peerCtrPercentile)}`, role: "response" },
        { id: "conversion_rate", label: "Attributed conversion rate", formattedValue: formatSnapshotValue(datasets.conversionRate, item.conversionRate), percentile: item.peerConversionRatePercentile, rangeMeaning: `Peer-relative · ${percentileMeaning(item.peerConversionRatePercentile)}`, role: "attributed_outcome" },
        { id: "cost_per_conversion", label: "Cost / attributed conversion", formattedValue: formatSnapshotValue(datasets.costPerConversion, item.costPerConversion), percentile: item.peerCostPerConversionPercentile, rangeMeaning: `Peer-relative · ${percentileMeaning(item.peerCostPerConversionPercentile)}`, role: "attributed_outcome" },
        { id: "population", label: "Population", formattedValue: formatNumber(item.market.population), percentile: populationPercentile, rangeMeaning: percentileMeaning(populationPercentile), role: "market_context" },
        { id: "households", label: "Households", formattedValue: formatNumber(item.market.households), percentile: householdPercentile, rangeMeaning: percentileMeaning(householdPercentile), role: "market_context" },
        { id: "density", label: "Population density", formattedValue: item.market.density.toLocaleString("en-US", { maximumFractionDigits: 1 }), percentile: densityPercentile, rangeMeaning: percentileMeaning(densityPercentile), role: "market_context" },
        { id: "income", label: "Median household income", formattedValue: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.market.income), percentile: incomePercentile, rangeMeaning: percentileMeaning(incomePercentile), role: "market_context" },
        ...(singleStateOwnership ? [{ id: "state_dog_ownership", label: "State dog-owning households (2016 survey)", formattedValue: `${singleStateOwnership.householdRate!.toFixed(1)}%`, percentile: singleStateOwnership.relativePercentile!, rangeMeaning: `State-level context · P${singleStateOwnership.relativePercentile} among reported states`, role: "market_context" as const }] : []),
      ],
    };
  });
  const comparisons = candidates.length * (candidates.length - 1) / 2;
  const base = baseInvestigation(plan, "marketing");
  return {
    ...base,
    period: datasets.cpc.snapshotId,
    dataSnapshotLabel: "Joined paid-search cost, response, attributed conversion, CBSA context, and eligible coarse state pet context",
    dataSnapshotVersion: `${datasets.cpc.snapshotId}+${datasets.cpc.transformationVersion}+SRC-016-acs-2024+${stateDogOwnershipSource.sourceId}`,
    readiness: {
      label: "Partial answer",
      summary: "The investigation now joins paid-search cost, delivery, response, attributed conversions, and same-grain market context. It can identify efficiency-pressure leads, but regional orders, new customers, sales, contribution, campaign mix, and incrementality are still required before calling a region overpaid.",
      missing: ["Compatible campaign, query, and device cohorts", "Privacy-safe regional orders, new customers, net sales, and contribution", "Approved conversion semantics and incrementality evidence", "Approved regional pet-household or customer-demand denominator"],
    },
    toolsRun: ["Resolve the decision definition", "Join eight paid-search funnel measures at CBSA grain", "Calculate within-snapshot percentiles", "Add same-grain public market context", "Add eligible state pet-ownership context without allocating it to metros", "Apply transparent efficiency-pressure rules", "Challenge the conclusion boundary"],
    measuresExamined: ["Cost", "Average CPC", "Impressions", "Clicks", "Click-through rate", "Attributed conversions", "Attributed conversion rate", "Cost per attributed conversion", "Population", "Households", "Median household income", "Population density", "State dog-owning household rate where geographically unambiguous"],
    comparisonsExamined: comparisons,
    portfolioPattern: {
      headline: `${dominantSegment.label} markets show the broadest concentration of dual cost pressure`,
      summary: `Across ${candidates.length} measured metros, ${highCostCohort.length} had high click costs. ${dualPressureTotal} of those also had high cost per attributed conversion, while ${strongerConversionTotal} showed above-typical attributed conversion rates that may offset the higher click cost.`,
      implication: "This is a geographic pattern from one 30-day snapshot—not a time trend. Use it to prioritize regional review, then confirm persistence with period-over-period campaign and commercial outcomes.",
      segments: portfolioSegments,
    },
    mediaScope: {
      included: "Google Ads paid search · retail account · matched-postal aggregates · 30-day snapshot",
      excluded: ["YouTube / video", "Paid social", "Display / programmatic", "Affiliate", "Email / CRM", "Retail media", "Offline media"],
      bundlingRule: "No cross-channel bundling. Campaigns inside the connected Google Ads retail snapshot are aggregated; other media channels are not represented.",
    },
    screeningScope: {
      marketUniverse: rows.length,
      eligibleCohort: `${candidates.length} CBSAs with complete paid-search funnel and public-context measures for the joined period`,
      eligibleComparisons: comparisons,
      allMarketPairs: rows.length * (rows.length - 1) / 2,
      selectionRule: requestedCodes.size
        ? "Return the requested geography with every compatible joined measure."
        : "For every market, find its 20 closest measured metros by population, households, median income, and density. Retain high peer-relative CPC markets, then order transparently by higher peer-relative cost per attributed conversion, lower attributed conversion rate, and higher CPC; no blended score.",
      executionMode: "deterministic_local_snapshot",
    },
    leads,
    rejectedPatterns: ["Calling high CPC overpayment", "Treating population or households as pet demand", "Treating configured platform conversions as incremental customers", "Blending demographics and media metrics into an opaque opportunity score"],
    limitations: ["Google Ads conversions use configured platform semantics and can include multiple conversion actions.", "The postal-to-CBSA assignment uses a documented centroid approximation.", "Population, households, income, and density are market context—not addressable pet demand or causal controls.", stateDogOwnershipSource.limitation, "No privacy-safe regional orders, new customers, net sales, contribution, or incrementality output is checked into this worktree."],
    sourceIds: ["SRC-018", "SRC-016", stateDogOwnershipSource.sourceId],
    allowedUse: "internal_shadow_evaluation_only",
    scoringEligibility: "none",
    evidenceStage: "signal",
    nextPass: {
      status: "waiting_for_evidence",
      question: "After matching campaign and conversion semantics, did the region generate enough governed orders, new customers, net sales, and contribution to justify its advertising cost?",
      evidenceNeeded: ["Campaign/query/device cohort", "Regional governed orders and new customers", "Regional net sales and contribution", "Incrementality or approved attribution rule", "Regional pet-household or customer-demand denominator"],
      completionRule: "Call a region overpaid only when compatible commercial outcomes show materially worse economics than an approved peer or target and the conclusion survives campaign-mix and incrementality checks.",
    },
    investigationPath: [
      { id: "screen_cost_pressure", label: "Screen cost pressure", purpose: "Locate unusually high click costs and total spend.", contributionToAnswer: "Identifies where cost pressure exists without calling it inefficiency.", status: "completed", sourceIds: ["SRC-018"], result: `Joined CPC and cost across ${candidates.length} compatible CBSAs.` },
      { id: "test_delivery_response", label: "Test delivery and response", purpose: "Check whether impressions, clicks, and CTR explain the cost pattern.", contributionToAnswer: "Separates high cost caused by scale from weak response efficiency.", status: "completed", sourceIds: ["SRC-018"], result: "Recomputed click-through rate from matched impressions and clicks at CBSA grain." },
      { id: "test_attributed_conversion", label: "Test attributed conversion efficiency", purpose: "Compare conversion rate and cost per configured platform conversion.", contributionToAnswer: "Shows whether higher click cost carried through to stronger or weaker attributed conversion efficiency.", status: "completed", sourceIds: ["SRC-018"], result: "Recomputed attributed conversion rate and cost per conversion from joined platform aggregates." },
      { id: "add_market_opportunity", label: "Add market opportunity context", purpose: "Describe market scale, household base, income, density, and any geographically valid coarse pet context.", contributionToAnswer: "Improves peer and denominator context without relabeling households or state survey rates as metro pet demand.", status: "completed", sourceIds: ["SRC-016", stateDogOwnershipSource.sourceId], result: "Added CBSA population, household, income, and density percentiles; added the dated state dog-ownership rate only for single-state metros and did not use it for ranking." },
      { id: "test_campaign_mix", label: "Test campaign and auction mix", purpose: "Check campaign, query, device, audience, conversion-action, and auction differences.", contributionToAnswer: "Determines whether setup and mix explain the apparent regional inefficiency.", status: "waiting_for_evidence", sourceIds: [], result: "The local campaign export is DMA-grain and cannot be joined safely to the CBSA result without an approved crosswalk or CBSA campaign aggregate." },
      { id: "connect_commercial_outcomes", label: "Connect commercial outcomes", purpose: "Test governed orders, new customers, net sales, contribution, and incrementality.", contributionToAnswer: "Determines whether the advertising cost produced enough business value to justify it.", status: "waiting_for_evidence", sourceIds: [], result: "The available Snowflake campaign file is national channel-month grain, not privacy-safe regional outcome grain." },
    ],
  };
}

function workspaceSnapshotInvestigation(plan: EvaluationPlan, rows: MarketRow[]): MarketInvestigation {
  const datasetId = plan.evidenceSelection.datasetId;
  if (!datasetId) return contextOnlyInvestigation(plan, rows);
  const dataset = getApprovedWorkspaceSnapshotDataset(datasetId);
  const config = SNAPSHOT_CONFIG[datasetId];
  if (!config) return contextOnlyInvestigation(plan, rows);
  const crossDatasetIds = CROSS_SYNTHESIS_DATASETS[plan.perspectiveId === "pricing" ? "pricing" : "marketing"];
  const crossDatasets = crossDatasetIds.map((id) => getApprovedWorkspaceSnapshotDataset(id));
  const crossValueMaps = new Map(crossDatasets.map((item) => [
    item.datasetId,
    new Map(item.values.map((value) => [value.cbsaCode, value.rawValue])),
  ]));
  const crossDistributions = new Map(crossDatasets.map((item) => [
    item.datasetId,
    item.values.map((value) => value.rawValue).sort((left, right) => left - right),
  ]));
  const marketById = new Map(rows.map((row) => [row.id, row]));
  const requestedCodes = new Set(plan.geographyResolution.selectedCbsaCodes);
  const eligibleValues = dataset.values
    .filter((item) => marketById.has(item.cbsaCode))
    .filter((item) => requestedCodes.size === 0 || requestedCodes.has(item.cbsaCode));
  const distribution = dataset.values.map((item) => item.rawValue).sort((left, right) => left - right);
  const ranked = [...eligibleValues].sort((left, right) => right.rawValue - left.rawValue);
  const selected = requestedCodes.size
    ? ranked
    : [...ranked.slice(0, 3), ...ranked.slice(-2).reverse()];
  const contextDistributions = {
    population: rows.map((row) => row.population).sort((left, right) => left - right),
    households: rows.map((row) => row.households).sort((left, right) => left - right),
    income: rows.map((row) => row.income).sort((left, right) => left - right),
    density: rows.map((row) => row.density).sort((left, right) => left - right),
  };
  const leads = selected.map((item): InvestigationLead => {
    const market = marketById.get(item.cbsaCode)!;
    const percentile = percentileFor(item.rawValue, distribution);
    const high = percentile >= 50;
    const rangeMeaning = percentileMeaning(percentile);
    const formattedValue = formatSnapshotValue(dataset, item.rawValue);
    const upperTail = Math.max(1, 101 - percentile);
    const lowerTail = Math.max(1, percentile);
    const connectedMeasures = crossDatasets.flatMap((connectedDataset) => {
      const rawValue = crossValueMaps.get(connectedDataset.datasetId)?.get(item.cbsaCode);
      const connectedDistribution = crossDistributions.get(connectedDataset.datasetId);
      if (rawValue === undefined || !connectedDistribution) return [];
      const connectedPercentile = percentileFor(rawValue, connectedDistribution);
      return [{
        id: connectedDataset.datasetId,
        label: connectedDataset.label,
        formattedValue: formatSnapshotValue(connectedDataset, rawValue),
        percentile: connectedPercentile,
        rangeMeaning: percentileMeaning(connectedPercentile),
        role: crossMeasureRole(connectedDataset.datasetId),
      }];
    });
    const contextMeasures: NonNullable<InvestigationLead["supportingMeasures"]> = [
      { id: "population", label: "Population", formattedValue: formatNumber(market.population), percentile: percentileFor(market.population, contextDistributions.population), rangeMeaning: percentileMeaning(percentileFor(market.population, contextDistributions.population)), role: "market_context" },
      { id: "households", label: "Households", formattedValue: formatNumber(market.households), percentile: percentileFor(market.households, contextDistributions.households), rangeMeaning: percentileMeaning(percentileFor(market.households, contextDistributions.households)), role: "market_context" },
      { id: "income", label: "Median household income", formattedValue: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(market.income), percentile: percentileFor(market.income, contextDistributions.income), rangeMeaning: percentileMeaning(percentileFor(market.income, contextDistributions.income)), role: "market_context" },
      { id: "density", label: "Population density", formattedValue: market.density.toLocaleString("en-US", { maximumFractionDigits: 1 }), percentile: percentileFor(market.density, contextDistributions.density), rangeMeaning: percentileMeaning(percentileFor(market.density, contextDistributions.density)), role: "market_context" },
    ];
    const crossCheckSummary = connectedMeasures
      .filter((measure) => measure.id !== datasetId)
      .map((measure) => `${measure.label} ${measure.formattedValue} (P${measure.percentile})`)
      .join("; ");
    return {
      id: `${datasetId}-${item.cbsaCode}`,
      marketIds: [item.cbsaCode],
      title: `${market.name}: ${high ? config.highSignal : config.lowSignal}`,
      observation: `${config.measureName} was ${formattedValue}—among the ${high ? `highest ${upperTail}%` : `lowest ${lowerTail}%`} of ${distribution.length} measured regions from ${readableSnapshotPeriod(dataset.snapshotId)}.${crossCheckSummary ? ` Cross-check across the other connected ${plan.perspectiveId} measures: ${crossCheckSummary}.` : ""}`,
      businessMeaning: high ? config.highMeaning : config.lowMeaning,
      method: `${dataset.geographyMethod}; ${dataset.transformationVersion}`,
      sampleSize: distribution.length,
      strength: rangeMeaning,
      challenge: config.challenge,
      nextEvidence: config.nextEvidence,
      measureValue: {
        label: dataset.valueLabel,
        rawValue: item.rawValue,
        formattedValue,
        percentile,
        rangeMeaning,
      },
      supportingMeasures: [...connectedMeasures, ...contextMeasures],
    };
  });
  const comparisons = eligibleValues.length < 2
    ? 0
    : eligibleValues.length * (eligibleValues.length - 1) / 2;
  const perspective = plan.perspectiveId === "pricing" ? "Pricing" : "Marketing";
  const requestedMarketNames = plan.geographyResolution.selectedCbsaCodes
    .map((code) => marketById.get(code)?.name ?? code)
    .join(", ");
  const hasCompatibleEvidence = eligibleValues.length > 0;
  const connectedSourceIds = [...new Set([...crossDatasets.flatMap((item) => item.sourceIds), "SRC-016"])];
  const connectedMeasureLabels = crossDatasets.map((item) => item.label);

  return {
    ...baseInvestigation(plan, plan.perspectiveId),
    period: dataset.snapshotId,
    dataSnapshotLabel: `${dataset.label} · ${dataset.inputGrain}`,
    dataSnapshotVersion: `${dataset.snapshotId}+${dataset.transformationVersion}`,
    readiness: {
      label: hasCompatibleEvidence ? "Partial answer" : "Context only",
      summary: hasCompatibleEvidence
        ? `${perspective} screens the requested ${config.measureName.toLowerCase()} from the selected approved snapshot, cross-checks ${crossDatasets.length - 1} other connected ${plan.perspectiveId} measures, and adds same-grain market context. The result identifies multi-stage validation leads, not causal explanations or an authorized action.`
        : `The selected approved snapshot has no compatible ${config.measureName.toLowerCase()} row for ${requestedMarketNames || "the requested geography"}. No regional signal or comparison was calculated.`,
      missing: hasCompatibleEvidence
        ? config.missing
        : [`Snapshot coverage for ${requestedMarketNames || "the requested geography"}`, ...config.missing],
    },
    toolsRun: ["Retain the selected map view in the answer contract", "Screen the requested measure", "Cross-check every compatible same-perspective measure", "Add same-grain market context", "Challenge the combined interpretation"],
    measuresExamined: [config.measureName, ...connectedMeasureLabels.filter((label) => label !== dataset.label), "Population", "Households", "Median household income", "Population density"],
    comparisonsExamined: comparisons,
    screeningScope: {
      marketUniverse: rows.length,
      eligibleCohort: hasCompatibleEvidence
        ? `${eligibleValues.length} question-compatible CBSAs from ${distribution.length} mapped values`
        : `0 compatible rows for ${requestedMarketNames || "the requested geography"} from ${distribution.length} mapped values`,
      eligibleComparisons: comparisons,
      allMarketPairs: rows.length * (rows.length - 1) / 2,
      selectionRule: requestedCodes.size
        ? hasCompatibleEvidence
          ? "Return the selected question geography when it has a compatible snapshot value."
          : "Do not substitute a different market when the requested geography is absent from the snapshot."
        : "Show the three highest and two lowest values as analyst-review leads; keep the full distribution available on the map.",
      executionMode: "deterministic_local_snapshot",
    },
    leads,
    rejectedPatterns: config.rejectedPatterns,
    limitations: [...new Set([...crossDatasets.flatMap((item) => item.limitations), config.challenge, plan.evidenceSelection.evidenceBoundary])],
    sourceIds: connectedSourceIds,
    allowedUse: dataset.allowedUse,
    scoringEligibility: dataset.scoringEligibility,
    evidenceStage: "signal",
    nextPass: {
      status: "waiting_for_evidence",
      question: config.nextQuestion,
      evidenceNeeded: config.missing,
      completionRule: "This remains a signal until a compatible outcome dataset for the same geography, cohort, and period supports or contradicts it. Then rerun the investigation and update the answer contract coverage.",
    },
    investigationPath: [
      {
        id: "screen_selected_measure",
        label: "Screen the requested measure",
        purpose: `Find regional contrasts in ${config.measureName.toLowerCase()} that match the question.`,
        contributionToAnswer: "Identifies the initial regional signal without treating it as the conclusion.",
        status: hasCompatibleEvidence ? "completed" : "waiting_for_evidence",
        sourceIds: dataset.sourceIds,
        result: hasCompatibleEvidence
          ? `${config.measureName} was screened across ${eligibleValues.length} question-compatible regions from ${distribution.length} mapped values and produced ${leads.length} analyst-review signal${leads.length === 1 ? "" : "s"}.`
          : `${config.measureName} could not be screened for ${requestedMarketNames || "the requested geography"} because the selected snapshot has no compatible row.`,
      },
      {
        id: "cross_check_connected_measures",
        label: `Cross-check connected ${plan.perspectiveId} measures`,
        purpose: `Test whether the requested measure agrees with or is qualified by the other ${plan.perspectiveId} measures available at the same CBSA grain.`,
        contributionToAnswer: "Shows whether the initial signal is isolated, reinforced, or contradicted elsewhere in the connected evidence.",
        status: hasCompatibleEvidence ? "completed" : "pending",
        sourceIds: [...new Set(crossDatasets.flatMap((item) => item.sourceIds))],
        result: hasCompatibleEvidence ? `${crossDatasets.length} compatible ${plan.perspectiveId} measures were joined for each retained market.` : "Runs after the requested geography has a compatible anchor measure.",
      },
      {
        id: "add_market_context",
        label: "Add comparable-market context",
        purpose: "Add population, households, income, and density at the same CBSA grain.",
        contributionToAnswer: "Makes regional contrasts interpretable without blending demographics into an opaque score.",
        status: hasCompatibleEvidence ? "completed" : "pending",
        sourceIds: ["SRC-016"],
        result: hasCompatibleEvidence ? "Four public market-context measures were joined to every retained signal." : "Runs after a compatible regional signal exists.",
      },
      {
        id: "connect_business_outcomes",
        label: "Connect decision outcomes",
        purpose: config.nextQuestion,
        contributionToAnswer: config.nextEvidence,
        status: "waiting_for_evidence",
        sourceIds: [],
        result: "The connected cross-check improves the signal, but governed decision outcomes are still required for a recommendation-level conclusion.",
      },
      {
        id: "test_explanation",
        label: "Test alternative explanations",
        purpose: "Check whether mix, timing, coverage, eligibility, or operational constraints explain the regional contrast.",
        contributionToAnswer: "Records contrary evidence and prevents correlation from being presented as a driver.",
        status: "pending",
        sourceIds: [],
        result: "Runs after the compatible outcome and driver evidence is connected.",
      },
      {
        id: "update_answer",
        label: "Update the answer",
        purpose: "Synthesize supporting, contradicting, and missing evidence under the Answer Contract.",
        contributionToAnswer: "Promotes a signal only when the promised conclusion is actually supported.",
        status: "pending",
        sourceIds: [],
        result: "Waiting for the remaining evidence stages.",
      },
    ],
  };
}

function contextOnlyInvestigation(plan: EvaluationPlan, rows: MarketRow[]): MarketInvestigation {
  return {
    ...baseInvestigation(plan, plan.perspectiveId),
    readiness: {
      label: "Context only",
      summary: plan.perspectiveId === "pricing"
        ? "The opening map can describe monitored competitor availability, but this investigator does not yet consume that snapshot and cannot answer price response, economics, or elasticity questions."
        : "The connected public Census evidence can describe market context, but it cannot answer this question without a compatible business outcome or driver.",
      missing: plan.perspectiveId === "pricing"
        ? ["A governed competitor-availability investigation operator", "Compatible Chewy price and economics", "Customer outcomes, comparison baselines, and historical stability"]
        : ["A question-specific business measure at CBSA grain", "A compatible outcome or comparison baseline", "Historical evidence for stability"],
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

export function restrictInvestigationToRequestedGeography(
  plan: EvaluationPlan,
  investigation: MarketInvestigation,
): MarketInvestigation {
  const requestedCodes = new Set(plan.geographyResolution.selectedCbsaCodes);
  if (!requestedCodes.size) return investigation;
  const leads = investigation.leads.filter((lead) =>
    lead.marketIds.some((marketId) => requestedCodes.has(marketId)),
  );
  if (leads.length === investigation.leads.length) return investigation;
  const requestedMarketNames = plan.geographyResolution.selectedCbsaCodes
    .map((code) => publicMarkets.find((market) => market.cbsa_code === code)?.cbsa_name ?? code)
    .join(", ");
  return {
    ...investigation,
    readiness: leads.length
      ? investigation.readiness
      : {
          label: "Context only",
          summary: `No compatible investigation lead was returned for ${requestedMarketNames}. The workspace did not substitute a national or unrelated market result.`,
          missing: [...new Set([
            `Question-compatible evidence for ${requestedMarketNames}`,
            ...investigation.readiness.missing,
          ])],
        },
    screeningScope: {
      ...investigation.screeningScope,
      eligibleComparisons: leads.length,
      selectionRule: leads.length
        ? "Return only investigation leads that include at least one explicitly selected CBSA."
        : "Return an explicit evidence gap when the selected CBSA has no compatible lead; never substitute another market.",
    },
    leads,
  };
}

export function runMarketInvestigation(plan: EvaluationPlan): MarketInvestigation {
  const rows = marketRows();
  let investigation: MarketInvestigation;
  if (plan.evidenceSelection.datasetId === "marketing_paid_search_cpc") {
    investigation = marketingEfficiencyInvestigation(plan, rows);
  } else if (plan.evidenceSelection.datasetId) {
    investigation = workspaceSnapshotInvestigation(plan, rows);
  } else if (plan.perspectiveId === "cvc") {
    investigation = cvcInvestigation(plan, rows);
  } else if (plan.perspectiveId === "marketing") {
    investigation = marketingInvestigation(plan, rows);
  } else {
    investigation = contextOnlyInvestigation(plan, rows);
  }
  return restrictInvestigationToRequestedGeography(plan, investigation);
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

function revisionInterpretation(investigation: MarketInvestigation, prompt: string) {
  const normalized = prompt.toLowerCase();
  if (investigation.perspectiveId === "marketing" && /channel|youtube|video|meta|social|display|affiliate|email|crm|retail media|offline/.test(normalized)) {
    const channel = /youtube|video/.test(normalized) ? "YouTube" : "other advertising channels";
    const evidenceGap = channel === "YouTube"
      ? "No compatible YouTube evidence is connected yet"
      : `No compatible evidence for ${channel} is connected yet`;
    return {
      summary: `${channel} was added as a separate investigation factor.`,
      effectOnRecommendation: `The recommendation remains a Google Ads paid-search signal. ${evidenceGap}, so it cannot be generalized or used to reallocate cross-channel budget until comparable spend, exposure, and outcomes are joined.`,
      recommendedFollowUp: `Compare paid search with ${channel} using the same geography, period, audience-overlap, attribution, and first-party outcome definitions.`,
      evidenceRequest: `${channel} regional spend, reach or completed-view exposure, attributed outcomes, and audience overlap at a compatible geography and period`,
      recommendationUpdate: `Added factor — ${channel}: keep any budget move channel-specific until comparable ${channel} evidence is connected; the paid-search finding itself is unchanged.`,
    };
  }
  if (/trend|over time|week|month|season|period/.test(normalized)) {
    return {
      summary: "Persistence over time was added as a required check.",
      effectOnRecommendation: "The current 30-day pattern remains a prioritization signal, not a sustained trend, until the same measures are compared across compatible periods.",
      recommendedFollowUp: "Compare at least three compatible periods and separate seasonality, campaign changes, and durable regional differences.",
      evidenceRequest: "At least three compatible periods with campaign-change and seasonality annotations",
      recommendationUpdate: "Added factor — time: keep the recommendation provisional until the pattern persists across compatible periods.",
    };
  }
  if (/sale|order|customer|revenue|contribution|margin|profit|conversion/.test(normalized)) {
    return {
      summary: "Commercial outcomes were elevated in the recommendation.",
      effectOnRecommendation: "Do not reduce spend from platform cost alone; test whether governed orders, new customers, sales, contribution, and incrementality justify the apparent cost pressure.",
      recommendedFollowUp: "Join privacy-safe regional orders, new customers, net sales, and contribution using compatible attribution and time windows.",
      evidenceRequest: "Privacy-safe regional orders, new customers, net sales, contribution, and compatible attribution windows",
      recommendationUpdate: "Added factor — commercial outcomes: do not change spend until first-party business value confirms or overturns the platform-efficiency signal.",
    };
  }
  if (/pet|household|population|density|income|demand/.test(normalized)) {
    return {
      summary: "Market-demand context was added to the review.",
      effectOnRecommendation: "Use same-grain demand context to choose fair peers and interpret scale, but do not blend public demographics into an opaque advertising score.",
      recommendedFollowUp: "Test the signal within comparable market-size and demand cohorts, then validate with governed regional customer outcomes.",
      evidenceRequest: "A same-grain governed demand measure and compatible regional customer outcomes",
      recommendationUpdate: "Added factor — demand: use it to validate peer choice, not as a substitute for regional business outcomes.",
    };
  }
  return {
    summary: "The analyst's consideration was added as a validation requirement.",
    effectOnRecommendation: "The observed signal is unchanged until compatible evidence tests the added consideration; the recommendation now makes that dependency explicit.",
    recommendedFollowUp: `Test this analyst direction with compatible evidence: ${prompt}`,
    evidenceRequest: `Compatible evidence for the analyst-requested factor: ${prompt}`,
    recommendationUpdate: `Added factor — ${prompt}: keep the current recommendation provisional until compatible evidence tests this consideration.`,
  };
}

export function recommendedInvestigationRevision(investigation: MarketInvestigation) {
  if (investigation.perspectiveId === "marketing") {
    return /\b(?:increase|spend\s+more|expand|raise)\b/i.test(investigation.originalQuestion)
      ? "Consider whether regional orders, new customers, contribution, and incrementality support the same bounded spend-increase test."
      : "Consider whether paid-search cost pressure is offset by regional sales, new customers, and contribution.";
  }
  if (investigation.perspectiveId === "pricing") {
    return "Consider whether the observed price difference persists by category and customer segment.";
  }
  return "Consider whether demand, capacity, and clinic economics support the same regional conclusion.";
}

export function reviseMarketInvestigation(
  investigation: MarketInvestigation,
  prompt: string,
  draftNumber: number,
): MarketInvestigation {
  const normalizedPrompt = prompt.trim().replace(/\s+/g, " ");
  if (!normalizedPrompt) return investigation;
  const interpretation = revisionInterpretation(investigation, normalizedPrompt);
  const revisionCheck = `Analyst-requested check: ${normalizedPrompt.replace(/[.!?]+$/, "")}`;
  return {
    ...investigation,
    analystRevision: {
      draftNumber,
      prompt: normalizedPrompt,
      ...interpretation,
    },
    leads: investigation.leads.map((lead) => ({
      ...lead,
      businessMeaning: `${lead.businessMeaning} ${interpretation.recommendationUpdate}`,
      nextEvidence: `${lead.nextEvidence} ${revisionCheck}.`,
    })),
    readiness: {
      ...investigation.readiness,
      missing: [...new Set([...investigation.readiness.missing, interpretation.evidenceRequest])],
    },
    mediaScope: investigation.mediaScope && /youtube|video/i.test(normalizedPrompt)
      ? { ...investigation.mediaScope, excluded: [...new Set(["YouTube / video", ...investigation.mediaScope.excluded])] }
      : investigation.mediaScope,
    nextPass: {
      ...investigation.nextPass,
      status: "waiting_for_evidence",
      question: interpretation.recommendedFollowUp,
      evidenceNeeded: [...new Set([...investigation.nextPass.evidenceNeeded, interpretation.evidenceRequest])],
    },
    limitations: [...new Set([...investigation.limitations, interpretation.effectOnRecommendation])],
    investigationPath: [
      ...investigation.investigationPath.filter((step) => !step.id.startsWith("analyst_revision_")),
      {
        id: `analyst_revision_${draftNumber}`,
        label: "Investigate the added factor",
        purpose: `Test the result using this human direction: ${normalizedPrompt}`,
        contributionToAnswer: interpretation.effectOnRecommendation,
        status: "waiting_for_evidence",
        sourceIds: [],
        result: `${interpretation.summary} A new evidence request was generated; no unsupported metric or conclusion was invented.`,
      },
    ],
  };
}
