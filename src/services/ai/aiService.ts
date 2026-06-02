// src/services/ai/aiService.ts
import { callGroq, GROQ_MODEL_TEXT, GROQ_MODEL_VISION, type AIMessage } from "./providers/groq";

export type { AIMessage };

export interface AICallOptions {
  messages: AIMessage[];
  systemPrompt?: string;
  vision?: boolean;
  maxTokens?: number;
}

function isUnrecoverableError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("tidak valid") ||
    msg.includes("401") ||
    msg.includes("402") ||
    msg.includes("unauthorized")
  );
}

export async function callAI(opts: AICallOptions): Promise<string> {
  const model = opts.vision ? GROQ_MODEL_VISION : GROQ_MODEL_TEXT;

  if (!import.meta.env.VITE_GROQ_API_KEY) {
    throw new Error("VITE_GROQ_API_KEY belum diisi di .env.local");
  }

  const result = await callGroq(opts.messages, model, opts.systemPrompt, opts.maxTokens);
  return result.content;
}

export async function callAIWithRetry(opts: AICallOptions, maxRetries = 2): Promise<string> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callAI(opts);
    } catch (e) {
      lastError = e as Error;
      if (isUnrecoverableError(lastError)) throw lastError;
      if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastError!;
}
