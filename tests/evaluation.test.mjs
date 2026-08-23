import assert from "node:assert/strict";
import test from "node:test";
import { boundaryF1 } from "../core/evaluation/storyboard-eval.mjs";

test("boundary F1 reports exact and tolerant matches", () => {
  assert.deepEqual(boundaryF1([10, 20], [10, 20], 0), {
    matches: 2,
    precision: 1,
    recall: 1,
    f1: 1,
  });
  assert.equal(boundaryF1([12, 25], [10, 20], 2).matches, 1);
  assert.equal(boundaryF1([], [], 0).f1, 1);
});
