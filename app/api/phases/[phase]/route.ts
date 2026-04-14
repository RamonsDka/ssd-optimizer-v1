// ─── GET /api/phases/[phase] ──────────────────────────────────────────────────
// Lists all models associated with a specific SDD phase via PhaseRecommendation.
// Groups results by tier: PREMIUM, BALANCED, ECONOMIC.
// Supports ?page and ?limit for pagination within each tier group.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Tier } from "@/types";

export const runtime = "nodejs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map phase string (e.g. "sdd-apply") to phase number 1-10 */
const PHASE_MAP: Record<string, number> = {
  "sdd-explore": 1,
  "sdd-propose": 2,
  "sdd-spec":    3,
  "sdd-design":  4,
  "sdd-tasks":   5,
  "sdd-apply":   6,
  "sdd-verify":  7,
  "sdd-archive": 8,
  "sdd-init":    9,
  "sdd-onboard": 10,
};

// ─── Response types ───────────────────────────────────────────────────────────

export interface PhaseModelEntry {
  modelId: string;
  modelName: string;
  providerId: string;
  tier: Tier;
  contextWindow: number;
  costPer1M: number;
  strengths: string[];
  discoveredByAI: boolean;
  score: number;
  rationale: string | null;
}

export interface PhaseDetailResponse {
  success: true;
  phase: string;
  phaseNumber: number;
  data: {
    PREMIUM: PhaseModelEntry[];
    BALANCED: PhaseModelEntry[];
    ECONOMIC: PhaseModelEntry[];
  };
  total: number;
  pagination: {
    page: number;
    limit: number;
  };
}

export interface PhaseDetailErrorResponse {
  success: false;
  error: string;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ phase: string }> }
): Promise<NextResponse<PhaseDetailResponse | PhaseDetailErrorResponse>> {
  try {
    const { phase } = await params;

    if (!phase || typeof phase !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid phase" },
        { status: 400 }
      );
    }

    // Resolve phase number — accept both "sdd-apply" and "6"
    let phaseNumber: number;
    const asInt = parseInt(phase, 10);
    if (!isNaN(asInt) && asInt >= 1 && asInt <= 10) {
      phaseNumber = asInt;
    } else {
      phaseNumber = PHASE_MAP[phase.toLowerCase()] ?? -1;
    }

    if (phaseNumber === -1) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown phase: "${phase}". Use sdd-explore…sdd-onboard or 1-10.`,
        },
        { status: 400 }
      );
    }

    // Pagination params
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    // Fetch PhaseRecommendation rows for this phase
    // Note: PhaseRecommendation has no explicit relation to Model in schema,
    // so we fetch model details in a second query.
    const recs = await prisma.phaseRecommendation.findMany({
      where: { phase: phaseNumber },
      orderBy: [{ tier: "asc" }, { score: "desc" }],
      skip,
      take: limit,
    });

    // Fetch all model IDs referenced
    const modelIds = [...new Set(recs.map((r) => r.modelId))];
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
    });
    const modelMap = new Map(models.map((m) => [m.id, m]));

    const total = await prisma.phaseRecommendation.count({
      where: { phase: phaseNumber },
    });

    // Group by tier
    const grouped: Record<Tier, PhaseModelEntry[]> = {
      PREMIUM: [],
      BALANCED: [],
      ECONOMIC: [],
    };

    for (const rec of recs) {
      const model = modelMap.get(rec.modelId);
      if (!model) continue;

      const entry: PhaseModelEntry = {
        modelId: model.id,
        modelName: model.name,
        providerId: model.providerId,
        tier: rec.tier as Tier,
        contextWindow: model.contextWindow,
        costPer1M: model.costPer1M,
        strengths: model.strengths,
        discoveredByAI: model.discoveredByAI,
        score: rec.score,
        rationale: rec.rationale,
      };

      if (grouped[rec.tier as Tier]) {
        grouped[rec.tier as Tier].push(entry);
      }
    }

    // Reverse the phase key to string name
    const phaseLabel =
      Object.entries(PHASE_MAP).find(([, v]) => v === phaseNumber)?.[0] ??
      `phase-${phaseNumber}`;

    return NextResponse.json({
      success: true,
      phase: phaseLabel,
      phaseNumber,
      data: grouped,
      total,
      pagination: { page, limit },
    });
  } catch (err) {
    console.error("[GET /api/phases/[phase]] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
