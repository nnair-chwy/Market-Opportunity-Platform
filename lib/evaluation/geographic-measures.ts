import type { CbsaAcsMetricKey } from "../data/cbsa-acs/index.ts";
import { publicMarkets } from "../data/public-market-ui.ts";

export type PublicMarketMeasureId=
  | "market_population"
  | "market_households"
  | "market_income"
  | "market_housing_units"
  | "market_density";

export type PublicMarketMeasure={
  id:PublicMarketMeasureId;
  metricKey:CbsaAcsMetricKey;
  label:string;
  shortLabel:string;
  unit:string;
  aliases:readonly string[];
  sourceId:"SRC-016";
  sourceTitle:string;
  sourceUrl:string;
  observedAt:string;
  evidenceStatus:"Confirmed"|"Derived";
  allowedUse:"market_context_only";
  limitation:string;
};

export const PUBLIC_MARKET_MEASURES:readonly PublicMarketMeasure[]=[
  {id:"market_population",metricKey:"total_population",label:"Total population",shortLabel:"Population",unit:"people",aliases:["population","people","residents","market size"],sourceId:"SRC-016",sourceTitle:"U.S. Census Bureau 2020–2024 ACS 5-year estimate",sourceUrl:"https://api.census.gov/data/2024/acs/acs5",observedAt:"2024-12-31",evidenceStatus:"Confirmed",allowedUse:"market_context_only",limitation:"A period estimate of residents; it is not pet demand, customer demand, or a forecast."},
  {id:"market_households",metricKey:"household_count",label:"Household count",shortLabel:"Households",unit:"households",aliases:["households","household count","homes"],sourceId:"SRC-016",sourceTitle:"U.S. Census Bureau 2020–2024 ACS 5-year estimate",sourceUrl:"https://api.census.gov/data/2024/acs/acs5",observedAt:"2024-12-31",evidenceStatus:"Confirmed",allowedUse:"market_context_only",limitation:"Household scale does not indicate pet ownership, Chewy penetration, or category demand."},
  {id:"market_income",metricKey:"median_household_income",label:"Median household income",shortLabel:"Income",unit:"USD",aliases:["income","median income","affluence","purchasing power","ability to pay"],sourceId:"SRC-016",sourceTitle:"U.S. Census Bureau 2020–2024 ACS 5-year estimate",sourceUrl:"https://api.census.gov/data/2024/acs/acs5",observedAt:"2024-12-31",evidenceStatus:"Confirmed",allowedUse:"market_context_only",limitation:"Income is market context, not willingness to pay or expected customer value."},
  {id:"market_housing_units",metricKey:"housing_unit_count",label:"Housing unit count",shortLabel:"Housing units",unit:"housing units",aliases:["housing units","housing stock","residences"],sourceId:"SRC-016",sourceTitle:"U.S. Census Bureau 2020–2024 ACS 5-year estimate",sourceUrl:"https://api.census.gov/data/2024/acs/acs5",observedAt:"2024-12-31",evidenceStatus:"Confirmed",allowedUse:"market_context_only",limitation:"Housing-unit scale is contextual and does not establish commercial opportunity."},
  {id:"market_density",metricKey:"population_density",label:"Population density",shortLabel:"Density",unit:"people per square mile",aliases:["density","population density","dense","urban concentration"],sourceId:"SRC-016",sourceTitle:"U.S. Census Bureau ACS population joined to Census CBSA land area",sourceUrl:"https://api.census.gov/data/2024/acs/acs5",observedAt:"2024-12-31",evidenceStatus:"Derived",allowedUse:"market_context_only",limitation:"CBSA-wide density can hide substantial local variation and is not a trade-area measure."},
] as const;

export function publicMarketMeasure(id:string):PublicMarketMeasure{return PUBLIC_MARKET_MEASURES.find((item)=>item.id===id)??PUBLIC_MARKET_MEASURES[0];}

export function matchPublicMarketMeasure(question:string):PublicMarketMeasure|null{
  const value=question.toLowerCase();
  const best=PUBLIC_MARKET_MEASURES.map((measure)=>({measure,score:measure.aliases.reduce((score,alias)=>score+(value.includes(alias)?alias.length:0),0)})).sort((a,b)=>b.score-a.score)[0];
  return best?.score?best.measure:null;
}

export function rawPublicMarketValue(cbsaCode:string,measureId:string){const market=publicMarkets.find((item)=>item.cbsa_code===cbsaCode);return market?.acs?.metrics[publicMarketMeasure(measureId).metricKey].raw_value??null;}

export function publicMarketMeasureScores(measureId:string):Record<string,number>{
  const measure=publicMarketMeasure(measureId);const values=publicMarkets.map((market)=>({code:market.cbsa_code,value:market.acs?.metrics[measure.metricKey].raw_value??null})).filter((item):item is {code:string;value:number}=>item.value!==null).sort((a,b)=>a.value-b.value||a.code.localeCompare(b.code));
  const count=Math.max(1,values.length-1);return Object.fromEntries(values.map((item,index)=>[item.code,Number((index/count*100).toFixed(1))]));
}

export function rankedPublicMarkets(measureId:string,limit=12){const measure=publicMarketMeasure(measureId);return publicMarkets.map((market)=>({market,value:market.acs?.metrics[measure.metricKey].raw_value??null})).filter((item):item is {market:(typeof publicMarkets)[number];value:number}=>item.value!==null).sort((a,b)=>b.value-a.value||a.market.cbsa_name.localeCompare(b.market.cbsa_name)).slice(0,limit);}

export function formatPublicMarketValue(value:number,measureId:string){const measure=publicMarketMeasure(measureId);if(measure.unit==="USD")return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);return new Intl.NumberFormat("en-US",{maximumFractionDigits:measure.id==="market_density"?1:0,notation:value>=1_000_000?"compact":"standard"}).format(value);}
