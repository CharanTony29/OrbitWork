import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type LanguageModel } from "ai";

/**
 * AI Provider Instances
 */

export function getGoogleModel(modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash"): LanguageModel | null {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const provider = createGoogleGenerativeAI({ apiKey });
  return provider(modelName);
}

export function getGroqModel(modelName = "llama-3.3-70b-versatile"): LanguageModel | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const provider = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
  return provider.chat(modelName);
}

export function getOpenRouterModel(modelName = "meta-llama/llama-3.3-70b-instruct:free"): LanguageModel | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const provider = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
  return provider.chat(modelName);
}

export interface ModelEntry {
  name: string;
  model: LanguageModel;
}

/**
 * Builds the prioritized chain of available models based on configured environment keys.
 * 1. Google Gemini (Gemini 2.0 Flash / configured GEMINI_MODEL)
 * 2. Groq (Llama 3.3 70B)
 * 3. OpenRouter (Free model pool)
 */
export function getModelFallbackChain(): ModelEntry[] {
  const chain: ModelEntry[] = [];

  const google = getGoogleModel();
  if (google) chain.push({ name: `Google Gemini (${process.env.GEMINI_MODEL || "gemini-2.0-flash"})`, model: google });

  const groq = getGroqModel();
  if (groq) chain.push({ name: "Groq (llama-3.3-70b-versatile)", model: groq });

  const openrouter = getOpenRouterModel();
  if (openrouter) chain.push({ name: "OpenRouter (llama-3.3-70b:free)", model: openrouter });

  if (chain.length === 0) {
    throw new Error(
      "No AI provider API key found. Please set GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in your environment variables."
    );
  }

  return chain;
}

/**
 * Returns the primary AI model available.
 */
export function getAIModel(): LanguageModel {
  const chain = getModelFallbackChain();
  return chain[0].model;
}

/**
 * Robust execution with multi-provider automatic failover.
 * If Provider A hits rate limit or error, silently fails over to Provider B, then C.
 */
export async function generateTextWithFallback(options: {
  prompt: string;
  system?: string;
  temperature?: number;
  abortSignal?: AbortSignal;
}) {
  const chain = getModelFallbackChain();
  let lastError: unknown = null;

  for (const entry of chain) {
    try {
      const res = await generateText({
        model: entry.model,
        prompt: options.prompt,
        system: options.system,
        temperature: options.temperature,
        abortSignal: options.abortSignal || AbortSignal.timeout(12000),
      });
      return {
        text: res.text,
        provider: entry.name,
      };
    } catch (err: unknown) {
      console.warn(`[AI Failover]: ${entry.name} failed:`, err instanceof Error ? err.message : err);
      lastError = err;
    }
  }

  throw lastError || new Error("All configured AI providers failed.");
}

/**
 * Robust streaming with multi-provider automatic failover.
 */
export async function streamTextWithFallback(options: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  system?: string;
  temperature?: number;
}) {
  const chain = getModelFallbackChain();
  let lastError: unknown = null;

  for (const entry of chain) {
    try {
      const stream = streamText({
        model: entry.model,
        messages: options.messages,
        system: options.system,
        temperature: options.temperature,
      });
      return stream;
    } catch (err: unknown) {
      console.warn(`[Stream Fallback]: ${entry.name} failed:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("All configured AI providers failed for streaming.");
}
