import { sha256, stripFrontmatter } from "../utils.mjs";

export function compileScriptRequest({
  brief,
  baseSkill,
  retrieval,
  outputContract = {},
  runId = null,
}) {
  const selectedCard = retrieval.selected_card;
  const systemPrompt = [
    "你正在生成一份中文口播脚本。",
    "只使用本次消息中的 Brief（任务简报）、基础 Skill（生成规则）和已发布策略卡。",
    "策略卡只提供结构、叙事与表达方法，不能提供当前主题或商品事实。",
    "当前事实只以 Brief（任务简报）的 confirmed_facts（确认事实）为准。",
    "不得新增数据、功效、认证、医学结论、机构背书、真实证言或其他未确认事实。",
    "直接返回最终脚本，不展示隐藏推理过程。",
    "",
    "===== BASE_SKILL（基础生成规则） =====",
    stripFrontmatter(baseSkill),
    "===== END BASE_SKILL（基础生成规则） =====",
  ].join("\n");

  const strategyView = selectedCard
    ? {
        strategy_card_id: selectedCard.strategy_card_id,
        strategy_card_version: selectedCard.strategy_card_version,
        strategy_name: selectedCard.strategy_name,
        strategy_summary: selectedCard.strategy_summary,
        generation_view: selectedCard.generation_view,
        transfer_boundary: selectedCard.transfer_boundary,
      }
    : null;

  const userPrompt = [
    "===== CURRENT_BRIEF（当前任务简报） =====",
    brief.trim(),
    "===== END CURRENT_BRIEF（当前任务简报） =====",
    "",
    "===== RETRIEVED_STRATEGY（召回策略） =====",
    strategyView
      ? JSON.stringify(strategyView, null, 2)
      : "没有合格策略卡，使用 Brief（任务简报）与基础 Skill（生成规则）回退生成。",
    "===== END RETRIEVED_STRATEGY（召回策略） =====",
    "",
    "===== OUTPUT_CONTRACT（输出合同） =====",
    JSON.stringify(outputContract, null, 2),
    "===== END OUTPUT_CONTRACT（输出合同） =====",
  ].join("\n");

  const promptSha256 = sha256(`${systemPrompt}\n${userPrompt}`);
  return {
    format: "script_request_v1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    inference_params: {},
    metadata: {
      run_id: runId,
      compile_version: "script_compiler_v1",
      brief_sha256: sha256(brief),
      base_skill_sha256: sha256(baseSkill),
      prompt_sha256: promptSha256,
      retrieval: {
        retrieval_version: retrieval.retrieval_version,
        selected_strategy_card_id: retrieval.selected_strategy_card_id,
        selected_strategy_card_version: retrieval.selected_strategy_card_version,
        score: retrieval.score,
        fallback: retrieval.fallback,
      },
    },
  };
}

