import type { AutonomousInsight } from "./current-data-discovery.ts";

export const FINDING_DECISION_CASE_VERSION = "finding-decision-case-v1" as const;

export type FindingDecisionCase = {
  version: typeof FINDING_DECISION_CASE_VERSION;
  status: "quantified_proxy_scenario" | "observed_outcome_scenario" | "inputs_required" | "data_issue";
  observedFact: string;
  comparison: string;
  proposedAction: string;
  scenario: { label: string; summary: string; range: string | null; basis: string; isIncrementalForecast: false };
  calculation: string[];
  whyValidationMatters: string[];
  successRule: string;
  stopRule: string;
  couldReverseRecommendation: string[];
};

function number(value: string) { return Number(value.replaceAll(",", "")); }
function money(value: number) { return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }
function oneDecimal(value: number) { return value.toLocaleString("en-US", { maximumFractionDigits: 1 }); }

function marketingCase(finding: AutonomousInsight): FindingDecisionCase {
  const observed = finding.valueTranslation.statement.match(/\$1,000 corresponds to about ([\d,]+) attributed conversions[—-]([\d.]+)×/i);
  const conversionsPerThousand = observed ? number(observed[1]!) : null;
  const relativeEfficiency = observed ? number(observed[2]!) : null;
  const testSpend = 10_000;
  const mechanicalConversions = conversionsPerThousand === null ? null : conversionsPerThousand * (testSpend / 1_000);
  return {
    version: FINDING_DECISION_CASE_VERSION,
    status: mechanicalConversions === null ? "inputs_required" : "quantified_proxy_scenario",
    observedFact: finding.valueTranslation.statement,
    comparison: relativeEfficiency === null ? finding.whyInteresting : `The observed platform-attributed conversion count per dollar was ${oneDecimal(relativeEfficiency)}× the snapshot-median implication.`,
    proposedAction: `Design a capped ${money(testSpend)} geo test in ${finding.marketName}; change one controllable element such as query, audience, creative, or channel mix while holding the comparison design stable.`,
    scenario: mechanicalConversions === null ? {
      label: "Value inputs required",
      summary: "Connect regional spend, new-customer, contribution, and matched-control outcomes before estimating an incremental return.",
      range: null,
      basis: "The current evidence describes delivery or attributed response but does not contain a reusable conversion-per-dollar scenario.",
      isIncrementalForecast: false,
    } : {
      label: "Observed-rate planning scenario",
      summary: `${money(testSpend)} corresponds to about ${Math.round(mechanicalConversions).toLocaleString("en-US")} platform-attributed conversions if the historical average persists.`,
      range: `${Math.round(mechanicalConversions * 0.8).toLocaleString("en-US")}–${Math.round(mechanicalConversions * 1.2).toLocaleString("en-US")} attributed conversions using a ±20% planning band.`,
      basis: "Mechanical scaling of the observed average; the range is a planning sensitivity, not a statistical confidence interval.",
      isIncrementalForecast: false,
    },
    calculation: conversionsPerThousand === null ? ["Incremental contribution = incremental new customers × contribution per new customer − incremental media cost."] : [`${conversionsPerThousand.toLocaleString("en-US")} attributed conversions per $1,000 × ${testSpend / 1_000} = ${Math.round(mechanicalConversions!).toLocaleString("en-US")} attributed conversions.`],
    whyValidationMatters: ["Platform attribution can include customers who would have converted without the added spend.", "New-customer and contribution outcomes determine whether attributed response creates business value."],
    successRule: "Proceed beyond the test only if matched-control incremental new customers and contribution clear the team’s pre-registered hurdle after media cost.",
    stopRule: "Stop or roll back if incremental contribution is non-positive, conversion quality deteriorates, or the matched control shows no credible lift.",
    couldReverseRecommendation: ["A materially lower marginal conversion rate than the historical average.", "No incremental new-customer lift versus control.", "Contribution per acquired customer below media and operating cost."],
  };
}

