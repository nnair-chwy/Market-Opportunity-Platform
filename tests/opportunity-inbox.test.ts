import assert from "node:assert/strict";
import test from "node:test";
import {
  actionPacketSchema,
  ActionPacketExplanationError,
  createDeliveryPreview,
  createInMemoryOpportunityStore,
  buildNationalMonitoringSnapshot,
  explainActionPacket,
  getFixtureBatch,
  getOpportunityBlockers,
  getOpportunityInboxSnapshot,
  isWithinCooldown,
  outcomeObservationSchema,
  PLAYBOOKS,
  playbookDefinitionSchema,
  resetOpportunityInboxForTests,
  reviewOpportunity,
  runPlaybooks,
  runSyntheticDiscovery,
  summarizeSectorOpportunities,
  validateSignalBatch,
} from "../lib/opportunity-inbox/index.ts";
import { SECTOR_WORKSPACES } from "../lib/opportunity-inbox/sector-catalog.ts";

const BATCH_01_TIME = "2026-08-05T16:00:00.000Z";
const BATCH_02_TIME = "2026-08-06T16:00:00.000Z";

test("synthetic Seattle intake quarantines prohibited input and suppresses duplicate observations", () => {
  const batch = validateSignalBatch(getFixtureBatch());

  assert.equal(batch.events.length, 12);
  assert.equal(batch.quarantinedCount, 1);
  assert.equal(batch.duplicateObservationCount, 1);
  assert.equal(batch.events.every((event) => event.regionId === "cbsa:42660"), true);
  assert.equal(
    batch.events.every((event) => event.allowedUse === "synthetic_prototype_only"),
    true,
  );
});

test("three deterministic playbooks produce one reviewable opportunity each", () => {
  const opportunities = runPlaybooks(validateSignalBatch(getFixtureBatch()));

  assert.deepEqual(
    opportunities.map((item) => item.sector).sort(),
    ["ecosystem", "marketing", "pet_health"],
  );
  assert.deepEqual(
    opportunities.map((item) => [item.sector, item.state]),
    [
      ["marketing", "needs_review"],
      ["pet_health", "needs_review"],
      ["ecosystem", "prepared"],
    ],
  );
  assert.equal(opportunities.every((item) => item.evidenceCoverage === 1), true);
  assert.equal(
    opportunities.every((item) => item.draft.origin === "deterministic_fallback"),
    true,
  );
});

test("sector opportunity summaries retain blockers without mixing production dependencies", () => {
  const opportunities = runPlaybooks(validateSignalBatch(getFixtureBatch()), BATCH_01_TIME);
  const summary = summarizeSectorOpportunities(opportunities);

  assert.equal(summary.activeCount, 3);
  assert.equal(summary.blockerCount, 0);
  assert.equal(summary.needsAttentionCount, 2);
  assert.equal(summary.averageCoverage, 1);

  const fixture = getFixtureBatch() as { context: Array<Record<string, unknown>> };
  const retailer = fixture.context.find((item) => item.fieldId === "retailer_identity");
  assert.ok(retailer);
  retailer.value = null;
  retailer.evidenceStatus = "Unknown";
  const blocked = runPlaybooks(validateSignalBatch(fixture), BATCH_01_TIME)
    .find((item) => item.sector === "ecosystem");
  assert.ok(blocked);
  assert.equal(getOpportunityBlockers(blocked).some((item) => item.id === "blocker:retailer_identity"), true);
});

test("ecosystem closure assembles a deterministic advancing ActionPacket", () => {
  const batch = validateSignalBatch(getFixtureBatch());
  const first = runPlaybooks(batch, BATCH_01_TIME).find((item) => item.sector === "ecosystem");
  const second = runPlaybooks(batch, BATCH_01_TIME).find((item) => item.sector === "ecosystem");
  assert.ok(first?.actionPacket);
  assert.deepEqual(second?.actionPacket, first.actionPacket);
  assert.deepEqual(actionPacketSchema.parse(first.actionPacket), first.actionPacket);
  assert.equal(first.state, "prepared");
  assert.equal(first.actionPacket.systemDisposition, "advance");
  assert.equal(first.actionPacket.deadline.dueAt, "2026-08-07T16:00:00.000Z");
  assert.equal(first.actionPacket.situation.retailerIdentity, "NorthSound Pet Market");
  assert.equal(first.actionPacket.remainingBlockers.length, 0);
  assert.equal(first.actionPacket.sourceIds.includes("SYN-ECO-VERIFY-001"), true);
});

