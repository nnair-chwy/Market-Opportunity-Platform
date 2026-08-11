import {
  CALCULATION_VERSION,
  deliveryPreviewRequestSchema,
  discoveryRunSchema,
  opportunitySchema,
  reviewRequestSchema,
  type DeliveryReceipt,
  type DiscoveryRun,
  type Opportunity,
  type OpportunityInboxSnapshot,
} from "./contracts.ts";
import { explainActionPacket, type ActionPacketModelCaller } from "./explanations.ts";
import { DEFAULT_BATCH_ID, getFixtureBatch } from "./fixtures.ts";
import { validateSignalBatch } from "./intake.ts";
import { expireOpportunity, isHistoricalOpportunity, isWithinCooldown, mergeOpportunityUpdate } from "./lifecycle.ts";
import { PLAYBOOKS, runPlaybooks } from "./playbooks.ts";
import { buildNationalMonitoringSnapshot } from "./national-monitoring.ts";

export interface OpportunityStore {
  get(opportunityId: string): Opportunity | undefined;
  findByDedupeKey(dedupeKey: string): Opportunity | undefined;
  list(): Opportunity[];
  save(opportunity: Opportunity): void;
  listRuns(): DiscoveryRun[];
  saveRun(run: DiscoveryRun): void;
  clear(): void;
}

export function createInMemoryOpportunityStore(): OpportunityStore {
  const opportunities = new Map<string, Opportunity>();
  const runs: DiscoveryRun[] = [];
  return {
    get: (id) => opportunities.has(id) ? structuredClone(opportunities.get(id)) : undefined,
    findByDedupeKey: (key) => {
      const found = [...opportunities.values()].find((item) => item.dedupeKey === key);
      return found ? structuredClone(found) : undefined;
    },
    list: () => [...opportunities.values()].map((item) => structuredClone(item)),
    save: (opportunity) => { opportunities.set(opportunity.opportunityId, opportunitySchema.parse(structuredClone(opportunity))); },
    listRuns: () => structuredClone(runs),
    saveRun: (run) => { runs.push(discoveryRunSchema.parse(structuredClone(run))); },
    clear: () => { opportunities.clear(); runs.length = 0; },
  };
}

const processGlobal = globalThis as typeof globalThis & {
  __opportunityInboxStore?: OpportunityStore;
};
const defaultStore = processGlobal.__opportunityInboxStore ?? createInMemoryOpportunityStore();
processGlobal.__opportunityInboxStore = defaultStore;

type OperationalOptions = {
  effectiveAt?: string;
  idFactory?: () => string;
  store?: OpportunityStore;
};

function operationalId() {
  return crypto.randomUUID();
}

function nextBatchId(runs: DiscoveryRun[]): string {
  if (!runs.some((run) => run.batchId === "seattle-batch-01")) return DEFAULT_BATCH_ID;
  return "seattle-batch-02";
}

function snapshot(store: OpportunityStore): OpportunityInboxSnapshot {
  const all = store.list().sort((a, b) => a.sector.localeCompare(b.sector));
  const runs = store.listRuns().slice(-10).reverse();
  const opportunities = all.filter((item) => !isHistoricalOpportunity(item));
  return {
    opportunities,
    historicalOpportunities: all.filter(isHistoricalOpportunity),
    runs,
    nextBatchId: nextBatchId(store.listRuns()),
    ...buildNationalMonitoringSnapshot(runs[0] ?? null, opportunities),
  };
}

export function getOpportunityInboxSnapshot(): OpportunityInboxSnapshot {
  return snapshot(defaultStore);
}

export function runSyntheticDiscovery(
  batchId = DEFAULT_BATCH_ID,
  options: OperationalOptions = {},
) {
  const store = options.store ?? defaultStore;
  const effectiveAt = options.effectiveAt ?? new Date().toISOString();
  const idFactory = options.idFactory ?? operationalId;
  const batch = validateSignalBatch(getFixtureBatch(batchId));
  let candidatesExpired = 0;
  for (const current of store.list()) {
    const expired = expireOpportunity(current, effectiveAt);
    if (expired.state !== current.state) {
      store.save(expired);
      candidatesExpired += 1;
    }
  }

  const candidates = runPlaybooks(batch, effectiveAt);
  let candidatesCreated = 0;
  let candidatesUpdated = 0;
  let candidatesSuppressed = 0;

  for (const candidate of candidates) {
    const existing = store.findByDedupeKey(candidate.dedupeKey);
    if (existing?.inputFingerprint === candidate.inputFingerprint) {
      candidatesSuppressed += 1;
      continue;
    }
    if (existing) {
      store.save(mergeOpportunityUpdate(existing, candidate));
      candidatesUpdated += 1;
      continue;
    }
    const playbook = PLAYBOOKS.find((item) => item.playbookId === candidate.playbookId);
    const coolingDown = playbook && store.list().some((item) =>
      item.playbookId === candidate.playbookId &&
      item.regionId === candidate.regionId &&
      !isHistoricalOpportunity(item) &&
      isWithinCooldown(item.detectedAt, candidate.detectedAt, playbook.cooldownDays)
    );
    if (coolingDown) {
      candidatesSuppressed += 1;
      continue;
    }
    store.save(candidate);
    candidatesCreated += 1;
  }

  const run = discoveryRunSchema.parse({
    runId: `run:${idFactory()}`,
    batchId,
    startedAt: effectiveAt,
    completedAt: effectiveAt,
    status: batch.quarantinedCount > 0 ? "completed_with_warnings" : "completed",
    acceptedObservations: batch.events.length,
    quarantinedObservations: batch.quarantinedCount,
    duplicateObservations: batch.duplicateObservationCount,
    candidatesCreated,
    candidatesUpdated,
    candidatesSuppressed,
    candidatesExpired,
    quarantineReceipts: batch.quarantineReceipts,
    inputVersion: `${batch.fixtureVersion}:${batch.batchId}`,
    calculationVersion: CALCULATION_VERSION,
    message: candidatesCreated || candidatesUpdated
      ? `Created ${candidatesCreated} and updated ${candidatesUpdated} synthetic opportunities; ecosystem ActionPackets were prepared automatically.`
      : "No new opportunities were created; existing candidates were suppressed or ineligible.",
  });
  store.saveRun(run);
  return { run: structuredClone(run), snapshot: snapshot(store) };
}

