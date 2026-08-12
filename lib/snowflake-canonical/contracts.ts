import { z } from "zod";

export const EvidenceStatus = z.enum([
  "Confirmed",
  "Reported",
  "Derived",
  "Hypothesis",
  "Unknown",
]);

export const QualityStatus = z.enum(["accepted", "warning", "rejected"]);
export const Sensitivity = z.enum(["public", "internal", "confidential", "restricted"]);

export const Provenance = z.object({
  sourceId: z.string().min(1),
  sourceFile: z.string().min(1),
  observedAt: z.string().min(1).nullable(),
  extractedAt: z.string().min(1),
  geography: z.string().min(1),
  grain: z.string().min(1),
  evidenceStatus: EvidenceStatus,
  qualityStatus: QualityStatus,
  sensitivity: Sensitivity,
  allowedUse: z.string().min(1),
});
export type ProvenanceRecord = z.infer<typeof Provenance>;

export const MarketContextRecord = z.object({
  marketId: z.string().min(1),
  cbsaCode: z.string().regex(/^\d{5}$/).nullable(),
  cbsaName: z.string().min(1),
  reportingDate: z.string().min(1),
  activeCustomerCount: z.number().int().nonnegative().nullable(),
  priorYearActiveCustomerCount: z.number().int().nonnegative().nullable(),
  activeCustomerYoyGrowth: z.number().nullable(),
  totalHouseholds: z.number().int().nonnegative().nullable(),
  activeCustomersPer1000Households: z.number().nonnegative().nullable(),
  populationEstimate: z.number().int().nonnegative().nullable(),
  provenance: Provenance,
});

export const ZipMarketRecord = z.object({
  zip: z.string().regex(/^\d{5}$/),
  cbsaName: z.string().min(1),
  statisticalAreaType: z.string().min(1),
  provenance: Provenance,
});

export const DemandRecord = z.object({
  geographyId: z.string().min(1),
  marketId: z.string().nullable(),
  year: z.number().int().min(2000).max(2100),
  netSales: z.number().nullable(),
  netSalesExcludingRefunds: z.number().nullable(),
  provenance: Provenance,
});

export const ClinicIdentityRecord = z.object({
  clinicId: z.string().min(1),
  zip: z.string().regex(/^\d{5}$/).nullable(),
  marketId: z.string().nullable(),
  businessStartDate: z.string().nullable(),
  tenure: z.number().int().nonnegative().nullable(),
  corporateClinic: z.boolean().nullable(),
  practiceHubClinic: z.boolean().nullable(),
  pharmacyBusinessClinic: z.boolean().nullable(),
  provenance: Provenance,
});

export const ClinicPerformanceRecord = z.object({
  clinicId: z.string().min(1),
  metricId: z.string().min(1),
  rawValue: z.number().nullable(),
  unit: z.string().min(1),
  observationWindowStart: z.string().nullable(),
  observationWindowEnd: z.string().nullable(),
  maturityWeeks: z.number().int().nonnegative().nullable(),
  provenance: Provenance,
});

export const PlaybookEvidencePackage = z.object({
  packageVersion: z.string().min(1),
  playbookId: z.enum([
    "clinic_site_evaluation",
    "retail_location_evaluation",
    "local_growth_test",
    "regional_pricing",
  ]),
  question: z.string().min(1),
  marketId: z.string().min(1),
  marketContext: z.array(MarketContextRecord),
  demand: z.array(DemandRecord),
  clinicIdentity: z.array(ClinicIdentityRecord),
  clinicPerformance: z.array(ClinicPerformanceRecord),
  missingEvidence: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type MarketContextRecord = z.infer<typeof MarketContextRecord>;
export type ZipMarketRecord = z.infer<typeof ZipMarketRecord>;
export type DemandRecord = z.infer<typeof DemandRecord>;
export type ClinicIdentityRecord = z.infer<typeof ClinicIdentityRecord>;
export type ClinicPerformanceRecord = z.infer<typeof ClinicPerformanceRecord>;
export type PlaybookEvidencePackage = z.infer<typeof PlaybookEvidencePackage>;
