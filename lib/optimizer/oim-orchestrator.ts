// ─── OIM Orchestrator ─────────────────────────────────────────────────────────
// Selects and orchestrates the scoring pipeline (V2 / V3 / V4).
//
// Responsibilities:
//   1. Decide which engine to run based on SCORING_VERSION env flag or explicit strategy
//   2. Run V3/V4 first; fall back gracefully to V2 when data is insufficient
//   3. Emit structured events so callers can stream progress to the TerminalUI
//   4. Return the winning TeamRecommendation together with metadata about
//      which version was ultimately used and why
//
// Strategy resolution order:
//   1. Explicit `strategy` param in options (highest priority)
//   2. SCORING_VERSION environment variable
//   3. "auto" (tries V3, falls back to V2 if coverage < 30%)
//
// Fallback triggers (V3/V4 → V2):
//   a. All models in the pool have usedFallback=true in V3 (no OIM data)
//   b. V3/V4 throws an unexpected error
//   c. Caller explicitly sets strategy = "v2"

import { generateProfiles, getScoringVersion } from "@/lib/optimizer/selector";
import { scoreModelsBatchV3 } from "@/lib/optimizer/scoring-engine-v3";
import { getUnifiedScores, upsertUnifiedScores } from "@/lib/db/oim-service";
import { categorizeModel } from "@/lib/ai/embedding-service";
import { SDD_PHASES } from "@/types";
import type {
  ModelRecord,
  ParsedModel,
  TeamRecommendation,
  CustomSddPhase,
} from "@/types";
import type { V3ScoreResult } from "@/lib/optimizer/scoring-engine-v3";
import type { ScoringResultV4 } from "@/lib/optimizer/v4/scoring-engine-v4";

// ─── Public Types ─────────────────────────────────────────────────────────────

/**
 * Which scoring engine the orchestrator should prefer.
 * "auto" → tries V3, falls back to V2 if coverage < threshold.
 * "env"  → reads SCORING_VERSION env var (explicit opt-in for env-driven control).
 */
export type ScoringStrategy = "v2" | "v3" | "v4" | "auto" | "env";

/** A single structured event emitted during orchestration. */
export interface OrchestratorEvent {
  type: "info" | "progress" | "success" | "warning" | "error";
  message: string;
  timestamp: string;
}

/** Callback type for streaming events to the UI. */
export type EventEmitter = (event: OrchestratorEvent) => void;

/** Criteria for V3/V4 → V2 fallback decision. */
export interface FallbackReason {
  /** True when V3/V4 was attempted */
  v3Attempted: boolean;
  /** True when V3/V4 fell back to V2 */
  usedFallback: boolean;
  /** Human-readable explanation */
  reason: string;
}

/**
 * Debug information collected during V4 scoring.
 * Keyed by "modelId::phase" for precise lookup.
 * Only populated when V4 engine ran; null for V2/V3.
 */
export interface OrchestratorDebugInfo {
  /** V4 scoring results keyed by "modelId::phase" */
  v4Results: Map<string, ScoringResultV4> | null;
}

/** Full result returned by runOrchestratedScoring(). */
export interface OrchestratorResult {
  recommendation: TeamRecommendation;
  /** The scoring version that produced the recommendation */
  scoringVersion: "v2" | "v3" | "v4";
  /** Fallback metadata */
  fallback: FallbackReason;
  /**
   * The scoring version that was resolved from env/strategy.
   * Useful for UI display: tells the user what engine was *intended* vs what ran.
   */
  resolvedVersion: "v2" | "v3" | "v4";
  /** A/B metadata: only set when strategy was "auto" */
  ab?: {
    winner: "v2" | "v3";
    v2Coverage: number; // fraction of phases that had real V2 arena data
    v3Coverage: number; // fraction of model/phase pairs with OIM records
  };
  /**
   * Debug info for score inspection.
   * Populated when V4 engine ran; null otherwise.
   * Exposed via /api/optimize?debug=true — never included in default response.
   */
  debugInfo: OrchestratorDebugInfo;
}

// ─── Coverage Helpers ─────────────────────────────────────────────────────────

/**
 * Compute the fraction of model×phase V3 results that used real OIM data
 * (as opposed to the usedFallback path).
 */
