// ─── GET /api/models/[id] ─────────────────────────────────────────────────────
// Returns full technical details for a single AI model (including provider info).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Tier } from "@/types";

export const runtime = "nodejs";

// ─── Response types ───────────────────────────────────────────────────────────

export interface ModelDetailResponse {
  success: true;
  data: {
    id: string;
    name: string;
    providerId: string;
    providerName: string;
    providerLogoUrl: string | null;
    tier: Tier;
    contextWindow: number;
    costPer1M: number;
    strengths: string[];
    discoveredByAI: boolean;
    updatedAt: string;
    /** Total times this model has been selected across all jobs */
    totalSelections: number;
  };
}

export interface ModelDetailErrorResponse {
  success: false;
  error: string;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ModelDetailResponse | ModelDetailErrorResponse>> {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid model ID" },
        { status: 400 }
      );
    }

    // Decode URL-encoded IDs (e.g. "anthropic%2Fclaude-sonnet-4-5")
    const decodedId = decodeURIComponent(id);

    const model = await prisma.model.findUnique({
      where: { id: decodedId },
      include: {
        provider: true,
        selections: {
          select: { id: true },
        },
      },
    });

    if (!model) {
      return NextResponse.json(
        { success: false, error: `Model not found: ${decodedId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: model.id,
        name: model.name,
        providerId: model.providerId,
        providerName: model.provider.name,
        providerLogoUrl: model.provider.logoUrl,
        tier: model.tier as Tier,
        contextWindow: model.contextWindow,
        costPer1M: model.costPer1M,
        strengths: model.strengths,
        discoveredByAI: model.discoveredByAI,
        updatedAt: model.updatedAt.toISOString(),
        totalSelections: model.selections.length,
      },
    });
  } catch (err) {
    console.error("[GET /api/models/[id]] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
