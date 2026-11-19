import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, type LanguageModel } from "ai";

/**
 * Friendly error message shown when every configured free AI provider/key
 * has reached its free quota or been skipped.
 */
export const AI_LIMIT_REACHED_MESSAGE =
  "Daily free AI limit reached across all providers. Please try again tomorrow.";

export class AILimitReachedError extends Error {
  public readonly statusCode = 429;
  public readonly code = "AI_FREE_LIMIT_REACHED";

  constructor(message = AI_LIMIT_REACHED_MESSAGE) {
    super(message);
    this.name = "AILimitReachedError";
  }
}

export function isAILimitError(err: unknown): err is AILimitReachedError {
  return (
    err instanceof AILimitReachedError ||
    (err instanceof Error && err.name === "AILimitReachedError")
  );
}

type ProviderKind = "google" | "openrouter" | "groq" | "apinex" | "nvidia" | "cloudflare" | "huggingface";

export interface ModelEntry {
  id: string;
  keyGroup: string;
  provider: ProviderKind;
  modelId: string;
  name: string;
  model: LanguageModel;
  supportsSystem: boolean;
}

/**
 * Default free-tier Google AI Studio models ordered from lightest/lowest-token
 * and highest-quota to larger models.
 */
const DEFAULT_GOOGLE_FREE_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
];

/**
 * Fallback OpenRouter strictly-free models (used only if live discovery fails).
 */
const FALLBACK_OPENROUTER_FREE_MODELS = [
  "openrouter/free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "inclusionai/ling-3.2-flash:free",
];

/**
 * Fallback Groq free production chat models (used only if live discovery fails).
 */
const FALLBACK_GROQ_MODELS = [
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
];

/**
 * Fallback APInex strictly free-prefixed models (used only if live discovery fails).
 */
const FALLBACK_APINEX_FREE_MODELS = [
  "free/gemini-3.8-flash",
  "free/deepseek-v4.1-flash",
  "free/glm-5.3-flash",
  "free/minimax-m3.1-flash",
  "free/qwen-3.8-max",
  "free/claude-sonnet-4.6",
];

const DEFAULT_MAX_OUTPUT_TOKENS = 600;
const MODEL_CATALOG_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory cooldowns (persist across requests in the Node server process)
const slotCooldownUntil = new Map<string, number>();
const keyCooldownUntil = new Map<string, number>();
const globalModelDisabledUntil = new Map<string, number>();

// Cached live free-model discovery
let cachedOpenRouterFreeModels: { fetchedAt: number; models: string[] } | null = null;
let cachedGroqModels: { fetchedAt: number; models: string[] } | null = null;
let cachedApinexFreeModels: { fetchedAt: number; models: string[] } | null = null;

