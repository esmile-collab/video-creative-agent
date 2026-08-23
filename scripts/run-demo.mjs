import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluateStoryboard } from "../core/evaluation/storyboard-eval.mjs";
import { createMockProvider } from "../core/providers/mock.mjs";
import { buildStoryboard, renderStoryboardMarkdown } from "../core/storyboard/pipeline.mjs";
import { compileScriptRequest } from "../core/strategy/compiler.mjs";
import { retrieveStrategy } from "../core/strategy/retriever.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..");

function resolveInside(baseDirectory, relativePath) {
  const resolved = path.resolve(baseDirectory, relativePath);
  const relative = path.relative(baseDirectory, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`demo input escapes its directory: ${relativePath}`);
  }
  return resolved;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--config") result.configPath = argv[++index];
    else if (argv[index] === "--out") result.outDir = argv[++index];
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return result;
}

export async function runDemo(options = {}) {
  const rootDirectory = path.resolve(options.rootDirectory || defaultRoot);
  const configPath = path.resolve(
    options.configPath || path.join(rootDirectory, "examples/demo_001/run-config.json"),
  );
  const demoDirectory = path.dirname(configPath);
  const config = await readJson(configPath);

  const brief = await readFile(resolveInside(demoDirectory, config.brief_path), "utf8");
  const query = await readJson(resolveInside(demoDirectory, config.query_path));
  const baseSkill = await readFile(resolveInside(demoDirectory, config.base_skill_path), "utf8");
  const cards = await readJson(resolveInside(demoDirectory, config.cards_path));
  const mockScript = await readFile(resolveInside(demoDirectory, config.mock_script_path), "utf8");
  const publicSources = await readJson(
    resolveInside(demoDirectory, config.public_sources_path),
  );

  const retrieval = retrieveStrategy(cards, {
    query,
    scriptType: config.script_type,
    threshold: config.retrieval_threshold,
    allowFallback: config.allow_fallback,
  });
  const compiledRequest = compileScriptRequest({
    brief,
    baseSkill,
    retrieval,
    outputContract: config.output_contract || {},
    runId: config.run_id,
  });

  const provider = createMockProvider(mockScript);
  const generated = await provider.generateScript(compiledRequest);
  const { storyboard, validation } = buildStoryboard(generated.content);
  const evaluation = evaluateStoryboard({
    storyboard,
    approvedScript: generated.content,
  });

  const outputDirectory = path.resolve(
    options.outDir || path.join(rootDirectory, "outputs/demo_001"),
  );
  await mkdir(outputDirectory, { recursive: true });

  const retrievalOutput = { ...retrieval };
  delete retrievalOutput.selected_card;
  const sourceReferences = publicSources.map((source) => ({
    source_id: source.source_id,
    public_video_id: source.public_video_id,
    title: source.title,
    public_url: source.public_url,
    media_mode: source.media_mode,
    local_media_included: source.local_media_included,
  }));
  const summary = {
    run_id: config.run_id,
    provider_id: provider.provider_id,
    model_id: provider.model_id,
    selected_strategy_card_id: retrieval.selected_strategy_card_id,
    retrieval_fallback: retrieval.fallback,
    segment_count: storyboard.segments.length,
    estimated_total_duration_sec: storyboard.estimated_total_duration_sec,
    release_decision: evaluation.release_decision,
    blocking_ok: validation.blocking_ok,
    public_source_count: sourceReferences.length,
    public_sources: sourceReferences,
  };

  await Promise.all([
    writeJson(path.join(outputDirectory, "retrieval_result.json"), retrievalOutput),
    writeJson(path.join(outputDirectory, "compiled_request.json"), compiledRequest),
    writeFile(path.join(outputDirectory, "script.txt"), `${generated.content.trim()}\n`, "utf8"),
    writeJson(path.join(outputDirectory, "storyboard.json"), storyboard),
    writeFile(
      path.join(outputDirectory, "storyboard.md"),
      renderStoryboardMarkdown(storyboard, "Public Demo Storyboard（公开演示分镜）"),
      "utf8",
    ),
    writeJson(path.join(outputDirectory, "validation_report.json"), evaluation),
    writeJson(path.join(outputDirectory, "run_summary.json"), summary),
  ]);

  return { outputDirectory, summary, retrieval, storyboard, evaluation };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const cliOptions = parseArguments(process.argv.slice(2));
  const result = await runDemo(cliOptions);
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}
