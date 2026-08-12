import assert from "node:assert/strict";
import test from "node:test";
import {
  actionPacketSchema,
  approveActionPacket,
  aiInterpretationSchema,
  createClinicEvaluationContract,
  evaluationContractSchema,
} from "../lib/evaluation-contracts.ts";
import {
  CALCULATION_VERSION,
  CONFIGURATION_SCHEMA_VERSION,
  type EvaluationInput,
  type ScoringConfiguration,
} from "../lib/scoring.ts";

function clinicConfiguration(): ScoringConfiguration {
  return {
    configurationSchemaVersion: CONFIGURATION_SCHEMA_VERSION,
    scoringVersion: "synthetic-clinic-contract-v1",
    calculationVersion: CALCULATION_VERSION,
    status: "synthetic",
    label: "Synthetic clinic contract fixture",
    metricDefinitions: [{
      metricId: "demand",
      name: "Synthetic demand",
      description: "Synthetic test evidence only.",
      unit: "index",
      direction: "higher-is-better",
      validRange: { min: 0, max: 100 },
      normalization: {
        function: "linear",
        version: "linear-v1",
        inputMin: 0,
        inputMax: 100,
        clamp: false,
      },
      missingDataPolicy: "fail-evaluation",
      owner: "Synthetic fixture",
      sourceIds: ["SYN-DEMAND"],
    }],
    metricWeights: [{
      metricId: "demand",
      included: true,
      weight: 100,
    }],
    constraints: [{
      constraintId: "staffing",
      name: "Synthetic staffing feasibility",
      description: "Synthetic threshold only.",
      unit: "flag",
      operator: "eq",
      threshold: 1,
      missingPolicy: "fail",
      owner: "Synthetic fixture",
      sourceIds: ["SYN-STAFFING"],
    }],
    expectedWeightTotal: 100,
    notes: "Synthetic and unapproved. A score is not a site recommendation.",
  };
}

function clinicInput(rawValue: number | null = 72): EvaluationInput {
  return {
    siteId: "synthetic-clinic-a",
    inputDataVersion: "synthetic-clinic-input-v1",
    metricObservations: [{
      metricId: "demand",
      rawValue,
      unit: "index",
      sourceReference: {
        sourceId: "SYN-DEMAND-SITE-A",
        observationId: "demand-a",
      },
      observedAt: "2026-08-01",
      geography: "synthetic market",
      qualityStatus: rawValue === null ? "warning" : "accepted",
      sensitivity: "internal",
    }],
    constraintObservations: [{
      constraintId: "staffing",
      rawValue: 1,
      unit: "flag",
      sourceReference: {
        sourceId: "SYN-STAFFING-SITE-A",
        observationId: "staffing-a",
      },
      observedAt: "2026-08-01",
      qualityStatus: "accepted",
      sensitivity: "internal",
    }],
    qualitativeEvidence: [],
  };
}

test("creates a valid, versioned shared contract from clinic evaluation inputs", () => {
  const contract = createClinicEvaluationContract(
    clinicInput(),
    clinicConfiguration(),
  );

  assert.equal(evaluationContractSchema.safeParse(contract).success, true);
  assert.equal(contract.contractVersion, "1.0.0");
  assert.equal(contract.domain, "clinic_location_evaluation");
  assert.equal(contract.formulas[0]?.deterministic, true);
  assert.equal(contract.thresholds[0]?.value, 1);
  assert.equal(contract.weights[0]?.weight, 100);
  assert.equal(contract.evidence[0]?.value, 72);
});

test("rejects invalid evidence that fills a missing value by inference", () => {
  const contract = createClinicEvaluationContract(
    clinicInput(null),
    clinicConfiguration(),
  );
  const invalid = structuredClone(contract);
  invalid.evidence[0]!.value = 0;

  const result = evaluationContractSchema.safeParse(invalid);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(
      result.error.issues.map((issue) => issue.message).join(" "),
      /cannot be inferred/,
    );
  }
});

test("preserves an incomplete clinic evaluation as null and Unknown", () => {
  const contract = createClinicEvaluationContract(
    clinicInput(null),
    clinicConfiguration(),
  );
  const demand = contract.evidence.find(
    (record) => record.evidenceId === "metric:demand",
  );

  assert.equal(demand?.availability, "missing");
  assert.equal(demand?.value, null);
  assert.equal(demand?.evidenceStatus, "Unknown");
  assert.equal(
    contract.question.requiredEvidence[0]?.allowMissing,
    false,
  );
});

