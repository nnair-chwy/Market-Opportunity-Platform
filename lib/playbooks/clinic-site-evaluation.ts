import { PlaybookEvidencePackage } from "../snowflake-canonical/contracts.ts";
import { PLAYBOOK_DEFINITIONS } from "./contracts.ts";
import type {
  AdapterResult,
} from "../adapters/snowflake-csv/index.ts";
import type {
  ClinicIdentityRecord,
  ClinicPerformanceRecord,
  DemandRecord,
  MarketContextRecord,
} from "../snowflake-canonical/contracts.ts";

export type ClinicReviewReadiness = {
  status: "ready_for_review" | "blocked";
  package: PlaybookEvidencePackage;
  blockers: string[];
};

export function prepareClinicSiteReview(input: {
  marketId: string;
  question?: string;
  marketContext: AdapterResult<MarketContextRecord>;
  demand: AdapterResult<DemandRecord>;
  clinicIdentity: AdapterResult<ClinicIdentityRecord>;
  clinicPerformance: AdapterResult<ClinicPerformanceRecord>;
  approvals?: Partial<Record<"outcome" | "maturity" | "cohort" | "dataUse", boolean>>;
}): ClinicReviewReadiness {
  const approvals = input.approvals ?? {};
  const blockers = [
    !approvals.outcome && "clinic outcome definition is not approved",
    !approvals.maturity && "clinic maturity window is not approved",
    !approvals.cohort && "comparable clinic cohort is not approved",
    !approvals.dataUse && "clinic and demand data-use approval is not confirmed",
    input.marketContext.records.every((record) => record.marketId !== input.marketId) && "market has no stable CBSA-linked context",
    input.clinicIdentity.records.length === 0 && "no clinic identity evidence is available",
  ].filter((blocker): blocker is string => Boolean(blocker));

  const warnings = [
    ...input.marketContext.warnings.map((warning) => warning.message),
    ...input.demand.warnings.map((warning) => warning.message),
    ...input.clinicIdentity.warnings.map((warning) => warning.message),
    ...input.clinicPerformance.warnings.map((warning) => warning.message),
  ];

  const evidencePackage = PlaybookEvidencePackage.parse({
    packageVersion: "clinic-site-evidence-package-v1",
    playbookId: "clinic_site_evaluation",
    question: input.question ?? PLAYBOOK_DEFINITIONS.clinic_site_evaluation.questionTemplate,
    marketId: input.marketId,
    marketContext: input.marketContext.records,
    demand: input.demand.records,
    clinicIdentity: input.clinicIdentity.records,
    clinicPerformance: input.clinicPerformance.records,
    missingEvidence: blockers,
    warnings,
  });

  return {
    status: blockers.length === 0 ? "ready_for_review" : "blocked",
    package: evidencePackage,
    blockers,
  };
}
