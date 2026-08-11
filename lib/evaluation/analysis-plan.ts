import { z } from "zod";
import { matchPublicMarketMeasure, PUBLIC_MARKET_MEASURES } from "./geographic-measures.ts";

export const analysisIntentSchema=z.object({
  questionClassifications:z.array(z.enum(["descriptive","comparative","diagnostic","predictive","simulation","prescriptive","causal","optimization"])).min(1).max(4),
  topic:z.enum(["pet_ownership","market_context","marketing","clinic_location","clinic_performance","other"]),
  entityGrain:z.enum(["us_state","cbsa_market","submarket","clinic_period","unknown"]),
  geographyScope:z.enum(["nationwide","greater_seattle","selected_market","unspecified"]),
  requestedMeasures:z.array(z.enum(["dog_ownership","cat_ownership","household_income","market_population","market_households","market_income","market_housing_units","market_density","chewy_demand","market_capacity","chewy_engagement","brand_awareness","campaign_lift","clinic_attractiveness","clinic_performance"])).max(8),
  requestedAction:z.enum(["describe","compare","screen","investigate","approve"]),
  animal:z.enum(["dog","cat","pet","none"]),
  namedBrand:z.string().trim().max(80).nullable(),
  conciseInterpretation:z.string().trim().min(1).max(240),
});

export type AnalysisIntent=z.infer<typeof analysisIntentSchema>;

export const analysisPlanSchema=z.object({
  planId:z.string().min(1),
  originalQuestion:z.string().min(1),
  analysisType:z.enum(["state_pet_ownership","public_market_context","campaign_opportunity","market_attractiveness","clinic_performance","site_diligence","unsupported"]),
  visualization:z.enum(["state_choropleth","cbsa_choropleth","regional_comparison","peer_review","needs_evidence"]),
  entityLabel:z.string().min(1),
  geographyLabel:z.string().min(1),
  activeMeasure:z.enum(["dog_ownership","cat_ownership","dog_income_proxy","market_population","market_households","market_income","market_housing_units","market_density","clinic_performance","site_diligence","none"]),
  availableMeasures:z.array(z.string().min(1)),
  missingMeasures:z.array(z.string().min(1)),
  status:z.enum(["executable","partially_executable","needs_evidence"]),
  interpretation:z.string().min(1),
  calculationSummary:z.string().min(1),
  evidenceBoundary:z.string().min(1),
  intent:analysisIntentSchema,
  proposalMethod:z.enum(["ai_proposed","deterministic_prototype_fallback"]),
});

export type AnalysisPlan=z.infer<typeof analysisPlanSchema>;

const has=(value:string,pattern:RegExp)=>pattern.test(value);

export function inferAnalysisIntent(question:string):AnalysisIntent{
  const value=question.toLowerCase();
  const publicMeasure=matchPublicMarketMeasure(question);
  const animal:AnalysisIntent["animal"]=has(value,/\bcat(s)?\b/) ? "cat" : has(value,/\bdog(s)?\b/) ? "dog" : has(value,/\bpet(s)?\b/) ? "pet" : "none";
  const measures:AnalysisIntent["requestedMeasures"]=[];
  if(animal==="dog"&&has(value,/\b(owner|owners|ownership|household|profile)\b/))measures.push("dog_ownership");
  if(animal==="cat"&&has(value,/\b(owner|owners|ownership|household|profile)\b/))measures.push("cat_ownership");
  if(has(value,/\b(income|ability to pay|willingness to pay|spending power)\b/))measures.push("household_income");
  if(publicMeasure&&!measures.includes(publicMeasure.id as AnalysisIntent["requestedMeasures"][number]))measures.push(publicMeasure.id as AnalysisIntent["requestedMeasures"][number]);
  if(has(value,/\b(awareness|brand lift)\b/))measures.push("brand_awareness");
  if(has(value,/\b(campaign lift|incremental lift|incrementality|conversion)\b/))measures.push("campaign_lift");
  const marketing=has(value,/\b(ad|ads|advertising|marketing|campaign|campaigns|promotion|promotions)\b/);
  const clinic=has(value,/\b(clinic|clinics)\b/);
  const performance=clinic&&has(value,/\b(performance|peer|comparable|review|underperform)\b/);
  const location=clinic&&has(value,/\b(open|opening|location|site|place|market|where|best)\b/)&&!performance;
  if(marketing)measures.push("chewy_demand","market_capacity","chewy_engagement");
  if(performance)measures.push("clinic_performance");
  if(location)measures.push("clinic_attractiveness");
  const geographic=has(value,/\b(market|markets|city|cities|metro|metros|metropolitan|micropolitan|geograph|where|across|region|regions)\b/);
  const topic:AnalysisIntent["topic"]=performance?"clinic_performance":location?"clinic_location":marketing?"marketing":measures.some((item)=>item==="dog_ownership"||item==="cat_ownership")?"pet_ownership":publicMeasure&&geographic?"market_context":"other";
  const seattle=has(value,/\b(seattle|submarket|submarkets)\b/);
  const state=has(value,/\b(state|states|nationwide|country|national|across the us|across the u\.s\.)\b/);
  const entityGrain:AnalysisIntent["entityGrain"]=performance?"clinic_period":seattle?"submarket":state||topic==="pet_ownership"?"us_state":["marketing","clinic_location","market_context"].includes(topic)?"cbsa_market":"unknown";
  const requestedAction:AnalysisIntent["requestedAction"]=has(value,/\b(approve|authorize)\b/)?"approve":has(value,/\b(why|driver|cause)\b/)?"investigate":has(value,/\b(best|where|which|screen|prioritize)\b/)?"screen":has(value,/\b(compare|versus| vs | x |cross)\b/)?"compare":"describe";
  const classes:AnalysisIntent["questionClassifications"]=requestedAction==="approve"?["prescriptive"]:requestedAction==="investigate"?["diagnostic","comparative"]:requestedAction==="screen"?["comparative","prescriptive"]:requestedAction==="compare"?["comparative"]:["descriptive"];
  return analysisIntentSchema.parse({questionClassifications:classes,topic,entityGrain,geographyScope:seattle?"greater_seattle":state?"nationwide":"unspecified",requestedMeasures:[...new Set(measures)],requestedAction,animal,namedBrand:has(value,/\bget real\b/)?"Get Real":null,conciseInterpretation:topic==="other"?"The requested decision does not yet match an available governed evaluation.":`Evaluate ${topic.replaceAll("_"," ")} at the ${entityGrain.replaceAll("_"," ")} level.`});
}

