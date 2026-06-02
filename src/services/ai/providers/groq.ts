// src/services/ai/providers/groq.ts
export const GROQ_MODEL_TEXT = "qwen/qwen3-32b";
export const GROQ_MODEL_VISION = "meta-llama/llama-4-scout-17b-16e-instruct";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

export interface AIResponse {
  content: string;
}

// Key management dengan support primary + fallback
function getApiKeys(): string[] {
  const keys: string[] = [];
  const primary = import.meta.env.VITE_GROQ_API_KEY;
  const fallback = import.meta.env.VITE_GROQ_API_KEY_FB;
  if (primary) keys.push(primary);
  if (fallback) keys.push(fallback);
  return keys;
}

async function callGroqWithKey(
  apiKey: string,
  messages: AIMessage[],
  model: string,
  maxTokens = 1024,
): Promise<AIResponse> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw Object.assign(new Error(`Groq API error ${response.status}: ${errorBody}`), {
      status: response.status,
    });
  }

  const data = await response.json();
  let content: string = data.choices?.[0]?.message?.content ?? "";

  content = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .trim();

  return { content };
}

export async function callGroq(
  messages: AIMessage[],
  model: string = GROQ_MODEL_TEXT,
  systemPrompt?: string,
  maxTokens = 1024,
): Promise<AIResponse> {
  const keys = getApiKeys();

  if (keys.length === 0) {
    throw new Error("VITE_GROQ_API_KEY belum diisi di .env.local");
  }

  const fullMessages: AIMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  let lastError: Error | null = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const label = i === 0 ? "primary" : "fallback";
    try {
      const result = await callGroqWithKey(key, fullMessages, model, maxTokens);
      if (i > 0) console.info(`[Groq] Berhasil via key ${label}`);
      return result;
    } catch (e: any) {
      lastError = e as Error;
      const isRateLimit = e?.status === 429 || e?.message?.includes("429");
      const isQuotaExceeded = e?.message?.includes("quota") || e?.message?.includes("rate_limit");

      if ((isRateLimit || isQuotaExceeded) && i < keys.length - 1) {
        console.warn(`[Groq] Key ${label} rate limited, mencoba key fallback...`);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError!;
}
