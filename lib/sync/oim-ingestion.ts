// ─── OIM Ingestion Pipeline ───────────────────────────────────────────────────
// Unified data ingestion for the Intelligent Model Matrix Orchestrator (OIM).
//
// Responsibilities:
//   1. Fetch benchmark data from ArtificialAnalysis.ai (mocked / structured)
//   2. Integrate LM Arena scores into the UnifiedModelMatrix
//   3. Ingest model metadata from OpenRouter/Providers
//   4. Discover new models via embedding-service.ts similarity scoring
//   5. Auto-estimate scores for models without benchmark data
//
// All external scores are normalised to [0.0 – 1.0] via `normalizeExternalScore()`
// before being persisted through `oim-service.ts`.
//
// Usage:
//   import { ingestModelData } from "@/lib/sync/oim-ingestion";
//   const result = await ingestModelData({ dryRun: false });

import { prisma } from "@/lib/db/prisma";
import {
  upsertUnifiedScores,
  getUnifiedScores,
} from "@/lib/db/oim-service";
import { fetchAllCategories } from "@/lib/sync/lmarena-client";
import { categorizeModel, isEmbeddingServiceAvailable, loadModel } from "@/lib/ai/embedding-service";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import type {
  ScoreSource,
  UnifiedModelScoresData,
} from "@/types";

// ─── Public Result Types ──────────────────────────────────────────────────────

export interface OimIngestionResult {
  /** Source label for the run */
  source: ScoreSource;
  /** Total model IDs processed */
  total: number;
  /** Records successfully upserted */
  upserted: number;
  /** Records skipped (already up-to-date, missing FK, etc.) */
  skipped: number;
  /** Errors encountered (non-fatal — processing continues) */
  errors: number;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
  errorDetails?: string;
}

export interface OimIngestionSummary {
  arena: OimIngestionResult;
  artificialAnalysis: OimIngestionResult;
  webInferred: OimIngestionResult;
  totalDurationMs: number;
}

export interface OimIngestionOptions {
  /** When true, logs what would be written but makes no DB writes. Default: false */
  dryRun?: boolean;
  /**
   * Which sources to run. Default: all three.
   * Useful for incremental or targeted re-syncs.
   */
  sources?: Array<ScoreSource>;
}

// ─── ArtificialAnalysis.ai — Mock / Structured Fetcher ────────────────────────
//
// ArtificialAnalysis.ai publishes detailed per-model benchmarks (MMLU, HumanEval,
// MT-Bench, MATH, etc.) on their website.  A proper scraping integration would
// call their unofficial JSON endpoints or scrape the comparison table.
//
// For now we model the expected payload shape and provide representative static
// data for top-tier models.  When a real API becomes available the
// `fetchFromArtificialAnalysis()` function is the single integration point.

/** Raw payload shape returned by ArtificialAnalysis (or our mock) */
export interface ArtificialAnalysisModelRaw {
  /** Canonical model ID as used on ArtificialAnalysis (may need mapping) */
  modelId: string;
  /** MMLU score [0–100] — measures knowledge & reasoning */
  mmlu?: number;
  /** HumanEval score [0–100] — measures coding capability */
  humanEval?: number;
  /** MT-Bench score [1–10] — measures instruction following & conversation */
  mtBench?: number;
  /** MATH score [0–100] — measures mathematical reasoning */
  math?: number;
  /** GPQA score [0–100] — measures graduate-level reasoning */
  gpqa?: number;
  /** Snapshot date (ISO string) for historical anchoring */
  snapshotDate: string;
}

/**
 * Fetch benchmark data from ArtificialAnalysis.ai.
 *
 * Currently returns a structured static dataset representing the most
 * well-known models.  Replace the body of this function with a real HTTP
 * fetch when an official or unofficial API endpoint is available.
 *
 * Scores sourced from public ArtificialAnalysis leaderboard (2026-Q1).
 *
 * @returns Array of raw benchmark entries for all known models.
 */
export async function fetchFromArtificialAnalysis(): Promise<
  ArtificialAnalysisModelRaw[]
