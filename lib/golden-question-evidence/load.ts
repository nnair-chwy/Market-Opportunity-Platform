import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import checkedInGoldenQuestionEvidence from "../../data/approved/golden-question-evidence/current.json" with { type: "json" };
import { goldenQuestionEvidenceSchema, type GoldenQuestionEvidence } from "./contracts.ts";

export type GoldenQuestionEvidenceLoadOptions = {
  path?: string;
};

export async function loadGoldenQuestionEvidence(
  options: GoldenQuestionEvidenceLoadOptions = {},
): Promise<GoldenQuestionEvidence> {
  if (!options.path) {
    // Keep the approved default snapshot in the server bundle. Some local web
    // runtimes do not preserve import.meta.url as a readable filesystem path.
    return goldenQuestionEvidenceSchema.parse(checkedInGoldenQuestionEvidence);
  }
  const contents = await readFile(resolve(options.path), "utf8");
  return goldenQuestionEvidenceSchema.parse(JSON.parse(contents));
}
