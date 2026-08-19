import { z } from "zod";

const findingIdSchema = z.string().trim().min(1).max(180);

export const insightDiscoveryRequestSchema = z.object({
  previousRunId: z.string().trim().min(1).max(180).optional(),
  previousPrimaryFindingIds: z.array(findingIdSchema).max(50).default([]),
  explorationCursor: z.string().trim().min(1).max(8000).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.previousPrimaryFindingIds.length || value.explorationCursor) && !value.previousRunId) {
    ctx.addIssue({ code: "custom", path: ["previousRunId"], message: "A rerun must identify the previous run." });
  }
});

const cursorPayloadSchema = z.object({
  version: z.literal("insight-discovery-cursor-v1"),
  runId: z.string().min(1),
  runSequence: z.number().int().positive(),
  snapshotFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  excludedPrimaryFindingIds: z.array(findingIdSchema).max(200),
}).strict();

export type InsightDiscoveryRequest = z.infer<typeof insightDiscoveryRequestSchema>;
export type InsightDiscoveryCursorPayload = z.infer<typeof cursorPayloadSchema>;

export function encodeInsightDiscoveryCursor(payload: InsightDiscoveryCursorPayload) {
  return Buffer.from(JSON.stringify(cursorPayloadSchema.parse(payload)), "utf8").toString("base64url");
}

export function decodeInsightDiscoveryCursor(cursor: string) {
  try {
    return cursorPayloadSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw new Error("The exploration cursor is invalid or no longer supported.");
  }
}