export async function enrichEcosystemActionPackets(
  opportunities: Opportunity[],
  options: OperationalOptions & { callModel?: ActionPacketModelCaller } = {},
) {
  const store = options.store ?? defaultStore;
  for (const candidate of opportunities) {
    const opportunity = store.get(candidate.opportunityId);
    if (!opportunity?.actionPacket) continue;
    const explanation = options.callModel
      ? await explainActionPacket(opportunity.actionPacket, options.callModel)
      : await explainActionPacket(opportunity.actionPacket);
    opportunity.actionPacketExplanation = explanation;
    opportunity.draft = {
      state: explanation.state === "available" ? "available" : "unavailable",
      headline: explanation.headline,
      explanation: explanation.summary,
      uncertainty: explanation.limitation,
      suggestedAction: explanation.courseOfAction,
      sourceIds: explanation.sourceIds,
      origin: explanation.origin,
      modelVersion: explanation.modelVersion,
      promptVersion: explanation.promptVersion,
    };
    opportunity.updatedAt = options.effectiveAt ?? opportunity.updatedAt;
    store.save(opportunity);
  }
  return snapshot(store);
}

export function reviewOpportunity(
  opportunityId: string,
  input: unknown,
  options: OperationalOptions = {},
) {
  const store = options.store ?? defaultStore;
  const request = reviewRequestSchema.parse(input);
  const opportunity = store.get(opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  if (opportunity.actionPacket) throw new Error("Ecosystem ActionPackets do not use a human approval or validation gate.");
  if (["dismissed", "expired", "routed"].includes(opportunity.state)) throw new Error("This opportunity is no longer available for review.");
  const priorState = opportunity.state;
  const nextState = request.action === "approve" ? "approved_for_routing" : request.action === "dismiss" ? "dismissed" : "needs_review";
  opportunity.state = nextState;
  opportunity.updatedAt = options.effectiveAt ?? new Date().toISOString();
  opportunity.humanDisposition = request.action === "approve" ? "approved" : request.action === "dismiss" ? "dismissed" : "evidence_requested";
  opportunity.reviewDecisions.push({
    decisionId: `decision:${(options.idFactory ?? operationalId)()}`,
    action: request.action,
    priorState,
    nextState,
    reason: request.reason,
    reviewer: request.reviewer,
    decidedAt: opportunity.updatedAt,
  });
  store.save(opportunity);
  return structuredClone(opportunity);
}

export function createDeliveryPreview(
  opportunityId: string,
  input: unknown,
  options: OperationalOptions = {},
) {
  const store = options.store ?? defaultStore;
  const request = deliveryPreviewRequestSchema.parse(input);
  const opportunity = store.get(opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  const isPreparedEcosystem = Boolean(opportunity.actionPacket) && ["prepared", "blocked", "stopped"].includes(opportunity.state);
  if (!isPreparedEcosystem && opportunity.state !== "approved_for_routing" && opportunity.state !== "routed") throw new Error("Approve the opportunity before preparing stakeholder communication.");
  const generatedAt = options.effectiveAt ?? new Date().toISOString();
  const packet = opportunity.actionPacket;
  const explanation = opportunity.actionPacketExplanation;
  const receipt: DeliveryReceipt = {
    receiptId: `delivery:${(options.idFactory ?? operationalId)()}`,
    channel: request.channel,
    intendedStakeholder: packet?.accountableOwner.displayName ?? opportunity.owner,
    subject: `[Synthetic demo] ${opportunity.draft.headline}`,
    message: packet && explanation ? [
      `System disposition: ${packet.systemDisposition}.`,
      explanation.summary,
      `Prepared course of action: ${packet.recommendedCourseOfAction}`,
      `Accountable owner: ${packet.accountableOwner.displayName} (${packet.accountableOwner.role}).`,
      `Deadline: ${packet.deadline.dueAt}.`,
      `Remaining blockers: ${packet.remainingBlockers.length ? packet.remainingBlockers.map((item) => item.label).join("; ") : "None"}.`,
      `Important limitation: ${explanation.limitation}`,
      "This is a proof-of-concept preview. It was not sent, and no real action was executed.",
    ].join("\n\n") : [
      `${opportunity.regionName} has a synthetic ${opportunity.sectorLabel.toLowerCase()} opportunity ready for review.`,
      opportunity.draft.explanation,
      `Suggested next step: ${opportunity.draft.suggestedAction}`,
      `Important limitation: ${opportunity.draft.uncertainty}`,
      "This is a proof-of-concept message and was not sent.",
    ].join("\n\n"),
    status: "simulated",
    generatedAt,
  };
  opportunity.deliveryReceipts.push(receipt);
  if (!isPreparedEcosystem) opportunity.state = "routed";
  opportunity.updatedAt = generatedAt;
  store.save(opportunity);
  return { opportunity: structuredClone(opportunity), receipt };
}

export function resetOpportunityInboxForTests() {
  defaultStore.clear();
}

export function resetOpportunityInboxDemo() {
  defaultStore.clear();
  return snapshot(defaultStore);
}