test("keeps synthetic-only contracts visibly ineligible for production use", () => {
  const contract = createClinicEvaluationContract(
    clinicInput(),
    clinicConfiguration(),
  );

  assert.equal(contract.status, "synthetic");
  assert.equal(contract.contractApproval, null);
  assert.equal(
    contract.question.eligibility.scoringEligibility,
    "synthetic_prototype_only",
  );
  assert.equal(
    contract.evidence.every(
      (record) =>
        record.evidenceStatus === "Hypothesis" &&
        record.eligibility.allowedUse === "synthetic_prototype_only",
    ),
    true,
  );
  assert.equal(
    contract.capabilities
      .filter((capability) => capability.kind !== "human_review")
      .every((capability) => capability.syntheticOnly),
    true,
  );
});

test("requires human review before an action packet can be approved", () => {
  const contract = createClinicEvaluationContract(
    clinicInput(),
    clinicConfiguration(),
  );
  const awaitingReview = {
    packetId: "packet-a",
    packetVersion: "packet-v1",
    contractId: contract.contractId,
    contractRevision: contract.contractRevision,
    status: "awaiting_human_review" as const,
    generatedAt: "2026-08-10T20:00:00.000Z",
    evidence: contract.evidence,
    missingEvidenceIds: [],
    proposedAiInterpretation: {
      status: "proposed" as const,
      text: "Draft explanation based only on the supplied structured evidence.",
      modelVersion: "model-v1",
      promptVersion: "prompt-v1",
      generatedAt: "2026-08-10T20:00:00.000Z",
      sourceIds: contract.sourceIds,
    },
    humanApprovedInterpretation: null,
    actions: [{
      actionId: "record-clinic-decision",
      status: "proposed" as const,
      proposedBy: "ai" as const,
      rationale: "Route the draft packet to an accountable reviewer.",
      approvalGateIds: ["clinic-final-decision-review"],
    }],
    approvalGates: contract.approvalGates,
    artifactIds: ["clinic-review-packet"],
    sourceIds: contract.sourceIds,
  };

  assert.equal(actionPacketSchema.safeParse(awaitingReview).success, true);
  assert.equal(
    actionPacketSchema.safeParse({
      ...awaitingReview,
      status: "approved_for_permitted_action",
      actions: awaitingReview.actions.map((action) => ({
        ...action,
        status: "approved",
      })),
    }).success,
    false,
  );

  assert.throws(() => approveActionPacket(awaitingReview, {
    actionId: "record-clinic-decision",
    receipts: [{
      gateId: "clinic-final-decision-review",
      approvedBy: "reviewer-a",
      approvedAt: "2026-08-10T21:00:00.000Z",
      reviewerRole: "AI agent",
    }],
  }), /requires role/i);

  const approved = approveActionPacket(awaitingReview, {
    actionId: "record-clinic-decision",
    receipts: [{
      gateId: "clinic-final-decision-review",
      approvedBy: "reviewer-a",
      approvedAt: "2026-08-10T21:00:00.000Z",
      reviewerRole: contract.approvalGates[0].requiredRole,
    }],
  });
  assert.equal(approved.status, "approved_for_permitted_action");
  assert.equal(approved.actions[0].status, "approved");
});

test("rejects an action packet that references a gate outside the packet", () => {
  const contract = createClinicEvaluationContract(clinicInput(), clinicConfiguration());
  const packet = {
    packetId: "packet-gate-bypass",
    packetVersion: "packet-v1",
    contractId: contract.contractId,
    contractRevision: contract.contractRevision,
    status: "awaiting_human_review" as const,
    generatedAt: "2026-08-10T20:00:00.000Z",
    evidence: contract.evidence,
    missingEvidenceIds: [],
    proposedAiInterpretation: null,
    humanApprovedInterpretation: null,
    actions: [{ actionId: "record-clinic-decision", status: "proposed" as const, proposedBy: "ai" as const, rationale: "Attempt a direct gate bypass.", approvalGateIds: ["missing-gate"] }],
    approvalGates: contract.approvalGates,
    artifactIds: ["clinic-review-packet"],
    sourceIds: contract.sourceIds,
  };
  assert.equal(actionPacketSchema.safeParse(packet).success, false);
});

test("does not allow human approval metadata inside an AI proposal", () => {
  assert.equal(
    aiInterpretationSchema.safeParse({
      status: "proposed",
      text: "Proposed interpretation.",
      modelVersion: "model-v1",
      promptVersion: "prompt-v1",
      generatedAt: "2026-08-10T20:00:00.000Z",
      sourceIds: ["SYN-DEMAND"],
      approvedBy: "reviewer-a",
    }).success,
    false,
  );
});
