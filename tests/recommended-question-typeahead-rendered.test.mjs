import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const typeahead = fs.readFileSync(new URL("../components/decision-workflow/RecommendedQuestionTypeahead.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../components/decision-workflow/AdaptiveEvaluationWorkspace.tsx", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../components/decision-workflow/DecisionWorkflowApp.tsx", import.meta.url), "utf8");

test("recommended-question typeahead preserves free entry and accessible keyboard selection", () => {
  assert.match(typeahead, /role="combobox"/);
  assert.match(typeahead, /aria-autocomplete="list"/);
  assert.match(typeahead, /role="listbox"/);
  assert.match(typeahead, /role="option"/);
  assert.match(typeahead, /aria-activedescendant/);
  for (const key of ["ArrowDown", "ArrowUp", "Escape", "Enter"]) {
    assert.match(typeahead, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(typeahead, /onChange\(event\.target\.value\)/);
  assert.match(typeahead, /onChange\(suggestion\.question\)/);
  assert.doesNotMatch(typeahead, /onSubmit/);
});

test("suggestions expose support metadata and separate saved, recommended, and related questions", () => {
  assert.match(typeahead, /Previous investigations/);
  assert.match(typeahead, /Recommended questions/);
  assert.match(typeahead, /Related questions/);
  assert.match(typeahead, /Available now/);
  assert.match(typeahead, /Partial answer/);
  assert.match(typeahead, /More evidence required/);
  assert.match(typeahead, /onOpenPrevious\(suggestion\.id\)/);
  assert.match(typeahead, /Open findings/);
  assert.match(typeahead, /limitTotal: 3/);
});

test("saved packet questions and the consolidated starter registry feed the same composer", () => {
  assert.match(workspace, /<RecommendedQuestionTypeahead/);
  assert.match(workspace, /previousInvestigations=\{savedPackets\}/);
  assert.match(workspace, /listStarterQuestions\(perspectiveId\)/);
  assert.match(workflow, /question: packet\.question/);
  assert.match(workflow, /onOpenSavedPacket=\{\(id\) => \{/);
  assert.match(workflow, /if \(packet\) openSavedPacket\(packet\)/);
});
