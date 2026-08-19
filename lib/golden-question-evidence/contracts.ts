import { z } from "zod";

export const GOLDEN_QUESTION_EVIDENCE_QUERY_VERSION = "golden-question-evidence-query-v1" as const;
export const GOLDEN_QUESTION_EVIDENCE_CALCULATION_VERSION = "golden-question-candidate-selection-v1" as const;

const cbsaGeographySchema = z.object({
  type: z.literal("cbsa"),
  id: z.string().regex(/^\d{5}$/),
  name: z.string().trim().min(1),
}).strict();

const marketingCandidateSchema = z.object({
  geography: cbsaGeographySchema,
  cohort: z.string().trim().min(1),
  observationWindow: z.string().trim().min(1),
  metrics: z.object({
    clicks: z.number().int().nonnegative(),
    impressions: z.number().int().nonnegative(),
    ctrPercent: z.number().nonnegative(),
    cpcUsd: z.number().nonnegative(),
    configuredConversions: z.number().nonnegative(),
    configuredConversionRatePercent: z.number().nonnegative(),
    costUsd: z.number().nonnegative(),
    mappedPostalGeographies: z.number().int().nonnegative(),
  }).strict(),
  comparison: z.object({
    cohortMedianCtrPercent: z.number().nonnegative(),
    cohortMedianCpcUsd: z.number().nonnegative(),
    cohortMedianConfiguredConversionRatePercent: z.number().nonnegative(),
    conversionRateDifferenceVsMedianPercentagePoints: z.number(),
  }).strict(),
}).strict();

const pricingCandidateSchema = z.object({
  geography: cbsaGeographySchema,
  cohort: z.string().trim().min(1),
  observationWindow: z.string().trim().min(1),
  metrics: z.object({
    documentedAvailabilityPercent: z.number().min(0).max(100),
    monitoredOfferRows: z.number().int().nonnegative(),
    summedDistinctSkuObservations: z.number().int().nonnegative(),
    offerRowWeightedEqualizedPriceUsd: z.number().nonnegative(),
    mappedZipGeographies: z.number().int().nonnegative(),
  }).strict(),
  comparison: z.object({
    eligibleCohortMedianAvailabilityPercent: z.number().min(0).max(100),
    availabilityDifferenceVsMedianPercentagePoints: z.number(),
    metropolitanMedianOfferRows: z.number().int().nonnegative(),
  }).strict(),
}).strict();

const cvcCandidateSchema = z.object({
  geography: z.object({
    type: z.literal("supplied_trade_area"),
    siteId: z.string().trim().min(1),
    siteName: z.string().trim().min(1),
    marketLabel: z.string().trim().min(1),
  }).strict(),
  cohort: z.string().trim().min(1),
  observationWindow: z.string().trim().min(1),
  metrics: z.object({
    petHouseholds: z.number().int().nonnegative(),
    reportedVeterinaryClinicCount: z.number().int().nonnegative(),
    reportedPetHouseholdsPerClinic: z.number().int().nonnegative(),
    reportedChewyOnlineCustomers: z.number().nonnegative(),
  }).strict(),
  comparison: z.object({
    cohortMedianPetHouseholdsPerClinic: z.number().int().nonnegative(),
    cohortMedianChewyOnlineCustomers: z.number().nonnegative(),
    petHouseholdsPerClinicMultipleVsMedian: z.number().nonnegative(),
  }).strict(),
}).strict();

export const goldenQuestionFamilySchema = z.enum(["marketing", "pricing", "cvc"]);
export type GoldenQuestionFamily = z.infer<typeof goldenQuestionFamilySchema>;

export const goldenQuestionEvidenceSchema = z.object({
  version: z.literal("1.0.0"),
  snapshotId: z.string().trim().min(1),
  generatedAt: z.string().datetime(),
  allowedUse: z.literal("internal_shadow_evaluation_only"),
  scoringEligibility: z.literal("none"),
  actionAuthority: z.literal("investigation_leads_only_no_material_action"),
  sourceSnapshots: z.object({
    mapSignalsGeneratedAt: z.string().datetime(),
    pricing: z.string().trim().min(1),
    marketing: z.string().trim().min(1),
    cvc: z.string().trim().min(1),
    cbsaUniverse: z.string().trim().min(1),
    zeus: z.string().trim().min(1),
  }).strict(),
  operationalContext: z.object({
    pricing: z.object({
      snapshotDate: z.string().date(),
      exportedProductSkus: z.number().int().positive(),
      sourceUiProductEntries: z.number().int().positive(),
      productExportCoveragePercent: z.number().min(0).max(100),
      currentRegularExceptions: z.number().int().nonnegative(),
      productExportCompleteness: z.string().trim().min(1),
      exceptionExportCompleteness: z.string().trim().min(1),
      allowedUse: z.string().trim().min(1),
      scoringEligibility: z.literal("none"),
    }).strict(),
  }).strict(),
  selectionRules: z.object({
    marketing: z.string().trim().min(1),
    pricing: z.string().trim().min(1),
    cvc: z.string().trim().min(1),
  }).strict(),
  cohortDiagnostics: z.object({
    marketing: z.object({
      eligibleMarkets: z.number().int().positive(),
      medianCtrPercent: z.number().nonnegative(),
      medianCpcUsd: z.number().nonnegative(),
      medianConfiguredConversionRatePercent: z.number().nonnegative(),
      p75ConfiguredConversionRatePercent: z.number().nonnegative(),
    }).strict(),
    pricing: z.object({
      metropolitanMarketsWithCompleteSignals: z.number().int().positive(),
      eligibleMarkets: z.number().int().positive(),
      medianOfferRowsAllMetropolitan: z.number().int().nonnegative(),
      medianAvailabilityPercentEligible: z.number().min(0).max(100),
    }).strict(),
    cvc: z.object({
      sourceLinkedCompleteRecords: z.number().int().positive(),
      comparableMarketLabelCohorts: z.number().int().positive(),
    }).strict(),
  }).strict(),
  candidates: z.object({
    marketing: z.array(marketingCandidateSchema),
    pricing: z.array(pricingCandidateSchema),
    cvc: z.array(cvcCandidateSchema),
  }).strict(),
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

export type GoldenQuestionEvidence = z.infer<typeof goldenQuestionEvidenceSchema>;
export type GoldenMarketingCandidate = z.infer<typeof marketingCandidateSchema>;
export type GoldenPricingCandidate = z.infer<typeof pricingCandidateSchema>;
export type GoldenCvcCandidate = z.infer<typeof cvcCandidateSchema>;
