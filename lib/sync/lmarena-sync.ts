// ─── LM Arena Sync ────────────────────────────────────────────────────────────
// Fetches leaderboard data from LM Arena and syncs category rankings and scores
// into the local PostgreSQL database.
//
// Usage (Node.js / tsx):
//   tsx lib/sync/lmarena-sync.ts          # dry-run (logs only)
//   tsx lib/sync/lmarena-sync.ts --commit # actually writes to DB
//
// Also exported as `syncLMArenaCategories()` for use from API routes.

import { prisma } from "@/lib/db/prisma";
import {
  fetchAllCategories,
  LMARENA_CATEGORIES,
  type LMArenaLeaderboardResponse,
  type LMArenaModelEntry,
} from "@/lib/sync/lmarena-client";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface LMArenaSyncResult {
  total: number; // total models processed across all categories
  categoriesProcessed: number;
  categoriesFailed: number;
  scoresUpserted: number;
  modelsMatched: number; // models that matched existing Model records
  errors: number;
  durationMs: number;
  errorDetails?: string;
}

export interface LMArenaSyncOptions {
  dryRun?: boolean;
  categories?: readonly string[]; // subset of categories to sync (default: all)
}

// ─── Category metadata ────────────────────────────────────────────────────────

/**
 * Human-readable names and descriptions for LM Arena categories.
 * Used when upserting LMArenaCategory records.
 */
const CATEGORY_METADATA: Record<
  string,
  { name: string; description: string }
> = {
  overall: {
    name: "Overall",
    description: "General-purpose performance across all tasks",
  },
  coding: {
    name: "Coding",
    description: "Code generation, debugging, and software engineering tasks",
  },
  "instruction-following": {
    name: "Instruction Following",
    description: "Ability to follow complex multi-step instructions accurately",
  },
  "long-context": {
    name: "Long Context",
    description: "Performance on tasks requiring large context windows (100k+ tokens)",
  },
  "hard-prompts": {
    name: "Hard Prompts",
    description: "Challenging prompts requiring advanced reasoning and creativity",
  },
  "creative-writing": {
    name: "Creative Writing",
    description: "Story generation, poetry, and creative content",
  },
  math: {
    name: "Math",
    description: "Mathematical reasoning and problem-solving",
  },
  reasoning: {
    name: "Reasoning",
    description: "Logical reasoning, inference, and deduction",
  },
  multilingual: {
    name: "Multilingual",
    description: "Performance across multiple languages",
  },
  safety: {
    name: "Safety",
    description: "Refusal of harmful requests and alignment with safety guidelines",
  },
  "function-calling": {
    name: "Function Calling",
    description: "Ability to call external functions and APIs correctly",
  },
  "structured-output": {
    name: "Structured Output",
    description: "JSON, XML, and other structured format generation",
  },
  vision: {
    name: "Vision",
    description: "Image understanding and visual reasoning",
  },
  multimodal: {
    name: "Multimodal",
    description: "Combined text, image, audio, and video understanding",
  },
  speed: {
    name: "Speed",
    description: "Response latency and tokens per second",
  },
  "cost-efficiency": {
    name: "Cost Efficiency",
    description: "Performance per dollar spent",
  },
  "context-window": {
    name: "Context Window",
    description: "Maximum supported context length",
  },
  "tool-use": {
    name: "Tool Use",
    description: "Ability to use external tools and APIs effectively",
  },
  "agent-tasks": {
    name: "Agent Tasks",
    description: "Multi-step autonomous task completion",
  },
  summarization: {
    name: "Summarization",
    description: "Text summarization and condensation",
  },
  translation: {
    name: "Translation",
    description: "Language translation accuracy",
  },
  "question-answering": {
    name: "Question Answering",
    description: "Factual question answering and information retrieval",
  },
  dialogue: {
    name: "Dialogue",
    description: "Multi-turn conversational ability",
  },
  roleplay: {
    name: "Roleplay",
    description: "Character roleplay and persona consistency",
  },
  analysis: {
    name: "Analysis",
    description: "Data analysis and interpretation",
  },
  research: {
    name: "Research",
    description: "Research assistance and literature review",
  },
  planning: {
    name: "Planning",
    description: "Task planning and project management",
  },
};

// ─── Model matching helpers ───────────────────────────────────────────────────

/**
 * Explicit alias mapping for known LM Arena model names to our Model IDs.
 * Used when arena names don't match our ID conventions.
 * 
 * LM Arena typically uses model names without provider prefixes and without
 * version suffixes like -latest or -preview.
 */