function cvcCase(finding: AutonomousInsight): FindingDecisionCase {
  const observed = finding.valueTranslation.statement.match(/([\d.]+) completed appointments and \$([\d,]+) net sales per \$1,000[^;]*; ([\d.]+)% of completed appointments were new to Chewy/i);
  const appointmentsPerThousand = observed ? number(observed[1]!) : null;
  const salesPerThousand = observed ? number(observed[2]!) : null;
  const newToChewyShare = observed ? number(observed[3]!) / 100 : null;
  const testSpend = 10_000;
  const appointments = appointmentsPerThousand === null ? null : appointmentsPerThousand * (testSpend / 1_000);
  const sales = salesPerThousand === null ? null : salesPerThousand * (testSpend / 1_000);
  return {
    version: FINDING_DECISION_CASE_VERSION,
    status: appointments === null || sales === null ? "inputs_required" : "observed_outcome_scenario",
    observedFact: finding.valueTranslation.statement,
    comparison: finding.whyInteresting,
    proposedAction: `Build a four-week ${finding.marketName} decision case using current appointment demand and staffed capacity; if capacity is available, test a capped ${money(testSpend)} media or scheduling intervention before changing footprint.`,
    scenario: appointments === null || sales === null ? {
      label: "Outcome export required",
      summary: finding.businessValue.headline,
      range: null,
      basis: "The market signal is available, but compatible appointment, sales, and capacity values are not attached at this geography.",
      isIncrementalForecast: false,
    } : {
      label: "Historical-rate planning scenario",
      summary: `${money(testSpend)} corresponds to about ${oneDecimal(appointments)} completed appointments and ${money(sales)} net sales if the historical observed rate persists${newToChewyShare === null ? "." : `; approximately ${oneDecimal(appointments * newToChewyShare)} appointments would be new-to-Chewy at the observed mix.`}`,
      range: `${oneDecimal(appointments * 0.8)}–${oneDecimal(appointments * 1.2)} completed appointments and ${money(sales * 0.8)}–${money(sales * 1.2)} net sales using a ±20% planning band.`,
      basis: "Mechanical scaling of historical tracked-spend ratios; capacity, marginal response, contribution, and causality are not assumed.",
      isIncrementalForecast: false,
    },
    calculation: appointments === null || sales === null ? ["Incremental clinic contribution = incremental completed appointments × contribution per appointment − media and staffing cost."] : [`${oneDecimal(appointmentsPerThousand!)} completed appointments per $1,000 × ${testSpend / 1_000} = ${oneDecimal(appointments)} completed appointments.`, `${money(salesPerThousand!)} net sales per $1,000 × ${testSpend / 1_000} = ${money(sales)} net sales.`],
    whyValidationMatters: ["Media cannot create completed appointments above staffed and schedulable capacity.", "Historical net sales do not show incremental contribution or the effect of the next dollar spent."],
    successRule: "Proceed only if current staffed slots can absorb the expected appointments and incremental contribution exceeds media plus staffing cost versus a matched comparison.",
    stopRule: "Stop if appointment availability, completion rate, wait time, or contribution misses its pre-registered threshold.",
    couldReverseRecommendation: ["Insufficient staffed appointment slots.", "Lower current-period completion or new-to-Chewy mix.", "Contribution per incremental appointment below media and staffing cost."],
  };
}

function pricingCase(finding: AutonomousInsight): FindingDecisionCase {
  const dataIssue = finding.opportunity?.recommendation.type === "data_quality" || finding.decisionValue.flags.includes("coverage_risk");
  return {
    version: FINDING_DECISION_CASE_VERSION,
    status: dataIssue ? "data_issue" : "inputs_required",
    observedFact: finding.valueTranslation.statement,
    comparison: finding.whyInteresting,
    proposedAction: dataIssue ? "Do not use this record for a price decision; repair its retailer, SKU, package, geography, and freshness coverage first." : `Create a matched-SKU economics table for ${finding.marketName}, then decide whether a reversible price, promotion, or match test is warranted.`,
    scenario: { label: dataIssue ? "Excluded from opportunity sizing" : "Price-response inputs required", summary: dataIssue ? "Coverage is insufficient to estimate a market opportunity." : "Potential contribution cannot be estimated until Chewy price, unit margin, matched competitor price, and expected unit response are joined.", range: null, basis: "Competitor price or availability alone does not establish Chewy demand response or contribution.", isIncrementalForecast: false },
    calculation: ["Incremental contribution = (test price − unit cost) × expected units at test price − baseline contribution."],
    whyValidationMatters: ["A competitor observation may not represent a comparable SKU, package, retailer, or shopping period.", "A price gap can destroy rather than create value if unit response and margin are not modeled together."],
    successRule: "Run a bounded test only when matched-SKU coverage passes and expected contribution after unit response exceeds the current strategy.",
    stopRule: "Stop if unit response, conversion, customer retention, or contribution crosses the pre-registered downside threshold.",
    couldReverseRecommendation: ["Low matched-SKU or retailer coverage.", "Demand elasticity that offsets the apparent margin opportunity.", "Customer or retention harm larger than contribution gain."],
  };
}

export function buildFindingDecisionCase(finding: AutonomousInsight): FindingDecisionCase {
  if (finding.department === "marketing") return marketingCase(finding);
  if (finding.department === "cvc") return cvcCase(finding);
  return pricingCase(finding);
}
