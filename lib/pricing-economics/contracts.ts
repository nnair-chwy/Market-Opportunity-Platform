import { z } from "zod";

const optionalFiniteNumber = z.number().finite().nullable();

export const pricingEconomicsSnapshotSchema = z.object({
  version: z.literal("1.0.0"),
  datasetId: z.literal("pricing_chewy_economics_daily_v1"),
  snapshotId: z.string().trim().min(1),
  activityDate: z.string().date(),
  generatedAt: z.string().datetime(),
  sourceIds: z.array(z.string().trim().min(1)).min(1),
  sourceObject: z.string().trim().min(1),
  sourceFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  inputGrain: z.literal("current_date_x_merchandise_hierarchy_x_manufacturer"),
  outputGrain: z.literal("current_date_x_us_top_level_merchandise_category"),
  geography: z.literal("US"),
  allowedUse: z.literal("internal_shadow_commercial_materiality_only"),
  scoringEligibility: z.literal("none"),
  privacy: z.object({
    containsDirectIdentifiers: z.literal(false),
    containsCustomerGeography: z.literal(false),
    aggregationRule: z.string().trim().min(1),
  }).strict(),
  coverage: z.object({
    inputRows: z.number().int().positive(),
    outputCategories: z.number().int().positive(),
    skuRows: z.number().int().nonnegative(),
    skuRowsWithCompetitorPrice: z.number().int().nonnegative(),
    rowsWithNonZeroSales: z.number().int().nonnegative(),
  }).strict(),
  categories: z.array(z.object({
    category: z.string().trim().min(1),
    sourceRows: z.number().int().positive(),
    skuRows: z.number().int().nonnegative(),
    skuRowsWithCompetitorPrice: z.number().int().nonnegative(),
    averageChewyPrice: optionalFiniteNumber,
    averageMinCompetitorPrice: optionalFiniteNumber,
    averagePseCost: optionalFiniteNumber,
    averageRawProductCost: optionalFiniteNumber,
    averageProductCost: optionalFiniteNumber,
    unitsSold: z.number().finite(),
    netSales: z.number().finite(),
    totalDiscounts: z.number().finite(),
    shippingRevenue: z.number().finite(),
    averageElasticity: optionalFiniteNumber,
  }).strict()).min(1),
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

export type PricingEconomicsSnapshot = z.infer<typeof pricingEconomicsSnapshotSchema>;

export const regionalPricingOutcomeSnapshotSchema = z.object({
  version: z.literal("1.0.0"),
  datasetId: z.literal("pricing_chewy_geo_outcome_weekly_v1"),
  snapshotId: z.string().trim().min(1),
  sourceIds: z.array(z.string().trim().min(1)).min(1),
  outputGrain: z.literal("week_x_cbsa_x_top_level_merchandise_category"),
  minimumDistinctOrders: z.number().int().min(50),
  rows: z.array(z.object({
    weekStartDate: z.string().date(),
    cbsaCode: z.string().regex(/^\d{5}$/),
    category: z.string().trim().min(1),
    distinctOrders: z.number().int().min(50),
    units: z.number().finite(),
    netSales: z.number().finite(),
    discounts: z.number().finite(),
    refunds: z.number().finite(),
    rawProductCost: z.number().finite().nullable(),
    modeledProductCost: z.number().finite().nullable(),
    fulfillmentCost: z.number().finite().nullable(),
    contribution: z.number().finite().nullable(),
    outcomeCompleteness: z.enum(["complete", "missing_cost", "missing_contribution"]),
  }).strict()),
  privacy: z.object({
    directIdentifiersRetained: z.literal(false),
    postalCodesRetained: z.literal(false),
    smallCellsSuppressed: z.literal(true),
  }).strict(),
  allowedUse: z.literal("internal_shadow_regional_outcome_validation_only"),
  limitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

export type RegionalPricingOutcomeSnapshot = z.infer<typeof regionalPricingOutcomeSnapshotSchema>;