const KNOWN_ALIASES: Record<string, string> = {
  // Anthropic models (without provider prefix)
  "claude-opus-4-5": "anthropic/claude-opus-4-5",
  "claude-sonnet-4-5": "anthropic/claude-sonnet-4-5",
  "claude-3-7-sonnet": "anthropic/claude-3-7-sonnet-latest",
  "claude-haiku-3-5": "anthropic/claude-haiku-3-5",
  "claude-sonnet-3-5": "anthropic/claude-sonnet-3-5",
  
  // OpenAI models (without provider prefix)
  "gpt-4o": "openai/gpt-4o",
  "o3": "openai/o3",
  "o4-mini": "openai/o4-mini",
  "gpt-4.5-preview": "openai/gpt-4.5-preview",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "o3-mini": "openai/o3-mini",
  
  // Google models (without provider prefix and -preview suffix)
  "gemini-2.5-pro": "google/gemini-2.5-pro-preview",
  "gemini-2.0-flash": "google/gemini-2.0-flash",
  "gemini-2.5-flash": "google/gemini-2.5-flash-preview",
  
  // Groq models (without provider prefix)
  "llama-3.3-70b-versatile": "groq/llama-3.3-70b-versatile",
  "llama-3.1-8b-instant": "groq/llama-3.1-8b-instant",
  "deepseek-r1-distill-llama-70b": "groq/deepseek-r1-distill-llama-70b",
  
  // Mistral models (without provider prefix and -latest suffix)
  "mistral-large": "mistral/mistral-large-latest",
  "codestral": "mistral/codestral-latest",
  "mistral-small": "mistral/mistral-small-latest",
  
  // DeepSeek models (without provider prefix)
  "deepseek-chat": "deepseek/deepseek-chat",
  "deepseek-r1": "deepseek/deepseek-r1",
  
  // xAI models (without provider prefix)
  "grok-3-beta": "xai/grok-3-beta",
  "grok-3-mini-beta": "xai/grok-3-mini-beta",
};

/**
 * Normalize a model name for exact matching only.
 * Removes special characters and converts to lowercase.
 * Does NOT remove prefixes or suffixes to avoid false positives.
 */
function normalizeForExactMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove special chars only
}

/**
 * Check if a suffix match is valid (represents a complete token, not a substring).
 * Valid: "anthropic/claude-sonnet-4-5" ends with "/claude-sonnet-4-5"
 * Invalid: "deepseek/deepseek-chat" should NOT match "chat"
 */
function isValidSuffixMatch(modelId: string, arenaName: string): boolean {
  // Must have a slash separator before the arena name
  if (!modelId.endsWith(`/${arenaName}`)) {
    return false;
  }
  
  // The part after the slash must be the complete arena name
  const parts = modelId.split("/");
  const lastPart = parts[parts.length - 1];
  return lastPart === arenaName;
}

/**
 * Attempt to find a matching Model record for an LM Arena model name.
 * Matching strategies (in order of precision):
 * 1. Exact ID match (e.g. "anthropic/claude-sonnet-4-5")
 * 2. Known alias lookup (explicit mappings)
 * 3. Valid suffix match (e.g. "claude-sonnet-4-5" matches "anthropic/claude-sonnet-4-5")
 * 4. Exact normalized match (no fuzzy includes)
 *
 * Prioritizes precision over recall to avoid false positives.
 *
 * @returns Model ID if found, null otherwise
 */
async function findModelByArenaName(
  arenaName: string
): Promise<string | null> {
  // Strategy 1: Exact ID match
  const exactMatch = await prisma.model.findUnique({
    where: { id: arenaName },
    select: { id: true },
  });
  if (exactMatch) return exactMatch.id;

  // Strategy 2: Known alias lookup
  if (KNOWN_ALIASES[arenaName]) {
    const aliasedId = KNOWN_ALIASES[arenaName];
    // Verify the aliased ID exists
    const aliasMatch = await prisma.model.findUnique({
      where: { id: aliasedId },
      select: { id: true },
    });
    if (aliasMatch) return aliasMatch.id;
  }

  // Fetch all models for remaining strategies
  const models = await prisma.model.findMany({
    select: { id: true, name: true },
  });

  // Strategy 3: Valid suffix match (must be complete token after slash)
  for (const model of models) {
    if (isValidSuffixMatch(model.id, arenaName)) {
      return model.id;
    }
  }

  // Strategy 4: Exact normalized match (no fuzzy includes)
  const normalizedArena = normalizeForExactMatch(arenaName);
  for (const model of models) {
    const normalizedModelName = normalizeForExactMatch(model.name);
    const normalizedModelId = normalizeForExactMatch(model.id);

    // Only exact matches, no substring matching
    if (
      normalizedModelName === normalizedArena ||
      normalizedModelId === normalizedArena
    ) {
      return model.id;
    }
  }

  return null;
}

// ─── Core sync function ───────────────────────────────────────────────────────

