import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateScript, generateStoryboard } from "./generate.mjs";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function serveStaticFile(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(appDirectory, safePath);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(appDirectory)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(normalized);
    const ext = path.extname(normalized);
    response.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
}

async function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  const { method, url } = request;
  const requestUrl = new URL(url, "http://localhost");

  if (method === "GET" && requestUrl.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, app: "video-creative-agent-ui" }));
    return;
  }

  if (method === "GET" && ["/", "/index.html", "/styles.css", "/app.js"].includes(requestUrl.pathname)) {
    await serveStaticFile(requestUrl.pathname, response);
    return;
  }

  if (method === "POST" && requestUrl.pathname === "/api/script") {
    try {
      const payload = await readRequestBody(request);
      const result = await generateScript(payload);
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          ok: true,
          data: {
            brief: result.brief,
            script: result.script,
            summary: result.summary,
          },
        }),
      );
      return;
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: error.message || "Failed to generate script" }));
      return;
    }
  }

  if (method === "POST" && requestUrl.pathname === "/api/storyboard") {
    try {
      const payload = await readRequestBody(request);
      const result = generateStoryboard(payload.script, {
        charactersPerSecond: payload.charactersPerSecond,
        maximumCharacters: payload.maximumCharacters,
      });
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          ok: true,
          data: {
            storyboard: result.storyboard,
            storyboardMarkdown: result.storyboardMarkdown,
            summary: result.summary,
          },
        }),
      );
      return;
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: error.message || "Failed to generate storyboard" }));
      return;
    }
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
});

const port = Number(process.env.PORT || 4173);
server.listen(port, () => {
  console.log(`Video Creative Agent UI running at http://localhost:${port}`);
});