> {
  // ── NOTE ─────────────────────────────────────────────────────────────────────
  // In production this would be:
  //   const res = await fetch("https://artificialanalysis.ai/api/models", {...});
  //   const json = await res.json();
  //   return json.models as ArtificialAnalysisModelRaw[];
  //
  // For now we return a curated static dataset.  The scores below are
  // representative approximations derived from public ArtificialAnalysis charts.
  // ─────────────────────────────────────────────────────────────────────────────

  const SNAPSHOT = "2026-01-15";

  const staticData: ArtificialAnalysisModelRaw[] = [
    // ── Anthropic ─────────────────────────────────────────────────────────────
    {
      modelId: "anthropic/claude-opus-4-5",
      mmlu: 90.1,
      humanEval: 87.4,
      mtBench: 9.4,
      math: 78.3,
      gpqa: 74.2,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "anthropic/claude-sonnet-4-5",
      mmlu: 88.3,
      humanEval: 92.0,
      mtBench: 9.2,
      math: 75.1,
      gpqa: 70.5,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "anthropic/claude-3-7-sonnet-latest",
      mmlu: 86.8,
      humanEval: 90.5,
      mtBench: 9.1,
      math: 73.6,
      gpqa: 68.4,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "anthropic/claude-haiku-3-5",
      mmlu: 80.2,
      humanEval: 83.6,
      mtBench: 8.6,
      math: 64.4,
      gpqa: 59.0,
      snapshotDate: SNAPSHOT,
    },
    // ── OpenAI ────────────────────────────────────────────────────────────────
    {
      modelId: "openai/gpt-4o",
      mmlu: 88.7,
      humanEval: 90.2,
      mtBench: 9.3,
      math: 76.6,
      gpqa: 71.0,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "openai/o3",
      mmlu: 92.0,
      humanEval: 95.1,
      mtBench: 9.6,
      math: 96.7,
      gpqa: 87.7,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "openai/o4-mini",
      mmlu: 88.0,
      humanEval: 93.4,
      mtBench: 9.1,
      math: 93.4,
      gpqa: 81.0,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "openai/gpt-4o-mini",
      mmlu: 82.0,
      humanEval: 87.2,
      mtBench: 8.8,
      math: 70.2,
      gpqa: 60.0,
      snapshotDate: SNAPSHOT,
    },
    // ── Google ────────────────────────────────────────────────────────────────
    {
      modelId: "google/gemini-2.5-pro-preview",
      mmlu: 90.0,
      humanEval: 90.0,
      mtBench: 9.2,
      math: 91.6,
      gpqa: 84.0,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "google/gemini-2.5-flash-preview",
      mmlu: 85.0,
      humanEval: 88.5,
      mtBench: 8.9,
      math: 88.0,
      gpqa: 78.0,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "google/gemini-2.0-flash",
      mmlu: 83.0,
      humanEval: 85.5,
      mtBench: 8.7,
      math: 82.0,
      gpqa: 72.0,
      snapshotDate: SNAPSHOT,
    },
    // ── DeepSeek ──────────────────────────────────────────────────────────────
    {
      modelId: "deepseek/deepseek-r1",
      mmlu: 90.8,
      humanEval: 92.6,
      mtBench: 9.1,
      math: 97.3,
      gpqa: 71.5,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "deepseek/deepseek-chat",
      mmlu: 88.0,
      humanEval: 89.0,
      mtBench: 8.9,
      math: 84.0,
      gpqa: 65.0,
      snapshotDate: SNAPSHOT,
    },
    // ── Mistral ───────────────────────────────────────────────────────────────
    {
      modelId: "mistral/mistral-large-latest",
      mmlu: 84.0,
      humanEval: 84.1,
      mtBench: 8.6,
      math: 63.4,
      gpqa: 57.0,
      snapshotDate: SNAPSHOT,
    },
    {
      modelId: "mistral/codestral-latest",
      mmlu: 78.5,
      humanEval: 91.6,
      mtBench: 8.2,
      math: 58.0,
      gpqa: 48.0,
      snapshotDate: SNAPSHOT,
    },
    // ── xAI ───────────────────────────────────────────────────────────────────
    {
      modelId: "xai/grok-3-beta",
      mmlu: 87.0,
      humanEval: 88.0,
      mtBench: 9.0,
      math: 83.0,
      gpqa: 72.0,
      snapshotDate: SNAPSHOT,
    },
  ];

  console.log(
    `[oim-ingestion] ArtificialAnalysis: returning ${staticData.length} model entries (static dataset)`
  );

  return staticData;
}

// ─── Score Normalisation ─────────────────────────────────────────────────────

export type NormalisationStrategy =
  | "percent-to-fraction"   // [0–100] → [0.0–1.0]  (divide by 100)
  | "mt-bench"              // [1–10]  → [0.0–1.0]  ((value − 1) / 9)
  | "arena-elo"             // ELO scores ~[800–1400] → [0.0–1.0] via sigmoid
  | "clamp"                 // already in [0–1], just clamp to bounds
  | "rank-inverse";         // rank position → score (lower rank = higher score)

