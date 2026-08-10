import type { EvaluationDefinition } from "./contracts.ts";

const approved = (id:string,label:string,value:string,origin:"user_provided"|"approved_definition"|"prototype_default"|"agent_proposed"|"unsupported_or_missing"|"human_approved_run_local"="prototype_default",material=true) => ({ id,label,value,origin,material,approved:true } as const);

export const SITE_DILIGENCE_DEFINITION: EvaluationDefinition = {
  evaluationId:"eval-seattle-area-diligence", name:"Seattle area diligence", description:"Compare synthetic, mutually exclusive analysis zones for bounded deeper-diligence review.", version:"1.0.0-prototype",
  originalQuestion:"Within Greater Seattle, how do submarkets compare for deeper clinic site diligence?", decisionSupported:"After Greater Seattle is selected for follow-up, which illustrative submarket zones merit deeper evidence collection under the visible prototype criteria?", proposedDecisionOwner:"Real Estate analytics — prototype hypothesis pending owner confirmation",
  entityType:"Synthetic illustrative analysis zone", eligibilityRules:[approved("parent","Parent boundary","Seattle-Tacoma-Bellevue CBSA 42660","agent_proposed")], geographicScope:"Seattle-Tacoma-Bellevue CBSA 42660; deterministic mutually exclusive clipped zones", temporalScope:"Synthetic fixture reported 2026-08-03",
  requiredEvidence:["Parent CBSA identity and boundary","Synthetic area metric evidence","Minimized Esri evidence-readiness context"], requiredFields:["cbsa_code","geometry","submarket_id","metrics","limitations"],
  metrics:[
    {id:"demand_potential",label:"Demand potential",inputFields:["demand_potential"],formula:"identity index (0–100)",unit:"index",direction:"higher",weight:30,sourceIds:["SYN-SEATTLE-SUBMARKET-001"]},
    {id:"veterinary_whitespace",label:"Veterinary whitespace",inputFields:["veterinary_whitespace"],formula:"identity index (0–100)",unit:"index",direction:"higher",weight:20,sourceIds:["SYN-SEATTLE-SUBMARKET-001"]},
    {id:"customer_presence",label:"Customer presence",inputFields:["customer_presence"],formula:"identity index (0–100)",unit:"index",direction:"higher",weight:20,sourceIds:["SYN-SEATTLE-SUBMARKET-001"]},
    {id:"commercial_availability",label:"Commercial availability",inputFields:["commercial_availability"],formula:"identity index (0–100)",unit:"index",direction:"higher",weight:15,sourceIds:["SYN-SEATTLE-SUBMARKET-001"]},
    {id:"staffing_feasibility",label:"Staffing feasibility",inputFields:["staffing_feasibility"],formula:"identity index (0–100)",unit:"index",direction:"higher",weight:15,sourceIds:["SYN-SEATTLE-SUBMARKET-001"]},
  ],
  comparisonType:"ranked_alternatives", cohortRules:[approved("same-parent","Comparison cohort","All seven zones within the same selected parent boundary","agent_proposed")],
  criteria:[approved("weights","Prototype weights","30 / 20 / 20 / 15 / 15","prototype_default"),approved("boundary","Decision boundary","Advance ≥ 72; defer ≥ 62; otherwise stop review","prototype_default")],
  missingDataPolicy:"Preserve null; exclude a missing metric and visibly renormalize remaining configured weights within that entity.",
  validationRules:[{type:"completeness",parameters:{minimumCoveragePercent:70},failurePolicy:"warn"},{type:"comparability",parameters:{sameParentBoundary:true},failurePolicy:"block"},{type:"freshness",parameters:{fixtureVersionRequired:true},failurePolicy:"block"}],
  decisionBoundary:"Advance to deeper diligence at score ≥72; defer pending named evidence at 62–71.99; stop this review below 62. These are prototype boundaries, not a site or market-entry decision.",
  permittedActions:["Advance to deeper diligence","Defer pending named evidence","Stop this review"], requiredHumanGates:["approve_definition","resolve_evidence","approve_action"], followUpMetric:"Completion of named diligence evidence",
  evidenceStatus:"Hypothesis", allowedUse:"synthetic_prototype_only", sourceIds:["SRC-014","SRC-015","SRC-016","SYN-SEATTLE-SUBMARKET-001","SRC-017"],
  operatorPlan:[
    {id:"validate",operator:"validate",label:"Validate required area evidence",parameters:{fields:["overall_score","coverage_percent"]}},
    {id:"rank",operator:"rank",label:"Rank alternatives",parameters:{field:"overall_score",direction:"descending"}},
    {id:"disposition",operator:"deterministic_disposition",label:"Apply the declared diligence boundary",parameters:{field:"overall_score",advanceThreshold:72,deferThreshold:62,advanceLabel:"Advance to deeper diligence",deferLabel:"Defer pending named evidence",stopLabel:"Stop this review"}},
  ], assumptions:[approved("segmentation","Local segmentation","Nearest-hub Voronoi partition clipped to the selected CBSA; method v1","agent_proposed"),approved("receiving","Receiving function","Real Estate analytics","agent_proposed")],
};

