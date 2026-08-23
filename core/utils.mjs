import { createHash } from "node:crypto";

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function stripFrontmatter(markdown) {
  return String(markdown || "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .trim();
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

