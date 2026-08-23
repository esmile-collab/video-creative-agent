export function createMockProvider(script) {
  return {
    provider_id: "mock",
    model_id: "deterministic-demo-v1",
    async generateScript() {
      return {
        content: script.trim(),
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    },
  };
}