/**
 * Normalise a raw external score to the [0.0 – 1.0] range used by
 * `UnifiedModelScores`.
 *
 * @param value      Raw value from the external source.
 * @param strategy   How the raw value should be mapped to [0, 1].
 * @param options    Extra parameters needed by specific strategies.
 *
 * @returns Normalised score in [0.0 – 1.0], or `null` when the input is invalid.
 *
 * @example
 *   normalizeExternalScore(87.5, "percent-to-fraction")  // → 0.875
 *   normalizeExternalScore(8.6,  "mt-bench")             // → 0.844
 *   normalizeExternalScore(1150, "arena-elo")            // → ~0.69
 *   normalizeExternalScore(3,    "rank-inverse", { totalModels: 50 }) // → 0.94
 */
export function normalizeExternalScore(
  value: number | null | undefined,
  strategy: NormalisationStrategy,
  options?: { totalModels?: number; minElo?: number; maxElo?: number }
): number | null {
  // Guard: reject non-finite or missing values.
  if (value === null || value === undefined || !isFinite(value)) {
    return null;
  }

  let normalised: number;

  switch (strategy) {
    // [0–100] → [0.0–1.0]
    case "percent-to-fraction": {
      normalised = value / 100;
      break;
    }

    // MT-Bench is scored [1–10]; map linearly onto [0–1].
    case "mt-bench": {
      normalised = (value - 1) / 9;
      break;
    }

    // ELO is unbounded; use a sigmoid centred at 1000 with scale 200.
    // f(elo) = 1 / (1 + e^(-(elo - 1000) / 200))
    // Typical LM Arena range [800–1400] maps to roughly [0.27–0.95].
    case "arena-elo": {
      const centre = 1000;
      const scale = 200;
      normalised = 1 / (1 + Math.exp(-(value - centre) / scale));
      break;
    }

    // Already in [0–1] — just clamp for safety.
    case "clamp": {
      normalised = value;
      break;
    }

    // Rank-inverse: rank 1 → score 1.0, last rank → score 0.0.
    // Requires options.totalModels to be set.
    case "rank-inverse": {
      const total = options?.totalModels ?? 100;
      if (value < 1) return null; // ranks start at 1
      normalised = (total - value) / (total - 1);
      break;
    }

    default: {
      console.warn(`[normalizeExternalScore] Unknown strategy: ${strategy as string}`);
      return null;
    }
  }

  // Final clamp to [0.0, 1.0] — prevents floating-point edge cases.
  return Math.max(0, Math.min(1, normalised));
}

// ─── Arena → UnifiedModelScores Bridge ───────────────────────────────────────

/**
 * Map LM Arena category scores for a model into the four OIM dimensions:
 * Coding, Thinking, Design, Instruction Following.
 *
 * The mapping uses weighted averages across the most relevant Arena categories.
 * Arena scores are ELO values → normalised via `arena-elo` strategy.
 *
 * @param arenaScores  Map of category slug → raw ELO score.
 * @returns            Partial OIM dimension scores (only dimensions with coverage).
 */
function mapArenaToDimensions(
  arenaScores: Map<string, number>
): {
  codingScore: number | null;
  thinkingScore: number | null;
  designScore: number | null;
  instructionScore: number | null;
  contextEfficiency: number | null;
} {
  // Helper: get a normalised score for a category (returns null if not present).
  const norm = (cat: string): number | null => {
    const raw = arenaScores.get(cat);
    if (raw === undefined) return null;
    return normalizeExternalScore(raw, "arena-elo");
  };

  // Helper: weighted average of non-null values.
  const wavg = (
    entries: Array<{ value: number | null; weight: number }>
  ): number | null => {
    const valid = entries.filter((e) => e.value !== null) as Array<{
      value: number;
      weight: number;
    }>;
    if (valid.length === 0) return null;
    const totalWeight = valid.reduce((s, e) => s + e.weight, 0);
    const weightedSum = valid.reduce((s, e) => s + e.value * e.weight, 0);
    return weightedSum / totalWeight;
  };

  return {
    // Coding = coding + function-calling + structured-output + agent-tasks
    codingScore: wavg([
      { value: norm("coding"), weight: 0.50 },
      { value: norm("function-calling"), weight: 0.20 },
      { value: norm("structured-output"), weight: 0.15 },
      { value: norm("agent-tasks"), weight: 0.15 },
    ]),

    // Thinking = reasoning + math + hard-prompts + analysis
    thinkingScore: wavg([
      { value: norm("reasoning"), weight: 0.35 },
      { value: norm("math"), weight: 0.30 },
      { value: norm("hard-prompts"), weight: 0.20 },
      { value: norm("analysis"), weight: 0.15 },
    ]),

    // Design = creative-writing + roleplay + dialogue + summarization
    designScore: wavg([
      { value: norm("creative-writing"), weight: 0.40 },
      { value: norm("roleplay"), weight: 0.20 },
      { value: norm("dialogue"), weight: 0.20 },
      { value: norm("summarization"), weight: 0.20 },
    ]),

    // Instruction = instruction-following + overall + planning
    instructionScore: wavg([
      { value: norm("instruction-following"), weight: 0.50 },
      { value: norm("overall"), weight: 0.30 },
      { value: norm("planning"), weight: 0.20 },
    ]),

    // Context efficiency = long-context (proxy)
    contextEfficiency: norm("long-context"),
  };
}

