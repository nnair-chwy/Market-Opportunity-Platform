import { z } from "zod";

export const proposedWeightSchema = z.object({
  criterion_id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  metric: z.string().trim().min(1),
  weight_percent: z.number().finite().min(0).max(100),
  why_it_matters: z.string().trim().min(1),
}).strict();

export const questionIntentSchema = z.object({
  decision: z.string().trim().min(1),
  stakeholder: z.string().trim().min(1),
  entity: z.string().trim().min(1),
  geography: z.string().trim().min(1),
  period: z.string().trim().min(1),
  outcome: z.string().trim().min(1),
  denominator: z.string().trim().min(1),
  action: z.string().trim().min(1),
  constraints: z.array(z.string().trim().min(1)),
  assumptions: z.array(z.string().trim().min(1)),
  ambiguities: z.array(z.string().trim().min(1)),
  ideal_evidence: z.array(z.string().trim().min(1)).min(1),
  evaluation_metrics: z.array(z.string().trim().min(1)).min(1),
  comparison_rules: z.array(z.string().trim().min(1)).min(1),
  proposed_weights: z.array(proposedWeightSchema),
  research_plan: z.array(z.string().trim().min(1)).min(1),
  confirmation_status: z.enum(["proposed", "confirmed", "revision_requested"]),
}).strict();

export type QuestionIntent = z.infer<typeof questionIntentSchema>;

const has = (question: string, pattern: RegExp) => pattern.test(question.toLowerCase());
const vague = (value: string) => /not yet defined|not provided|define the|candidate geograph|decision timing|planning horizon|^next clinic$|^select a location/i.test(value);
const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