test("ecosystem ActionPacket blocks on missing evidence without imputing it", () => {
  const fixture = getFixtureBatch() as { context: Array<Record<string, unknown>> };
  const retailer = fixture.context.find((item) => item.fieldId === "retailer_identity");
  assert.ok(retailer);
  retailer.value = null;
  retailer.evidenceStatus = "Unknown";
  const opportunity = runPlaybooks(validateSignalBatch(fixture), BATCH_01_TIME).find((item) => item.sector === "ecosystem");
  assert.ok(opportunity?.actionPacket);
  assert.equal(opportunity.state, "blocked");
  assert.equal(opportunity.actionPacket.systemDisposition, "blocked");
  assert.equal(opportunity.actionPacket.situation.retailerIdentity, null);
  assert.equal(opportunity.actionPacket.remainingBlockers.some((item) => item.blockerId === "blocker:retailer_identity"), true);
});

test("ecosystem ActionPacket stops when a configured contradiction is confirmed", () => {
  const fixture = getFixtureBatch() as { context: Array<Record<string, unknown>> };
  const permanence = fixture.context.find((item) => item.fieldId === "closure_permanence");
  assert.ok(permanence);
  permanence.value = "temporary";
  const opportunity = runPlaybooks(validateSignalBatch(fixture), BATCH_01_TIME).find((item) => item.sector === "ecosystem");
  assert.ok(opportunity?.actionPacket);
  assert.equal(opportunity.state, "stopped");
  assert.equal(opportunity.actionPacket.systemDisposition, "stop");
  assert.match(opportunity.actionPacket.recommendedCourseOfAction, /Close the synthetic regional response plan/);
});

test("ecosystem delivery preview needs no approval and never changes the prepared state", () => {
  const store = createInMemoryOpportunityStore();
  const result = runSyntheticDiscovery("seattle-batch-01", { store, effectiveAt: BATCH_01_TIME, idFactory: () => "ecosystem" });
  const ecosystem = result.snapshot.opportunities.find((item) => item.sector === "ecosystem");
  assert.ok(ecosystem);
  assert.throws(() => reviewOpportunity(ecosystem.opportunityId, { action: "approve", reason: "Not used", reviewer: "Test" }, { store }), /do not use a human approval/);
  const delivery = createDeliveryPreview(ecosystem.opportunityId, { channel: "outlook" }, { store, effectiveAt: BATCH_01_TIME, idFactory: () => "preview" });
  assert.equal(delivery.opportunity.state, "prepared");
  assert.equal(delivery.receipt.status, "simulated");
  assert.match(delivery.receipt.message, /Remaining blockers: None/);
  assert.match(delivery.receipt.message, /was not sent, and no real action was executed/);
});

test("ActionPacket explanation accepts supported AI wording and rejects altered policy", async () => {
  const opportunity = runPlaybooks(validateSignalBatch(getFixtureBatch()), BATCH_01_TIME).find((item) => item.sector === "ecosystem");
  assert.ok(opportunity?.actionPacket);
  const packet = opportunity.actionPacket;
  const accepted = await explainActionPacket(packet, async () => ({
    model: "test-model",
    output: {
      headline: "Synthetic Seattle retailer closure response",
      summary: "The fictional evidence passes the configured policy.",
      courseOfAction: packet.recommendedCourseOfAction,
      limitation: "This is fictional synthetic evidence and no real action was executed.",
      sourceIds: packet.sourceIds,
    },
  }));
  assert.equal(accepted.state, "available");
  assert.equal(accepted.origin, "ai");

  const rejected = await explainActionPacket(packet, async () => ({
    model: "test-model",
    output: {
      headline: "Synthetic Seattle retailer closure response",
      summary: "The fictional evidence passes the configured policy.",
      courseOfAction: "Launch a real campaign immediately.",
      limitation: "Synthetic evidence.",
      sourceIds: packet.sourceIds,
    },
  }));
  assert.equal(rejected.state, "validation_rejected");
  assert.equal(rejected.origin, "deterministic_fallback");
});

test("ActionPacket explanation falls back for missing configuration, timeout, and invalid structure", async () => {
  const opportunity = runPlaybooks(validateSignalBatch(getFixtureBatch()), BATCH_01_TIME).find((item) => item.sector === "ecosystem");
  assert.ok(opportunity?.actionPacket);
  const packet = opportunity.actionPacket;
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.equal((await explainActionPacket(packet)).state, "not_configured");
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
  const timeout = await explainActionPacket(packet, async () => {
    throw new ActionPacketExplanationError("timeout", "Synthetic timeout");
  });
  assert.equal(timeout.state, "timeout");
  const invalid = await explainActionPacket(packet, async () => ({ model: "test-model", output: { headline: "Incomplete" } }));
  assert.equal(invalid.state, "invalid_structure");
});

