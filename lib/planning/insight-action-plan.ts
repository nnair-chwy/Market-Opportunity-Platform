import type { AnalysisBrief } from "./analysis-brief.ts";
import type { EvaluationPlan } from "./contracts.ts";
import type { InvestigationLead, MarketInvestigation } from "./market-investigation.ts";
import { evaluateAnswerCompletion, type AnswerEvaluationReport } from "./answer-evaluation.ts";
import { checkInvestigationCoverage } from "./investigation-coverage.ts";
import { requestedActionDirection } from "./action-direction.ts";

export type InsightActionWorkstream = {
  id: string;
  sequence: number;
  title: string;
  owner: string;
  dueDate: string;
  action: string;
  deliverable: string;
  completionCriteria: string;
  kpi: string;
  validationThreshold: string;
  stopCondition: string;
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
  lever: "paid_search_spend_test" | "pricing_test" | "clinic_footprint_validation";
  actionReadiness: "ready_for_bounded_test" | "validation_required" | "outcome_missing" | "evidence_incompatible";
  confidence: "High" | "Medium" | "Low";
  goalEvaluationStatus: AnswerEvaluationReport["overallStatus"];
  baseline: {
    status: "available" | "partial" | "missing";
    description: string;
    evidenceIds: string[];
  };
  kpi: string;
  validationThreshold: string;
  stopCondition: string;
  sensitivityAndContraryEvidence: string;
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
    .replace(/ has (?:higher|mixed|source-linked).*$/i, "")
    .replace(/ shows .*$/i, "")
    .replace(/'s higher.*$/i, "")
    .replace(/ form a useful footprint contrast.*$/i, "")
    .replace(/ is validation priority \d+.*$/i, "")
    .trim();
}

function outcomeGap(plan: EvaluationPlan, investigation: MarketInvestigation) {
  const gaps = [
    ...plan.missingEvidence,
    ...investigation.readiness.missing,
    ...investigation.nextPass.evidenceNeeded,
    ...investigation.leads.flatMap((lead) => [lead.challenge, lead.nextEvidence]),
  ].join(" ");
  const pattern = plan.perspectiveId === "marketing"
    ? /business outcome|orders?|new customers?|net sales|contribution|incrementality/i
    : plan.perspectiveId === "pricing"
      ? /business outcome|orders?|units?|sales|contribution|profit|margin|customer response/i
      : /appointments?|capacity|clinic performance|maturity|demand|unit economics/i;
  return pattern.test(gaps);
}

function actionAssessment(plan: EvaluationPlan, investigation: MarketInvestigation) {
  const coverage = checkInvestigationCoverage(plan, investigation, plan.actions[0]);
  const goalEvaluation = evaluateAnswerCompletion(plan, investigation, coverage, plan.actions[0]);
  const incompatible = investigation.reconciliation?.canCombine === false;
  const missingOutcome = outcomeGap(plan, investigation);
  const actionReadiness: InsightActionPlan["actionReadiness"] = incompatible
    ? "evidence_incompatible"
    : missingOutcome
      ? "outcome_missing"
      : goalEvaluation.overallStatus === "pass" && investigation.evidenceStage === "triangulated_finding"
        ? "ready_for_bounded_test"
        : "validation_required";
  const confidence: InsightActionPlan["confidence"] = actionReadiness === "ready_for_bounded_test"
    ? "High"
    : actionReadiness === "validation_required" && goalEvaluation.overallStatus === "partial"
      ? "Medium"
      : "Low";
  return { actionReadiness, confidence, goalEvaluation };
}

function buildCommercialActionPlan(
  plan: EvaluationPlan,
  investigation: MarketInvestigation,
  lead: InvestigationLead,
  brief: AnalysisBrief,
  generatedAt: string,
): InsightActionPlan {
  const start = new Date(generatedAt);
  const marketName = marketNameFromLead(lead);
  const assessment = actionAssessment(plan, investigation);
  const isMarketing = plan.perspectiveId === "marketing";
  const requestedDirection = requestedActionDirection(plan);
  const increaseMarketingSpend = isMarketing && requestedDirection === "increase";
  const owner = isMarketing ? "Marketing Science + Paid Search" : "Pricing Analytics + Pricing Science";
  const lever: InsightActionPlan["lever"] = isMarketing ? "paid_search_spend_test" : "pricing_test";
  const kpi = isMarketing
    ? "Owner-approved incremental business outcome for the test cohort—such as new customers, orders, net sales, or contribution—reported with paid and organic/direct substitution guardrails."
    : "Owner-approved contribution, unit, sales, and customer-response outcome for a matched-SKU test cohort, with margin, availability, promotion, and inventory guardrails.";
  const validationThreshold = isMarketing
    ? "The pre-registered comparison reaches the owner-approved power or minimum-detectable-effect requirement and clears outcome, incrementality, geography, campaign-mix, and operational guardrails."
    : "The matched-SKU cohort clears owner-approved coverage, economics, customer-impact, measurement, and rollback gates and reaches the pre-registered test threshold."
  const stopCondition = assessment.actionReadiness === "evidence_incompatible"
    ? "Stop before a combined lever claim: geography, period, metric definition, unit, or allocation evidence is incompatible and must remain source-specific."
    : isMarketing
      ? "Do not change live spend when first-party outcomes, a valid comparator, incrementality design, geography compatibility, or accountable approval is missing; stop the test if a pre-registered business or operational guardrail fails."
      : "Do not change live price when regional outcomes, matched-SKU coverage, economics, customer impact, geography compatibility, or accountable approval is missing; stop the test if a pre-registered margin, availability, inventory, or customer guardrail fails.";
  const evidenceIds = [...new Set([...investigation.sourceIds, lead.id])];
  const firstStatus: InsightActionWorkstream["status"] = assessment.actionReadiness === "evidence_incompatible" ? "blocked_on_evidence" : "ready_to_start";
  const analystFactor = investigation.analystRevision?.prompt;
  const youtubeFactor = Boolean(isMarketing && analystFactor && /youtube|video/i.test(analystFactor));
  const revisionOffset = analystFactor ? 1 : 0;
  const workstreams: InsightActionWorkstream[] = [
    {
      id: "reconcile-baseline",
      sequence: 1,
      title: "Confirm the decision baseline and comparable cohort",
      owner,
      dueDate: addBusinessDays(start, 3),
      action: `Reconcile the source-linked ${marketName} signal against a stable comparison cohort, period, geography, metric definition, and baseline without averaging incompatible evidence.`,
      deliverable: "A versioned baseline table with evidence IDs, cohort definition, periods, geography coverage, unmatched records, definitions, units, contradictions, and precedence decisions.",
      completionCriteria: "Every material baseline claim resolves to compatible source evidence or remains explicitly source-specific.",
      kpi: "Share of baseline claims with compatible geography, period, definition, unit, and source lineage.",
      validationThreshold: "All material baseline claims are source-linked and compatible; unmatched records and contradictions are dispositioned by the accountable owner.",
      stopCondition: "Stop synthesis when an unapproved crosswalk, unresolved allocation, conflicting definition/unit, or material contradiction would be required.",
      status: firstStatus,
    },
    ...(analystFactor ? [{
      id: "evaluate-analyst-factor",
      sequence: 2,
      title: youtubeFactor ? "Compare YouTube with paid search" : "Evaluate the added analyst factor",
      owner: isMarketing ? "Marketing Science + Channel Analytics" : owner,
      dueDate: addBusinessDays(start, 5),
      action: youtubeFactor
        ? `Build a same-geography, same-period comparison of paid search and YouTube for ${marketName}, including spend, reach or completed-view exposure, audience overlap, attributed outcomes, and privacy-safe first-party business outcomes.`
        : `Test this analyst-requested factor for ${marketName} with compatible source evidence: ${analystFactor}`,
      deliverable: youtubeFactor
        ? "A channel-comparison table that keeps paid-search and YouTube exposure, attribution, and first-party outcomes separate and documents unmatched geography or audience coverage."
        : "A source-linked factor assessment stating whether the added consideration supports, weakens, or leaves the original signal unchanged.",
      completionCriteria: "The added factor is either supported by compatible evidence or explicitly marked unavailable with its effect on the recommendation.",
      kpi: youtubeFactor ? "Coverage of comparable paid-search and YouTube spend, exposure, attributed outcomes, audience overlap, and first-party outcomes." : "Coverage of the evidence required by the analyst-added factor.",
      validationThreshold: "The added evidence uses a compatible geography, period, population, metric definition, and accountable owner before it can change the recommendation.",
      stopCondition: "Do not generalize or change a material lever when the added factor is missing, incompatible, or based on unlike attribution definitions.",
      status: "blocked_on_evidence" as const,
    }] : []),
    {
      id: "design-bounded-lever-test",
      sequence: 2 + revisionOffset,
      title: isMarketing ? "Design a controlled paid-search spend test" : "Design a controlled pricing test",
      owner,
      dueDate: addBusinessDays(start, 7),
      action: isMarketing
        ? increaseMarketingSpend
          ? `Pre-register a reversible paid-search spend-increase test for ${marketName}. Define a bounded treatment increase against a stable control, with paid and organic/direct outcomes, power, budget bounds, contamination checks, and rollback rules; do not change live spend yet.`
          : `Pre-register a reversible spend-test design for ${marketName}, including test/control cohorts, paid and organic/direct outcomes, power, budget bounds, contamination checks, and rollback rules; do not change spend yet.`
        : `Pre-register a reversible matched-SKU price-test design for ${marketName}, including treatment/control, economics, customer outcomes, power, inventory and promotion controls, and rollback rules; do not change price yet.`,
      deliverable: "An owner-reviewed test protocol with source-linked baseline, KPI, threshold, guardrails, sensitivity cases, stop condition, and approval gate.",
      completionCriteria: validationThreshold,
      kpi,
      validationThreshold,
      stopCondition,
      status: assessment.actionReadiness === "ready_for_bounded_test" ? "ready_to_start" : "blocked_on_evidence",
    },
    {
      id: "record-lever-disposition",
      sequence: 3 + revisionOffset,
      title: "Record the accountable lever disposition",
      owner,
      dueDate: addBusinessDays(start, 10),
      action: "Review the evidence and protocol, then record Advance, Hold, or Stop for the bounded test only; execution remains outside this platform.",
      deliverable: "A source-linked human disposition with the approved test owner, bounds, monitoring cadence, rollback owner, or the unresolved evidence request.",
      completionCriteria: "An accountable human records the disposition and no external price or spend action is represented as executed.",
      kpi: "Completion of an accountable, source-linked test disposition.",
      validationThreshold: "Every required evidence and feasibility workstream has a status and the accountable owner records Advance, Hold, or Stop.",
      stopCondition: "Record Hold or Stop if any required evidence is missing, incompatible, contradictory, unapproved, or meets its stop condition.",
      status: "blocked_on_evidence",
    },
  ];

  return {
    version: "1.0.0",
    planId: plan.planId,
    leadId: lead.id,
    marketName,
    decisionOwner: owner,
    decisionDueDate: workstreams[workstreams.length - 1].dueDate,
    recommendation: isMarketing
      ? youtubeFactor
        ? `Keep the ${marketName} recommendation channel-specific: prepare the paid-search validation and add a separate YouTube comparison before any cross-channel budget reallocation.`
        : increaseMarketingSpend
          ? `Prepare a bounded paid-search spend-increase test for ${marketName}; increase only within a pre-registered reversible treatment after the evidence and approval gates pass, and do not change live spend yet.`
          : `Prepare a bounded paid-search spend test for ${marketName}; do not change live spend until the evidence and approval gates pass.`
      : `Prepare a bounded matched-SKU pricing test for ${marketName}; do not change live price until the evidence and approval gates pass.`,
    whyNow: `${lead.businessMeaning} Evidence detail: ${lead.observation} ${investigation.analystRevision?.effectOnRecommendation ?? ""} This supports a reversible validation path, not a causal or material-action conclusion. ${lead.challenge}`,
    whatThisInforms: [
      `Whether ${marketName} merits a controlled ${increaseMarketingSpend ? "paid-search spend-increase" : isMarketing ? "paid-search spend" : "pricing"} test`,
      "Which outcome, compatibility, measurement, and approval gaps must be resolved first",
      "Whether the observed signal survives a comparable cohort, sensitivity checks, and contrary explanations",
    ],
    workstreams,
    decisionRules: [
      { disposition: "advance", rule: `Advance only to a bounded, reversible test after the baseline, outcome, measurement, feasibility, approval, and rollback gates all pass.` },
      { disposition: "hold", rule: "Hold when evidence is missing, provisional, incompatible, stale, underpowered, contradictory, or awaiting an accountable owner." },
      { disposition: "stop", rule: `Stop when the signal does not survive compatible comparison or sensitivity checks, or a pre-registered business, customer, operational, or economic guardrail fails.` },
    ],
    stakeholders: isMarketing
      ? ["Marketing Science", "Paid Search", "Finance", "Analytics", "Channel Operations"]
      : ["Pricing Analytics", "Pricing Science", "Finance", "Merchandising", "Pricing Platform"],
    longerTermConsiderations: [
      "Persist tested baselines, interventions, and observed outcomes so later recommendations can learn from reviewed historical cases.",
      "Replace provisional geography and metric relationships with owner-approved, versioned production contracts.",
      "Calibrate thresholds only from approved historical or experimental evidence; do not infer them from the current descriptive signal.",
    ],
    sourcePattern: `Goal-checked, source-linked bounded lever plan for the confirmed question: ${brief.rewrittenQuestion}`,
    lever,
    actionReadiness: assessment.actionReadiness,
    confidence: assessment.confidence,
    goalEvaluationStatus: assessment.goalEvaluation.overallStatus,
    baseline: { status: evidenceIds.length > 1 ? "partial" : "missing", description: lead.observation, evidenceIds },
    kpi,
    validationThreshold,
    stopCondition,
    sensitivityAndContraryEvidence: `${lead.challenge} ${investigation.rejectedPatterns[0] ?? "No additional rejected interpretation was recorded."}`,
  };
}

export function buildInsightActionPlan(
  plan: EvaluationPlan,
  investigation: MarketInvestigation,
  lead: InvestigationLead,
  brief: AnalysisBrief,
  generatedAt: string,
): InsightActionPlan | null {
  if (plan.perspectiveId !== "cvc") return buildCommercialActionPlan(plan, investigation, lead, brief, generatedAt);
  const start = new Date(generatedAt);
  const marketName = marketNameFromLead(lead);
  const assessment = actionAssessment(plan, investigation);
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
      kpi: "Coverage of the approved demand, awareness, consideration, needs, barriers, and Chewy-demand measures at the selected geography and benchmark.",
      validationThreshold: "All owner-required measures are source-linked and comparable, and the accountable owner records whether the approved expansion benchmark is met.",
      stopCondition: "Stop this workstream if sample, geography, period, benchmark, or definitions cannot support a comparable cut without imputation.",
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
      kpi: "Coverage of current clinic supply, appointment capacity, veterinarian availability, competitive access, and cannibalization checks.",
      validationThreshold: "Every required supply-and-capacity check has current evidence at an approved trade-area grain and an operating-owner disposition.",
      stopCondition: "Stop advancement if clinic identity or geography cannot be reconciled, or an operating owner confirms a material capacity, workforce, access, or cannibalization constraint.",
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
      kpi: "Count of candidate trade areas clearing all owner-approved property, access, cost, unit-economics, and network-conflict gates.",
      validationThreshold: "At least one candidate trade area clears every approved gate with assumptions, exclusions, and sensitivity results documented.",
      stopCondition: "Stop site research if no candidate trade area clears an approved gate or required property/economic evidence cannot be obtained.",
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
      kpi: "Completion of the source-linked packet and accountable human research disposition.",
      validationThreshold: "Every evidence workstream has a status and the accountable owner records Advance, Hold, or Stop for the next research stage only.",
      stopCondition: "Stop and record Hold or Stop when any required workstream is unresolved, contradictory, unapproved, or meets its stop condition.",
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
    lever: "clinic_footprint_validation",
    actionReadiness: assessment.actionReadiness,
    confidence: assessment.confidence,
    goalEvaluationStatus: assessment.goalEvaluation.overallStatus,
    baseline: {
      status: investigation.sourceIds.length ? "partial" : "missing",
      description: lead.observation,
      evidenceIds: [...new Set([...investigation.sourceIds, lead.id])],
    },
    kpi: "Owner-approved clinic demand, appointment capacity, mature-clinic performance, workforce feasibility, and unit-economics gates at a compatible geography and period.",
    validationThreshold: "Every required demand, capacity, mature-performance, workforce, property, and economics gate is source-linked, comparable, owner-approved, and passes its recorded threshold.",
    stopCondition: assessment.actionReadiness === "evidence_incompatible"
      ? "Stop before a combined footprint claim: incompatible geography, period, definition, unit, or allocation evidence must remain separate."
      : "Do not advance footprint research if demand, capacity, mature performance, workforce, property, economics, geography compatibility, or accountable approval is missing or fails an owner-approved gate.",
    sensitivityAndContraryEvidence: `${lead.challenge} ${investigation.rejectedPatterns[0] ?? "No additional rejected interpretation was recorded."}`,
  };
}
