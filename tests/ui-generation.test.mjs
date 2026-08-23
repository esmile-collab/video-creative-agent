import assert from "node:assert/strict";
import test from "node:test";
import { generateScriptFromBrief } from "../app/generate.mjs";

test("generateScriptFromBrief returns a script and storyboard summary from user-friendly input", async () => {
  const result = await generateScriptFromBrief({
    title: "AI 工作流入门",
    scriptType: "knowledge_explainer",
    audience: "刚接触 AI 的非技术创作者",
    product: "Video Creative Agent",
    sellingPoints: [
      "把写需求、生成脚本、生成分镜和自动校验串成一条可验证的工作流。",
    ],
    coreFacts: [
      "一个最小视频工作流可以拆成 Brief、脚本、确认脚本、分镜和校验五个阶段。",
      "确认脚本进入分镜阶段后应冻结原文，分镜只增加画面说明。",
    ],
    keyMessage: "解释最小可验证的视频工作流",
    forbiddenClaims: [
      "不承诺收入、流量、转化或效率提升比例。",
    ],
  });

  assert.ok(result.script && result.script.length > 80);
  assert.ok(result.summary);
  assert.ok(Array.isArray(result.storyboard.segments));
  assert.ok(result.retrieval.selected_strategy_card_id || result.retrieval.fallback === true);

  // 用户输入的卖点与事实应进入内部 Brief 的确认事实边界
  assert.ok(result.brief.includes("把写需求、生成脚本、生成分镜和自动校验串成一条可验证的工作流。"));
  assert.ok(result.brief.includes("Video Creative Agent"));
});

test("generateScriptFromBrief works with minimal input and safe defaults", async () => {
  const result = await generateScriptFromBrief({
    title: "冒烟测试",
  });

  assert.ok(result.script && result.script.length > 80);
  assert.ok(result.brief.includes("不承诺收入、流量、转化或效率提升比例。"));
});