function cleanKey(val: string | undefined): string | null {
  const trimmed = val?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function collectUniqueKeys(envNames: string[]): Array<{ envName: string; apiKey: string }> {
  const seen = new Set<string>();
  const result: Array<{ envName: string; apiKey: string }> = [];
  for (const envName of envNames) {
    const apiKey = cleanKey(process.env[envName]);
    if (apiKey && !seen.has(apiKey)) {
      seen.add(apiKey);
      result.push({ envName, apiKey });
    }
  }
  return result;
}

function getGoogleFreeModels(): string[] {
  const customList = process.env.GEMINI_FREE_MODELS?.split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (customList && customList.length > 0) return customList;

  const preferred = cleanKey(process.env.GEMINI_MODEL);
  if (preferred && !DEFAULT_GOOGLE_FREE_MODELS.includes(preferred)) {
    // Ignore retired gemini-2.0-flash if still lingering in env
    if (!/^gemini-2\.0-/i.test(preferred)) {
      return [preferred, ...DEFAULT_GOOGLE_FREE_MODELS];
    }
  }
  return DEFAULT_GOOGLE_FREE_MODELS;
}

/**
 * Dynamically discovers strictly $0/token text chat models from OpenRouter.
 * Any model OpenRouter converts to paid automatically disappears from this list.
 */
async function discoverOpenRouterFreeModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedOpenRouterFreeModels && now - cachedOpenRouterFreeModels.fetchedAt < MODEL_CATALOG_TTL_MS) {
    return cachedOpenRouterFreeModels.models;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{
          id?: string;
          pricing?: { prompt?: string | number; completion?: string | number };
          architecture?: { modality?: string; output_modalities?: string[] };
        }>;
      };

      const excludedPattern = /(lyria|tts|whisper|image|embed|rerank|moderation|audio|video|flux|sdxl|dall-e)/i;
      const freeIds = (json.data || [])
        .filter((m) => {
          if (!m.id) return false;
          if (m.id === "openrouter/free") return false; // added explicitly first
          if (!m.id.endsWith(":free")) return false;
          if (excludedPattern.test(m.id)) return false;
          const promptPrice = Number(m.pricing?.prompt ?? 1);
          const completionPrice = Number(m.pricing?.completion ?? 1);
          if (promptPrice !== 0 || completionPrice !== 0) return false;
          const outMods = m.architecture?.output_modalities;
          if (Array.isArray(outMods) && !outMods.includes("text")) return false;
          return true;
        })
        .map((m) => m.id as string);

      // Prefer fast / lightweight models first to conserve tokens & latency
      const scoreModel = (id: string): number => {
        const lower = id.toLowerCase();
        if (lower.includes("gemma")) return 1;
        if (lower.includes("flash") || lower.includes("lightning") || lower.includes("mini")) return 2;
        if (lower.includes("small") || lower.includes("nano") || lower.includes("1.7b")) return 3;
        if (lower.includes("reasoning") || lower.includes("ultra") || lower.includes("550b")) return 6;
        return 4;
      };

      freeIds.sort((a, b) => scoreModel(a) - scoreModel(b));

      // Always lead with openrouter/free (auto-router), followed by top 6 verified $0 models
      const selected = ["openrouter/free", ...freeIds.slice(0, 6)];
      cachedOpenRouterFreeModels = { fetchedAt: now, models: selected };
      return selected;
    }
  } catch {
    // Fall back silently to static free defaults
  }

  cachedOpenRouterFreeModels = { fetchedAt: now, models: FALLBACK_OPENROUTER_FREE_MODELS };
  return FALLBACK_OPENROUTER_FREE_MODELS;
}

/**
 * Dynamically discovers active Groq free-tier chat models so retired slugs never break failover.
 */
async function discoverGroqModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedGroqModels && now - cachedGroqModels.fetchedAt < MODEL_CATALOG_TTL_MS) {
    return cachedGroqModels.models;
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id?: string; active?: boolean }> };
      const excludedPattern = /(whisper|guard|tts|playai|orpheus|embed|audio|vision|compound|safeguard|distil)/i;
      const chatIds = (json.data || [])
        .filter((m) => m.id && m.active !== false && !excludedPattern.test(m.id))
        .map((m) => m.id as string);

      if (chatIds.length > 0) {
        // Prefer smaller / faster models first to save tokens & quota
        const scoreGroq = (id: string): number => {
          const lower = id.toLowerCase();
          if (lower.includes("20b") || lower.includes("8b") || lower.includes("7b")) return 1;
          if (lower.includes("qwen") || lower.includes("27b") || lower.includes("32b")) return 2;
          if (lower.includes("120b") || lower.includes("70b")) return 3;
          return 4;
        };
        chatIds.sort((a, b) => scoreGroq(a) - scoreGroq(b));
        cachedGroqModels = { fetchedAt: now, models: chatIds };
        return chatIds;
      }
    }
  } catch {
    // Fall back silently
  }

  cachedGroqModels = { fetchedAt: now, models: FALLBACK_GROQ_MODELS };
  return FALLBACK_GROQ_MODELS;
}

/**
 * Dynamically discovers strictly free-tier (`free/*`) chat models from APInex.
 * Paid models (which omit the `free/` prefix) are never included.
 */
