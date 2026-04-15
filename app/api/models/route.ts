// ─── GET /api/models ──────────────────────────────────────────────────────────
// Dictionary lookup with optional fuzzy matching and tier filter.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type {
  ModelRecord,
  ModelsLookupResponse,
  OptimizeErrorResponse,
  Tier,
} from "@/types";

export const runtime = "nodejs";

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest
): Promise<NextResponse<ModelsLookupResponse | OptimizeErrorResponse>> {
  try {
    const { searchParams } = req.nextUrl;
    const query = searchParams.get("query")?.trim() ?? "";
    const tierParam = searchParams.get("tier")?.toUpperCase();
    const limitParam = searchParams.get("limit");

    // Validate limit
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    if (isNaN(limit) || limit < 1 || limit > 200) {
      return NextResponse.json(
        { success: false, error: "`limit` must be an integer between 1 and 200" },
        { status: 400 }
      );
    }

    // Validate tier
    const VALID_TIERS = new Set(["PREMIUM", "BALANCED", "ECONOMIC"]);
    if (tierParam && !VALID_TIERS.has(tierParam)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid tier. Must be one of: PREMIUM, BALANCED, ECONOMIC`,
        },
        { status: 400 }
      );
    }

    const tier = tierParam as Tier | undefined;

    // ── Strategy 1: No query — return all (filtered by tier) ─────────────────
    if (!query) {
      const models = await prisma.model.findMany({
        where: tier ? { tier } : undefined,
        orderBy: [{ tier: "asc" }, { name: "asc" }],
        take: limit,
      });

      return NextResponse.json({
        success: true,
        data: models.map(toModelRecord),
        total: models.length,
      });
    }

    // ── Strategy 2: Exact ID match first ─────────────────────────────────────
    const exact = await prisma.model.findUnique({ where: { id: query } });
    if (exact) {
      if (!tier || exact.tier === tier) {
        return NextResponse.json({
          success: true,
          data: [toModelRecord(exact)],
          total: 1,
        });
      }
    }

    // ── Strategy 3: Fuzzy matching via contains on id + name ─────────────────
    // Prisma doesn't expose pg_trgm directly — use case-insensitive contains.
    // For real trigram fuzzy search, would use $queryRaw with pg_trgm.
    const lowerQuery = query.toLowerCase();

    const fuzzyResults = await prisma.model.findMany({
      where: {
        AND: [
          tier ? { tier } : {},
          {
            OR: [
              { id: { contains: lowerQuery, mode: "insensitive" } },
              { name: { contains: lowerQuery, mode: "insensitive" } },
              { providerId: { contains: lowerQuery, mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
      take: limit,
    });

    // ── Strategy 4: Trigram similarity via raw SQL (pg_trgm) ─────────────────
    // Used when fuzzy contains returns 0 results.
    let finalResults = fuzzyResults;

    if (fuzzyResults.length === 0) {
      try {
        // pg_trgm similarity — requires pg_trgm extension (enabled via docker init)
        // Two separate queries to avoid conditional template literal issues

        type TrigramRow = {
          id: string;
          name: string;
          provider_id: string;
          tier: string;
          context_window: number;
          cost_per1m: number;
          strengths: string[];
          discovered_by_ai: boolean;
          similarity: number;
        };

        const trigramResults: TrigramRow[] = tier
          ? await prisma.$queryRaw<TrigramRow[]>`
              SELECT
                id, name, provider_id, tier, context_window, cost_per1m,
                strengths, discovered_by_ai,
                GREATEST(similarity(id, ${query}), similarity(name, ${query})) AS similarity
              FROM models
              WHERE tier = ${tier}::"Tier"
                AND GREATEST(similarity(id, ${query}), similarity(name, ${query})) > 0.1
              ORDER BY similarity DESC
              LIMIT ${limit}
            `
          : await prisma.$queryRaw<TrigramRow[]>`
              SELECT
                id, name, provider_id, tier, context_window, cost_per1m,
                strengths, discovered_by_ai,
                GREATEST(similarity(id, ${query}), similarity(name, ${query})) AS similarity
              FROM models
              WHERE GREATEST(similarity(id, ${query}), similarity(name, ${query})) > 0.1
              ORDER BY similarity DESC
              LIMIT ${limit}
            `;

        // Map raw result → ModelRecord shape
        finalResults = trigramResults.map((r) => ({
          id: r.id,
          name: r.name,
          providerId: r.provider_id,
          tier: r.tier as Tier,
          contextWindow: r.context_window,
          costPer1M: r.cost_per1m,
          strengths: r.strengths ?? [],
          discoveredByAI: r.discovered_by_ai,
          lastSyncedAt: null,
          updatedAt: new Date(),
          provider: { id: r.provider_id, name: r.provider_id, logoUrl: null, models: [] },
          selections: [],
        }));
      } catch {
        // pg_trgm not available — return empty
        finalResults = [];
      }
    }

    return NextResponse.json({
      success: true,
      data: finalResults.map(toModelRecord),
      total: finalResults.length,
    });
  } catch (err) {
    console.error("[GET /api/models] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toModelRecord(m: {
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
