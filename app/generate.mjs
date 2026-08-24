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

const DEFAULT_FORBIDDEN_CLAIMS = [
  "不承诺收入、流量、转化或效率提升比例。",
  "不虚构用户证言、机构背书、平台能力和实测数据。",
];

const DEFAULT_DELIVERY = [
  "口语化中文，控制在 60 至 90 秒。",
  "开头直接提出受众常见误区。",
  "结尾给出一个当天可以完成的最小行动。",
];

export function buildBrief(input = {}) {
  const title = String(input.title || "未命名项目").trim();
  const scriptType = String(input.scriptType || "knowledge_explainer").trim();
  const audience = String(input.audience || "对主题感兴趣的普通观众").trim();
  const product = String(input.product || "").trim();
  const keyMessage = String(input.keyMessage || input.goal || "讲清楚核心内容，并给出一个可执行的行动").trim();

  // 用户填写的核心事实与产品卖点都属于"已确认的事实边界"
  const confirmedFacts = [
    ...normalizeList(input.coreFacts ?? input.confirmedFacts),
    ...normalizeList(input.sellingPoints),
  ];
  const forbiddenClaims = normalizeList(input.forbiddenClaims);

  return [
    `# ${title}`,
    "",
    "## goal（目标）",
    product
      ? `"${scriptType}" 类型脚本，围绕「${product}」：${keyMessage}`
      : `"${scriptType}" 类型脚本，目标：${keyMessage}`,
    "",
    "## audience（受众）",
    `- ${audience}`,
    "",
    "## confirmed_facts（确认事实）",
    confirmedFacts.length > 0
      ? confirmedFacts.map((fact) => `- ${fact}`).join("\n")
      : `- ${product ? `脚本围绕「${product}」展开。` : "脚本只围绕用户提供的主题展开，不添加未经确认的信息。"}`,
    "",
    "## creative_permissions（创作许可）",
    "- 可以围绕用户提供的产品、卖点与表达重点展开，使用日常场景和第二人称提问。",
    "",
    "## forbidden_claims（禁止项）",
    (forbiddenClaims.length > 0 ? forbiddenClaims : DEFAULT_FORBIDDEN_CLAIMS).map((item) => `- ${item}`).join("\n"),
    "",
    "## delivery（交付要求）",
    DEFAULT_DELIVERY.map((item) => `- ${item}`).join("\n"),
    "",
  ].join("\n");
}

export async function generateScript(input = {}) {
  const [cards, baseSkill, approvedScript, publicSources] = await Promise.all([
    readJson(path.join(exampleDirectory, "strategy-cards.json")),
    readFile(path.join(exampleDirectory, "base-skill.md"), "utf8"),
    readFile(path.join(exampleDirectory, "approved-script.txt"), "utf8"),
    readJson(path.join(exampleDirectory, "public-sources.json")),
  ]);

  const brief = buildBrief(input);
  const scriptType = String(input.scriptType || "knowledge_explainer").trim();
  const audience = String(input.audience || "对主题感兴趣的普通观众").trim();
  const product = String(input.product || "").trim();
  const keyMessage = String(input.keyMessage || input.goal || "讲清楚核心内容，并给出一个可执行的行动").trim();

  const retrieval = retrieveStrategy(cards, {
    query: {
      audience_situations: [audience],
      problem_patterns: [String(input.problemPattern || "把单次生成当成稳定系统").trim() || "把单次生成当成稳定系统"],
      content_goals: [keyMessage, "给出可执行动作"],
      product_tasks: [scriptType, product || "知识讲解"],
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

  return {
    brief,
    script: generated.content.trim(),
    retrieval,
    summary: {
      run_id: compiledRequest.metadata.run_id,
      provider_id: provider.provider_id,
      model_id: provider.model_id,
      selected_strategy_card_id: retrieval.selected_strategy_card_id,
      retrieval_fallback: retrieval.fallback,
      script_characters: generated.content.trim().length,
      public_source_count: publicSources.length,
    },
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function generateStoryboard(script, options = {}) {
  const confirmedScript = String(script || "").trim();
  if (!confirmedScript) throw new Error("script_required");

  const { storyboard, validation } = buildStoryboard(confirmedScript, {
    charactersPerSecond: clampNumber(options.charactersPerSecond, 3, 10, 5.97),
    maximumCharacters: clampNumber(options.maximumCharacters, 10, 120, 42),
  });
  const evaluation = evaluateStoryboard({ storyboard, approvedScript: confirmedScript });

  return {
    storyboard,
    validation,
    evaluation,
    storyboardMarkdown: renderStoryboardMarkdown(storyboard, "生成结果分镜"),
    summary: {
      segment_count: storyboard.segments.length,
      estimated_total_duration_sec: storyboard.estimated_total_duration_sec,
      release_decision: evaluation.release_decision,
      blocking_ok: validation.blocking_ok,
      warning_count: validation.warnings.length,
    },
  };
}
