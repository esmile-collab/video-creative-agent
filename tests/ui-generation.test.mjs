import assert from "node:assert/strict";
import test from "node:test";
import { generateScriptFromBrief } from "../app/generate.mjs";

test("generateScriptFromBrief returns a script and storyboard summary from a brief", async () => {
  const result = await generateScriptFromBrief({
    title: "AI 工作流入门",
    scriptType: "knowledge_explainer",
    audience: "刚接触 AI 的非技术创作者",
    goal: "解释最小可验证的视频工作流",
    confirmedFacts: [
      "一个最小视频工作流可以拆成 Brief、脚本、确认脚本、分镜和校验五个阶段。",
      "确认脚本进入分镜阶段后应冻结原文，分镜只增加画面说明。",
    ],
    creativePermissions: [
      "可以使用日常创作场景和第二人称提问。",
      "可以用先跑通一条，再逐步替换模块的教学顺序。",
    ],
    forbiddenClaims: [
      "不承诺收入、流量、转化或效率提升比例。",
    ],
    deliveryRequirements: [
      "口语化中文，控制在 60 至 90 秒。",
      "开头直接提出误区。",
    ],
  });

  assert.ok(result.script && result.script.length > 80);
  assert.ok(result.summary);
  assert.ok(Array.isArray(result.storyboard.segments));
  assert.ok(result.retrieval.selected_strategy_card_id || result.retrieval.fallback === true);
});
