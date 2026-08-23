import { assert, normalizeText, sha256 } from "../utils.mjs";

export const VISUAL_TYPES = new Set([
  "digital_human",
  "ai_visual",
  "explanatory_graphic",
  "user_asset",
]);

function splitReadableUnits(script) {
  const compact = String(script || "").replace(/\s+/gu, "").trim();
  assert(compact, "approved script is empty");
  return compact.match(/[^。！？!?；;]+[。！？!?；;]?/gu) || [compact];
}

export function segmentApprovedScript(script, options = {}) {
  const maximumCharacters = Number(options.maximumCharacters || 42);
  const charactersPerSecond = Number(options.charactersPerSecond || 5.97);
  const units = splitReadableUnits(script);
  const texts = [];
  let current = "";

  for (const unit of units) {
    if (current && current.length + unit.length > maximumCharacters) {
      texts.push(current);
      current = unit;
    } else {
      current += unit;
    }
  }
  if (current) texts.push(current);

  let cursor = 0;
  const segments = texts.map((asrText, index) => {
    const duration = Math.max(2, Math.ceil(asrText.length / charactersPerSecond));
    const segment = {
      segment_id: `S${String(index + 1).padStart(3, "0")}`,
      start_sec: cursor,
      end_sec: cursor + duration,
      asr_text: asrText,
    };
    cursor = segment.end_sec;
    return segment;
  });

  return {
    characters_per_second: charactersPerSecond,
    estimated_total_duration_sec: cursor,
    segments,
  };
}

function visualTypeForText(text) {
  if (/界面|截图|实拍|原图|已有素材|用户素材/u.test(text)) return "user_asset";
  if (/步骤|第一|第二|第三|流程|关系|机制|原因|结构|对比|层次|公式/u.test(text)) {
    return "explanatory_graphic";
  }
  if (/场景|想象|每天|早上|夜里|走进|开始|生活/u.test(text)) return "ai_visual";
  return "digital_human";
}

function captionForSegment(segment, visualType) {
  const focus = segment.asr_text.replace(/[。！？!?；;]/gu, "").slice(0, 32);
  const templates = {
    digital_human: `讲述者以中景直接承接“${focus}”，表情自然，背景保持简洁。`,
    ai_visual: `用一个具体生活场景呈现“${focus}”，主体动作清楚，不添加未经确认的事实。`,
    explanatory_graphic: `用层级清晰的图形、关键词和关系线解释“${focus}”，只保留必要文字。`,
    user_asset: `调用用户已确认素材展示“${focus}”，保持原始信息，不补造素材内容。`,
  };
  return templates[visualType];
}

export function planVisuals(segments, planner = null) {
  assert(Array.isArray(segments) && segments.length > 0, "segments are required");
  return segments.map((segment) => {
    const planned = planner ? planner(segment) : null;
    const visualType = planned?.visual_type || visualTypeForText(segment.asr_text);
    return {
      ...segment,
      visual_type: visualType,
      caption: planned?.caption || captionForSegment(segment, visualType),
    };
  });
}

export function validateStoryboard(storyboard, approvedScript) {
  const segments = storyboard?.segments;
  const hardFailures = [];
  const warnings = [];

  if (!Array.isArray(segments) || segments.length === 0) {
    hardFailures.push("missing_segments");
  } else {
    let previousEnd = 0;
    for (const [index, segment] of segments.entries()) {
      const expectedId = `S${String(index + 1).padStart(3, "0")}`;
      if (segment.segment_id !== expectedId) hardFailures.push(`invalid_segment_id:${index}`);
      if (!Number.isInteger(segment.start_sec) || segment.start_sec !== previousEnd) {
        hardFailures.push(`non_continuous_start:${segment.segment_id}`);
      }
      if (!Number.isInteger(segment.end_sec) || segment.end_sec <= segment.start_sec) {
        hardFailures.push(`invalid_end:${segment.segment_id}`);
      }
      if (!segment.asr_text) hardFailures.push(`missing_asr:${segment.segment_id}`);
      if (!VISUAL_TYPES.has(segment.visual_type)) {
        hardFailures.push(`invalid_visual_type:${segment.segment_id}`);
      }
      if (!segment.caption?.trim()) hardFailures.push(`missing_caption:${segment.segment_id}`);
      if ((segment.caption || "").length > 90) warnings.push(`long_caption:${segment.segment_id}`);
      if (/相关画面|配合字幕|适当展示/u.test(segment.caption || "")) {
        warnings.push(`vague_caption:${segment.segment_id}`);
      }
      previousEnd = segment.end_sec;
    }

    const reconstructed = segments.map((segment) => segment.asr_text).join("");
    if (normalizeText(reconstructed) !== normalizeText(approvedScript)) {
      hardFailures.push("approved_script_not_preserved");
    }
    if (storyboard.estimated_total_duration_sec !== previousEnd) {
      hardFailures.push("total_duration_mismatch");
    }
  }

  return {
    validation_version: "storyboard_validation_v1",
    blocking_ok: hardFailures.length === 0,
    quality_ok: hardFailures.length === 0 && warnings.length === 0,
    hard_failures: [...new Set(hardFailures)],
    warnings: [...new Set(warnings)],
    checks: {
      segment_count: Array.isArray(segments) ? segments.length : 0,
      approved_script_sha256: sha256(approvedScript),
      storyboard_script_sha256: storyboard?.script_sha256 || null,
    },
  };
}

export function buildStoryboard(approvedScript, options = {}) {
  const segmentation = segmentApprovedScript(approvedScript, options);
  const plannedSegments = planVisuals(segmentation.segments, options.planner);
  const storyboard = {
    schema_version: "storyboard_v1",
    script_sha256: sha256(approvedScript),
    estimated_total_duration_sec: segmentation.estimated_total_duration_sec,
    segments: plannedSegments,
  };
  const validation = validateStoryboard(storyboard, approvedScript);
  return { storyboard, validation };
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
}

export function renderStoryboardMarkdown(storyboard, title = "Storyboard") {
  const lines = [
    `# ${title}`,
    "",
    `- 预估总时长：${storyboard.estimated_total_duration_sec} 秒`,
    `- 脚本哈希：\`${storyboard.script_sha256}\``,
    "",
    "| 段落 | 时间 | 冻结口播 | 画面类型 | Caption（画面描述） |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const segment of storyboard.segments) {
    lines.push(
      `| ${markdownCell(segment.segment_id)} | ${segment.start_sec}–${segment.end_sec}s | ${markdownCell(segment.asr_text)} | ${markdownCell(segment.visual_type)} | ${markdownCell(segment.caption)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

