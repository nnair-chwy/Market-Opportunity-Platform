import type { DiscoveredSourceProfile } from "../data-discovery/contracts.ts";
import {
  fullFileValidationReportSchema,
  type FullFileValidationReport,
} from "../data-discovery/full-file-validator.ts";
import {
  DISCOVERED_EVIDENCE_QUERY_VERSION,
  validatedDiscoveredSourceContractSchema,
  type AggregateFunction,
  type ValidatedDiscoveredSourceContract,
} from "./contracts.ts";

export type DiscoveredSourceContractReview = {
  contractId: string;
  reviewedBy: string;
  reviewedAt: string;
  dimensionFields: string[];
  measures: Array<{ field: string; allowedAggregations: AggregateFunction[] }>;
  filterFields: string[];
  minimumGroupSize?: number;
  maxSourceRows?: number;
  maxSourceBytes?: number;
  maxGroups?: number;
  unresolvedContractQuestions?: string[];
};

/** Creates a query contract only after an approved discovered source receives an explicit review. */
export function createValidatedDiscoveredSourceContract(
  profile: DiscoveredSourceProfile,
  validationInput: FullFileValidationReport,
  review: DiscoveredSourceContractReview,
): ValidatedDiscoveredSourceContract {
  if (profile.approvalState !== "approved_local_source" || profile.integration.queryEligibility !== "candidate_for_adapter") {
    throw new Error("Only an approved local source marked candidate_for_adapter can receive a temporary query contract.");
  }
  if (!profile.sha256) throw new Error("A temporary query contract requires the approved inventory SHA-256.");
  if (profile.format === "xlsx") throw new Error("XLSX discovery profiles require a separately reviewed adapter before temporary aggregate querying.");
  if (!["public", "internal"].includes(profile.inferredSensitivity)) {
    throw new Error("Confidential or restricted discovered sources cannot enter the temporary aggregate-query layer.");
  }
  const validation = fullFileValidationReportSchema.parse(validationInput);
  if (validation.status !== "structurally_valid_candidate" || !validation.semanticContract) {
    throw new Error("A structurally_valid_candidate full-file validation report with a semantic contract is required before temporary querying.");
  }
  const semantic = validation.semanticContract;
  if (validation.sourceId !== profile.sourceId || semantic.sourceId !== profile.sourceId) {
    throw new Error("The full-file validation source does not match the discovered profile.");
  }
  if (semantic.packageId !== profile.packageId || semantic.format !== profile.format || semantic.fileSha256 !== profile.sha256) {
    throw new Error("The full-file semantic contract does not match the profile package, format, and SHA-256.");
  }
  if (semantic.sensitivity !== profile.inferredSensitivity || semantic.allowedUse !== profile.allowedUse) {
    throw new Error("The full-file semantic contract use and sensitivity do not match the discovered profile.");
  }
  if (validation.rowsValidated !== semantic.rowCount || validation.duplicateRowCount !== 0 || validation.failures.length) {
    throw new Error("The full-file validation report is not internally consistent and cannot authorize querying.");
  }
  const profileFields = new Set(profile.columns.map((column) => column.name));
  const validatedFields = new Set(semantic.fieldValidation.map((field) => field.field));
  const requestedFields = new Set([
    ...review.dimensionFields,
    ...review.measures.map((measure) => measure.field),
    ...review.filterFields,
  ]);
  for (const field of requestedFields) {
    if (!profileFields.has(field) || !validatedFields.has(field)) {
      throw new Error(`Reviewed query field ${field} is not present in both the discovered profile and full-file semantic contract.`);
    }
  }
  return validatedDiscoveredSourceContractSchema.parse({
    version: DISCOVERED_EVIDENCE_QUERY_VERSION,
    contractId: review.contractId,
    sourceProfileVersion: profile.profileVersion,
    fullFileValidationVersion: validation.version,
    semanticSourceContractVersion: semantic.version,
    validatedRowCount: validation.rowsValidated,
    sourceId: profile.sourceId,
    relativePath: profile.relativePath,
    format: profile.format,
    sha256: profile.sha256,
    sensitivity: profile.inferredSensitivity,
    allowedUse: profile.allowedUse,
    reviewedBy: review.reviewedBy,
    reviewedAt: review.reviewedAt,
    reviewStatus: "reviewed_for_temporary_aggregate_query",
    columns: profile.columns,
    policy: {
      dimensionFields: review.dimensionFields,
      measures: review.measures,
      filterFields: review.filterFields,
      minimumGroupSize: review.minimumGroupSize ?? 2,
      maxSourceRows: review.maxSourceRows ?? 250_000,
      maxSourceBytes: review.maxSourceBytes ?? 256 * 1024 * 1024,
      maxGroups: review.maxGroups ?? 50,
    },
    quality: {
      profileWarnings: profile.warnings,
      unresolvedContractQuestions: review.unresolvedContractQuestions ?? profile.uncertainties.map((item) => `${item.field}: ${item.reason}`),
    },
  });
}
