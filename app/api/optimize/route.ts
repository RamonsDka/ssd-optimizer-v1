// ─── POST /api/optimize ───────────────────────────────────────────────────────
// Pipeline: Parse → DB Lookup → AI Categorize (unknown) → Score → Return
//
// The `scoringVersion` query-param (or request-body field) allows callers to
// override which engine is used for A/B testing purposes:
//   ?version=v2  → force V2 (LM Arena)
//   ?version=v3  → force V3 (OIM multi-dimensional)
//   ?version=v4  → force V4 (17-dimensional — requires ModelCapabilities table)
//   ?version=env → read SCORING_VERSION environment variable
//   (omit)       → "env" strategy — SCORING_VERSION env var governs the default
//
// Default is "env" so the SCORING_VERSION feature flag controls production behavior
// without requiring callers to pass an explicit version parameter.
//
// Add ?debug=true to include score breakdown and fallback metadata in the response.
// The debug field is NEVER included by default to keep payloads lean.
//
// The resolved version is persisted in OptimizationJob.scoringVersion.

import { NextRequest, NextResponse } from "next/server";
import { parseModelList } from "@/lib/optimizer/parser";
import { runOrchestratedScoring } from "@/lib/optimizer/oim-orchestrator";
import type { ScoringStrategy } from "@/lib/optimizer/oim-orchestrator";
import { getGeminiClient } from "@/lib/ai/gemini";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { ModelRecord, OptimizeResponse, OptimizeErrorResponse, OptimizeRequest, CustomSddPhase, TeamProfile, DebugInfo } from "@/types";
import type { Tier } from "@/types";
import { SDD_PHASES } from "@/types";

// ─── Runtime: Node.js (Prisma requires it) ────────────────────────────────────
export const runtime = "nodejs";
export const maxDuration = 300; // allow slow upstreams, but we still cap AI work below

