// ─── GET /api/history/[id] ────────────────────────────────────────────────────
// Returns full detail for a single OptimizationJob including ModelSelection list.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

// ─── Response types ───────────────────────────────────────────────────────────

export interface JobDetailModelSelection {
  id: string;
  phase: number;
  tier: string;
  modelId: string;
  modelName: string;
}

export interface JobDetailResponse {
  success: true;
  data: {
    id: string;
    status: string;
    input: string;
    results: unknown; // Full TeamRecommendation JSON
    advancedOptions: unknown | null; // AdvancedOptions snapshot persisted at submission time
    selections: JobDetailModelSelection[];
    createdAt: string;
    updatedAt: string;
    executionMs: number | null;
    modelCount: number;
  };
}

export interface JobDetailErrorResponse {
  success: false;
  error: string;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<JobDetailResponse | JobDetailErrorResponse>> {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid job ID" },
        { status: 400 }
      );
    }

    const job = await prisma.optimizationJob.findUnique({
      where: { id },
      include: {
        selections: {
          include: {
            model: {
              select: { id: true, name: true },
            },
          },
          orderBy: { phase: "asc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: `Job not found: ${id}` },
        { status: 404 }
      );
    }

    // Derive modelCount from userInput (same heuristic as list route)
    const lines = job.userInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const modelCount = new Set(lines.map((l) => l.toLowerCase())).size;

    // Derive executionMs from diff between createdAt and updatedAt if completed
    const executionMs =
      job.status === "COMPLETED" || job.status === "FAILED"
        ? job.updatedAt.getTime() - job.createdAt.getTime()
        : null;

    const selections: JobDetailModelSelection[] = job.selections.map((s) => ({
      id: s.id,
      phase: s.phase,
      tier: s.tier,
      modelId: s.modelId,
      modelName: s.model.name,
    }));

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        input: job.userInput,
        results: job.results,
        advancedOptions: job.advancedOptions ?? null,
        selections,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        executionMs,
        modelCount,
      },
    });
  } catch (err) {
    console.error("[GET /api/history/[id]] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