export const CLINIC_PERFORMANCE_DEFINITION: EvaluationDefinition = {
  evaluationId:"eval-clinic-performance-review",name:"Comparable clinic performance review",description:"Identify material peer-adjusted performance signals without inferring cause.",version:"1.0.0-prototype",
  originalQuestion:"Which comparable clinics require performance review, and why?",decisionSupported:"Which mature, comparable synthetic clinics show a material multi-signal performance review need?",proposedDecisionOwner:"CVC Analytics and clinic operations — prototype hypothesis pending owner confirmation",
  entityType:"Aggregate synthetic clinic-period",eligibilityRules:[approved("maturity","Maturity window","26–52 weeks since opening","prototype_default")],geographicScope:"No geographic comparison; clinic aggregate only",temporalScope:"Comparable 12-week synthetic observation windows",
  requiredEvidence:["Aggregate clinic outcomes","Opening date and weeks since opening","Comparable observation windows","Source quality status"],requiredFields:["business_id","opening_date","weeks_since_opening","completed_appointments","unique_customers","net_sales"],
  metrics:[
    {id:"completed_appointments",label:"Completed appointments",inputFields:["completed_appointments"],formula:"source aggregate; peer difference = clinic value − eligible cohort median",unit:"appointments",direction:"higher",threshold:-25,sourceIds:["SRC-002"]},
    {id:"unique_customers",label:"Unique customers",inputFields:["unique_customers"],formula:"source aggregate; peer difference = clinic value − eligible cohort median",unit:"customers",direction:"higher",sourceIds:["SRC-002"]},
    {id:"net_sales",label:"Net sales",inputFields:["net_sales"],formula:"source aggregate; peer difference = clinic value − eligible cohort median",unit:"USD",direction:"higher",sourceIds:["SRC-002"]},
  ],comparisonType:"peer",cohortRules:[approved("peer","Peer cohort","Eligible clinics with the same observation-window length and maturity band","prototype_default")],criteria:[approved("outcome","Primary outcome","Completed appointments","prototype_default"),approved("materiality","Materiality rule","At least 10 appointments below eligible-peer median, moderated by supporting metrics","prototype_default")],
  missingDataPolicy:"Do not impute. Block comparison for missing opening dates, rejected quality, or incomparable windows; show warnings separately.",validationRules:[{type:"minimum_sample",parameters:{minimumClinics:3},failurePolicy:"block"},{type:"comparability",parameters:{sameWindowLength:true},failurePolicy:"block"},{type:"completeness",parameters:{requiredMetrics:3},failurePolicy:"warn"}],
  decisionBoundary:"Flag review when completed appointments are at least 10 below the eligible-peer median and preserve moderating signals; never assert a cause.",permittedActions:["Review customer acquisition","Review appointment conversion or clinic operations","Conduct a cross-functional review","No qualified issue"],requiredHumanGates:["approve_definition","resolve_evidence","approve_action"],followUpMetric:"Completed appointments versus the same eligible peer cohort at the next review",
  evidenceStatus:"Hypothesis",allowedUse:"synthetic_prototype_only",sourceIds:["SRC-002"],operatorPlan:[
    {id:"eligible",operator:"establish_eligibility",label:"Apply the approved maturity window",parameters:{field:"weeks_since_opening",minimum:26,maximum:52}},
    {id:"compare-primary",operator:"compare_to_peer_median",label:"Compare completed appointments with peers",parameters:{field:"completed_appointments"}},
    {id:"compare-customers",operator:"compare_to_peer_median",label:"Compare unique customers with peers",parameters:{field:"unique_customers"}},
    {id:"compare-sales",operator:"compare_to_peer_median",label:"Compare net sales with peers",parameters:{field:"net_sales"}},
    {id:"rank",operator:"rank",label:"Order the strongest review signals",parameters:{field:"completed_appointments_peer_difference",direction:"ascending"}},
    {id:"disposition",operator:"deterministic_disposition",label:"Apply materiality boundary",parameters:{field:"completed_appointments_peer_difference",advanceThreshold:-9.999,deferThreshold:-1000000,advanceLabel:"No qualified issue",deferLabel:"Conduct a cross-functional review",stopLabel:"Conduct a cross-functional review"}},
  ],assumptions:[approved("outcome-owner","Outcome definition owner","CVC Analytics and Finance must confirm","unsupported_or_missing"),approved("receiving","Receiving function","CVC Analytics and clinic operations","agent_proposed")],
};

export const DEMAND_COVERAGE_GAP_TEST_DEFINITION: EvaluationDefinition = {
  ...SITE_DILIGENCE_DEFINITION,evaluationId:"eval-demand-coverage-gap-test",name:"Synthetic demand-to-coverage gap",description:"Automated adaptability fixture only.",version:"1.0.0-test",originalQuestion:"Rank markets by a synthetic demand-to-coverage gap.",decisionSupported:"Rank prepared synthetic markets by declared demand minus coverage.",entityType:"Synthetic market",geographicScope:"Prepared test markets",temporalScope:"Fixed test fixture",requiredEvidence:["Synthetic demand and coverage"],requiredFields:["demand","coverage"],metrics:[{id:"gap",label:"Demand-to-coverage gap",inputFields:["demand","coverage"],formula:"demand − coverage",unit:"index points",direction:"higher",sourceIds:["SYN-DEMAND-COVERAGE-TEST-001"]}],sourceIds:["SYN-DEMAND-COVERAGE-TEST-001"],operatorPlan:[{id:"rank",operator:"rank",label:"Rank declared gap",parameters:{field:"gap",direction:"descending"}}],assumptions:[],
};

export const SAVED_EVALUATION_DEFINITIONS=[SITE_DILIGENCE_DEFINITION,CLINIC_PERFORMANCE_DEFINITION] as const;
