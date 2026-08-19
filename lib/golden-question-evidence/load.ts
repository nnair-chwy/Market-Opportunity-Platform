import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { goldenQuestionEvidenceSchema, type GoldenQuestionEvidence } from "./contracts.ts";

export type GoldenQuestionEvidenceLoadOptions = {
  path?: string;
};

export async function loadGoldenQuestionEvidence(
  options: GoldenQuestionEvidenceLoadOptions = {},
): Promise<GoldenQuestionEvidence> {
  const path = options.path
    ? resolve(options.path)
    : new URL("../../data/approved/golden-question-evidence/current.json", import.meta.url);
  const contents = await readFile(path, "utf8");
  return goldenQuestionEvidenceSchema.parse(JSON.parse(contents));
}
