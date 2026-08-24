import assert from "node:assert/strict";
import test from "node:test";
import { generateScript, generateStoryboard } from "../app/generate.mjs";

const demoInput = {
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
};

test("generateScript returns only the script for user review, no storyboard yet", async () => {
  const result = await generateScript(demoInput);

  assert.ok(result.script && result.script.length > 80);
  assert.ok(result.summary.selected_strategy_card_id || result.summary.retrieval_fallback === true);
  assert.equal("storyboard" in result, false);

  // 用户输入的卖点与事实应进入内部 Brief 的确认事实边界
  assert.ok(result.brief.includes("把写需求、生成脚本、生成分镜和自动校验串成一条可验证的工作流。"));
  assert.ok(result.brief.includes("Video Creative Agent"));
});

test("generateScript works with minimal input and safe defaults", async () => {
  const result = await generateScript({ title: "冒烟测试" });

  assert.ok(result.script && result.script.length > 80);
  assert.ok(result.brief.includes("不承诺收入、流量、转化或效率提升比例。"));
});

test("generateStoryboard builds an adjustable storyboard from the confirmed script", async () => {
  const { script } = await generateScript(demoInput);
  const result = generateStoryboard(script);

  assert.ok(result.storyboard.segments.length > 0);
  for (const segment of result.storyboard.segments) {
    assert.ok(Number.isInteger(segment.start_sec));
    assert.ok(Number.isInteger(segment.end_sec));
    assert.ok(segment.visual_type);
    assert.ok(segment.caption.trim().length > 0);
  }
  assert.equal(result.summary.blocking_ok, true);
  assert.ok(result.storyboardMarkdown.includes("| 段落 |"));
});

test("generateStoryboard respects pacing options and rejects empty scripts", async () => {
  const { script } = await generateScript(demoInput);
  const slower = generateStoryboard(script, { charactersPerSecond: 4 });
  const faster = generateStoryboard(script, { charactersPerSecond: 8 });

  assert.ok(slower.summary.estimated_total_duration_sec > faster.summary.estimated_total_duration_sec);
  assert.throws(() => generateStoryboard("   "), /script_required/);
});