// ─── ArtificialAnalysis → UnifiedModelScores Bridge ─────────────────────────

/**
 * Map ArtificialAnalysis raw benchmarks to OIM dimension scores.
 * All benchmark scores use the `percent-to-fraction` strategy except MT-Bench.
 */
function mapAAToDimensions(raw: ArtificialAnalysisModelRaw): {
  codingScore: number | null;
  thinkingScore: number | null;
  designScore: number | null;
  instructionScore: number | null;
  contextEfficiency: number | null;
} {
  const coding = normalizeExternalScore(raw.humanEval, "percent-to-fraction");
  const thinking = normalizeExternalScore(
    // Thinking = weighted avg of MMLU (breadth) + MATH (depth) + GPQA (hard)
    raw.mmlu !== undefined && raw.math !== undefined && raw.gpqa !== undefined
      ? raw.mmlu * 0.35 + raw.math * 0.40 + raw.gpqa * 0.25
      : raw.mmlu,
    "percent-to-fraction"
  );
  const instruction = normalizeExternalScore(raw.mtBench, "mt-bench");

  return {
    codingScore: coding,
    thinkingScore: thinking,
    // Design: AA doesn't have a direct design benchmark; derive from MT-Bench
    // (conversational quality correlates with design fluency).
    designScore: instruction !== null ? instruction * 0.85 : null,
    instructionScore: instruction,
    // Context efficiency: not measured by ArtificialAnalysis directly.
    contextEfficiency: null,
  };
}

// ─── Embedding-based Score Estimation ────────────────────────────────────────

/**
 * Estimate OIM dimension scores for a model that has NO benchmark coverage.
 *
 * Uses `categorizeModel()` from the embedding service to compute semantic
 * similarity between the model's name/description and each capability anchor.
 * The resulting confidence scores are used as proxy dimension values.
 *
 * @param modelId     Canonical model ID.
 * @param description Short textual description of the model.
 * @returns           Estimated dimension scores and a note that they are inferred.
 */
async function estimateScoresViaEmbedding(
  modelId: string,
  description: string
): Promise<{
  codingScore: number | null;
  thinkingScore: number | null;
  designScore: number | null;
  instructionScore: number | null;
  contextEfficiency: number | null;
  inferenceNote: string;
}> {
  try {
    const capabilities = await categorizeModel(modelId, description);

    // Pull confidence values for relevant categories (returns 0 if not found).
    const get = (cat: string): number => {
      const entry = capabilities.categories.find((c) => c.category === cat);
      return entry?.confidence ?? 0;
    };

    return {
      // Coding: average of coding + function-calling confidences
      codingScore: (get("coding") + get("function-calling")) / 2,
      // Thinking: average of reasoning + math analysis
      thinkingScore: (get("reasoning") + get("math") + get("analysis")) / 3,
      // Design: average of creative-writing + dialogue
      designScore: (get("creative-writing") + get("dialogue")) / 2,
      // Instruction: instruction-following confidence
      instructionScore: get("instruction-following"),
      // Context efficiency: long-context confidence
      contextEfficiency: get("long-context"),
      inferenceNote: `WEB_INFERRED via embedding similarity (overallConfidence: ${capabilities.overallConfidence.toFixed(3)})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[oim-ingestion] Embedding estimation failed for ${modelId}: ${msg}`
    );
    return {
      codingScore: null,
      thinkingScore: null,
      designScore: null,
      instructionScore: null,
      contextEfficiency: null,
      inferenceNote: `WEB_INFERRED estimation failed: ${msg}`,
    };
  }
}

// ─── Source: ARENA ───────────────────────────────────────────────────────────

/**
 * Ingest LM Arena leaderboard data into `UnifiedModelScores`.
 *
 * Process:
 * 1. Fetch all category leaderboards from LM Arena via the existing client.
 * 2. For each model that exists in our DB, collect category ELO scores.
 * 3. Map scores to OIM dimensions via `mapArenaToDimensions()`.
 * 4. Upsert a `ARENA`-sourced snapshot through `oim-service`.
 */
