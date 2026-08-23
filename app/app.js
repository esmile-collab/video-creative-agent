const form = document.getElementById("brief-form");
const resultPanel = document.getElementById("result-panel");
const summaryGrid = document.getElementById("summary-grid");
const scriptOutput = document.getElementById("script-output");
const storyboardOutput = document.getElementById("storyboard-output");
const statusTag = document.getElementById("status-tag");
const resetButton = document.getElementById("reset-form");
const useDemoButton = document.getElementById("use-demo");

function parseMultiline(value) {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildPayload(formElement) {
  const formData = new FormData(formElement);
  return {
    title: formData.get("title")?.trim() || "未命名项目",
    scriptType: formData.get("scriptType") || "knowledge_explainer",
    audience: formData.get("audience")?.trim() || "",
    product: formData.get("product")?.trim() || "",
    sellingPoints: parseMultiline(formData.get("sellingPoints") || ""),
    coreFacts: parseMultiline(formData.get("coreFacts") || ""),
    keyMessage: formData.get("keyMessage")?.trim() || "",
    forbiddenClaims: parseMultiline(formData.get("forbiddenClaims") || ""),
  };
}

function renderSummary(summary) {
  const items = [
    ["策略卡", summary.selected_strategy_card_id || "回退模式"],
    ["分段数", String(summary.segment_count || 0)],
    ["时长", `${summary.estimated_total_duration_sec || 0} 秒`],
    ["状态", summary.release_decision || "unknown"],
    ["阻断检查", summary.blocking_ok ? "通过" : "失败"],
    ["来源数", String(summary.public_source_count || 0)],
  ];

  summaryGrid.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="summary-item">
          <label>${label}</label>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");
}

function setStatus(state, label) {
  statusTag.className = `status-tag ${state || ""}`.trim();
  statusTag.textContent = label;
}

async function submitBrief(event) {
  event.preventDefault();
  const payload = buildPayload(form);
  setStatus("warning", "生成中");
  resultPanel.classList.remove("hidden");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok || !json.ok) {
      throw new Error(json.error || "生成失败");
    }

    const { script, summary, storyboardMarkdown } = json.data;
    scriptOutput.textContent = script;
    storyboardOutput.textContent = storyboardMarkdown || JSON.stringify(storyboardMarkdown || "", null, 2);
    renderSummary(summary);
    setStatus(summary.blocking_ok ? "success" : "warning", summary.release_decision || "已生成");
  } catch (error) {
    scriptOutput.textContent = `生成失败：${error.message}`;
    storyboardOutput.textContent = "请检查表单字段或后端服务状态。";
    renderSummary({
      selected_strategy_card_id: "error",
      segment_count: 0,
      estimated_total_duration_sec: 0,
      release_decision: "error",
      blocking_ok: false,
      public_source_count: 0,
    });
    setStatus("warning", "失败");
  }
}

function fillDemo() {
  form.title.value = "AI 工作流入门";
  form.scriptType.value = "knowledge_explainer";
  form.audience.value = "刚接触 AI 的非技术创作者";
  form.product.value = "Video Creative Agent（视频创意 Agent）";
  form.sellingPoints.value = "把写需求、生成脚本、生成分镜和自动校验串成一条可验证的工作流。\n无需 API Key，本地就能跑通完整演示。";
  form.coreFacts.value = "一个最小视频工作流可以拆成 Brief、脚本、确认脚本、分镜和校验五个阶段。\n确认脚本进入分镜阶段后应冻结原文，分镜只增加画面说明。\n自动校验可以检查结构完整性，最终画面质量仍需人工确认。";
  form.keyMessage.value = "解释一个最小可验证的视频工作流，并给出当天可以完成的最小行动。";
  form.forbiddenClaims.value = "不承诺收入、流量、转化或效率提升比例。\n不虚构用户证言、机构背书、平台能力和实测数据。";
}

function resetForm() {
  form.reset();
  scriptOutput.textContent = "";
  storyboardOutput.textContent = "";
  summaryGrid.innerHTML = "";
  resultPanel.classList.add("hidden");
  setStatus("", "生成中");
}

form.addEventListener("submit", submitBrief);
resetButton.addEventListener("click", resetForm);
useDemoButton.addEventListener("click", fillDemo);
fillDemo();
