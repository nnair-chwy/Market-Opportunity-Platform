export const GROWTH_TEST_SCREENING_VERSION = "growth-test-screening-v1" as const;

export const GROWTH_TEST_SCREENING_WEIGHTS = {
  regionalDemandGrowth2024To2025: 0.30,
  activeCustomersPer1000Households: 0.25,
  activeCustomerYoyGrowth: 0.20,
  veterinarySearchConversions: 0.15,
  householdCount: 0.10,
} as const;
