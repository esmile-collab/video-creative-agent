import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildStoryboard, validateStoryboard } from "../core/storyboard/pipeline.mjs";
import { normalizeText } from "../core/utils.mjs";

const approvedScript = await readFile(
  new URL("../examples/demo_001/approved-script.txt", import.meta.url),
  "utf8",
);

test("storyboard preserves approved script and continuous timing", () => {
  const { storyboard, validation } = buildStoryboard(approvedScript);
  assert.equal(validation.blocking_ok, true);
  assert.equal(
    normalizeText(storyboard.segments.map((segment) => segment.asr_text).join("")),
    normalizeText(approvedScript),
  );
  storyboard.segments.forEach((segment, index) => {
    assert.equal(segment.start_sec, index === 0 ? 0 : storyboard.segments[index - 1].end_sec);
  });
});

test("validator blocks a changed approved script", () => {
  const { storyboard } = buildStoryboard(approvedScript);
  storyboard.segments[0].asr_text = "被改写的口播。";
  const result = validateStoryboard(storyboard, approvedScript);
  assert.equal(result.blocking_ok, false);
  assert.ok(result.hard_failures.includes("approved_script_not_preserved"));
});