export function interpretQuestionPrototype(question: string): QuestionIntent {
  if (has(question, /\b(clinic|clinics)\b/) && has(question, /\b(help|performance|underperform|struggl|peer|review)\b/)) {
    return questionIntentSchema.parse({
      decision: "Identify mature clinics that warrant a structured performance review against eligible peers.",
      stakeholder: "CVC clinic operations and analytics leaders",
      entity: "Aggregate clinic-period",
      geography: "Operating CVC clinics in an eligible national peer cohort",
      period: "Latest complete 13-week period after the clinic reaches 26 weeks of maturity",
      outcome: "Completed appointments per operating week relative to the eligible peer median",
      denominator: "Eligible mature clinic-periods",
      action: "Open a bounded diagnostic review; do not change staffing or close a clinic.",
      constraints: ["Use only eligible peer periods", "Treat the result as a review signal, not a causal finding"],
      assumptions: ["Use completed appointments per operating week as the proposed review KPI", "Treat 26 operating weeks as the proposed maturity floor", "A lower result means the clinic may warrant review"],
      ambiguities: ["Confirm the performance KPI, maturity floor, peer-cohort rule, and materiality threshold before treating the review as business-ready"],
      ideal_evidence: ["Aggregate clinic periods with completed appointments, operating weeks, maturity, temporary closures, and source versions", "Clinic attributes needed to form comparable peers, including opening cohort, format, service model, and market context", "Aggregate operational constraints and approved qualitative notes that may explain—but not score—the observed gap"],
      evaluation_metrics: ["Outcome · completed appointments per operating week", "Comparison · absolute and percentage difference from the eligible peer median", "Eligibility · at least 26 operating weeks with a complete 13-week observation period", "Guardrail · flag closures, missing weeks, and materially incompatible clinic formats"],
      comparison_rules: ["Compare only mature clinics with complete periods and compatible service models", "Use the peer median as the proposed descriptive baseline", "Flag a clinic for review only when the approved materiality boundary is crossed; do not infer cause"],
      proposed_weights: [],
      research_plan: ["Confirm the approved clinic-performance KPI, maturity rule, peer cohort, and materiality threshold with Analytics and Clinic Operations", "Inspect aggregate clinic-period data definitions, completeness, closures, and compatible service-model attributes", "Review operational context only after the descriptive performance gap is validated"],
      confirmation_status: "proposed",
    });
  }

  if (has(question, /\b(price|pricing|elasticity|competitor benchmark)\b/)) {
    return questionIntentSchema.parse({
      decision: "Identify which regions and product groups have enough evidence to justify a bounded regional-pricing experiment.",
      stakeholder: "Pricing Product, Pricing Science, Category, Finance, and Customer Experience leaders",
      entity: "Region-by-product-group opportunities",
      geography: "Regions supported by representative competitor-price and availability sampling",
      period: "A recent stable baseline followed by a time-bounded experiment window",
      outcome: "Improved price competitiveness and stability without unacceptable demand, margin, or customer-experience harm",
      denominator: "Eligible SKU-region observations with compatible competitor, availability, price, and demand evidence",
      action: "Advance evidence-qualified region and product-group pairs into experiment design; do not publish regional prices automatically.",
      constraints: ["Preserve pricing authority and existing competitor-relevance rules", "Require experiment guardrails for demand, margin, volatility, availability, and customer experience", "Do not infer price elasticity from regional demographic correlation"],
      assumptions: ["Use competitor price and availability variation to find research opportunities, not to set prices", "Treat regional pricing as exploratory and cross-functional", "Require a controlled experiment before a business case or production change"],
      ambiguities: ["Confirm eligible categories, regional unit, competitor set, elasticity source, margin boundary, experiment owner, and publishing authority"],
      ideal_evidence: ["Competitor price and in-stock observations by retailer, ZIP sample, SKU, and timestamp with sampling method", "Chewy price, price-driver, availability, volatility, demand, conversion, margin, and customer-experience outcomes at compatible grain", "Competitor-relevance framework and category-specific substitutes", "Pricing Science elasticity estimates with model version, uncertainty, eligibility, and geographic support", "Experiment exposure, control assignment, promotions, messaging, shipping fees, and concurrent pricing changes"],
      evaluation_metrics: ["Opportunity signal · competitor price gap and regional dispersion when both prices are available", "Stability signal · day-over-day price-change rate and fallback events caused by competitor stockouts", "Customer response · conversion, units, retention, cancellation, and complaint guardrails", "Business guardrail · contribution margin and approved price boundaries", "Experiment outcome · incremental change relative to randomized or approved control"],
      comparison_rules: ["Compare like SKUs, landed-price definitions, competitor relevance, and contemporaneous availability", "Keep sampling coverage and freshness visible; do not treat one ZIP as a region", "Use randomization or an approved causal design for experiment conclusions", "Separate opportunity screening from the final price-setting and publishing decision"],
      proposed_weights: [],
      research_plan: ["Read Ram Shenoy — Pricing Product Meeting Prep as reported stakeholder context", "Confirm the five-ZIP sampling design, median calculation, Clear Demand feed, and Zeus or PricePulse ownership with Pricing Product", "Locate the competitor-relevance framework and Pricing Science elasticity dataset definitions", "Define experiment unit, control strategy, margin and customer-experience guardrails, and decision authority before analysis"],
      confirmation_status: "proposed",
    });
  }

  if (has(question, /\b(spend|marketing|campaign|advertis|promotion|awareness)\b/)) {
    return questionIntentSchema.parse({
      decision: "Choose which comparable U.S. markets should enter a bounded paid-marketing test review.",
      stakeholder: "Growth marketing and finance leaders",
      entity: "U.S. Census metropolitan market",
      geography: "Mainland U.S. metropolitan markets where campaign activation is feasible",
      period: "A proposed 8-week campaign test in the next planning quarter",
      outcome: "Incremental new-customer conversion rate during the test window",
      denominator: "Eligible reached prospects in each test market",
      action: "Prepare markets for human review; do not authorize or reallocate spend.",
      constraints: ["Require a defined test budget and approval owner", "Do not infer campaign lift from public market context"],
      assumptions: ["The question concerns paid acquisition rather than clinic capital", "Metropolitan markets are the proposed activation unit", "Use an 8-week test and incremental new-customer conversion as editable defaults"],
      ambiguities: ["Confirm the channel, budget, audience eligibility, attribution window, and approval owner"],
      ideal_evidence: ["Google Ads market-level spend, impressions, clicks, conversions, campaign objective, and attribution settings at daily grain", "Eligible reached audience and new-customer outcome at compatible market and test-window grain", "Pre-test baseline plus test/control market eligibility, exclusions, promotions, and concurrent media"],
      evaluation_metrics: ["Outcome · incremental new-customer conversion rate = incremental new customers / eligible reached prospects", "Efficiency guardrail · incremental customer acquisition cost = test spend / incremental new customers", "Delivery diagnostics · reach, frequency, click-through rate, and conversion volume", "Quality guardrail · minimum audience and conversion sample before comparing markets"],
      comparison_rules: ["Compare test markets with pre-approved control or matched-baseline markets over the same 8-week window", "Keep campaign objective, channel, attribution window, and audience eligibility compatible", "Do not treat raw conversion rate or public market context as incremental lift"],
      proposed_weights: [],
      research_plan: ["Confirm campaign objective, eligible audience, attribution window, budget, and approval owner", "Inspect Google Ads grain, geography, conversion definitions, freshness, and compatibility with new-customer outcomes", "Define test and control eligibility plus concurrent-media exclusions before estimating lift"],
      confirmation_status: "proposed",
    });
  }

  if (has(question, /\b(whitespace|white space|coverage gap|access gap|underserved)\b/)) {
    return questionIntentSchema.parse({
      decision: "Identify U.S. metro areas where addressable pet demand appears high relative to current CVC access and veterinary supply.",
      stakeholder: "CVC real estate, strategy, clinic operations, and analytics leaders",
      entity: "Metro areas",
      geography: "Mainland U.S. metropolitan markets",
      period: "Current evidence snapshot, with every source's observation period shown",
      outcome: "A defensible view of relative clinic whitespace for further investigation",
      denominator: "Addressable pet households in each eligible metro area",
      action: "Produce an evidence map and investigation list; do not select a next-clinic market or property.",
      constraints: ["Define whitespace from compatible demand, access, and supply evidence", "Do not treat Census context or clinic dots alone as whitespace", "Keep missing and incompatible geographies visible"],
      assumptions: ["Use metro areas as the first comparison unit", "Treat whitespace as a relative evidence gap, not proof that a clinic should open", "Use current CVC access and total veterinary capacity as distinct considerations"],
      ambiguities: ["Confirm the approved demand measure, access geography, veterinary-capacity definition, current-clinic coverage method, and minimum evidence threshold"],
      ideal_evidence: ["Addressable pet households and aggregate Chewy customer demand at metro or governed crosswalk grain", "Current CVC locations with approved access or trade-area relationships", "Veterinary clinic locations, service mix, and capacity at compatible geography", "Population, income, and density context with period and provenance", "Missingness, freshness, geographic coverage, and permitted-use metadata for every source"],
      evaluation_metrics: ["Demand · addressable pet households and aggregate Chewy customer presence", "CVC access gap · addressable demand outside approved current-clinic coverage", "Veterinary supply · relevant clinic capacity per 10,000 addressable pet households", "Evidence confidence · compatible-grain coverage, freshness, and missingness"],
      comparison_rules: ["Compare metro areas using compatible periods and geographic definitions", "Keep CVC access gap separate from total veterinary supply", "Exclude or visibly flag markets without minimum evidence coverage", "Describe relative whitespace; do not convert it into a final opening recommendation"],
      proposed_weights: [
        { criterion_id: "demand", label: "Addressable demand", metric: "Addressable pet households and aggregate Chewy customer presence", weight_percent: 40, why_it_matters: "Whitespace is more actionable where the potential need is large enough to investigate." },
        { criterion_id: "cvc_access_gap", label: "CVC access gap", metric: "Addressable demand outside approved current-clinic coverage", weight_percent: 35, why_it_matters: "Shows where current CVC access may not cover addressable demand." },
        { criterion_id: "veterinary_supply", label: "Veterinary supply", metric: "Relevant clinic capacity per 10,000 addressable pet households", weight_percent: 25, why_it_matters: "Distinguishes CVC footprint gaps from markets already well served by veterinary capacity." },
      ],
      research_plan: ["Confirm the business definition of clinic whitespace and whether the desired output is descriptive or a decision screen", "Locate approved CVC access or trade-area relationships and veterinary-capacity evidence at compatible grain", "Validate demand denominator, source periods, geographic crosswalks, and minimum coverage before calculating relative whitespace"],
      confirmation_status: "proposed",
    });
  }

  if (has(question, /\b(clinic|clinics|site|location)\b/)) {
    return questionIntentSchema.parse({
      decision: "Decide which 3–5 U.S. metro areas should move into detailed site research for the next CVC general-practice clinic.",
      stakeholder: "CVC real estate, clinic operations, and finance leaders",
      entity: "Metro areas",
      geography: "Mainland U.S. metropolitan markets outside the current clinic footprint",
      period: "The next 12–24 month clinic development pipeline",
      outcome: "Sustainable patient demand and operating feasibility 24 months after opening",
      denominator: "Eligible mainland U.S. metropolitan markets outside the current footprint",
      action: "Advance 3–5 markets to property-level diligence; do not approve a site, lease, staffing plan, or capital spend.",
      constraints: ["Use public context only as descriptive evidence", "Require property, staffing, permitting, and supply evidence before advancement"],
      assumptions: ["Assume the next clinic is a new general-practice CVC clinic", "Assume national metro-market screening comes before property selection", "Use a 12–24 month pipeline and 24-month post-opening outcome horizon as editable defaults", "Advance 3–5 markets rather than selecting a final site"],
      ambiguities: ["Confirm the service model, capital envelope, approved success KPI, exclusions, comparison rules, and advancement threshold"],
      ideal_evidence: ["Aggregate pet-household and Chewy-demand evidence at metropolitan-market grain with observation period and provenance", "Veterinary clinic supply, service mix, capacity, and whitespace at a compatible market or governed trade-area grain", "Current CVC footprint, customer access, and non-overlap evidence using approved geographic relationships", "Staffing feasibility, property availability, permitting, capital, and operating constraints for the 12–24 month pipeline", "Historical mature-clinic outcomes and opening conditions needed to define a fair reference cohort"],
      evaluation_metrics: ["Demand driver · addressable pet households and aggregate Chewy customer presence", "Supply driver · veterinary clinic capacity per 10,000 addressable pet households", "Access driver · population or pet households outside approved current-clinic coverage", "Eligibility · staffing, property, permitting, and capital feasibility must pass before advancement", "Outcome for later validation · sustainable patient demand and operating feasibility 24 months after opening"],
      comparison_rules: ["Screen metropolitan markets first; do not compare individual properties to market aggregates", "Compare markets only when demand, supply, geography, and periods are compatible", "Keep eligibility constraints separate from preference metrics", "Advance 3–5 markets for property diligence; do not create a final site ranking from public context alone"],
      proposed_weights: [
        { criterion_id: "demand", label: "Patient demand", metric: "Addressable pet households and aggregate Chewy customer presence", weight_percent: 35, why_it_matters: "Indicates whether a market may support sustainable clinic demand." },
        { criterion_id: "access", label: "Unmet access", metric: "Pet households outside approved current-clinic coverage", weight_percent: 25, why_it_matters: "Prioritizes markets where a new clinic could improve access without overlapping the current footprint." },
        { criterion_id: "supply", label: "Veterinary whitespace", metric: "Veterinary clinic capacity per 10,000 addressable pet households", weight_percent: 20, why_it_matters: "Represents the balance between addressable demand and existing veterinary capacity." },
        { criterion_id: "operating_fit", label: "Operating fit", metric: "Aggregate staffing, property, permitting, and cost feasibility indicators", weight_percent: 20, why_it_matters: "Reflects whether a promising market can realistically enter the development pipeline." },
      ],
      research_plan: ["Confirm whether the question starts at national market screening or a known local property search", "Locate approved demand, CVC access, veterinary supply, staffing, property, permitting, and historical outcome definitions", "Validate compatible geography, periods, eligibility rules, and business-approved weights before producing a market screen"],
      confirmation_status: "proposed",
    });
  }

  return questionIntentSchema.parse({
    decision: "Clarify the requested business decision before calculating or ranking anything.",
    stakeholder: "Decision owner not yet identified",
    entity: "Entity not yet defined",
    geography: "Geography not yet defined",
    period: "Decision period not yet defined",
    outcome: "Success outcome not yet defined",
    denominator: "Denominator not yet defined",
    action: "Collect the missing business definition and evidence.",
    constraints: ["Do not calculate until the entity, outcome, geography, and decision boundary are confirmed"],
    assumptions: ["The user is seeking decision support rather than an autonomous decision"],
    ambiguities: ["Stakeholder, entity, outcome, denominator, geography, period, and allowed action require clarification"],
    ideal_evidence: ["Evidence cannot be specified until the decision entity and outcome are clarified"],
    evaluation_metrics: ["No metric is proposed until the outcome and denominator are clarified"],
    comparison_rules: ["Do not compare or rank entities until the entity, cohort, and decision boundary are clarified"],
    proposed_weights: [],
    research_plan: ["Identify the decision owner, action, outcome, denominator, comparison unit, and authoritative internal guidance before searching for data"],
    confirmation_status: "proposed",
  });
}