async function discoverApinexFreeModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedApinexFreeModels && now - cachedApinexFreeModels.fetchedAt < MODEL_CATALOG_TTL_MS) {
    return cachedApinexFreeModels.models;
  }

  const baseUrl = (process.env.APINEX_BASE_URL || "https://api.apinex.bond/v1").replace(/\/+$/, "");
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      const excludedPattern = /(whisper|tts|audio|image|embed|rerank|video|flux|dall-e|lyria)/i;
      const freeIds = (json.data || [])
        .map((m) => m.id || "")
        .filter((id) => id.startsWith("free/") && !excludedPattern.test(id));

      if (freeIds.length > 0) {
        // Prefer fast / low-token flash models first, then strong general models
        const scoreApinex = (id: string): number => {
          const lower = id.toLowerCase();
          if (lower.includes("flash")) return 1;
          if (lower.includes("mini") || lower.includes("lite")) return 2;
          if (lower.includes("sonnet") || lower.includes("qwen") || lower.includes("glm")) return 3;
          if (lower.includes("opus") || lower.includes("pro") || lower.includes("max")) return 4;
          return 5;
        };
        freeIds.sort((a, b) => scoreApinex(a) - scoreApinex(b));
        const selected = freeIds.slice(0, 8);
        cachedApinexFreeModels = { fetchedAt: now, models: selected };
        return selected;
      }
    }
  } catch {
    // Fall back silently to static free/* defaults
  }

  cachedApinexFreeModels = { fetchedAt: now, models: FALLBACK_APINEX_FREE_MODELS };
  return FALLBACK_APINEX_FREE_MODELS;
}

/**
 * Individual Provider Factory Helpers (kept exported for backwards compatibility)
 */
export function getGoogleModel(
  modelName = getGoogleFreeModels()[0],
  apiKey = cleanKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY) || cleanKey(process.env.GEMINI_API_KEY)
): LanguageModel | null {
  if (!apiKey) return null;
  const provider = createGoogleGenerativeAI({ apiKey });
  return provider(modelName);
}

export function getOpenRouterModel(
  modelName = "openrouter/free",
  apiKey = cleanKey(process.env.OPENROUTER_API_KEY)
): LanguageModel | null {
  if (!apiKey) return null;
  const provider = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://orbitwork.app",
      "X-Title": "Orbitwork",
    },
  });
  return provider.chat(modelName);
}

export function getGroqModel(
  modelName = FALLBACK_GROQ_MODELS[0],
  apiKey = cleanKey(process.env.GROQ_API_KEY)
): LanguageModel | null {
  if (!apiKey) return null;
  const provider = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
  return provider.chat(modelName);
}

export function getApinexModel(
  modelName = FALLBACK_APINEX_FREE_MODELS[0],
  apiKey = cleanKey(process.env.APINEX_API_KEY)
): LanguageModel | null {
  if (!apiKey) return null;
  const provider = createOpenAI({
    baseURL: (process.env.APINEX_BASE_URL || "https://api.apinex.bond/v1").replace(/\/+$/, ""),
    apiKey,
  });
  return provider.chat(modelName);
}

/**
 * Builds the prioritized FREE-ONLY chain in the exact order requested:
 * 1. GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY)
 * 2. GOOGLE_GENERATIVE_AI_API_KEY_2
 * 3. GOOGLE_GENERATIVE_AI_API_KEY_3
 * 4. OPENROUTER_API_KEY
 * 5. OPENROUTER_API_KEY_1
 * 6. OPENROUTER_API_KEY_2
 * 7. GROQ_API_KEY
 * (+ optional free backup providers if configured later: NVIDIA, Cloudflare, HF)
 */
