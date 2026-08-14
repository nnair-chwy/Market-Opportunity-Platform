import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCapabilityQuestion,
  capabilityRegistry,
  capabilityRegistrySchema,
} from "../lib/capability-registry.ts";

test("publishes a valid versioned registry with the four initial capabilities", () => {
  assert.equal(capabilityRegistrySchema.safeParse(capabilityRegistry).success, true);
  assert.equal(capabilityRegistry.registryVersion, "1.0.0");
  assert.deepEqual(
    capabilityRegistry.capabilities.map((item) => item.capabilityId),
    [
      "census_market_context",
      "clinic_performance",
      "clinic_site_evaluation",
      "local_growth_test",
    ],
  );
  for (const capability of capabilityRegistry.capabilities) {
    assert.ok(capability.supportedGeographyGrains.length > 0);
    assert.ok(capability.supportedOutputs.length > 0);
    assert.ok(capability.requiredEvidence.length > 0);
    assert.ok(capability.permittedDeterministicOperators.length > 0);
    assert.ok(capability.knownLimitations.length > 0);
  }
});

test("classifies a supported question", () => {
  const result = assessCapabilityQuestion({
    question: "Show the CBSA market context.",
    requirements: [{
      capabilityId: "census_market_context",
      outputId: "market_context_profile",
      geographyGrain: "cbsa",
    }],
  });

  assert.equal(result.outcome, "supported");
  assert.match(result.message, /Market context profile is supported/);
});

test("classifies an unsupported question without inventing a connection", () => {
  const result = assessCapabilityQuestion({
    question: "Return customer records from the Census context capability.",
    requirements: [{
      capabilityId: "census_market_context",
      outputId: "customer_records",
      geographyGrain: "cbsa",
    }],
  });

  assert.equal(result.outcome, "unsupported");
  assert.match(result.message, /customer records is not supported/i);
});

test("describes partial execution and the missing customer-geography evidence", () => {
  const result = assessCapabilityQuestion({
    question: "Rank markets and identify the eligible local audience.",
    requirements: [
      {
        capabilityId: "clinic_site_evaluation",
        outputId: "market_ranking",
        geographyGrain: "market",
      },
      {
        capabilityId: "local_growth_test",
        outputId: "audience_eligibility",
        geographyGrain: "market",
      },
    ],
  });

  assert.equal(result.outcome, "partially_supported");
  assert.equal(
    result.message,
    "Market ranking is supported, but audience eligibility requires an approved customer-geography view.",
  );
});

test("blocks an otherwise available output until approval is supplied", () => {
  const blocked = assessCapabilityQuestion({
    question: "Make the final site decision.",
    requirements: [{
      capabilityId: "clinic_site_evaluation",
      outputId: "final_site_decision",
      geographyGrain: "site",
    }],
  });
  assert.equal(blocked.outcome, "blocked");
  assert.deepEqual(blocked.missingApprovals, ["Material site decision approval"]);

  const approved = assessCapabilityQuestion({
    question: "Make the final site decision.",
    requirements: [{
      capabilityId: "clinic_site_evaluation",
      outputId: "final_site_decision",
      geographyGrain: "site",
    }],
    satisfiedApprovalIds: ["authorized_real_estate_decision"],
  });
  assert.equal(approved.outcome, "supported");
});

test("keeps available clinic performance evidence distinct from planned capabilities", () => {
  assert.equal(
    capabilityRegistry.capabilities.find((item) => item.capabilityId === "clinic_performance")?.status,
    "connected",
  );
  assert.equal(
    capabilityRegistry.capabilities.find((item) => item.capabilityId === "local_growth_test")?.status,
    "planned",
  );
});
