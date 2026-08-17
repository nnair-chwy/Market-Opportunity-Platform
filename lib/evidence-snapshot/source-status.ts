import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const sourceFileStatusSchema = z.object({
  file: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  qualityStatus: z.enum(["valid", "warning", "not_assessed", "blocked"]),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  allowedUse: z.string().min(1),
  browserAiExposure: z.enum(["public", "aggregate_only", "none"]),
  geographicGrain: z.string().min(1),
});

export const sourceFamilyStatusSchema = z.object({
  sourceFamily: z.enum(["general_regional", "clinic", "google_ads", "seo", "pricing", "competitor"]),
  status: z.enum(["loaded", "registered_context_only", "present_unregistered", "unavailable"]),
  evidenceStatus: z.enum(["Reported", "Unknown"]),
  qualityStatus: z.enum(["valid", "warning", "not_assessed", "blocked"]),
  geographyStatus: z.enum(["stable_keys_available", "partial_stable_keys", "matched_location_label_only", "national_no_geography", "unreviewed_geography_present", "unavailable"]),
  allowedUse: z.string().min(1),
  files: z.array(sourceFileStatusSchema),
  limitations: z.array(z.string()),
});

export const sourceStatusManifestSchema = z.object({
  manifestVersion: z.literal("demo-source-status-v1"),
  snapshotVersion: z.string().min(1),
  builtAt: z.string().datetime(),
  rawExportsCopied: z.literal(false),
  families: z.array(sourceFamilyStatusSchema).length(6),
}).superRefine((value, ctx) => {
  const names = value.families.map((family) => family.sourceFamily);
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Source family statuses must be unique.", path: ["families"] });
  for (const family of value.families) {
    if (family.status === "unavailable" && family.files.length) ctx.addIssue({ code: "custom", message: "Unavailable source families cannot contain files.", path: ["families", names.indexOf(family.sourceFamily), "files"] });
    if (family.status !== "unavailable" && !family.files.length) ctx.addIssue({ code: "custom", message: "Present source families must contain file metadata.", path: ["families", names.indexOf(family.sourceFamily), "files"] });
  }
});

export type SourceFileStatus = z.infer<typeof sourceFileStatusSchema>;
export type SourceFamilyStatus = z.infer<typeof sourceFamilyStatusSchema>;
export type SourceStatusManifest = z.infer<typeof sourceStatusManifestSchema>;

export async function loadSourceStatus(snapshotDir: string): Promise<SourceStatusManifest> {
  return sourceStatusManifestSchema.parse(JSON.parse(await readFile(join(snapshotDir, "source-status.json"), "utf8")));
}

export function sourceFamily(status: SourceStatusManifest, family: SourceFamilyStatus["sourceFamily"]): SourceFamilyStatus {
  const result = status.families.find((item) => item.sourceFamily === family);
  if (!result) throw new Error(`Source family ${family} is absent from the source-status manifest.`);
  return result;
}