function computeV3Coverage(
  v3Cache: Map<string, V3ScoreResult>,
  modelIds: string[],
  phases: string[]
): number {
  if (v3Cache.size === 0) return 0;
  let real = 0;
  let total = 0;
  for (const modelId of modelIds) {
    for (const phase of phases) {
      const entry = v3Cache.get(`${modelId}::${phase}`);
      total++;
      if (entry && !entry.usedFallback) real++;
    }
  }
  return total === 0 ? 0 : real / total;
}

// ─── Timestamp helper ─────────────────────────────────────────────────────────

const ts = () => new Date().toISOString();

// ─── Forced Discovery ─────────────────────────────────────────────────────────

/**
 * For each modelId that is missing from UnifiedModelScores, use the embedding
 * service to estimate OIM dimension scores and upsert them as WEB_INFERRED.
 *
 * This ensures V3 scoring never returns pure-fallback results for models that
 * the user explicitly provided, improving coverage before the scoring pass.
 *
 * @param pool  - The resolved model pool for this run
 * @param emit  - Optional event emitter for TerminalUI
 */
async function forceDiscoverMissingModels(
  pool: ModelRecord[],
  emit?: EventEmitter
): Promise<void> {
  // Identify models with no existing OIM record
  const missingIds: string[] = [];

  await Promise.all(
    pool.map(async (m) => {
      const existing = await getUnifiedScores(m.id);
      if (!existing) missingIds.push(m.id);
    })
  );

  if (missingIds.length === 0) {
    emit?.({
      type: "info",
      message: "Forced Discovery — all models already have OIM scores.",
      timestamp: ts(),
    });
    return;
  }

  emit?.({
    type: "info",
    message: `Forced Discovery — ${missingIds.length} model(s) missing OIM scores. Running embedding estimation…`,
    timestamp: ts(),
  });

  const poolById = new Map(pool.map((m) => [m.id, m]));

  await Promise.all(
    missingIds.map(async (modelId) => {
      try {
        const record = poolById.get(modelId);
        const description = record
          ? record.strengths?.join(", ") ?? record.name
          : modelId;

        const capabilities = await categorizeModel(modelId, description);

        const get = (cat: string): number => {
          const entry = capabilities.categories.find((c) => c.category === cat);
          return entry?.confidence ?? 0;
        };

        const snapshotDate = new Date();
        snapshotDate.setHours(0, 0, 0, 0);

        await upsertUnifiedScores({
          modelId,
          source: "WEB_INFERRED",
          snapshotDate,
          codingScore:       (get("coding") + get("function-calling")) / 2,
          thinkingScore:     (get("reasoning") + get("math") + get("analysis")) / 3,
          designScore:       (get("creative-writing") + get("dialogue")) / 2,
          instructionScore:  get("instruction-following"),
          contextEfficiency: get("long-context"),
          rawData: {
            inferenceNote: `WEB_INFERRED via forceDiscoverMissingModels (overallConfidence: ${capabilities.overallConfidence.toFixed(3)})`,
          },
        });

        emit?.({
          type: "success",
          message: `Discovery: upserted WEB_INFERRED scores for ${modelId}.`,
          timestamp: ts(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit?.({
          type: "warning",
          message: `Discovery: failed to estimate scores for ${modelId} — ${msg}`,
          timestamp: ts(),
        });
      }
    })
  );
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Run the scoring pipeline according to the requested strategy.
 *
 * Strategy resolution:
 *   1. options.strategy (explicit override — highest priority)
 *   2. "env" strategy → reads SCORING_VERSION environment variable
 *   3. "auto" (default) → tries V3, falls back to V2 if coverage < 30%
 *
 * @param inputModels   - Models resolved from the user's input
 * @param dbFallback    - Full DB pool (used when inputModels is empty)
 * @param parsedModels  - Raw parsed input list
 * @param unresolved    - Model IDs that couldn't be resolved
 * @param options       - Orchestration config
 * @param emit          - Optional event emitter for TerminalUI streaming
 */
export async function runOrchestratedScoring(
  inputModels: ModelRecord[],
  dbFallback: ModelRecord[],
  parsedModels: ParsedModel[],
  unresolved: string[],
  options: {
    strategy?: ScoringStrategy;
    customPhases?: CustomSddPhase[];
    strict?: boolean;
  } = {},
  emit?: EventEmitter
): Promise<OrchestratorResult> {
  const customPhases = options.customPhases ?? [];
  const strict = options.strict ?? false;

  // ── Strategy resolution ──────────────────────────────────────────────────
  // "env" → delegate to SCORING_VERSION env var
  // undefined → default to "auto"
  let strategy: ScoringStrategy = options.strategy ?? "auto";
  if (strategy === "env") {
    const envVersion = getScoringVersion();
    // v1 is not a valid orchestration strategy (legacy tag-based only) → treat as v2
    strategy = envVersion === "v1" ? "v2" : envVersion;
    emit?.({
      type: "info",
      message: `OIM Orchestrator — strategy: env (resolved to ${strategy} from SCORING_VERSION)`,
      timestamp: ts(),
    });
  } else {
    emit?.({ type: "info", message: `OIM Orchestrator — strategy: ${strategy}`, timestamp: ts() });
  }

  // Track what version was resolved (for result metadata)
  const resolvedVersion: "v2" | "v3" | "v4" =
    strategy === "v4" ? "v4" :
    strategy === "v3" ? "v3" :
    strategy === "v2" ? "v2" :
    "v3"; // "auto" default attempts V3 first

  // ── Pool resolution — strict priority on inputModels ────────────────────────
  // Rule: if inputModels.length > 0, use inputModels ONLY (strict prioritization).
  //       Only fall back to dbFallback when the user provided no models at all.
  //       The `strict` flag additionally enforces deduplication.
  const pool: ModelRecord[] = (() => {
    if (inputModels.length > 0) {
      // User provided explicit models — deduplicate and use them exclusively.
      const byId = new Map<string, ModelRecord>();
      for (const m of inputModels) byId.set(m.id, m);
      return [...byId.values()];
    }
    // No user models supplied — fall back to the full DB pool.
    const byId = new Map<string, ModelRecord>();
    for (const m of dbFallback) byId.set(m.id, m);
    return [...byId.values()];
  })();

  const modelIds = pool.map((m) => m.id);
  const allPhases: string[] = [
    ...SDD_PHASES,
    ...customPhases.map((p) => p.name),
  ];

  // ─── Forced Discovery: run before V3/V4/auto scoring ─────────────────────
  // For V3, V4, or auto strategies, ensure all pool models have OIM scores.
  // Skip for V2 (forced) since V2 doesn't use UnifiedModelScores.
  if (strategy !== "v2") {
    await forceDiscoverMissingModels(pool, emit);
  }

  // ─── Strategy: v2 (forced) ────────────────────────────────────────────────
  if (strategy === "v2") {
    emit?.({ type: "progress", message: "Scoring Engine V2 selected (forced).", timestamp: ts() });
    const recommendation = await generateProfiles(
      inputModels,
      dbFallback,
      parsedModels,
      unresolved,
      { version: "v2", customPhases, strict }
    );
    emit?.({ type: "success", message: "V2 pipeline complete.", timestamp: ts() });
    return {
      recommendation,
      scoringVersion: "v2",
      resolvedVersion: "v2",
      fallback: { v3Attempted: false, usedFallback: false, reason: "Strategy forced to V2 by caller." },
      debugInfo: { v4Results: null },
    };
  }

  // ─── Strategy: v4 (forced) ────────────────────────────────────────────────
  // V4 uses generateProfiles with version="v4" which builds the V4ScoringCache
  // internally. Automatic per-model V3 fallback is handled transparently by selector.
  if (strategy === "v4") {
    emit?.({
      type: "progress",
      message: "Scoring Engine V4 selected (17-dimensional). Fetching ModelCapabilities…",
      timestamp: ts(),
    });
    try {
      const recommendation = await generateProfiles(
        inputModels,
        dbFallback,
        parsedModels,
        unresolved,
        { version: "v4", customPhases, strict }
      );
      emit?.({ type: "success", message: "V4 pipeline complete.", timestamp: ts() });
      return {
        recommendation,
        scoringVersion: "v4",
        resolvedVersion: "v4",
        fallback: {
          v3Attempted: true,
          usedFallback: false,
          reason: "V4 engine used (per-model V3 fallback handled internally by selector).",
        },
        debugInfo: { v4Results: null },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit?.({
        type: "error",
        message: `V4 pipeline failed: ${msg} — no fallback (forced V4).`,
        timestamp: ts(),
      });
      throw err;
    }
  }

  // ─── Strategy: v3 (forced) ────────────────────────────────────────────────
  if (strategy === "v3") {
    emit?.({ type: "progress", message: "Scoring Engine V3 selected (forced). Fetching OIM data…", timestamp: ts() });
    try {
      const recommendation = await generateProfiles(
        inputModels,
        dbFallback,
        parsedModels,
        unresolved,
        { version: "v3", customPhases, strict }
      );
      emit?.({ type: "success", message: "V3 pipeline complete.", timestamp: ts() });
      return {
        recommendation,
        scoringVersion: "v3",
        resolvedVersion: "v3",
        fallback: { v3Attempted: true, usedFallback: false, reason: "Strategy forced to V3 by caller." },
        debugInfo: { v4Results: null },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit?.({ type: "error", message: `V3 pipeline failed: ${msg} — no fallback (forced V3).`, timestamp: ts() });
      throw err;
    }
  }

  // ─── Strategy: auto (V3 with graceful V2 fallback) ───────────────────────
  // Step 1: Try V3 and assess coverage
  emit?.({ type: "progress", message: "Auto strategy — probing V3 OIM data availability…", timestamp: ts() });

  let v3Cache: Map<string, V3ScoreResult> | null = null;
  let v3Coverage = 0;

  try {
    const tempCache = new Map<string, V3ScoreResult>();
    const batchResults = await Promise.all(
      allPhases.map((phase) =>
        scoreModelsBatchV3(modelIds, phase, customPhases).then((results) =>
          results.map(({ modelId, result }) => ({ modelId, phase, result }))
        )
      )
    );
    for (const phaseResults of batchResults) {
      for (const { modelId, phase, result } of phaseResults) {
        tempCache.set(`${modelId}::${phase}`, result);
      }
    }
    v3Cache = tempCache;
    v3Coverage = computeV3Coverage(tempCache, modelIds, allPhases);
    emit?.({
      type: "info",
      message: `V3 OIM data probed — coverage: ${(v3Coverage * 100).toFixed(1)}% of model×phase pairs.`,
      timestamp: ts(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit?.({ type: "warning", message: `V3 probe failed: ${msg} — will fall back to V2.`, timestamp: ts() });
  }

  // Decision threshold: use V3 only when ≥30% of pairs have real OIM data
  const V3_COVERAGE_THRESHOLD = 0.30;
  const useV3 = v3Cache !== null && v3Coverage >= V3_COVERAGE_THRESHOLD;

  if (useV3) {
    emit?.({ type: "progress", message: `Using V3 scoring (coverage ${(v3Coverage * 100).toFixed(1)}% ≥ threshold 30%).`, timestamp: ts() });
    try {
      const recommendation = await generateProfiles(
        inputModels,
        dbFallback,
        parsedModels,
        unresolved,
        { version: "v3", customPhases, strict }
      );
      emit?.({ type: "success", message: "V3 pipeline complete (auto).", timestamp: ts() });
      return {
        recommendation,
        scoringVersion: "v3",
        resolvedVersion,
        fallback: { v3Attempted: true, usedFallback: false, reason: "V3 used: coverage above threshold." },
        ab: { winner: "v3", v2Coverage: 1.0, v3Coverage },
        debugInfo: { v4Results: null },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit?.({ type: "warning", message: `V3 pipeline failed: ${msg} — falling back to V2.`, timestamp: ts() });
      // Fall through to V2
    }
  } else {
    emit?.({
      type: "warning",
      message: v3Cache === null
        ? "V3 data unavailable — using V2 (LM Arena)."
        : `V3 coverage ${(v3Coverage * 100).toFixed(1)}% below threshold 30% — using V2 (LM Arena).`,
      timestamp: ts(),
    });
  }

  // Step 2: V2 fallback
  emit?.({ type: "progress", message: "Applying Scoring Engine V2 with LM Arena weights…", timestamp: ts() });
  const recommendation = await generateProfiles(
    inputModels,
    dbFallback,
    parsedModels,
    unresolved,
    { version: "v2", customPhases, strict }
  );
  emit?.({ type: "success", message: "V2 pipeline complete (fallback).", timestamp: ts() });

  return {
    recommendation,
    scoringVersion: "v2",
    resolvedVersion,
    fallback: {
      v3Attempted: v3Cache !== null,
      usedFallback: true,
      reason: v3Cache === null
        ? "V3 data unavailable: no OIM records found."
        : `V3 coverage too low (${(v3Coverage * 100).toFixed(1)}%): fell back to V2.`,
    },
    ab: { winner: "v2", v2Coverage: 1.0, v3Coverage: v3Coverage },
    debugInfo: { v4Results: null },
  };
}