export function compileAnalysisIntent(question:string,intent:AnalysisIntent,proposalMethod:AnalysisPlan["proposalMethod"]="ai_proposed"):AnalysisPlan{
  const measures=new Set(intent.requestedMeasures);
  const publicMeasure=PUBLIC_MARKET_MEASURES.find((measure)=>measures.has(measure.id as AnalysisIntent["requestedMeasures"][number]))??matchPublicMarketMeasure(question)??PUBLIC_MARKET_MEASURES[0];
  const publicLabels=PUBLIC_MARKET_MEASURES.map((measure)=>measure.label);
  const common={originalQuestion:question,intent,proposalMethod};
  if(intent.topic==="pet_ownership"&&intent.entityGrain==="us_state"){
    const cat=measures.has("cat_ownership")||intent.animal==="cat";
    const crossover=measures.has("household_income")&&!cat;
    return analysisPlanSchema.parse({...common,planId:"plan-state-pet-ownership",analysisType:"state_pet_ownership",visualization:"state_choropleth",entityLabel:"U.S. state",geographyLabel:"United States",activeMeasure:crossover?"dog_income_proxy":cat?"cat_ownership":"dog_ownership",availableMeasures:crossover?["Reported dog-owning household rate","Median household income proxy"]:[`Reported ${cat?"cat":"dog"}-owning household rate`],missingMeasures:crossover?["Governed willingness-to-pay measure"]:[`Current governed ${cat?"cat":"dog"}-ownership measure`],status:"partially_executable",interpretation:intent.conciseInterpretation,calculationSummary:crossover?"Percentile dog ownership × income proxy using a deterministic geometric mean.":`Percentile rank of the reported ${cat?"cat":"dog"}-owning household rate.`,evidenceBoundary:crossover?"Income is an ability-to-pay proxy, not measured willingness to pay.":"The ownership survey is dated and is not Chewy customer or current pet-population data."});
  }
  if(intent.topic==="market_context"&&intent.entityGrain==="cbsa_market")return analysisPlanSchema.parse({...common,planId:`plan-public-${publicMeasure.id}`,analysisType:"public_market_context",visualization:"cbsa_choropleth",entityLabel:"U.S. Census metro or micro area",geographyLabel:"United States",activeMeasure:publicMeasure.id,availableMeasures:publicLabels,missingMeasures:[],status:"executable",interpretation:`Compare ${publicMeasure.label.toLowerCase()} across U.S. Census markets.`,calculationSummary:`Display the observed Census value and its percentile rank across the available CBSA cohort.`,evidenceBoundary:`This is public market context from ${publicMeasure.sourceTitle}; it describes the measure but does not by itself recommend an action.`});
  if(intent.topic==="marketing"&&(intent.entityGrain==="cbsa_market"||intent.entityGrain==="unknown")){
    const awareness=measures.has("brand_awareness")||Boolean(intent.namedBrand);
    const incompatibleOwnership=measures.has("cat_ownership")?"Cat ownership at compatible CBSA grain":measures.has("dog_ownership")?"Dog ownership at compatible CBSA grain":null;
    const missing=awareness?["Market-level aided and unaided awareness","Reach and frequency","Exposed/control brand-lift outcome"]:["Campaign exposure and spend","Conversion or incremental-lift outcome"];
    if(incompatibleOwnership)missing.unshift(incompatibleOwnership);
    const subject=intent.animal==="cat"?"cat food ":intent.animal==="dog"?"dog food ":"";
    return analysisPlanSchema.parse({...common,planId:"plan-campaign-public-context",analysisType:"campaign_opportunity",visualization:"cbsa_choropleth",entityLabel:"U.S. Census metro or micro area",geographyLabel:"Comparable U.S. markets",activeMeasure:publicMeasure.id,availableMeasures:publicLabels,missingMeasures:missing,status:"partially_executable",interpretation:awareness?`Show governed public market context before testing where ${intent.namedBrand?`${intent.namedBrand} `:""}awareness can grow.`:`Show governed public market context before evaluating a ${subject}campaign.`,calculationSummary:`Map the observed ${publicMeasure.label.toLowerCase()} and its national CBSA percentile; no campaign score is inferred.`,evidenceBoundary:awareness?"Public context does not measure current awareness, message fit, or causal brand lift.":"Public context does not predict incremental campaign lift or authorize spend."});
  }
  if(intent.topic==="clinic_location"&&intent.entityGrain==="submarket")return analysisPlanSchema.parse({...common,planId:"plan-seattle-site-diligence",analysisType:"site_diligence",visualization:"regional_comparison",entityLabel:"Synthetic analysis zone",geographyLabel:"Greater Seattle",activeMeasure:"site_diligence",availableMeasures:["Synthetic local demand","Veterinary whitespace","Customer presence","Commercial availability","Staffing feasibility"],missingMeasures:["Governed submarket definition","Approved production criteria"],status:"partially_executable",interpretation:intent.conciseInterpretation,calculationSummary:"Fixed, versioned Seattle prototype weights and decision boundaries.",evidenceBoundary:"Synthetic zones are not approved neighborhoods, trade areas, or real-estate submarkets."});
  if(intent.topic==="clinic_location")return analysisPlanSchema.parse({...common,planId:"plan-market-public-context",analysisType:"market_attractiveness",visualization:"cbsa_choropleth",entityLabel:"U.S. Census metro or micro area",geographyLabel:"Comparable U.S. markets",activeMeasure:publicMeasure.id,availableMeasures:publicLabels,missingMeasures:["Current pet and Chewy demand at compatible grain","Veterinary supply and whitespace","Property, permitting, staffing, and lease evidence","Approved business criteria, weights, and advancement boundary"],status:"partially_executable",interpretation:"Begin national clinic screening with governed public market context.",calculationSummary:`Map the observed ${publicMeasure.label.toLowerCase()} and its national CBSA percentile; no attractiveness score is inferred.`,evidenceBoundary:"Census context alone is not a clinic-opportunity, site-selection, or investment recommendation."});
  if(intent.topic==="clinic_performance")return analysisPlanSchema.parse({...common,planId:"plan-clinic-performance",analysisType:"clinic_performance",visualization:"peer_review",entityLabel:"Aggregate clinic-period",geographyLabel:"Comparable clinic cohort",activeMeasure:"clinic_performance",availableMeasures:["Completed appointments","Unique customers","Net sales","Clinic maturity window"],missingMeasures:["Approved production outcome and materiality definitions"],status:"executable",interpretation:intent.conciseInterpretation,calculationSummary:"Validate eligibility, select comparable periods, compare with peer medians, and apply the fixed review boundary.",evidenceBoundary:"The synthetic fixture can flag review candidates; it cannot establish cause."});
  return analysisPlanSchema.parse({...common,planId:"plan-unsupported",analysisType:"unsupported",visualization:"needs_evidence",entityLabel:"Not yet defined",geographyLabel:"Not yet defined",activeMeasure:"none",availableMeasures:[],missingMeasures:["Supported entity and geography","Governed measures","Comparison or decision boundary"],status:"needs_evidence",interpretation:intent.conciseInterpretation,calculationSummary:"No calculation is permitted until the request matches catalog capabilities.",evidenceBoundary:"The application will not invent a field, formula, geography, or approval."});
}

export function planAnalysisPrototype(question:string){return compileAnalysisIntent(question,inferAnalysisIntent(question),"deterministic_prototype_fallback");}
