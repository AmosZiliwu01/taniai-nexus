// src/services/ai/providers/groq.ts
// Provider Groq — pengganti OpenRouter
// Endpoint-nya kompatibel OpenAI, jadi strukturnya sama persis

export const GROQ_MODEL_TEXT = "qwen/qwen3-32b";
export const GROQ_MODEL_VISION = "meta-llama/llama-4-scout-17b-16e-instruct";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

export interface AIResponse {
  content: string;
}

export async function callGroq(
  messages: AIMessage[],
  model: string = GROQ_MODEL_TEXT,
  systemPrompt?: string
): Promise<AIResponse> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY belum diisi di .env.local");
  }

  const fullMessages: AIMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  let content: string = data.choices?.[0]?.message?.content ?? "";

  // Strip <think>...</think> blocks (Qwen3 / DeepSeek thinking mode)
  // These appear as English "thinking out loud" before the actual answer
  content = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "") // partial think block at start
    .trim();

  return { content };
}