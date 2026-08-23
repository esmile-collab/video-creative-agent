import { assert } from "../utils.mjs";

export function createOpenAICompatibleProvider({ baseUrl, apiKey, model, timeoutMs = 180000 }) {
  assert(baseUrl, "baseUrl is required");
  assert(apiKey, "apiKey is required");
  assert(model, "model is required");

  return {
    provider_id: "openai_compatible",
    model_id: model,
    async generateScript(compiledRequest) {
      const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: compiledRequest.messages,
          stream: false,
          ...compiledRequest.inference_params,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`model provider returned invalid JSON with HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(body?.error?.message || `model provider returned HTTP ${response.status}`);
      }
      const content = body?.choices?.[0]?.message?.content?.trim();
      assert(content, "model provider returned no message content");
      return { content, usage: body.usage || {} };
    },
  };
}

