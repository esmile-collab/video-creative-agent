import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..");
const excludedDirectories = new Set([".git", "node_modules", "outputs", "coverage", "dist"]);
const forbiddenSuffixes = [
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mp3",
  ".m4a",
  ".wav",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".xlsx",
  ".xls",
  ".docx",
  ".pptx",
  ".zip",
  ".tar",
  ".tar.gz",
  ".7z",
];
const sensitiveMetricKeys = [
  "periodCostTotal",
  "costTotal",
  "spend",
  "impressions",
  "exposure",
  "clicks",
  "ctr",
  "cvr",
  "gmv",
  "advv",
];

async function collectFiles(rootDirectory, currentDirectory = rootDirectory) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolutePath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(rootDirectory, absolutePath)));
    else files.push(absolutePath);
  }
  return files;
}

function contentViolations(content) {
  const violations = [];
  const checks = [
    [/(?:^|["'\s])\/(?:Users|home)\/[A-Za-z0-9._-]+\//mu, "local_absolute_path"],
    [/[A-Za-z]:\\Users\\[^\\\s]+\\/u, "windows_absolute_path"],
    [/(?:git|code|wiki|data)\.bilibili\.(?:co|internal)/iu, "internal_host"],
    [/bilibili-inc\.com/iu, "internal_host"],
    [/\bsk-[A-Za-z0-9_-]{20,}\b/u, "hardcoded_api_key"],
    [/"(?:cookie|access_token|refresh_token|api_key)"\s*:\s*"[^"\s]{8,}"/iu, "credential_value"],
  ];
  for (const [pattern, code] of checks) {
    if (pattern.test(content)) violations.push(code);
  }
  const metricPattern = new RegExp(
    `"(?:${sensitiveMetricKeys.join("|")})"\\s*:\\s*(?:-?\\d|"[^"\\s]+")`,
    "iu",
  );
  if (metricPattern.test(content)) violations.push("private_business_metric");
  return violations;
}

export async function scanRepo(rootDirectory = defaultRoot) {
  const resolvedRoot = path.resolve(rootDirectory);
  const files = await collectFiles(resolvedRoot);
  const violations = [];
  let scannedFiles = 0;

  for (const absolutePath of files) {
    const relativePath = path.relative(resolvedRoot, absolutePath);
    if (relativePath === "scripts/check-public-safety.mjs") continue;
    const lowerPath = relativePath.toLowerCase();
    const info = await lstat(absolutePath);

    if (info.isSymbolicLink()) {
      violations.push({ file: relativePath, code: "symlink_not_allowed" });
      continue;
    }
    if (forbiddenSuffixes.some((suffix) => lowerPath.endsWith(suffix))) {
      violations.push({ file: relativePath, code: "forbidden_binary_or_media" });
      continue;
    }
    if (info.size > 1024 * 1024) {
      violations.push({ file: relativePath, code: "file_larger_than_1mb" });
      continue;
    }
    if (/^\.env(?:\.|$)/u.test(relativePath) && relativePath !== ".env.example") {
      violations.push({ file: relativePath, code: "environment_file" });
      continue;
    }
    if (/(?:^|\/)(?:cookies?|credentials?)(?:\.|$)/iu.test(relativePath)) {
      violations.push({ file: relativePath, code: "credential_file_name" });
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    scannedFiles += 1;
    if (relativePath.endsWith(".json")) {
      try {
        JSON.parse(content);
      } catch {
        violations.push({ file: relativePath, code: "invalid_json" });
      }
    }
    for (const code of contentViolations(content)) {
      violations.push({ file: relativePath, code });
    }
  }

  return {
    safety_version: "public_repo_safety_v1",
    root: path.basename(resolvedRoot),
    scanned_files: scannedFiles,
    violation_count: violations.length,
    violations,
    ok: violations.length === 0,
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await scanRepo(process.argv[2] || defaultRoot);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
