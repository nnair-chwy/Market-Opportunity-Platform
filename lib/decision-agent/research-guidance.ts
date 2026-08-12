const PRICING_MEETING_URL = "https://chewyinc.atlassian.net/wiki/spaces/AUS/pages/5430739955/Ram+Shenoy+Pricing+Product+Meeting+Prep";

export function decisionResearchContext(question: string) {
  if (/\b(price|pricing|elasticity|competitor benchmark)\b/i.test(question)) return `Verified internal interview context from ${PRICING_MEETING_URL}:
- Pricing primarily uses competitor matching and benchmarking, with a relevance framework including Amazon, Walmart, Petco, PetSmart, and Target.
- Regional Walmart prices and availability vary; the team expanded from one ZIP to five rotating ZIP samples and uses recent medians.
- Price availability and volatility matter to customer experience; the notes report a recent stability test and describe regional pricing as exploratory with meaningful cross-functional and technical lift.
- Regional price sensitivity, elasticity, promotions, messaging, and shipping-fee sensitivity are candidate research areas.
- Treat these as reported interview context. Confirm metric definitions, datasets, experiment design, authority, and production readiness with Pricing Product and Pricing Science.`;
  if (/\b(clinic|clinics|cvc|veterinary|whitespace)\b/i.test(question)) return `Repository-verified clinic decision boundaries:
- Public CBSA and ACS evidence is descriptive market context, not an approved clinic-opportunity score.
- Current CVC footprint, veterinary supply, demand, staffing, property, permitting, and capital evidence need compatible geography and periods.
- A market screen is distinct from property selection, lease approval, staffing, and capital authorization.
- Treat any weights as editable prototype assumptions until business owners approve definitions and criteria.`;
  return "No topic-specific verified research context is available. Identify the highest-value internal guidance and business definitions to request before calculation.";
}