/**
 * Sync LM Arena leaderboard data into the local database.
 *
 * Process:
 * 1. Create SyncLog record with status "PENDING"
 * 2. Fetch all categories from LM Arena API
 * 3. For each category:
 *    - Upsert LMArenaCategory
 *    - For each model in category:
 *      - Upsert LMArenaScore
 *      - Try to match with existing Model and update lastSyncedAt
 * 4. Update SyncLog with final status and stats
 *
 * Partial failures are tolerated — if one category fails, others continue.
 *
 * @param options  Sync options (dryRun, categories subset)
 * @returns        Sync result summary
 */
export async function syncLMArenaCategories(
  options: LMArenaSyncOptions = {}
): Promise<LMArenaSyncResult> {
  const { dryRun = false, categories = LMARENA_CATEGORIES } = options;
  const startMs = Date.now();

  let totalModels = 0;
  let categoriesProcessed = 0;
  let categoriesFailed = 0;
  let scoresUpserted = 0;
  let modelsMatched = 0;
  let errors = 0;
  const errorLog: string[] = [];

  console.log(
    `[lmarena-sync] Starting sync${dryRun ? " (DRY RUN)" : ""}...`
  );
  console.log(`[lmarena-sync] Categories to sync: ${categories.length}`);

  // Create SyncLog record (skip in dry-run)
  let syncLogId: string | null = null;
  if (!dryRun) {
    const syncLog = await prisma.syncLog.create({
      data: {
        type: "LMARENA",
        status: "PENDING",
        totalModels: 0,
        upserted: 0,
        errors: 0,
        durationMs: 0,
      },
    });
    syncLogId = syncLog.id;
    console.log(`[lmarena-sync] Created SyncLog: ${syncLogId}`);
  }

  try {
    // Fetch all categories from LM Arena
    console.log("[lmarena-sync] Fetching leaderboard data...");
    const leaderboards = await fetchAllCategories();
    console.log(
      `[lmarena-sync] Fetched ${leaderboards.size} categories successfully`
    );

    // Process each category
    for (const [categorySlug, leaderboard] of leaderboards.entries()) {
      // Skip if not in requested categories
      if (!categories.includes(categorySlug)) {
        console.log(`[lmarena-sync] Skipping category: ${categorySlug}`);
        continue;
      }

      try {
        await processCategoryLeaderboard(
          categorySlug,
          leaderboard,
          dryRun,
          (stats) => {
            totalModels += stats.modelsProcessed;
            scoresUpserted += stats.scoresUpserted;
            modelsMatched += stats.modelsMatched;
            errors += stats.errors;
            if (stats.errorDetails) {
              errorLog.push(...stats.errorDetails);
            }
          }
        );
        categoriesProcessed++;
      } catch (err) {
        categoriesFailed++;
        const message = err instanceof Error ? err.message : String(err);
        errorLog.push(`Category ${categorySlug}: ${message}`);
        console.error(
          `[lmarena-sync] Failed to process category ${categorySlug}: ${message}`
        );
      }
    }

    const durationMs = Date.now() - startMs;

    // Update SyncLog with final status
    if (!dryRun && syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: categoriesFailed > 0 ? "PARTIAL" : "SUCCESS",
          totalModels,
          upserted: scoresUpserted,
          errors,
          errorDetails: errorLog.length > 0 ? errorLog.join("\n") : null,
          durationMs,
        },
      });
    }

    const result: LMArenaSyncResult = {
      total: totalModels,
      categoriesProcessed,
      categoriesFailed,
      scoresUpserted,
      modelsMatched,
      errors,
      durationMs,
      errorDetails: errorLog.length > 0 ? errorLog.join("\n") : undefined,
    };

    console.log(
      `[lmarena-sync] Done in ${durationMs}ms — ` +
        `${categoriesProcessed} categories, ${scoresUpserted} scores upserted, ` +
        `${modelsMatched} models matched, ${errors} errors`
    );

    return result;
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const message = err instanceof Error ? err.message : String(err);

    // Update SyncLog with failure status
    if (!dryRun && syncLogId) {
      await prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: "FAILED",
          totalModels,
          upserted: scoresUpserted,
          errors: errors + 1,
          errorDetails: message,
          durationMs,
        },
      });
    }

    console.error(`[lmarena-sync] Sync failed: ${message}`);
    throw err;
  }
}

// ─── Category processing ──────────────────────────────────────────────────────

interface CategoryProcessStats {
  modelsProcessed: number;
  scoresUpserted: number;
  modelsMatched: number;
  errors: number;
  errorDetails?: string[];
}

/**
 * Process a single category leaderboard.
 * Upserts category metadata and all model scores.
 */
