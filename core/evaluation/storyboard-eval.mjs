import { normalizeText } from "../utils.mjs";
import { validateStoryboard } from "../storyboard/pipeline.mjs";

function boundariesFromSegments(segments) {
  let offset = 0;
  return segments.slice(0, -1).map((segment) => {
    offset += [...normalizeText(segment.asr_text)].length;
    return offset;
  });
}

export function boundaryF1(actual, expected, tolerance = 0) {
  const used = new Set();
  let matches = 0;
  for (const point of actual) {
    const matchIndex = expected.findIndex(
      (candidate, index) => !used.has(index) && Math.abs(candidate - point) <= tolerance,
    );
    if (matchIndex >= 0) {
      used.add(matchIndex);
      matches += 1;
    }
  }
  const precision = actual.length > 0 ? matches / actual.length : expected.length === 0 ? 1 : 0;
  const recall = expected.length > 0 ? matches / expected.length : actual.length === 0 ? 1 : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { matches, precision, recall, f1 };
}

export function evaluateStoryboard({ storyboard, approvedScript, referenceBoundaries = null }) {
  const validation = validateStoryboard(storyboard, approvedScript);
  const report = {
    evaluation_version: "storyboard_evaluation_v1",
    validation,
    release_decision: validation.blocking_ok ? "human_review_required" : "blocked",
  };
  if (Array.isArray(referenceBoundaries)) {
    const actual = boundariesFromSegments(storyboard.segments || []);
    report.boundary_metrics = {
      exact: boundaryF1(actual, referenceBoundaries, 0),
      tolerant_6_characters: boundaryF1(actual, referenceBoundaries, 6),
    };
  }
  return report;
}

