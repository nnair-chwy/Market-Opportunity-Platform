import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWorkspaceResults,
  createWorkspaceActionPacket,
  genericWorkspaceContracts,
  genericWorkspaceFixtures,
  validateWorkspaceInterpretation,
} from "../lib/generic-workspace-fixtures.ts";

test("generic workspace fixtures expose two validated synthetic evaluation types", () => {
  assert.deepEqual(
    genericWorkspaceFixtures.map((fixture) => fixture.id),
    ["clinic_site", "local_growth_market"],
  );
  for (const fixture of genericWorkspaceFixtures) {
    const contract = genericWorkspaceContracts.get(fixture.id);
    assert.ok(contract);
    assert.equal(contract.status, "synthetic");
    assert.equal(contract.expectedWeightTotal, 100);
    assert.equal(contract.question.eligibility.allowedUse, "synthetic_prototype_only");
    assert.equal(contract.approvalGates[0].status, "required");
  }
});

test("application validation rejects an empty AI interpretation", () => {
  const fixture = genericWorkspaceFixtures[0];
  assert.throws(
    () => validateWorkspaceInterpretation(fixture, "too short"),
    /at least 20 characters/,
  );
  const parsed = validateWorkspaceInterpretation(
    fixture,
    fixture.proposedInterpretation,
  );
  assert.equal(parsed.decisionType, fixture.id);
  assert.equal(parsed.text, fixture.proposedInterpretation);
});

test("deterministic operators own fixture calculations and rankings", () => {
  const clinic = calculateWorkspaceResults(genericWorkspaceFixtures[0]);
  assert.deepEqual(
    clinic.map((result) => [result.entity.id, result.rank, result.score]),
    [
      ["clinic-river", 1, 79.75],
      ["clinic-west", 2, 74.9],
      ["clinic-north", 3, 73.75],
    ],
  );

  const growth = calculateWorkspaceResults(genericWorkspaceFixtures[1]);
  assert.deepEqual(
    growth.map((result) => [result.entity.id, result.rank, result.score]),
    [
      ["growth-charlotte", 1, 78.5],
      ["growth-denver", 2, 78],
      ["growth-austin", 3, 77.5],
    ],
  );
});

test("the structured action packet remains a proposed draft awaiting human review", () => {
  const fixture = genericWorkspaceFixtures[1];
  const result = calculateWorkspaceResults(fixture)[0];
  const packet = createWorkspaceActionPacket(
    fixture,
    result,
    fixture.proposedInterpretation,
  );
  assert.equal(packet.status, "awaiting_human_review");
  assert.equal(packet.actions[0].status, "proposed");
  assert.equal(packet.proposedAiInterpretation?.status, "proposed");
  assert.equal(packet.humanApprovedInterpretation, null);
  assert.equal(packet.approvalGates[0].status, "required");
});