async function processCategoryLeaderboard(
  categorySlug: string,
  leaderboard: LMArenaLeaderboardResponse,
  dryRun: boolean,
  onStats: (stats: CategoryProcessStats) => void
): Promise<void> {
  const stats: CategoryProcessStats = {
    modelsProcessed: 0,
    scoresUpserted: 0,
    modelsMatched: 0,
    errors: 0,
    errorDetails: [],
  };

  console.log(
    `[lmarena-sync] Processing category: ${categorySlug} (${leaderboard.models.length} models)`
  );

  // Get category metadata
  const metadata = CATEGORY_METADATA[categorySlug] ?? {
    name: categorySlug,
    description: null,
  };

  if (dryRun) {
    console.log(
      `[DRY RUN] Would upsert category: ${categorySlug} | ${metadata.name}`
    );
  } else {
    // Upsert category
    await prisma.lMArenaCategory.upsert({
      where: { id: categorySlug },
      create: {
        id: categorySlug,
        name: metadata.name,
        description: metadata.description ?? undefined,
      },
      update: {
        name: metadata.name,
        description: metadata.description ?? undefined,
      },
    });
  }

  // Process each model in the leaderboard
  for (const entry of leaderboard.models) {
    stats.modelsProcessed++;

    try {
      await processModelEntry(
        categorySlug,
        entry,
        dryRun,
        (matched) => {
          if (matched) stats.modelsMatched++;
          stats.scoresUpserted++;
        }
      );
    } catch (err) {
      stats.errors++;
      const message = err instanceof Error ? err.message : String(err);
      stats.errorDetails?.push(`${entry.model}: ${message}`);
      console.error(
        `[lmarena-sync] Error processing model ${entry.model} in ${categorySlug}: ${message}`
      );
    }
  }

  console.log(
    `[lmarena-sync] Category ${categorySlug}: ${stats.scoresUpserted} scores upserted, ${stats.modelsMatched} matched, ${stats.errors} errors`
  );

  onStats(stats);
}

/**
 * Process a single model entry from a leaderboard.
 * Upserts LMArenaScore with leaderboardPublishDate and attempts to match with existing Model.
 */
async function processModelEntry(
  categorySlug: string,
  entry: LMArenaModelEntry,
  dryRun: boolean,
  onUpsert: (matched: boolean) => void
): Promise<void> {
  const arenaModelName = entry.model.trim();
  const publishDate = new Date(entry.leaderboardPublishDate);

  // Try to find matching Model record
  const matchedModelId = await findModelByArenaName(arenaModelName);

  if (dryRun) {
    console.log(
      `[DRY RUN] Would upsert score: ${arenaModelName} | ${categorySlug} | ${entry.leaderboardPublishDate} | rank ${entry.rank} | score ${entry.score}${matchedModelId ? ` | matched: ${matchedModelId}` : " | no match"}`
    );
    onUpsert(!!matchedModelId);
    return;
  }

  // If no match found, we can't create a score (foreign key constraint)
  // Log warning and skip
  if (!matchedModelId) {
    console.warn(
      `[lmarena-sync] No matching Model found for arena name: ${arenaModelName} (category: ${categorySlug})`
    );
    // Don't throw — this is expected for models not in our database
    return;
  }

  // Upsert LMArenaScore with leaderboardPublishDate as part of unique key
  await prisma.lMArenaScore.upsert({
    where: {
      modelId_categoryId_leaderboardPublishDate: {
        modelId: matchedModelId,
        categoryId: categorySlug,
        leaderboardPublishDate: publishDate,
      },
    },
    create: {
      modelId: matchedModelId,
      categoryId: categorySlug,
      leaderboardPublishDate: publishDate,
      rank: entry.rank ?? undefined,
      score: entry.score,
      votes: entry.votes ?? undefined,
      ci: entry.ci ?? undefined,
      license: entry.license ?? undefined,
      syncedAt: new Date(),
    },
    update: {
      rank: entry.rank ?? undefined,
      score: entry.score,
      votes: entry.votes ?? undefined,
      ci: entry.ci ?? undefined,
      license: entry.license ?? undefined,
      syncedAt: new Date(),
    },
  });

  // Update Model.lastSyncedAt
  await prisma.model.update({
    where: { id: matchedModelId },
    data: { lastSyncedAt: new Date() },
  });

  onUpsert(true);
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

// Runs when invoked directly: tsx lib/sync/lmarena-sync.ts [--commit]
const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  process.argv[1].includes("lmarena-sync");

if (isMainModule) {
  const dryRun = !process.argv.includes("--commit");

  if (dryRun) {
    console.log(
      "Running in DRY RUN mode. Pass --commit to write to the database."
    );
  }

  syncLMArenaCategories({ dryRun })
    .then((result) => {
      console.log("\nSync result:", result);
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("\nSync failed:", err);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => {});
    });
}
