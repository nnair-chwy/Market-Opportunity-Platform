import type { AnalysisBrief } from "./analysis-brief.ts";
import type { EvaluationPlan } from "./contracts.ts";
import type { InvestigationLead, MarketInvestigation } from "./market-investigation.ts";

export type InsightActionWorkstream = {
  id: string;
  sequence: number;
  title: string;
  owner: string;
  dueDate: string;
  action: string;
  deliverable: string;
  completionCriteria: string;
  status: "ready_to_start" | "blocked_on_evidence";
};

export type InsightActionPlan = {
  version: "1.0.0";
  planId: string;
  leadId: string;
  marketName: string;
  decisionOwner: string;
  decisionDueDate: string;
  recommendation: string;
  whyNow: string;
  whatThisInforms: string[];
  workstreams: InsightActionWorkstream[];
  decisionRules: Array<{ disposition: "advance" | "hold" | "stop"; rule: string }>;
  stakeholders: string[];
  longerTermConsiderations: string[];
  sourcePattern: string;
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addBusinessDays(start: Date, days: number) {
  const result = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return dateOnly(result);
}

function marketNameFromLead(lead: InvestigationLead) {
  return lead.title
    .replace(/ has the highest.*$/i, "")
    .replace(/ form a useful footprint contrast.*$/i, "")
    .replace(/ is validation priority \d+.*$/i, "")
    .trim();
}

export function buildInsightActionPlan(
  plan: EvaluationPlan,
  investigation: MarketInvestigation,
  lead: InvestigationLead,
  brief: AnalysisBrief,
  generatedAt: string,
): InsightActionPlan | null {
  if (plan.perspectiveId !== "cvc") return null;
  const start = new Date(generatedAt);
  const marketName = marketNameFromLead(lead);
  const workstreams: InsightActionWorkstream[] = [
    {
      id: "demand_awareness",
      sequence: 1,
      title: "Add governed demand evidence",
      owner: "Consumer Insights Health + CVC Strategy",
      dueDate: addBusinessDays(start, 5),
      action: `Request a ${marketName} demand-and-awareness cut using the CVC Local Tracker learning pattern: pet-parent awareness, consideration, needs, barriers, and Chewy customer demand at the approved geography.`,
      deliverable: "A governed market evidence table with population definition, sample, geography, period, confidence, and comparison benchmark.",
      completionCriteria: "The owner states whether demand and consideration clear the approved expansion benchmark and documents contrary evidence.",
      status: "ready_to_start",
    },
    {
      id: "supply_capacity",
      sequence: 2,
      title: "Verify whitespace and operating capacity",
      owner: "CVC Operations + Network / Workforce Analytics",
      dueDate: addBusinessDays(start, 10),
      action: `Validate ${marketName} clinic supply, veterinarian availability, current CVC coverage, appointment capacity, staffing feasibility, and likely cannibalization at an approved trade-area grain.`,
      deliverable: "A current supply-and-capacity brief with source dates, definitions, gaps, and an owner-reviewed feasibility disposition.",
      completionCriteria: "No mapped-footprint conflict remains and the operating owner confirms that capacity and workforce constraints are feasible enough for site research.",
      status: "blocked_on_evidence",
    },
    {
      id: "property_economics",
      sequence: 3,
      title: "Run the property and economics screen",
      owner: "CVC Real Estate + Finance",
      dueDate: addBusinessDays(start, 15),
      action: `Screen ${marketName} for candidate trade areas, property availability, access, build and operating costs, unit economics, and conflicts with the current network.`,
      deliverable: "A bounded trade-area shortlist with explicit economic assumptions, excluded areas, and unresolved approval gates.",
      completionCriteria: "At least one trade area meets the owner-approved feasibility and economic thresholds without a material stop condition.",
      status: "blocked_on_evidence",
    },
    {
      id: "decision_review",
      sequence: 4,
      title: "Make the validation disposition",
      owner: "CVC Strategy and Real Estate Analytics",
      dueDate: addBusinessDays(start, 17),
      action: `Reconvene the named owners with one evidence packet for ${marketName}; record Advance, Hold, or Stop and the evidence behind that decision.`,
      deliverable: "A signed validation disposition with the next accountable owner, next milestone, and any remaining evidence requests.",
      completionCriteria: "The disposition is recorded by an accountable human owner; the public-context contrast is not used as approval evidence.",
      status: "blocked_on_evidence",
    },
  ];

  return {
    version: "1.0.0",
    planId: plan.planId,
    leadId: lead.id,
    marketName,
    decisionOwner: "CVC Strategy and Real Estate Analytics",
    decisionDueDate: workstreams[3].dueDate,
    recommendation: `Start a bounded validation sprint for ${marketName}; do not begin site selection or opening approval yet.`,
    whyNow: `${lead.observation} That is enough to prioritize a validation check, but not an opening decision. ${lead.challenge}`,
    whatThisInforms: [
      `Whether ${marketName} advances into detailed trade-area and site research`,
      "Which demand, awareness, supply, staffing, and economic gaps must be funded or requested",
      "Whether the public footprint contrast survives after governed demand and operating evidence is added",
    ],
    workstreams,
    decisionRules: [
      { disposition: "advance", rule: "All three evidence workstreams meet owner-approved thresholds, no stop condition is present, and the market remains competitive under sensitivity checks." },
      { disposition: "hold", rule: "Evidence is incomplete, definitions are incompatible, results conflict, or the market changes materially under alternate peer definitions or periods." },
      { disposition: "stop", rule: "Governed demand fails the expansion benchmark, current coverage or cannibalization removes the whitespace case, or operating/property economics fail an approved gate." },
    ],
    stakeholders: ["Consumer Insights Health", "CVC Strategy", "CVC Operations", "Network / Workforce Analytics", "CVC Real Estate", "Finance"],
    longerTermConsiderations: [
      "Connect governed recurring market inputs before introducing any opportunity ranking.",
      "Track actual validation outcomes so the formula can be calibrated against markets that advanced, paused, or stopped.",
      "Use market-level awareness and needs research to tailor launch strategy only after the market clears expansion validation.",
    ],
    sourcePattern: `Structured using Chewy research conventions: state what the work will inform, distinguish near-term action from longer-term considerations, name owners and dates, and specify the next research round. Confirmed question: ${brief.rewrittenQuestion}`,
  };
}
