import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { scanRepo } from "../scripts/check-public-safety.mjs";

test("safety scan accepts public text and rejects private metrics", async (context) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "video-agent-safety-"));
  context.after(() => rm(fixture, { recursive: true, force: true }));

  await writeFile(path.join(fixture, "public.json"), '{"title":"公开案例"}\n', "utf8");
  assert.equal((await scanRepo(fixture)).ok, true);

  const privateMetricKey = ["im", "pressions"].join("");
  await writeFile(
    path.join(fixture, "private.json"),
    `${JSON.stringify({ [privateMetricKey]: 1200 })}\n`,
    "utf8",
  );
  const result = await scanRepo(fixture);
  assert.equal(result.ok, false);
  assert.ok(result.violations.some((entry) => entry.code === "private_business_metric"));
});
