import seattleBatch01 from "../../data/fixtures/opportunity-inbox/seattle-batch-01.synthetic.json" with { type: "json" };
import seattleBatch02 from "../../data/fixtures/opportunity-inbox/seattle-batch-02.synthetic.json" with { type: "json" };
import seattleBatchInvalid from "../../data/fixtures/opportunity-inbox/seattle-batch-invalid.synthetic.json" with { type: "json" };

const FIXTURE_BATCHES: Readonly<Record<string, unknown>> = {
  "seattle-batch-01": seattleBatch01,
  "seattle-batch-02": seattleBatch02,
  "seattle-batch-invalid": seattleBatchInvalid,
};

export const DEFAULT_BATCH_ID = "seattle-batch-01";

export function getFixtureBatch(batchId = DEFAULT_BATCH_ID): unknown {
  const batch = FIXTURE_BATCHES[batchId];
  if (!batch) {
    throw new Error(`Unknown synthetic opportunity batch: ${batchId}.`);
  }
  return structuredClone(batch);
}

export function availableFixtureBatchIds(): string[] {
  return Object.keys(FIXTURE_BATCHES);
}
