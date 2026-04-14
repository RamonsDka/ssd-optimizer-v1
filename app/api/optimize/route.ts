// ─── POST /api/optimize ───────────────────────────────────────────────────────
// Pipeline: Parse → DB Lookup → AI Categorize (unknown) → Score → Return

import { NextRequest, NextResponse } from "next/server";
import { parseModelList } from "@/lib/optimizer/parser";
import { generateProfiles } from "@/lib/optimizer/selector";
import { getGeminiClient } from "@/lib/ai/gemini";
import { prisma } from "@/lib/db/prisma";
import type { ModelRecord, OptimizeResponse, OptimizeErrorResponse } from "@/types";
import type { Tier } from "@/types";

// ─── Runtime: Node.js (Prisma requires it) ────────────────────────────────────
export const runtime = "nodejs";
export const maxDuration = 60; // 60s — allow Gemini AI calls

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

    const { modelList } = body as Record<string, unknown>;
    if (typeof modelList !== "string" || !modelList.trim()) {
      return NextResponse.json(
        { success: false, error: "`modelList` must be a non-empty string" },
        { status: 400 }
      );
    }

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

      if (gemini) {
        const categorizations = await gemini.categorizeModels(unknownIds);

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

    // 6. Load full DB dictionary as fallback pool for phases with no user model
    const allDbModels = await prisma.model.findMany();
    const dbFallback: ModelRecord[] = allDbModels.map(prismaToModelRecord);

    // 7. Generate profiles
    const recommendation = generateProfiles(
      inputModels,
      dbFallback,
      parsed,
      unresolved
    );

    // 8. Persist optimization job
    await prisma.optimizationJob.create({
      data: {
        userInput: modelList,
        results: recommendation as object,
        status: "COMPLETED",
      },
    });

    return NextResponse.json({ success: true, data: recommendation });
  } catch (err) {
    console.error("[POST /api/optimize] Error:", err);
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
