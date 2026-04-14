// ─── GET /api/history ─────────────────────────────────────────────────────────
// Returns paginated list of OptimizationJob records (most recent first).
// Query params:
//   - page  (default: 1, min: 1)
//   - limit (default: 20, max: 100)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

// ─── Response types ───────────────────────────────────────────────────────────

export interface HistoryJobSummary {
  id: string;
  userInput: string;
  status: string;
  createdAt: string;
  modelCount: number;
}

export interface HistoryResponse {
  success: true;
  data: HistoryJobSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HistoryErrorResponse {
  success: false;
  error: string;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest
): Promise<NextResponse<HistoryResponse | HistoryErrorResponse>> {
  try {
    const { searchParams } = req.nextUrl;

    const pageParam = searchParams.get("page") ?? "1";
    const limitParam = searchParams.get("limit") ?? "20";

    const page = parseInt(pageParam, 10);
    const limit = parseInt(limitParam, 10);

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { success: false, error: "`page` must be a positive integer" },
        { status: 400 }
      );
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: "`limit` must be an integer between 1 and 100" },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;

    // Run total count and data fetch in parallel
    const [total, jobs] = await Promise.all([
      prisma.optimizationJob.count(),
      prisma.optimizationJob.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          userInput: true,
          status: true,
          createdAt: true,
          results: true,
        },
      }),
    ]);

    // Derive model count from userInput (same heuristic as InputModule)
    const data: HistoryJobSummary[] = jobs.map((job) => {
      const lines = job.userInput
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const modelCount = new Set(lines.map((l) => l.toLowerCase())).size;

      return {
        id: job.id,
        userInput: job.userInput.slice(0, 200), // cap preview length
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        modelCount,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[GET /api/history] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
