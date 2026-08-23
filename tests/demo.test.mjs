import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runDemo } from "../scripts/run-demo.mjs";

test("offline demo produces a complete reviewable package", async (context) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "video-agent-demo-"));
  context.after(() => rm(outputDirectory, { recursive: true, force: true }));

  const result = await runDemo({ outDir: outputDirectory });
  assert.equal(result.summary.blocking_ok, true);
  assert.equal(result.summary.release_decision, "human_review_required");
  assert.equal(result.summary.public_source_count, 3);

  const expectedFiles = [
    "retrieval_result.json",
    "compiled_request.json",
    "script.txt",
    "storyboard.json",
    "storyboard.md",
    "validation_report.json",
    "run_summary.json",
  ];
  const combined = (
    await Promise.all(expectedFiles.map((name) => readFile(path.join(outputDirectory, name), "utf8")))
  ).join("\n");
  assert.doesNotMatch(
    combined,
    /"(?:periodCostTotal|costTotal|spend|impressions|exposure|clicks|ctr|cvr|gmv|advv)"\s*:/iu,
  );
});
