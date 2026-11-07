import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
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

test("only the designated showcase media are allowed, within the upload size limit", async (context) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "video-agent-showcase-"));
  context.after(() => rm(fixture, { recursive: true, force: true }));
  const mediaDirectory = path.join(fixture, "showcase", "media");
  await mkdir(mediaDirectory, { recursive: true });
  const approved = path.join(mediaDirectory, "script-assembly.mp4");
  await writeFile(approved, Buffer.from("public demo fixture"));
  assert.equal((await scanRepo(fixture)).ok, true);

  const unapproved = path.join(mediaDirectory, "external-reference.mp4");
  await writeFile(unapproved, Buffer.from("reference fixture"));
  let result = await scanRepo(fixture);
  assert.ok(result.violations.some((entry) => entry.file.endsWith("external-reference.mp4")));
  await rm(unapproved);

  await truncate(approved, 25 * 1024 * 1024 + 1);
  result = await scanRepo(fixture);
  assert.equal(result.ok, false);
});
