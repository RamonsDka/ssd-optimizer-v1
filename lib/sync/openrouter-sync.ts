// ─── OpenRouter Sync ──────────────────────────────────────────────────────────
// Fetches the public model list from the OpenRouter API and upserts discovered
// models into the local PostgreSQL database.
//
// Usage (Node.js / tsx):
//   tsx lib/sync/openrouter-sync.ts          # dry-run (logs only)
//   tsx lib/sync/openrouter-sync.ts --commit # actually writes to DB
//
// Also exported as `syncOpenRouterModels()` for use from API routes.

import { prisma } from "@/lib/db/prisma";
import type { Tier } from "@/types";

// ─── OpenRouter API shape ─────────────────────────────────────────────────────

interface OpenRouterModelRaw {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string | number; // USD per token
    completion?: string | number;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    context_length?: number;
  };
}

interface OpenRouterListResponse {
  data: OpenRouterModelRaw[];
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface SyncResult {
  total: number;
  upserted: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export interface SyncError {
  modelId: string;
  reason: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const REQUEST_TIMEOUT_MS = 30_000;

// Strength tags derived from model name/description heuristics
const STRENGTH_KEYWORDS: Record<string, string[]> = {
  reasoning: ["reasoning", "think", "o1", "o3", "r1", "r2"],
  coding: ["coder", "code", "codex", "devstral", "qwen2.5-coder"],
  speed: ["flash", "haiku", "mini", "nano", "fast", "turbo", "instant"],
  context: ["128k", "200k", "1m", "2m", "long"],
  "cost-efficient": ["free", "economic", "micro", "tiny", "small"],
  architecture: ["architect", "design", "sonnet", "opus"],
  multimodal: ["vision", "vl", "multimodal", "pixtral", "llava"],
  "structured-output": ["instruct", "chat", "function"],
  analysis: ["analyze", "analyst", "research"],
  creative: ["creative", "story", "write", "novelist"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract provider ID from OpenRouter model ID.
 * OpenRouter IDs follow the pattern: "<provider>/<model-name>"
 * Some IDs may not have a slash — fall back to the full ID.
 */
function extractProviderId(orId: string): string {
  const slash = orId.indexOf("/");
  if (slash === -1) return orId.toLowerCase();
  return orId.slice(0, slash).toLowerCase();
}

/**
 * Parse cost from OpenRouter's string/number pricing field.
 * OpenRouter gives cost per TOKEN. Multiply × 1M to get per-1M cost.
 */
function parseCostPer1M(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (isNaN(n) || n < 0) return 0;
  // OpenRouter pricing is per-token — convert to per-1M
  return parseFloat((n * 1_000_000).toFixed(4));
}

/**
 * Infer SDD tier from cost and model name heuristics.
 */
function inferTier(model: OpenRouterModelRaw): Tier {
  const id = model.id.toLowerCase();
  const name = (model.name ?? "").toLowerCase();
  const combined = `${id} ${name}`;

  // Hard-code known premium patterns
  const premiumPatterns = [
    "claude-opus", "claude-sonnet", "gpt-4o", "o1", "o3", "gemini-2.5-pro",
    "gemini-2.0-pro", "grok-3", "mistral-large", "llama-3.3-70b",
    "deepseek-v3", "qwen-max", "command-r-plus",
  ];
  for (const p of premiumPatterns) {
    if (combined.includes(p)) return "PREMIUM";
  }

  // Economic patterns (free, micro, tiny models)
  const economicPatterns = [
    ":free", "free", "haiku-3", "mini", "nano", "tiny", "small",
    "7b", "8b", "3b", "1b", "flash-lite", "flash-8b",
  ];
  for (const p of economicPatterns) {
    if (combined.includes(p)) return "ECONOMIC";
  }

  // Cost-based inference
  const promptCost = parseCostPer1M(model.pricing?.prompt);
  if (promptCost === 0) return "ECONOMIC"; // free models
  if (promptCost <= 1.0) return "ECONOMIC"; // very cheap
  if (promptCost <= 5.0) return "BALANCED";
  return "PREMIUM"; // expensive = premium
}

/**
 * Derive strength tags from model name and description.
 */
function deriveStrengths(model: OpenRouterModelRaw): string[] {
  const haystack = `${model.id} ${model.name ?? ""} ${model.description ?? ""}`.toLowerCase();
  const found: string[] = [];

  for (const [tag, keywords] of Object.entries(STRENGTH_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      found.push(tag);
    }
  }

  // Default: add "speed" for flash/mini models, "reasoning" for think/o* models
  if (found.length === 0) {
    found.push("analysis"); // generic fallback
  }

  return found;
}

/**
 * Fetch the raw model list from the OpenRouter API.
 * Uses the API key if configured (higher rate limits), falls back to anonymous.
 */
async function fetchOpenRouterModels(): Promise<OpenRouterModelRaw[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "SDD Team Optimizer",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(
        `OpenRouter API returned ${res.status} ${res.statusText}`
      );
    }

    const json = (await res.json()) as OpenRouterListResponse;

    if (!Array.isArray(json?.data)) {
      throw new Error("Unexpected OpenRouter API response shape");
    }

    return json.data;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Core sync function ───────────────────────────────────────────────────────

/**
 * Sync OpenRouter models into the local database.
 *
 * @param dryRun  When true, logs what would be upserted but makes no DB writes.
 * @returns       SyncResult summary.
 */
export async function syncOpenRouterModels(dryRun = false): Promise<SyncResult> {
  const startMs = Date.now();
  let upserted = 0;
  let skipped = 0;
  let errors = 0;

  console.log(
    `[openrouter-sync] Starting sync${dryRun ? " (DRY RUN)" : ""}...`
  );

  // 1. Fetch model list
  const rawModels = await fetchOpenRouterModels();
  console.log(`[openrouter-sync] Fetched ${rawModels.length} models from OpenRouter`);

  // 2. Process each model
  for (const raw of rawModels) {
    const modelId = raw.id?.trim();
    if (!modelId || !modelId.includes("/")) {
      // Skip malformed IDs (no provider prefix)
      skipped++;
      continue;
    }

    try {
      const providerId = extractProviderId(modelId);
      const tier = inferTier(raw);
      const contextWindow =
        raw.context_length ??
        raw.top_provider?.context_length ??
        32_000;
      const costPer1M = parseCostPer1M(raw.pricing?.prompt);
      const strengths = deriveStrengths(raw);
      const name = (raw.name ?? modelId).trim();

      if (dryRun) {
        console.log(
          `[DRY RUN] Would upsert: ${modelId} | ${tier} | ${contextWindow}k ctx | $${costPer1M}/1M | [${strengths.join(", ")}]`
        );
        upserted++;
        continue;
      }

      // Upsert provider first (create if new, no-op if exists)
      await prisma.provider.upsert({
        where: { id: providerId },
        create: { id: providerId, name: providerId },
        update: {}, // never overwrite manually set provider names
      });

      // Upsert model — only overwrite discoveredByAI metadata
      // Does NOT overwrite models that were manually seeded (preserves curated data)
      await prisma.model.upsert({
        where: { id: modelId },
        create: {
          id: modelId,
          name,
          providerId,
          tier,
          contextWindow,
          costPer1M,
          strengths,
          discoveredByAI: true,
        },
        update: {
          // Only update fields that OpenRouter knows better than our manual seed
          contextWindow,
          costPer1M,
          strengths,
          // Preserve tier if already set — only auto-infer for new models
          // NOTE: discoveredByAI stays true once set
        },
      });

      upserted++;
    } catch (err) {
      errors++;
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[openrouter-sync] Error on ${modelId}: ${reason}`);
    }
  }

  const durationMs = Date.now() - startMs;

  const result: SyncResult = {
    total: rawModels.length,
    upserted,
    skipped,
    errors,
    durationMs,
  };

  console.log(
    `[openrouter-sync] Done in ${durationMs}ms — ` +
      `${upserted} upserted, ${skipped} skipped, ${errors} errors`
  );

  return result;
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

// Runs when invoked directly: tsx lib/sync/openrouter-sync.ts [--commit]
const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  process.argv[1].includes("openrouter-sync");

if (isMainModule) {
  const dryRun = !process.argv.includes("--commit");

  if (dryRun) {
    console.log(
      "Running in DRY RUN mode. Pass --commit to write to the database."
    );
  }

  syncOpenRouterModels(dryRun)
    .then((result) => {
      console.log("Sync result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Sync failed:", err);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => {});
    });
}