export async function buildFreeModelFallbackChain(): Promise<ModelEntry[]> {
  const chain: ModelEntry[] = [];

  // 1-3: Google AI Studio keys in exact order
  const googleKeys = collectUniqueKeys([
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY_2",
    "GOOGLE_GENERATIVE_AI_API_KEY_3",
  ]);
  const googleModels = getGoogleFreeModels();

  for (const { envName, apiKey } of googleKeys) {
    const provider = createGoogleGenerativeAI({ apiKey });
    for (const modelId of googleModels) {
      chain.push({
        id: `google:${envName}:${modelId}`,
        keyGroup: `google:${envName}`,
        provider: "google",
        modelId,
        name: `Google (${envName} / ${modelId})`,
        model: provider(modelId),
        supportsSystem: !modelId.toLowerCase().startsWith("gemma"),
      });
    }
  }

  // 4-6: OpenRouter keys in exact order (strictly $0-only models)
  const openRouterKeys = collectUniqueKeys([
    "OPENROUTER_API_KEY",
    "OPENROUTER_API_KEY_1",
    "OPENROUTER_API_KEY_2",
    "OPENROUTER_API_KEY_3",
  ]);

  if (openRouterKeys.length > 0) {
    const orModels = await discoverOpenRouterFreeModels();
    for (const { envName, apiKey } of openRouterKeys) {
      const provider = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        headers: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://orbitwork.app",
          "X-Title": "Orbitwork",
        },
      });
      for (const modelId of orModels) {
        chain.push({
          id: `openrouter:${envName}:${modelId}`,
          keyGroup: `openrouter:${envName}`,
          provider: "openrouter",
          modelId,
          name: `OpenRouter (${envName} / ${modelId})`,
          model: provider.chat(modelId),
          supportsSystem: true,
        });
      }
    }
  }

  // 7: Groq key(s)
  const groqKeys = collectUniqueKeys(["GROQ_API_KEY", "GROQ_API_KEY_2"]);
  if (groqKeys.length > 0) {
    const groqModels = await discoverGroqModels(groqKeys[0].apiKey);
    for (const { envName, apiKey } of groqKeys) {
      const provider = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey,
      });
      for (const modelId of groqModels) {
        chain.push({
          id: `groq:${envName}:${modelId}`,
          keyGroup: `groq:${envName}`,
          provider: "groq",
          modelId,
          name: `Groq (${envName} / ${modelId})`,
          model: provider.chat(modelId),
          supportsSystem: true,
        });
      }
    }
  }

  // 8: APInex key(s) (strictly free/* models only)
  const apinexKeys = collectUniqueKeys([
    "APINEX_API_KEY",
    "APINEX_API_KEY_1",
    "APINEX_API_KEY_2",
  ]);
  if (apinexKeys.length > 0) {
    const apinexBaseUrl = (process.env.APINEX_BASE_URL || "https://api.apinex.bond/v1").replace(/\/+$/, "");
    const apinexModels = await discoverApinexFreeModels(apinexKeys[0].apiKey);
    for (const { envName, apiKey } of apinexKeys) {
      const provider = createOpenAI({
        baseURL: apinexBaseUrl,
        apiKey,
      });
      for (const modelId of apinexModels) {
        chain.push({
          id: `apinex:${envName}:${modelId}`,
          keyGroup: `apinex:${envName}`,
          provider: "apinex",
          modelId,
          name: `APInex (${envName} / ${modelId})`,
          model: provider.chat(modelId),
          supportsSystem: true,
        });
      }
    }
  }

  // Optional future free backups (appended AFTER the 7 primary keys)
  const nvidiaKey = cleanKey(process.env.NVIDIA_API_KEY);
  if (nvidiaKey) {
    const nvidia = createOpenAI({
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: nvidiaKey,
    });
    for (const modelId of ["meta/llama-3.3-70b-instruct", "qwen/qwen2.5-72b-instruct"]) {
      chain.push({
        id: `nvidia:NVIDIA_API_KEY:${modelId}`,
        keyGroup: "nvidia:NVIDIA_API_KEY",
        provider: "nvidia",
        modelId,
        name: `NVIDIA NIM (${modelId})`,
        model: nvidia.chat(modelId),
        supportsSystem: true,
      });
    }
  }

  const cfAccount = cleanKey(process.env.CLOUDFLARE_ACCOUNT_ID);
  const cfToken = cleanKey(process.env.CLOUDFLARE_API_TOKEN);
  if (cfAccount && cfToken) {
    const cf = createOpenAI({
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1`,
      apiKey: cfToken,
    });
    for (const modelId of ["@cf/meta/llama-3.1-8b-instruct-fast", "@cf/google/gemma-3-12b-it"]) {
      chain.push({
        id: `cloudflare:CLOUDFLARE_API_TOKEN:${modelId}`,
        keyGroup: "cloudflare:CLOUDFLARE_API_TOKEN",
        provider: "cloudflare",
        modelId,
        name: `Cloudflare AI (${modelId})`,
        model: cf.chat(modelId),
        supportsSystem: true,
      });
    }
  }

  const hfToken = cleanKey(process.env.HF_TOKEN);
  if (hfToken) {
    const hf = createOpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: hfToken,
    });
    const modelId = "Qwen/Qwen2.5-7B-Instruct";
    chain.push({
      id: `huggingface:HF_TOKEN:${modelId}`,
      keyGroup: "huggingface:HF_TOKEN",
      provider: "huggingface",
      modelId,
      name: `HuggingFace (${modelId})`,
      model: hf.chat(modelId),
      supportsSystem: true,
    });
  }

  if (chain.length === 0) {
    throw new AILimitReachedError(
      "No free AI provider keys are configured. Please add your free API keys in environment variables."
    );
  }

  return chain;
}

/**
 * Synchronous fallback chain helper (kept for backwards compatibility).
 */
export function getModelFallbackChain(): ModelEntry[] {
  const chain: ModelEntry[] = [];

  const googleCandidates = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
  ];
  for (const modelId of googleCandidates) {
    for (const { envName, apiKey } of collectUniqueKeys([
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY_2",
      "GOOGLE_GENERATIVE_AI_API_KEY_3",
    ])) {
      const model = getGoogleModel(modelId, apiKey);
      if (model) {
        chain.push({
          id: `google:${envName}:${modelId}`,
          keyGroup: `google:${envName}`,
          provider: "google",
          modelId,
          name: `Google (${envName} / ${modelId})`,
          model,
          supportsSystem: !modelId.toLowerCase().startsWith("gemma"),
        });
      }
    }
  }

  for (const { envName, apiKey } of collectUniqueKeys([
    "OPENROUTER_API_KEY",
    "OPENROUTER_API_KEY_1",
    "OPENROUTER_API_KEY_2",
  ])) {
    const model = getOpenRouterModel("openrouter/free", apiKey);
    if (model) {
      chain.push({
        id: `openrouter:${envName}:openrouter/free`,
        keyGroup: `openrouter:${envName}`,
        provider: "openrouter",
        modelId: "openrouter/free",
        name: `OpenRouter (${envName} / openrouter/free)`,
        model,
        supportsSystem: true,
      });
    }
  }

  for (const { envName, apiKey } of collectUniqueKeys(["GROQ_API_KEY"])) {
    const modelId = FALLBACK_GROQ_MODELS[0];
    const model = getGroqModel(modelId, apiKey);
    if (model) {
      chain.push({
        id: `groq:${envName}:${modelId}`,
        keyGroup: `groq:${envName}`,
        provider: "groq",
        modelId,
        name: `Groq (${envName} / ${modelId})`,
        model,
        supportsSystem: true,
      });
    }
  }

  for (const { envName, apiKey } of collectUniqueKeys([
    "APINEX_API_KEY",
    "APINEX_API_KEY_1",
    "APINEX_API_KEY_2",
  ])) {
    const modelId = FALLBACK_APINEX_FREE_MODELS[0];
    const model = getApinexModel(modelId, apiKey);
    if (model) {
      chain.push({
        id: `apinex:${envName}:${modelId}`,
        keyGroup: `apinex:${envName}`,
        provider: "apinex",
        modelId,
        name: `APInex (${envName} / ${modelId})`,
        model,
        supportsSystem: true,
      });
    }
  }

  if (chain.length === 0) {
    throw new AILimitReachedError();
  }

  return chain;
}

export function getAIModel(): LanguageModel {
  return getModelFallbackChain()[0].model;
}

function isEntryCoolingDown(entry: ModelEntry, now: number): boolean {
  const globalUntil = globalModelDisabledUntil.get(`${entry.provider}:${entry.modelId}`);
  if (globalUntil && now < globalUntil) return true;

  const keyUntil = keyCooldownUntil.get(entry.keyGroup);
  if (keyUntil && now < keyUntil) return true;

  const slotUntil = slotCooldownUntil.get(entry.id);
  if (slotUntil && now < slotUntil) return true;

  return false;
}

function extractErrorDetails(err: unknown): { status?: number; message: string } {
  if (!err || typeof err !== "object") {
    return { message: String(err ?? "Unknown error") };
  }
  const e = err as Record<string, unknown>;
  const status =
    typeof e.statusCode === "number"
      ? e.statusCode
      : typeof e.status === "number"
      ? e.status
      : undefined;
  const responseBody = typeof e.responseBody === "string" ? e.responseBody : "";
  const baseMsg = err instanceof Error ? err.message : String(err);
  const causeMsg =
    e.cause && e.cause instanceof Error ? ` ${e.cause.message}` : "";
  return {
    status,
    message: `${baseMsg}${causeMsg} ${responseBody}`.trim(),
  };
}

/**
 * Classifies an AI provider failure and records an immediate cooldown so paid,
 * deprecated, invalid, or exhausted models/keys are skipped right away.
 */
function recordFailureAndCooldown(entry: ModelEntry, err: unknown): void {
  const { status, message } = extractErrorDetails(err);
  const lower = message.toLowerCase();
  const now = Date.now();

  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const TWO_MINUTES = 2 * 60 * 1000;
  const NINETY_SECONDS = 90 * 1000;

  // 1. Paid-only, billing-required, or retired/not-found model -> immediately skip globally
  const isPaidOrUnavailable =
    status === 402 ||
    status === 404 ||
    /unavailable for free|paid version|requires billing|billing|insufficient[_ ]credits|insufficient[_ ]balance|top[- ]?up|payment required|add credits|no credits|not found|no longer available|deprecated|decommissioned|model_decommissioned|does not exist|not supported for generatecontent|no endpoints found/i.test(
      lower
    );

  if (isPaidOrUnavailable) {
    if (
      entry.provider === "apinex" &&
      /top[- ]?up|insufficient[_ ]balance|insufficient[_ ]credits|add credits|deposit|payment required/i.test(lower)
    ) {
      // Account-level top-up/balance requirement on APInex -> skip the whole key
      keyCooldownUntil.set(entry.keyGroup, now + SIX_HOURS);
    } else {
      globalModelDisabledUntil.set(`${entry.provider}:${entry.modelId}`, now + TWELVE_HOURS);
    }
    console.warn(`[AI Skip - Paid/Unavailable]: ${entry.name} -> ${message.slice(0, 180)}`);
    return;
  }

  // 2. Invalid/revoked API key -> skip entire key group
  const isAuthError =
    status === 401 ||
    (status === 403 && /api key|invalid|unauthorized|forbidden|disabled|suspended|leaked/i.test(lower)) ||
    /api_key_invalid|invalid api key|api key not valid|incorrect api key/i.test(lower);

  if (isAuthError) {
    keyCooldownUntil.set(entry.keyGroup, now + TWELVE_HOURS);
    console.warn(`[AI Skip - Invalid Key]: ${entry.keyGroup} -> ${message.slice(0, 180)}`);
    return;
  }

  // 3. Daily quota / account-level exhaustion
  const isDailyLimit =
    /free-models-per-day|per[-_ ]?day|daily|rpd|tpd|exceeded your current quota|quota.*exceeded|limit reached|out of quota/i.test(
      lower
    );

  if (isDailyLimit) {
    if (entry.provider === "openrouter" && /free-models-per-day|per[-_ ]?day|daily/i.test(lower)) {
      // OpenRouter free daily limit is account/key-wide -> skip all remaining models on this key
      keyCooldownUntil.set(entry.keyGroup, now + SIX_HOURS);
    } else {
      // Google & Groq quotas are per-model -> skip this (key + model) for 6h and try next model
      slotCooldownUntil.set(entry.id, now + SIX_HOURS);
    }
    console.warn(`[AI Skip - Daily Limit]: ${entry.name} -> ${message.slice(0, 180)}`);
    return;
  }

  // 4. Short-term rate limit (RPM / TPM / 429)
  const isRateLimit =
    status === 429 ||
    /rate[-_ ]?limit|too many requests|resource_exhausted|tokens per minute|requests per minute|overloaded|capacity/i.test(
      lower
    );

  if (isRateLimit) {
    slotCooldownUntil.set(entry.id, now + TWO_MINUTES);
    console.warn(`[AI Skip - Rate Limit]: ${entry.name} -> ${message.slice(0, 180)}`);
    return;
  }

  // 5. Timeout / transient provider error -> brief cooldown and immediately move on
  slotCooldownUntil.set(entry.id, now + NINETY_SECONDS);
  console.warn(`[AI Failover]: ${entry.name} failed -> ${message.slice(0, 180)}`);
}

function adaptSystemForPrompt(
  entry: ModelEntry,
  prompt: string,
  system?: string
): { prompt: string; system?: string } {
  if (!system || entry.supportsSystem) {
    return { prompt, system };
  }
  return {
    prompt: `Instructions:\n${system}\n\nRequest:\n${prompt}`,
    system: undefined,
  };
}

function adaptSystemForMessages(
  entry: ModelEntry,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  system?: string
): {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  system?: string;
} {
  if (!system || entry.supportsSystem) {
    return { messages, system };
  }
  const cloned = messages.map((m) => ({ ...m }));
  const firstUserIdx = cloned.findIndex((m) => m.role === "user");
  if (firstUserIdx >= 0) {
    cloned[firstUserIdx] = {
      ...cloned[firstUserIdx],
      content: `[Instructions]\n${system}\n\n[User]\n${cloned[firstUserIdx].content}`,
    };
  } else {
    cloned.unshift({ role: "user", content: `[Instructions]\n${system}` });
  }
  return { messages: cloned, system: undefined };
}

/**
 * Low-token, strictly free-only text generation with automatic failover across
 * all configured free keys & models. Immediately skips paid/unavailable/exhausted models.
 */
export async function generateTextWithFallback(options: {
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}) {
  const chain = await buildFreeModelFallbackChain();
  const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const startedAt = Date.now();
  const overallBudgetMs = options.abortSignal ? 60000 : 35000;

  for (const entry of chain) {
    const now = Date.now();
    if (options.abortSignal?.aborted) break;
    if (now - startedAt > overallBudgetMs) break;
    if (isEntryCoolingDown(entry, now)) continue;

    const adapted = adaptSystemForPrompt(entry, options.prompt, options.system);

    try {
      const res = await generateText({
        model: entry.model,
        prompt: adapted.prompt,
        system: adapted.system,
        temperature: options.temperature,
        maxOutputTokens,
        maxRetries: 0, // Do not waste retries/quota on a failing model; fail over immediately
        abortSignal: options.abortSignal || AbortSignal.timeout(10000),
      });

      if (!res.text || res.text.trim().length === 0) {
        throw new Error("Empty response from provider");
      }

      return {
        text: res.text,
        provider: entry.name,
      };
    } catch (err: unknown) {
      recordFailureAndCooldown(entry, err);
    }
  }

  throw new AILimitReachedError();
}

/**
 * Multimodal generation (Audio/Video recording or text) with automatic failover.
 * Supports passing an audio/video buffer directly to Gemini models for transcription & MoM analysis.
 */
export async function generateMultimodalWithFallback(options: {
  prompt: string;
  system?: string;
  fileBuffer?: Buffer | Uint8Array;
  mimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}): Promise<{ text: string; provider: string }> {
  // If no file, use standard text generation
  if (!options.fileBuffer || !options.mimeType) {
    return generateTextWithFallback({
      prompt: options.prompt,
      system: options.system,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      abortSignal: options.abortSignal,
    });
  }

  const chain = await buildFreeModelFallbackChain();
  // Filter for providers that support file attachments (Google / Gemini)
  const multimodalChain = chain.filter((e) => e.provider === "google");
  const maxOutputTokens = options.maxOutputTokens ?? 4000;
  const startedAt = Date.now();
  const overallBudgetMs = options.abortSignal ? 120000 : 90000;

  for (const entry of multimodalChain) {
    const now = Date.now();
    if (options.abortSignal?.aborted) break;
    if (now - startedAt > overallBudgetMs) break;
    if (isEntryCoolingDown(entry, now)) continue;

    try {
      const res = await generateText({
        model: entry.model,
        system: options.system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: options.fileBuffer,
                mediaType: options.mimeType,
              },
              {
                type: "text",
                text: options.prompt,
              },
            ],
          },
        ],
        temperature: options.temperature ?? 0.2,
        maxOutputTokens,
        maxRetries: 0,
        abortSignal: options.abortSignal || AbortSignal.timeout(60000),
      });

      if (!res.text || res.text.trim().length === 0) {
        throw new Error("Empty response from multimodal provider");
      }

      return {
        text: res.text,
        provider: entry.name,
      };
    } catch (err: unknown) {
      recordFailureAndCooldown(entry, err);
    }
  }

  throw new AILimitReachedError();
}

export interface VerifiedTextStreamResult {
  provider: string;
  toTextStreamResponse: (init?: ResponseInit) => Response;
}

/**
 * Real streaming failover: verifies the provider actually yields its first text chunk
 * before committing the HTTP stream response. If a provider is paid-only, rate-limited,
 * or errors on startup, it immediately fails over to the next free key/model.
 */
export async function streamTextWithFallback(options: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<VerifiedTextStreamResult> {
  const chain = await buildFreeModelFallbackChain();
  const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const startedAt = Date.now();
  const overallBudgetMs = 35000;

  for (const entry of chain) {
    const now = Date.now();
    if (now - startedAt > overallBudgetMs) break;
    if (isEntryCoolingDown(entry, now)) continue;

    const adapted = adaptSystemForMessages(entry, options.messages, options.system);

    try {
      let streamError: unknown = null;
      const result = streamText({
        model: entry.model,
        messages: adapted.messages,
        system: adapted.system,
        temperature: options.temperature,
        maxOutputTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(15000),
        onError: ({ error }) => {
          streamError = error;
        },
      });

      const iterator = result.textStream[Symbol.asyncIterator]();

      // Wait for the first non-empty chunk so startup/quota/paid errors are caught BEFORE responding 200
      let firstChunk = "";
      let streamFinished = false;
      while (true) {
        const next = await iterator.next();
        if (next.done) {
          streamFinished = true;
          break;
        }
        if (next.value && next.value.length > 0) {
          firstChunk = next.value;
          break;
        }
      }

      if (streamError) {
        throw streamError;
      }

      if (!firstChunk) {
        throw new Error("Provider returned an empty stream");
      }

      const encoder = new TextEncoder();
      const readable = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(firstChunk));
          if (streamFinished) {
            controller.close();
          }
        },
        async pull(controller) {
          if (streamFinished) {
            controller.close();
            return;
          }
          try {
            const next = await iterator.next();
            if (next.done) {
              streamFinished = true;
              controller.close();
            } else if (next.value) {
              controller.enqueue(encoder.encode(next.value));
            }
          } catch (err) {
            console.warn(`[AI Mid-Stream Error]: ${entry.name}:`, err);
            controller.close();
          }
        },
        async cancel() {
          if (iterator.return) {
            await iterator.return().catch(() => undefined);
          }
        },
      });

      return {
        provider: entry.name,
        toTextStreamResponse(init?: ResponseInit) {
          const headers = new Headers(init?.headers);
          if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "text/plain; charset=utf-8");
          }
          headers.set("Cache-Control", "no-store");
          headers.set("X-AI-Provider", entry.provider);
          return new Response(readable, {
            ...init,
            status: init?.status ?? 200,
            headers,
          });
        },
      };
    } catch (err: unknown) {
      recordFailureAndCooldown(entry, err);
    }
  }

  throw new AILimitReachedError();
}