test("replaying the same batch does not create duplicate opportunities", () => {
  resetOpportunityInboxForTests();
  const first = runSyntheticDiscovery();
  const second = runSyntheticDiscovery();

  assert.equal(first.run.candidatesCreated, 3);
  assert.equal(second.run.candidatesCreated, 0);
  assert.equal(second.run.candidatesSuppressed, 3);
  assert.equal(getOpportunityInboxSnapshot().opportunities.length, 3);
});

test("human approval is required before a simulated delivery preview", () => {
  resetOpportunityInboxForTests();
  const { snapshot } = runSyntheticDiscovery();
  const opportunity = snapshot.opportunities.find((item) => item.sector === "marketing");
  assert.ok(opportunity);

  assert.throws(
    () => createDeliveryPreview(opportunity.opportunityId, { channel: "outlook" }),
    /Approve the opportunity/,
  );

  const reviewed = reviewOpportunity(opportunity.opportunityId, {
    action: "approve",
    reason: "Synthetic evidence is complete for the demonstration.",
    reviewer: "Test reviewer",
  });
  assert.equal(reviewed.state, "approved_for_routing");

  const delivered = createDeliveryPreview(opportunity.opportunityId, {
    channel: "outlook",
  });
  assert.equal(delivered.opportunity.state, "routed");
  assert.equal(delivered.receipt.status, "simulated");
  assert.match(delivered.receipt.message, /was not sent/);
});

test("playbooks are versioned synthetic definitions with explicit policy", () => {
  assert.equal(PLAYBOOKS.length, 3);
  for (const playbook of PLAYBOOKS) {
    assert.deepEqual(playbookDefinitionSchema.parse(playbook), playbook);
    assert.equal(playbook.evidenceStatus, "Hypothesis");
    assert.equal(playbook.allowedUse, "synthetic_prototype_only");
    assert.ok(playbook.requiredMetricIds.length > 0);
    assert.ok(playbook.conditions.length > 0);
  }
});

test("invalid batch retains deterministic quarantine receipts and reasons", () => {
  const batch = validateSignalBatch(getFixtureBatch("seattle-batch-invalid"));

  assert.equal(batch.events.length, 0);
  assert.equal(batch.quarantineReceipts.length, 2);
  assert.deepEqual(
    batch.quarantineReceipts.map((receipt) => receipt.receiptId),
    [
      "quarantine:seattle-batch-invalid:0",
      "quarantine:seattle-batch-invalid:1",
    ],
  );
  assert.equal(batch.quarantineReceipts.every((receipt) => receipt.reasons.length > 0), true);
});

test("batch validation fails closed outside exact Seattle geography", () => {
  const fixture = getFixtureBatch() as Record<string, unknown>;
  fixture.regionId = "cbsa:00000";
  assert.throws(() => validateSignalBatch(fixture));
});

test("second batch preserves null and contradiction while stale eligibility is blocked", () => {
  const opportunities = runPlaybooks(
    validateSignalBatch(getFixtureBatch("seattle-batch-02")),
    BATCH_02_TIME,
  );

  assert.deepEqual(opportunities.map((item) => item.sector), ["marketing"]);
  const marketing = opportunities[0];
  assert.equal(marketing.triggeringRuleResult, "insufficient_evidence");
  assert.equal(
    marketing.evidence.find((item) => item.metricId === "marketing_reach_index")?.rawValue,
    null,
  );
  assert.equal(
    marketing.evidence.find((item) => item.metricId === "delivery_ready")?.role,
    "contradicting",
  );
});

test("identical inputs and effective time produce stable domain records", () => {
  const batch = validateSignalBatch(getFixtureBatch());
  const first = runPlaybooks(batch, BATCH_01_TIME);
  const second = runPlaybooks(batch, BATCH_01_TIME);
  assert.deepEqual(second, first);
  assert.equal(first.every((item) => item.inputFingerprint.includes(batch.batchId)), true);
});