const MAX_AI_CATEGORIZATIONS_PER_REQUEST = 8;

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<OptimizeResponse | OptimizeErrorResponse>> {
  try {
    // 1. Parse request body
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { modelList, customPhases, advancedOptions, scoringVersion: bodyScoringVersion } = body as OptimizeRequest & {
      customPhases?: unknown;
      advancedOptions?: unknown;
      scoringVersion?: unknown;
    };

    // Resolve the scoring strategy:
    // 1. Query-param  ?version=v2|v3|v4|env
    // 2. Request-body scoringVersion field
    // 3. Default: "env" — lets SCORING_VERSION env var govern the engine.
    //    This ensures the feature flag controls default production behavior.
    const searchParams = new URL(req.url).searchParams;
    const qpVersion = searchParams.get("version");
    const rawStrategy = qpVersion ?? (typeof bodyScoringVersion === "string" ? bodyScoringVersion : null) ?? "env";
    const strategy: ScoringStrategy =
      rawStrategy === "v2" || rawStrategy === "v3" || rawStrategy === "v4" || rawStrategy === "env"
        ? rawStrategy
        : "env";

    // ?debug=true → include scoreBreakdown + fallback metadata in response
    const debugMode = searchParams.get("debug") === "true";
    if (typeof modelList !== "string" || !modelList.trim()) {
      return NextResponse.json(
        { success: false, error: "`modelList` must be a non-empty string" },
        { status: 400 }
      );
    }

    const customPhasesList = Array.isArray(customPhases)
      ? (customPhases.filter((phase): phase is CustomSddPhase => {
          const candidate = phase as any;
          return !!phase
            && typeof candidate === "object"
            && typeof candidate.name === "string"
            && typeof candidate.displayName === "string"
            && typeof candidate.categoryWeights === "object";
        }))
      : undefined;

    if (modelList.length > 50_000) {
      return NextResponse.json(
        { success: false, error: "Model list exceeds maximum length (50,000 chars)" },
        { status: 400 }
      );
    }

    // 2. Parse the raw model list
    const parsed = parseModelList(modelList);
    if (parsed.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid model IDs found in the input" },
        { status: 400 }
      );
    }

    // 3. Batch DB lookup — find which canonical IDs exist in the dictionary
    const canonicalIds = parsed.map((p) => p.canonical);

    const dbModels = await prisma.model.findMany({
      where: { id: { in: canonicalIds } },
      include: { provider: true },
    });

    const foundIds = new Set(dbModels.map((m) => m.id));
    const unknownIds = canonicalIds.filter((id) => !foundIds.has(id));

    // 4. AI categorization for unknown models
    const aiResults = new Map<string, ModelRecord>();
    const unresolved: string[] = [];

    if (unknownIds.length > 0) {
      const gemini = getGeminiClient();
      const idsForAi = unknownIds.slice(0, MAX_AI_CATEGORIZATIONS_PER_REQUEST);
      const skippedUnknownIds = unknownIds.slice(MAX_AI_CATEGORIZATIONS_PER_REQUEST);

      if (gemini) {
        if (skippedUnknownIds.length > 0) {
          console.warn(
            `[POST /api/optimize] Skipping AI categorization for ${skippedUnknownIds.length} models to avoid request timeout`
          );
          unresolved.push(...skippedUnknownIds);
        }

        const categorizations = await gemini.categorizeModels(idsForAi);

        for (const [id, cat] of categorizations.entries()) {
          if (!cat || cat.confidence < 0.2) {
            unresolved.push(id);
            continue;
          }

          // Upsert provider if new
          await prisma.provider.upsert({
            where: { id: cat.providerId },
            create: { id: cat.providerId, name: cat.providerId },
            update: {},
          });

          // Upsert model into DB for caching
          const upserted = await prisma.model.upsert({
            where: { id: cat.id },
            create: {
              id: cat.id,
              name: cat.name,
              providerId: cat.providerId,
              tier: cat.tier as Tier,
              contextWindow: cat.contextWindow,
              costPer1M: cat.costPer1M,
              strengths: cat.strengths,
              discoveredByAI: true,
            },
            update: {
              tier: cat.tier as Tier,
              contextWindow: cat.contextWindow,
              costPer1M: cat.costPer1M,
              strengths: cat.strengths,
              discoveredByAI: true,
            },
          });

          aiResults.set(id, prismaToModelRecord(upserted));
        }
      } else {
        // Gemini not configured — mark all unknown as unresolved
        unresolved.push(...unknownIds);
      }
    }

    // 5. Merge resolved models: DB + AI-categorized
    const inputModels: ModelRecord[] = [
      ...dbModels.map(prismaToModelRecord),
      ...aiResults.values(),
    ];

    // 6. Load full DB dictionary as fallback pool.
    // Only used when the user provided NO resolvable models (strict=false fallback).
    // When the user provided models (inputModels.length > 0), we operate in strict mode:
    // the selector will use ONLY those models and ignore the DB fallback entirely.
    const strict = inputModels.length > 0;
    const dbFallback: ModelRecord[] = strict
      ? [] // strict mode: skip the expensive DB full-scan
      : await prisma.model.findMany().then((rows) => rows.map(prismaToModelRecord));

    // 7. Generate profiles via OIM Orchestrator (V2/V3/auto strategy)
    const orchestratorResult = await runOrchestratedScoring(
      inputModels,
      dbFallback,
      parsed,
      unresolved,
      { strategy, customPhases: customPhasesList, strict }
    );
    const recommendation = orchestratorResult.recommendation;
    const resolvedScoringVersion = orchestratorResult.scoringVersion;

    console.log(
      `[POST /api/optimize] Scoring engine: ${resolvedScoringVersion} (strategy: ${strategy}, fallback: ${orchestratorResult.fallback.usedFallback})`
    );

    // 8. Persist optimization job + model selections (atomic transaction)
    const { job, selectionsCount } = await prisma.$transaction(async (tx) => {
      // 8a. Create the optimization job
      const createdJob = await tx.optimizationJob.create({
        data: {
          userInput: modelList,
          results: recommendation as unknown as Prisma.InputJsonValue,
          advancedOptions: advancedOptions && typeof advancedOptions === "object"
            ? (advancedOptions as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          scoringVersion: resolvedScoringVersion,
          status: "COMPLETED",
        },
      });

      // 8b. Build ModelSelection records from all three profiles
      const selectionData = buildModelSelections(createdJob.id, recommendation.premium, recommendation.balanced, recommendation.economic);

      // 8c. Persist selections (only those with a valid phase number)
      if (selectionData.length > 0) {
        await tx.modelSelection.createMany({ data: selectionData });
      }

      return { job: createdJob, selectionsCount: selectionData.length };
    });

    console.log(`[POST /api/optimize] Job ${job.id} created with ${selectionsCount} model selections`);

    // Build debug payload only when requested (keeps default response lean)
    const debugPayload: DebugInfo | undefined = debugMode
      ? {
          resolvedScoringVersion,
          fallback: orchestratorResult.fallback,
          // scoreBreakdown is only available when V4 engine ran AND v4Results
          // were collected. Currently v4Results are null (selector-internal);
          // set to null to communicate "not available at this engine version".
          scoreBreakdown: null,
          specialRulesApplied: null,
        }
      : undefined;

    return NextResponse.json({
      success: true,
      jobId: job.id,
      data: recommendation,
      scoringVersion: resolvedScoringVersion,
      ...(debugPayload !== undefined && { debug: debugPayload }),
    } satisfies OptimizeResponse);
  } catch (err) {
    console.error("[POST /api/optimize] Error DETALLADO:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ─── Helper: Prisma model → ModelRecord ───────────────────────────────────────

function prismaToModelRecord(m: {
  id: string;
  name: string;
  providerId: string;
  tier: string;
  contextWindow: number;
  costPer1M: number;
  strengths: string[];
  discoveredByAI: boolean;
}): ModelRecord {
  return {
    id: m.id,
    name: m.name,
    providerId: m.providerId,
    tier: m.tier as Tier,
    contextWindow: m.contextWindow,
    costPer1M: m.costPer1M,
    strengths: m.strengths,
    discoveredByAI: m.discoveredByAI,
  };
}

// ─── Helper: Phase string → phase number (1-based index) ──────────────────────
// SDD_PHASES is ordered; custom phases get no numeric mapping and are skipped.

function phaseStringToNumber(phase: string): number | null {
  const idx = SDD_PHASES.indexOf(phase as (typeof SDD_PHASES)[number]);
  if (idx === -1) return null; // custom phase — no stable number, skip
  return idx + 1; // 1-based (1–10)
}

// ─── Helper: Build ModelSelection create-many payload from all three profiles ──

interface ModelSelectionCreateData {
  jobId: string;
  modelId: string;
  phase: number;
  tier: Tier;
  reasoning: string;
  score: number;
}

function buildModelSelections(
  jobId: string,
  premium: TeamProfile,
  balanced: TeamProfile,
  economic: TeamProfile,
): ModelSelectionCreateData[] {
  const profiles: TeamProfile[] = [premium, balanced, economic];
  const records: ModelSelectionCreateData[] = [];

  for (const profile of profiles) {
    for (const assignment of profile.phases) {
      const phaseNumber = phaseStringToNumber(assignment.phase);
      if (phaseNumber === null) {
        // Custom phase — no stable integer mapping, skip silently
        continue;
      }

      records.push({
        jobId,
        modelId: assignment.primary.id,
        phase: phaseNumber,
        tier: profile.tier,
        reasoning: assignment.reason,
        score: assignment.score,
      });
    }
  }

  return records;
}