export function confirmQuestionIntent(intent: QuestionIntent): QuestionIntent {
  return questionIntentSchema.parse({ ...intent, confirmation_status: "confirmed" });
}

export function makeQuestionIntentDecisionReady(question: string, proposed: QuestionIntent): QuestionIntent {
  const defaults = interpretQuestionPrototype(question);
  const scalarKeys = ["decision", "stakeholder", "entity", "geography", "period", "outcome", "denominator", "action"] as const;
  const refined = { ...proposed };
  const proposedWeightTotal = proposed.proposed_weights.reduce((total, item) => total + item.weight_percent, 0);
  for (const key of scalarKeys) {
    if (vague(proposed[key]) || (key === "decision" && proposed[key].trim().split(/\s+/).length < 10)) refined[key] = defaults[key];
  }
  return questionIntentSchema.parse({
    ...refined,
    constraints: unique([...defaults.constraints, ...proposed.constraints.filter((item) => !vague(item))]),
    assumptions: unique([...defaults.assumptions, ...proposed.assumptions.filter((item) => !vague(item))]),
    ambiguities: unique([...defaults.ambiguities, ...proposed.ambiguities.filter((item) => !vague(item))]),
    ideal_evidence: unique([...defaults.ideal_evidence, ...proposed.ideal_evidence.filter((item) => !vague(item))]),
    evaluation_metrics: unique([...defaults.evaluation_metrics, ...proposed.evaluation_metrics.filter((item) => !vague(item))]),
    comparison_rules: unique([...defaults.comparison_rules, ...proposed.comparison_rules.filter((item) => !vague(item))]),
    proposed_weights: proposed.proposed_weights.length > 0 && Math.abs(proposedWeightTotal - 100) < 0.001 ? proposed.proposed_weights : defaults.proposed_weights,
    research_plan: unique([...defaults.research_plan, ...proposed.research_plan.filter((item) => !vague(item))]),
    confirmation_status: "proposed",
  });
}

export function proposedWeightTotal(intent: QuestionIntent) {
  return intent.proposed_weights.reduce((total, item) => total + item.weight_percent, 0);
}
