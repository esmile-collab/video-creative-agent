const form = document.getElementById("brief-form");
const scriptPanel = document.getElementById("script-panel");
const scriptSummary = document.getElementById("script-summary");
const scriptEditor = document.getElementById("script-editor");
const scriptStatus = document.getElementById("script-status");
const regenerateButton = document.getElementById("regenerate-script");
const confirmButton = document.getElementById("confirm-script");
const storyboardPanel = document.getElementById("storyboard-panel");
const storyboardSummary = document.getElementById("storyboard-summary");
const storyboardBody = document.getElementById("storyboard-body");
const storyboardStatus = document.getElementById("storyboard-status");
const rateInput = document.getElementById("opt-rate");
const maxCharsInput = document.getElementById("opt-max-chars");
const applyOptionsButton = document.getElementById("apply-options");
const exportButton = document.getElementById("export-markdown");
const resetButton = document.getElementById("reset-form");
const useDemoButton = document.getElementById("use-demo");

const VISUAL_TYPE_OPTIONS = [
  ["digital_human", "数字人口播"],
  ["ai_visual", "AI 场景画面"],
  ["explanatory_graphic", "图解说明"],
  ["user_asset", "自有素材"],
];

const state = {
  payload: null,
  title: "storyboard",
  storyboard: null,
};

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

function setStatus(element, stateName, label) {
  element.className = `status-tag ${stateName || ""}`.trim();
  element.textContent = label;
}

function renderSummary(container, items) {
  container.innerHTML = items
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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(json.error || "请求失败");
  }
  return json.data;
}

// ---- 第 2 步：文案脚本 ----

async function submitBrief(event) {
  event.preventDefault();
  state.payload = buildPayload(form);
  state.title = state.payload.title;
  await requestScript();
}

async function requestScript() {
  setStatus(scriptStatus, "warning", "生成中");
  scriptPanel.classList.remove("hidden");
  storyboardPanel.classList.add("hidden");
  scriptPanel.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const data = await postJson("/api/script", state.payload);
    scriptEditor.value = data.script;
    renderSummary(scriptSummary, [
      ["命中策略", data.summary.selected_strategy_card_id || "回退模式"],
      ["文案字数", `${data.summary.script_characters} 字`],
      ["预计语速", "约 6 字/秒"],
    ]);
    setStatus(scriptStatus, "", "待确认");
  } catch (error) {
    scriptEditor.value = "";
    renderSummary(scriptSummary, [["错误", error.message]]);
    setStatus(scriptStatus, "warning", "生成失败");
  }
}

// ---- 第 3 步：分镜脚本 ----

async function requestStoryboard() {
  const script = scriptEditor.value.trim();
  if (!script) {
    setStatus(scriptStatus, "warning", "文案不能为空");
    return;
  }
  setStatus(storyboardStatus, "warning", "生成中");
  storyboardPanel.classList.remove("hidden");
  storyboardPanel.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const data = await postJson("/api/storyboard", {
      script,
      charactersPerSecond: Number(rateInput.value),
      maximumCharacters: Number(maxCharsInput.value),
    });
    state.storyboard = data.storyboard;
    renderStoryboardSummary(data.summary);
    renderStoryboardTable();
    setStatus(
      storyboardStatus,
      data.summary.blocking_ok ? "success" : "warning",
      data.summary.blocking_ok ? "结构校验通过" : "结构校验未通过",
    );
  } catch (error) {
    state.storyboard = null;
    storyboardBody.innerHTML = "";
    renderSummary(storyboardSummary, [["错误", error.message]]);
    setStatus(storyboardStatus, "warning", "生成失败");
  }
}

function renderStoryboardSummary(summary) {
  renderSummary(storyboardSummary, [
    ["分段数", String(summary.segment_count ?? 0)],
    ["预计总时长", `${summary.estimated_total_duration_sec ?? 0} 秒`],
    ["结构门禁", summary.blocking_ok ? "通过" : "未通过"],
    ["提醒", `${summary.warning_count ?? 0} 条`],
  ]);
}

function visualTypeLabel(value) {
  return VISUAL_TYPE_OPTIONS.find(([key]) => key === value)?.[1] || value;
}

function renderStoryboardTable() {
  const segments = state.storyboard?.segments || [];
  storyboardBody.innerHTML = "";

  segments.forEach((segment, index) => {
    const row = document.createElement("tr");

    const idCell = document.createElement("td");
    idCell.textContent = segment.segment_id;
    row.appendChild(idCell);

    const timeCell = document.createElement("td");
    timeCell.className = "time-cell";
    timeCell.textContent = `${segment.start_sec}s – ${segment.end_sec}s`;
    row.appendChild(timeCell);

    const asrCell = document.createElement("td");
    asrCell.className = "asr-cell";
    asrCell.textContent = segment.asr_text;
    row.appendChild(asrCell);

    const typeCell = document.createElement("td");
    const select = document.createElement("select");
    for (const [value, label] of VISUAL_TYPE_OPTIONS) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = segment.visual_type;
    select.addEventListener("change", () => {
      segment.visual_type = select.value;
      markAdjusted();
    });
    typeCell.appendChild(select);
    row.appendChild(typeCell);

    const captionCell = document.createElement("td");
    const captionInput = document.createElement("textarea");
    captionInput.rows = 2;
    captionInput.value = segment.caption;
    captionInput.addEventListener("input", () => {
      segment.caption = captionInput.value;
      markAdjusted();
    });
    captionCell.appendChild(captionInput);
    row.appendChild(captionCell);

    storyboardBody.appendChild(row);
  });
}

function markAdjusted() {
  const hasEmptyCaption = (state.storyboard?.segments || []).some(
    (segment) => !segment.caption.trim(),
  );
  if (hasEmptyCaption) {
    setStatus(storyboardStatus, "warning", "已调整 · 存在空 Caption");
  } else {
    setStatus(storyboardStatus, "success", "已手动调整");
  }
}

// ---- Markdown 导出 ----

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function buildMarkdown() {
  const storyboard = state.storyboard;
  const lines = [
    `# ${state.title} · 分镜脚本`,
    "",
    `- 预估总时长：${storyboard.estimated_total_duration_sec} 秒`,
    "",
    "| 段落 | 时间戳 | 口播内容 | 画面类型 | 画面 Caption |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const segment of storyboard.segments) {
    lines.push(
      `| ${markdownCell(segment.segment_id)} | ${segment.start_sec}–${segment.end_sec}s | ${markdownCell(segment.asr_text)} | ${markdownCell(visualTypeLabel(segment.visual_type))} | ${markdownCell(segment.caption)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function exportMarkdown() {
  if (!state.storyboard) return;
  const blob = new Blob([buildMarkdown()], { type: "text/markdown; charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.title || "storyboard"}-分镜.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ---- 表单辅助 ----

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
  state.payload = null;
  state.storyboard = null;
  scriptEditor.value = "";
  scriptSummary.innerHTML = "";
  storyboardSummary.innerHTML = "";
  storyboardBody.innerHTML = "";
  scriptPanel.classList.add("hidden");
  storyboardPanel.classList.add("hidden");
}

form.addEventListener("submit", submitBrief);
regenerateButton.addEventListener("click", requestScript);
confirmButton.addEventListener("click", requestStoryboard);
applyOptionsButton.addEventListener("click", requestStoryboard);
exportButton.addEventListener("click", exportMarkdown);
resetButton.addEventListener("click", resetForm);
useDemoButton.addEventListener("click", fillDemo);
fillDemo();
