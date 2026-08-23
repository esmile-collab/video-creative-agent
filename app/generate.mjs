import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateStoryboard } from "../core/evaluation/storyboard-eval.mjs";
import { createMockProvider } from "../core/providers/mock.mjs";
import { buildStoryboard, renderStoryboardMarkdown } from "../core/storyboard/pipeline.mjs";
import { compileScriptRequest } from "../core/strategy/compiler.mjs";
import { retrieveStrategy } from "../core/strategy/retriever.mjs";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(appDirectory, "..");
const exampleDirectory = path.join(rootDirectory, "examples/demo_001");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function normalizeList(list) {
  if (Array.isArray(list)) return list.filter(Boolean).map((item) => String(item).trim());
  return [];
}

export function buildBrief(input = {}) {
  const title = String(input.title || "AI 视频脚本生成").trim();
  const scriptType = String(input.scriptType || "knowledge_explainer").trim();
  const audience = String(input.audience || "会使用对话模型但没有工程背景的创作者").trim();
  const goal = String(input.goal || "解释一个可验证的最小视频工作流").trim();

  const confirmedFacts = normalizeList(input.confirmedFacts);
  const creativePermissions = normalizeList(input.creativePermissions);
  const forbiddenClaims = normalizeList(input.forbiddenClaims);
  const deliveryRequirements = normalizeList(input.deliveryRequirements);

  return [
    `# ${title}`,
    "",
    "## goal（目标）",
    `"${scriptType}" 类型脚本，目标：${goal}`,
    "",
    "## audience（受众）",
    `- ${audience}`,
    "",
    "## confirmed_facts（确认事实）",
    confirmedFacts.length > 0 ? confirmedFacts.map((fact) => `- ${fact}`).join("\n") : "- 一个最小视频工作流可以拆成 Brief、脚本、确认脚本、分镜和校验五个阶段。",
    "",
    "## creative_permissions（创作许可）",
    creativePermissions.length > 0 ? creativePermissions.map((item) => `- ${item}`).join("\n") : "- 可以使用日常创作场景和第二人称提问。",
    "",
    "## forbidden_claims（禁止项）",
    forbiddenClaims.length > 0 ? forbiddenClaims.map((item) => `- ${item}`).join("\n") : "- 不虚构用户证言、机构背书、平台能力和实测数据。",
    "",
    "## delivery（交付要求）",
    deliveryRequirements.length > 0 ? deliveryRequirements.map((item) => `- ${item}`).join("\n") : "- 口语化中文，控制在 60 至 90 秒。",
    "",
  ].join("\n");
}

export async function generateScriptFromBrief(input = {}) {
  const [cards, baseSkill, approvedScript, publicSources] = await Promise.all([
    readJson(path.join(exampleDirectory, "strategy-cards.json")),
    readFile(path.join(exampleDirectory, "base-skill.md"), "utf8"),
    readFile(path.join(exampleDirectory, "approved-script.txt"), "utf8"),
    readJson(path.join(exampleDirectory, "public-sources.json")),
  ]);

  const brief = buildBrief(input);
  const scriptType = String(input.scriptType || "knowledge_explainer").trim();
  const audience = String(input.audience || "会使用对话模型但没有工程背景的创作者").trim();
  const goal = String(input.goal || "解释一个可验证的最小视频工作流").trim();

  const retrieval = retrieveStrategy(cards, {
    query: {
      audience_situations: [audience],
      problem_patterns: [String(input.problemPattern || "把单次生成当成稳定系统").trim() || "把单次生成当成稳定系统"],
      content_goals: [goal, "给出可执行动作"],
      product_tasks: [scriptType, "知识讲解"],
      available_inputs: ["confirmed_facts", "forbidden_claims", "creative_permissions"],
    },
    scriptType,
    threshold: 0.2,
    allowFallback: true,
  });

  const compiledRequest = compileScriptRequest({
    brief,
    baseSkill,
    retrieval,
    outputContract: {
      language: "zh-CN",
      duration_seconds: [60, 90],
      format: "plain_text",
    },
    runId: `ui_${Date.now()}`,
  });

  const provider = createMockProvider(approvedScript);
  const generated = await provider.generateScript(compiledRequest);
  const { storyboard, validation } = buildStoryboard(generated.content);
  const evaluation = evaluateStoryboard({ storyboard, approvedScript: generated.content });

  const summary = {
    run_id: compiledRequest.metadata.run_id,
    provider_id: provider.provider_id,
    model_id: provider.model_id,
    selected_strategy_card_id: retrieval.selected_strategy_card_id,
    retrieval_fallback: retrieval.fallback,
    segment_count: storyboard.segments.length,
    estimated_total_duration_sec: storyboard.estimated_total_duration_sec,
    release_decision: evaluation.release_decision,
    blocking_ok: validation.blocking_ok,
    public_source_count: publicSources.length,
  };

  return {
    brief,
    compiledRequest,
    script: generated.content.trim(),
    retrieval,
    storyboard,
    validation,
    evaluation,
    summary,
    storyboardMarkdown: renderStoryboardMarkdown(storyboard, "生成结果分镜"),
  };
}