async function ingestFromArena(
  dryRun: boolean
): Promise<OimIngestionResult> {
  const startMs = Date.now();
  let total = 0;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  const errorLog: string[] = [];
  const SOURCE: ScoreSource = "ARENA";

  console.log(
    `[oim-ingestion:arena] Starting ingestion${dryRun ? " (DRY RUN)" : ""}...`
  );

  try {
    // 1. Fetch all LM Arena categories
    const leaderboards = await fetchAllCategories();
    console.log(
      `[oim-ingestion:arena] Fetched ${leaderboards.size} categories`
    );

    // 2. Build a per-model map: modelId → { category → ELO }
    const modelCategoryScores = new Map<string, Map<string, number>>();
    const modelSnapshotDates = new Map<string, Date>();

    for (const [category, board] of leaderboards.entries()) {
      for (const entry of board.models) {
        const arenaName = entry.model.trim();

        // Resolve to our canonical modelId via DB lookup (same logic as lmarena-sync)
        const dbModel = await prisma.model.findFirst({
          where: {
            OR: [
              { id: arenaName },
              { id: { endsWith: `/${arenaName}` } },
              { name: { contains: arenaName, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });

        if (!dbModel) continue;

        const modelId = dbModel.id;

        if (!modelCategoryScores.has(modelId)) {
          modelCategoryScores.set(modelId, new Map());
        }

        // Store the highest score seen for this model+category combination
        const existing = modelCategoryScores.get(modelId)!.get(category);
        if (existing === undefined || entry.score > existing) {
          modelCategoryScores.get(modelId)!.set(category, entry.score);
        }

        // Track latest snapshot date
        const entryDate = new Date(entry.leaderboardPublishDate);
        const currentDate = modelSnapshotDates.get(modelId);
        if (!currentDate || entryDate > currentDate) {
          modelSnapshotDates.set(modelId, entryDate);
        }
      }
    }

    console.log(
      `[oim-ingestion:arena] Found coverage for ${modelCategoryScores.size} models`
    );
    total = modelCategoryScores.size;

    // 3. Map dimensions and upsert
    for (const [modelId, categoryScores] of modelCategoryScores.entries()) {
      try {
        const dimensions = mapArenaToDimensions(categoryScores);
        const snapshotDate = modelSnapshotDates.get(modelId) ?? new Date();

        const data: UnifiedModelScoresData = {
          modelId,
          source: SOURCE,
          snapshotDate,
          ...dimensions,
          rawData: { categoryScores: Object.fromEntries(categoryScores) },
        };

        if (dryRun) {
          console.log(
            `[DRY RUN][arena] Would upsert UnifiedModelScores: ${modelId} | ` +
              `coding=${dimensions.codingScore?.toFixed(3) ?? "null"} ` +
              `thinking=${dimensions.thinkingScore?.toFixed(3) ?? "null"} ` +
              `design=${dimensions.designScore?.toFixed(3) ?? "null"} ` +
              `instruction=${dimensions.instructionScore?.toFixed(3) ?? "null"}`
          );
          upserted++;
        } else {
          await upsertUnifiedScores(data);
          upserted++;
          console.log(
            `[oim-ingestion:arena] Upserted: ${modelId} | snapshot: ${snapshotDate.toISOString().slice(0, 10)}`
          );
        }
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        errorLog.push(`${modelId}: ${msg}`);
        console.error(
          `[oim-ingestion:arena] Error processing ${modelId}: ${msg}`
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[oim-ingestion:arena] Fatal error: ${msg}`);
    errors++;
    errorLog.push(`FATAL: ${msg}`);
  }

  const durationMs = Date.now() - startMs;
  console.log(
    `[oim-ingestion:arena] Done in ${durationMs}ms — ` +
      `${total} models, ${upserted} upserted, ${skipped} skipped, ${errors} errors`
  );

  return {
    source: SOURCE,
    total,
    upserted,
    skipped,
    errors,
    durationMs,
    errorDetails: errorLog.length > 0 ? errorLog.join("\n") : undefined,
  };
}

// ─── Source: ARTIFICIAL_ANALYSIS ────────────────────────────────────────────

/**
 * Ingest ArtificialAnalysis benchmark data into `UnifiedModelScores`.
 *
 * Only models that already exist in our DB are processed.  New models are
 * not created here — that responsibility belongs to `openrouter-sync.ts`.
 */
async function ingestFromArtificialAnalysis(
  dryRun: boolean
): Promise<OimIngestionResult> {
  const startMs = Date.now();
  let total = 0;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  const errorLog: string[] = [];
  const SOURCE: ScoreSource = "ARTIFICIAL_ANALYSIS";

  console.log(
    `[oim-ingestion:aa] Starting ingestion${dryRun ? " (DRY RUN)" : ""}...`
  );

  try {
    const rawEntries = await fetchFromArtificialAnalysis();
    total = rawEntries.length;
    console.log(
      `[oim-ingestion:aa] Fetched ${total} entries from ArtificialAnalysis`
    );

    for (const raw of rawEntries) {
      try {
        // Verify the model exists in our DB (FK constraint)
        const dbModel = await prisma.model.findUnique({
          where: { id: raw.modelId },
          select: { id: true },
        });

        if (!dbModel) {
          console.warn(
            `[oim-ingestion:aa] No DB record for modelId: ${raw.modelId} — skipping`
          );
          skipped++;
          continue;
        }

        const dimensions = mapAAToDimensions(raw);
        const snapshotDate = new Date(raw.snapshotDate);

        const data: UnifiedModelScoresData = {
          modelId: dbModel.id,
          source: SOURCE,
          snapshotDate,
          ...dimensions,
          rawData: {
            mmlu: raw.mmlu ?? null,
            humanEval: raw.humanEval ?? null,
            mtBench: raw.mtBench ?? null,
            math: raw.math ?? null,
            gpqa: raw.gpqa ?? null,
          },
        };

        if (dryRun) {
          console.log(
            `[DRY RUN][aa] Would upsert: ${dbModel.id} | ` +
              `coding=${dimensions.codingScore?.toFixed(3) ?? "null"} ` +
              `thinking=${dimensions.thinkingScore?.toFixed(3) ?? "null"}`
          );
          upserted++;
        } else {
          await upsertUnifiedScores(data);
          upserted++;
          console.log(`[oim-ingestion:aa] Upserted: ${dbModel.id}`);
        }
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        errorLog.push(`${raw.modelId}: ${msg}`);
        console.error(
          `[oim-ingestion:aa] Error processing ${raw.modelId}: ${msg}`
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[oim-ingestion:aa] Fatal error: ${msg}`);
    errors++;
    errorLog.push(`FATAL: ${msg}`);
  }

  const durationMs = Date.now() - startMs;
  console.log(
    `[oim-ingestion:aa] Done in ${durationMs}ms — ` +
      `${total} total, ${upserted} upserted, ${skipped} skipped, ${errors} errors`
  );

  return {
    source: SOURCE,
    total,
    upserted,
    skipped,
    errors,
    durationMs,
    errorDetails: errorLog.length > 0 ? errorLog.join("\n") : undefined,
  };
}

// ─── Source: WEB_INFERRED ────────────────────────────────────────────────────

/**
 * Ingest embedding-inferred scores for models that have NO coverage from
 * ARENA or ARTIFICIAL_ANALYSIS sources.
 *
 * Process:
 * 1. Fetch all models from DB.
 * 2. For each model, check if a score snapshot already exists from ARENA or AA.
 * 3. If not → run `categorizeModel()` to estimate scores semantically.
 * 4. Upsert a `WEB_INFERRED`-sourced snapshot.
 *
 * This ensures every model in our database has SOME score even before it
 * appears in official benchmarks.
 */
// Batch size for categorization inference — prevents memory exhaustion (ONNX) and
// rate-limit issues (Gemini LLM fallback).
// Each `categorizeModel()` call loads the ONNX model once (singleton) or makes an
// API call.  Processing in small batches with brief pauses gives the GC time to
// reclaim memory and avoids hammering the Gemini API quota.
const WEB_INFERRED_BATCH_SIZE = 5;

async function ingestWebInferred(
  dryRun: boolean
): Promise<OimIngestionResult> {
  const startMs = Date.now();
  let total = 0;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  const errorLog: string[] = [];
  const SOURCE: ScoreSource = "WEB_INFERRED";

  console.log(
    `[oim-ingestion:web] Starting embedding-inference ingestion${dryRun ? " (DRY RUN)" : ""} (batch size: ${WEB_INFERRED_BATCH_SIZE})...`
  );

  // ── Embedding / LLM service availability check ───────────────────────────
  // Attempt to warm-load the ONNX model before iterating over models.
  // If loadModel() returns null (Ort::Exception / missing native binding), we
  // check whether the Gemini LLM fallback is configured before aborting.
  // When Gemini IS available, categorizeModel() will delegate to it automatically,
  // so we can proceed with ingestion.  Only abort when neither service is ready.
  try {
    const warmPipeline = await loadModel();
    if (warmPipeline === null || !isEmbeddingServiceAvailable()) {
      if (isGeminiConfigured()) {
        console.info(
          "[oim-ingestion:web] ONNX embedding service unavailable. " +
            "Proceeding with Gemini LLM fallback for WEB_INFERRED ingestion."
        );
        // Fall through — categorizeModel() will use the LLM path automatically.
      } else {
        console.warn(
          "[oim-ingestion:web] Embedding service unavailable and Gemini not configured. " +
            "Skipping WEB_INFERRED ingestion — all models will rely on ARENA/AA sources."
        );
        return {
          source: SOURCE,
          total: 0,
          upserted: 0,
          skipped: 0,
          errors: 1,
          durationMs: Date.now() - startMs,
          errorDetails: "Embedding service unavailable: ONNX model failed to initialize. Set GEMINI_API_KEY to enable LLM fallback.",
        };
      }
    }
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : String(initErr);
    if (isGeminiConfigured()) {
      console.info(
        `[oim-ingestion:web] ONNX warm-load error (${msg}). Proceeding with Gemini LLM fallback.`
      );
      // Fall through — categorizeModel() will use the LLM path automatically.
    } else {
      console.error(`[oim-ingestion:web] Embedding service warm-load failed: ${msg}`);
      return {
        source: SOURCE,
        total: 0,
        upserted: 0,
        skipped: 0,
        errors: 1,
        durationMs: Date.now() - startMs,
        errorDetails: `Embedding service init error: ${msg}`,
      };
    }
  }

  try {
    // Fetch all models with name/description for embedding
    const allModels = await prisma.model.findMany({
      select: {
        id: true,
        name: true,
        strengths: true,
      },
    });

    total = allModels.length;
    console.log(
      `[oim-ingestion:web] Found ${total} models in DB to evaluate`
    );

    // Filter out models already covered by a primary source before batching.
    // Doing this upfront avoids loading the ONNX model for already-scored models.
    const modelsToProcess: typeof allModels = [];
    for (const model of allModels) {
      const existing = await getUnifiedScores(model.id);
      if (
        existing &&
        (existing.source === "ARENA" || existing.source === "ARTIFICIAL_ANALYSIS")
      ) {
        skipped++;
      } else {
        modelsToProcess.push(model);
      }
    }

    console.log(
      `[oim-ingestion:web] ${modelsToProcess.length} models need embedding inference (${skipped} already covered)`
    );

    // Process in batches to avoid Ort::Exception / memory exhaustion.
    for (let batchStart = 0; batchStart < modelsToProcess.length; batchStart += WEB_INFERRED_BATCH_SIZE) {
      const batch = modelsToProcess.slice(batchStart, batchStart + WEB_INFERRED_BATCH_SIZE);
      console.log(
        `[oim-ingestion:web] Processing batch ${Math.floor(batchStart / WEB_INFERRED_BATCH_SIZE) + 1}/${Math.ceil(modelsToProcess.length / WEB_INFERRED_BATCH_SIZE)} (${batch.length} models)…`
      );

      for (const model of batch) {
        try {
          // Build a description from strengths for the embedding
          const description = model.strengths.join(", ");

          const estimated = await estimateScoresViaEmbedding(
            model.name,
            description
          );

          const snapshotDate = new Date();
          snapshotDate.setHours(0, 0, 0, 0); // normalize to start-of-day

          const data: UnifiedModelScoresData = {
            modelId: model.id,
            source: SOURCE,
            snapshotDate,
            codingScore: estimated.codingScore,
            thinkingScore: estimated.thinkingScore,
            designScore: estimated.designScore,
            instructionScore: estimated.instructionScore,
            contextEfficiency: estimated.contextEfficiency,
            rawData: { inferenceNote: estimated.inferenceNote },
          };

          if (dryRun) {
            console.log(
              `[DRY RUN][web] Would upsert: ${model.id} | ` +
                `coding=${estimated.codingScore?.toFixed(3) ?? "null"} | ` +
                estimated.inferenceNote
            );
            upserted++;
          } else {
            await upsertUnifiedScores(data);
            upserted++;
            console.log(
              `[oim-ingestion:web] Inferred scores for: ${model.id} (${estimated.inferenceNote})`
            );
          }
        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          errorLog.push(`${model.id}: ${msg}`);
          console.error(
            `[oim-ingestion:web] Error processing ${model.id}: ${msg}`
          );
        }
      } // end for model in batch
    } // end for batchStart
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[oim-ingestion:web] Fatal error: ${msg}`);
    errors++;
    errorLog.push(`FATAL: ${msg}`);
  }

  const durationMs = Date.now() - startMs;
  console.log(
    `[oim-ingestion:web] Done in ${durationMs}ms — ` +
      `${total} total, ${upserted} inferred, ${skipped} skipped (already covered), ${errors} errors`
  );

  return {
    source: SOURCE,
    total,
    upserted,
    skipped,
    errors,
    durationMs,
    errorDetails: errorLog.length > 0 ? errorLog.join("\n") : undefined,
  };
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Orchestrate the full OIM data ingestion pipeline.
 *
 * Runs the three sources in order:
 *   1. ARENA (LM Arena ELO-based scores)
 *   2. ARTIFICIAL_ANALYSIS (benchmark-based scores)
 *   3. WEB_INFERRED (embedding-based estimation for uncovered models)
 *
 * Each source is run independently — a failure in one does NOT abort the others.
 * The summary reports results from all three runs.
 *
 * @param options  Ingestion options (dryRun, sources filter).
 * @returns        Combined summary of all ingestion runs.
 */
export async function ingestModelData(
  options: OimIngestionOptions = {}
): Promise<OimIngestionSummary> {
  const {
    dryRun = false,
    sources = ["ARENA", "ARTIFICIAL_ANALYSIS", "WEB_INFERRED"],
  } = options;

  const globalStart = Date.now();

  console.log(
    `[oim-ingestion] ═══ Starting OIM ingestion pipeline${dryRun ? " (DRY RUN)" : ""} ═══`
  );
  console.log(`[oim-ingestion] Sources: ${sources.join(", ")}`);

  // ── 1. ARENA ──────────────────────────────────────────────────────────────
  let arenaResult: OimIngestionResult = {
    source: "ARENA",
    total: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };

  if (sources.includes("ARENA")) {
    try {
      arenaResult = await ingestFromArena(dryRun);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[oim-ingestion] Arena ingestion threw unexpectedly: ${msg}`);
      arenaResult.errors++;
      arenaResult.errorDetails = msg;
    }
  } else {
    console.log("[oim-ingestion] Skipping ARENA source (not in sources list)");
  }

  // ── 2. ARTIFICIAL_ANALYSIS ────────────────────────────────────────────────
  let aaResult: OimIngestionResult = {
    source: "ARTIFICIAL_ANALYSIS",
    total: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };

  if (sources.includes("ARTIFICIAL_ANALYSIS")) {
    try {
      aaResult = await ingestFromArtificialAnalysis(dryRun);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[oim-ingestion] ArtificialAnalysis ingestion threw unexpectedly: ${msg}`);
      aaResult.errors++;
      aaResult.errorDetails = msg;
    }
  } else {
    console.log(
      "[oim-ingestion] Skipping ARTIFICIAL_ANALYSIS source (not in sources list)"
    );
  }

  // ── 3. WEB_INFERRED ───────────────────────────────────────────────────────
  let webResult: OimIngestionResult = {
    source: "WEB_INFERRED",
    total: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };

  if (sources.includes("WEB_INFERRED")) {
    try {
      webResult = await ingestWebInferred(dryRun);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[oim-ingestion] WebInferred ingestion threw unexpectedly: ${msg}`);
      webResult.errors++;
      webResult.errorDetails = msg;
    }
  } else {
    console.log(
      "[oim-ingestion] Skipping WEB_INFERRED source (not in sources list)"
    );
  }

  const totalDurationMs = Date.now() - globalStart;
  const totalUpserted = arenaResult.upserted + aaResult.upserted + webResult.upserted;
  const totalErrors = arenaResult.errors + aaResult.errors + webResult.errors;

  console.log(
    `[oim-ingestion] ═══ Pipeline complete in ${totalDurationMs}ms — ` +
      `${totalUpserted} total upserted, ${totalErrors} total errors ═══`
  );

  return {
    arena: arenaResult,
    artificialAnalysis: aaResult,
    webInferred: webResult,
    totalDurationMs,
  };
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────
// Runs when invoked directly: tsx lib/sync/oim-ingestion.ts [--commit]

const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  process.argv[1].includes("oim-ingestion");

if (isMainModule) {
  const dryRun = !process.argv.includes("--commit");

  if (dryRun) {
    console.log(
      "[oim-ingestion] DRY RUN mode. Pass --commit to write to the database."
    );
  }

  ingestModelData({ dryRun })
    .then((summary) => {
      console.log("\n[oim-ingestion] Summary:", JSON.stringify(summary, null, 2));
      const hasErrors =
        summary.arena.errors + summary.artificialAnalysis.errors + summary.webInferred.errors > 0;
      process.exit(hasErrors ? 1 : 0);
    })
    .catch((err) => {
      console.error("[oim-ingestion] Pipeline failed:", err);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => {});
    });
}