test("later valid evidence updates a stable opportunity without duplicating it", () => {
  const store = createInMemoryOpportunityStore();
  const first = runSyntheticDiscovery("seattle-batch-01", {
    store,
    effectiveAt: BATCH_01_TIME,
    idFactory: () => "first",
  });
  const second = runSyntheticDiscovery("seattle-batch-02", {
    store,
    effectiveAt: BATCH_02_TIME,
    idFactory: () => "second",
  });

  assert.equal(first.run.candidatesCreated, 3);
  assert.equal(second.run.candidatesUpdated, 1);
  assert.equal(second.snapshot.opportunities.length, 3);
  assert.equal(
    second.snapshot.opportunities.find((item) => item.sector === "marketing")?.batchId,
    "seattle-batch-02",
  );
});

test("expiration moves active records into retained history", () => {
  const store = createInMemoryOpportunityStore();
  runSyntheticDiscovery("seattle-batch-01", {
    store,
    effectiveAt: BATCH_01_TIME,
    idFactory: () => "first",
  });
  const result = runSyntheticDiscovery("seattle-batch-invalid", {
    store,
    effectiveAt: "2026-10-15T16:00:00.000Z",
    idFactory: () => "expiry",
  });

  assert.equal(result.run.candidatesExpired, 3);
  assert.equal(result.snapshot.opportunities.length, 0);
  assert.equal(result.snapshot.historicalOpportunities.length, 3);
  assert.equal(result.snapshot.historicalOpportunities.every((item) => item.state === "expired"), true);
});

test("cooldown calculation has explicit inclusive boundaries", () => {
  assert.equal(isWithinCooldown(BATCH_01_TIME, BATCH_02_TIME, 7), true);
  assert.equal(
    isWithinCooldown(BATCH_01_TIME, "2026-08-12T16:00:00.000Z", 7),
    false,
  );
});

test("outcome placeholder contract keeps evidence status explicit", () => {
  const outcome = outcomeObservationSchema.parse({
    opportunityId: "opp:test",
    actionType: "synthetic_investigation",
    owner: "Demo owner",
    outcomeDefinition: "Disposition time",
    startDate: "2026-08-05",
    endDate: null,
    resultSource: "SYN-OUTCOME-001",
    resultValue: null,
    evidenceStatus: "Unknown",
  });
  assert.equal(outcome.resultValue, null);
  assert.equal(outcome.evidenceStatus, "Unknown");
});

test("national monitoring covers the full non-scored CBSA universe", () => {
  const monitoring = buildNationalMonitoringSnapshot(null, []);

  assert.equal(monitoring.marketStatuses.length, 917);
  assert.equal(monitoring.portfolioMetrics.monitoredMarkets, 917);
  assert.equal(monitoring.portfolioMetrics.scannedMarkets, 0);
  assert.equal(
    monitoring.marketStatuses.every((market) => market.scoringEligibility === "none"),
    true,
  );
  assert.equal(
    monitoring.marketStatuses.every((market) => market.allowedUse === "synthetic_prototype_only"),
    true,
  );
});

test("completed national receipts reconcile qualified and exception markets", () => {
  const store = createInMemoryOpportunityStore();
  const result = runSyntheticDiscovery("seattle-batch-01", {
    store,
    effectiveAt: BATCH_01_TIME,
    idFactory: () => "national",
  });

  assert.equal(result.snapshot.portfolioMetrics.scannedMarkets, 917);
  assert.equal(result.snapshot.portfolioMetrics.qualifiedMarkets, 1);
  assert.equal(result.snapshot.portfolioMetrics.activeOpportunities, 3);
  assert.equal(result.snapshot.portfolioMetrics.exceptionMarkets, 4);
  assert.equal(result.snapshot.stageReceipts.find((item) => item.stageId === "detect")?.count, 917);
  assert.deepEqual(
    result.snapshot.activityEvents.map((event) => event.scanState),
    [
      "opportunity_qualified",
      "blocked_stale",
      "blocked_missing",
      "duplicate_suppressed",
      "quarantined",
    ],
  );
});

test("sector workspaces keep current and planned data visibly separate", () => {
  assert.deepEqual(Object.keys(SECTOR_WORKSPACES), [
    "growth-marketing",
    "pet-health",
    "market-ecosystem",
  ]);
  for (const workspace of Object.values(SECTOR_WORKSPACES)) {
    assert.equal(workspace.opportunities.length, 3);
    assert.equal(workspace.currentData.length, 4);
    assert.equal(workspace.plannedData.length, 4);
    assert.equal(workspace.currentData.every((item) => item.status === "Synthetic" || item.status === "Public context"), true);
    assert.equal(workspace.plannedData.every((item) => item.dependency.length > 0), true);
  }
});
