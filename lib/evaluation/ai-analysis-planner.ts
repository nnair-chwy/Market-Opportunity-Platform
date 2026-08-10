import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { analysisIntentSchema, compileAnalysisIntent } from "./analysis-plan.ts";

const MODEL="gpt-5.6-terra";

const INSTRUCTIONS=`You dissect an evaluation question into a small structured intent. Do not solve the question and do not provide hidden reasoning.
Choose only from the supplied schema. Identify the requested entity grain, geography, measures, action, and question classes.
Rules:
- Ownership means the matching dog_ownership or cat_ownership measure.
- Income, spending power, ability to pay, or willingness to pay requests household_income; do not claim they are equivalent.
- Public market questions about population, households, income, housing units, or density request the matching market_* measure and use market_context at cbsa_market grain unless a more specific business topic applies.
- Advertising, promotion, or campaign questions are marketing. Awareness requests brand_awareness. Incrementality or conversion requests campaign_lift.
- Opening a clinic is clinic_location. Comparing operating clinics is clinic_performance.
- Seattle or submarket questions use submarket / greater_seattle. Nationwide state comparisons use us_state / nationwide. City or market screening uses cbsa_market.
- Never invent a metric, owner, threshold, source, or approval.
- conciseInterpretation is one short operational sentence, not chain-of-thought.`;

export async function proposeAnalysisPlanWithAi(question:string){
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:1,timeout:20_000});
  const response=await client.responses.parse({model:MODEL,reasoning:{effort:"low"},store:false,input:[{role:"developer",content:INSTRUCTIONS},{role:"user",content:question}],text:{format:zodTextFormat(analysisIntentSchema,"evaluation_analysis_intent")}});
  if(!response.output_parsed)throw new Error("The model returned no structured analysis intent.");
  return compileAnalysisIntent(question,response.output_parsed,"ai_proposed");
}
