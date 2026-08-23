import { assert, normalizeText, sha256 } from "../utils.mjs";

const DEFAULT_WEIGHTS = {
  audience_situations: 0.3,
  problem_patterns: 0.3,
  content_goals: 0.2,
  product_tasks: 0.2,
};

function bigrams(value) {
  const text = normalizeText(value);
  if (!text) return new Set();
  if (text.length === 1) return new Set([text]);
  const result = new Set();
  for (let index = 0; index < text.length - 1; index += 1) {
    result.add(text.slice(index, index + 2));
  }
  return result;
}

export function phraseSimilarity(left, right) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 4) {
    return 0.9;
  }
  const aSet = bigrams(a);
  const bSet = bigrams(b);
  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap += 1;
  }
  return (2 * overlap) / Math.max(1, aSet.size + bSet.size);
}

function fieldScore(queryValues, cardValues) {
  if (!Array.isArray(queryValues) || queryValues.length === 0) return null;
  if (!Array.isArray(cardValues) || cardValues.length === 0) return 0;
  const scores = queryValues.map((query) =>
    Math.max(...cardValues.map((candidate) => phraseSimilarity(query, candidate))),
  );
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function validateStrategyCard(card) {
  assert(card && typeof card === "object" && !Array.isArray(card), "strategy card must be an object");
  for (const field of [
    "strategy_card_id",
    "strategy_card_version",
    "script_type",
    "status",
    "strategy_name",
    "strategy_summary",
  ]) {
    assert(card[field], `strategy card is missing ${field}`);
  }
  assert(card.retrieval_view && typeof card.retrieval_view === "object", "strategy card is missing retrieval_view");
  assert(card.generation_view && typeof card.generation_view === "object", "strategy card is missing generation_view");
  assert(card.transfer_boundary && typeof card.transfer_boundary === "object", "strategy card is missing transfer_boundary");
  assert(
    card.generation_view.narrator_profile?.dramatization_permission,
    "strategy card is missing dramatization_permission",
  );
  assert(
    card.generation_view.narrator_profile?.core_fact_boundary,
    "strategy card is missing core_fact_boundary",
  );
  assert(
    Array.isArray(card.generation_view.semantic_structure) &&
      card.generation_view.semantic_structure.length >= 3,
    "strategy card semantic_structure needs at least 3 sections",
  );
  return card;
}

function scoreCard(card, options) {
  const query = options.query || {};
  const allowedStatuses = new Set(options.allowedStatuses || ["published"]);
  const filteredReasons = [];

  if (!allowedStatuses.has(card.status)) {
    filteredReasons.push(`status_not_allowed:${card.status}`);
  }
  if (options.scriptType && card.script_type !== options.scriptType) {
    filteredReasons.push(`script_type_mismatch:${card.script_type}`);
  }

  const availableInputs = new Set(query.available_inputs || []);
  const missingInputs = (card.retrieval_view.required_inputs || []).filter(
    (item) => !availableInputs.has(item),
  );
  if (missingInputs.length > 0) {
    filteredReasons.push(`missing_inputs:${missingInputs.join(",")}`);
  }

  const activeExclusions = new Set(query.active_exclusion_ids || []);
  const hitExclusions = (card.retrieval_view.exclusion_conditions || [])
    .filter((item) => activeExclusions.has(item.condition_id))
    .map((item) => item.condition_id);
  if (hitExclusions.length > 0) {
    filteredReasons.push(`active_exclusions:${hitExclusions.join(",")}`);
  }

  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const fieldScores = {};
  let weightedSum = 0;
  let activeWeight = 0;
  for (const [field, weight] of Object.entries(weights)) {
    const score = fieldScore(query[field], card.retrieval_view[field]);
    fieldScores[field] = score;
    if (score !== null) {
      weightedSum += score * weight;
      activeWeight += weight;
    }
  }

  const score = activeWeight > 0 ? weightedSum / activeWeight : 0;
  return {
    strategy_card_id: card.strategy_card_id,
    strategy_card_version: card.strategy_card_version,
    eligible: filteredReasons.length === 0,
    score: Number(score.toFixed(6)),
    field_scores: fieldScores,
    matched_fields: Object.entries(fieldScores)
      .filter(([, value]) => typeof value === "number" && value > 0)
      .map(([field]) => field),
    filtered_reasons: filteredReasons,
  };
}

export function retrieveStrategy(cards, options = {}) {
  assert(Array.isArray(cards) && cards.length > 0, "at least one strategy card is required");
  cards.forEach(validateStrategyCard);

  const evaluations = cards.map((card) => scoreCard(card, options));
  const threshold = Number(options.threshold ?? 0);
  const candidates = evaluations
    .filter((entry) => entry.eligible && entry.score >= threshold)
    .sort((left, right) => right.score - left.score);

  let selectedEvaluation = candidates[0] || null;
  if (options.manualStrategyCardId) {
    selectedEvaluation = evaluations.find(
      (entry) => entry.strategy_card_id === options.manualStrategyCardId,
    );
    assert(selectedEvaluation, `manual strategy card not found: ${options.manualStrategyCardId}`);
    assert(
      selectedEvaluation.eligible,
      `manual strategy card is ineligible: ${selectedEvaluation.filtered_reasons.join(",")}`,
    );
  }

  const selectedCard = selectedEvaluation
    ? cards.find((card) => card.strategy_card_id === selectedEvaluation.strategy_card_id)
    : null;
  const fallback = !selectedCard;
  assert(!fallback || options.allowFallback === true, "no strategy card reached the retrieval threshold");

  return {
    retrieval_version: "deterministic_text_retrieval_v1",
    selection_mode: options.manualStrategyCardId ? "manual_override" : "automatic_top1",
    query_sha256: sha256(JSON.stringify(options.query || {})),
    threshold,
    selected_strategy_card_id: selectedCard?.strategy_card_id || null,
    selected_strategy_card_version: selectedCard?.strategy_card_version || null,
    score: selectedEvaluation?.score ?? null,
    matched_fields: selectedEvaluation?.matched_fields || [],
    fallback,
    evaluations,
    selected_card: selectedCard,
  };
}

