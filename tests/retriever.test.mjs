import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { retrieveStrategy } from "../core/strategy/retriever.mjs";

const cards = JSON.parse(
  await readFile(new URL("../examples/demo_001/strategy-cards.json", import.meta.url), "utf8"),
);
const query = JSON.parse(
  await readFile(new URL("../examples/demo_001/retrieval-query.json", import.meta.url), "utf8"),
);

test("retrieval selects the matching published card", () => {
  const result = retrieveStrategy(cards, {
    query,
    scriptType: "knowledge_explainer",
    threshold: 0.2,
    allowFallback: true,
  });
  assert.equal(result.selected_strategy_card_id, "knowledge_workflow_minimum_loop");
  assert.equal(result.selection_mode, "automatic_top1");
  assert.equal(result.fallback, false);
});

test("retrieval supports explicit fallback", () => {
  const result = retrieveStrategy(cards, {
    query: { audience_situations: ["完全无关主题"] },
    scriptType: "knowledge_explainer",
    threshold: 1,
    allowFallback: true,
  });
  assert.equal(result.selected_strategy_card_id, null);
  assert.equal(result.fallback, true);
});

test("manual override still respects hard exclusions", () => {
  assert.throws(
    () =>
      retrieveStrategy(cards, {
        query: { ...query, active_exclusion_ids: ["not_career_topic"] },
        scriptType: "knowledge_explainer",
        manualStrategyCardId: "career_capability_checklist",
        allowFallback: true,
      }),
    /manual strategy card is ineligible/u,
  );
});
