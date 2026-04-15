// ─── POST /api/deploy ─────────────────────────────────────────────────────────
// 1-Click Team Deploy — Apply a team profile from an OptimizationJob.
//
// Flow:
//   1. Receive jobId + tier (PREMIUM | BALANCED | ECONOMIC)
//   2. Load OptimizationJob.results (TeamRecommendation JSON)
//   3. Extract the selected profile's PhaseAssignments
//   4. Verify each primary model exists in DB
//   5. Create ModelSelection rows for each phase
//   6. Return created selections + any skipped models
//
// No auth in this slice — add middleware guard before production.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Tier, SddPhase, TeamRecommendation, TeamProfile } from "@/types";
import { SDD_PHASES } from "@/types";

export const runtime = "nodejs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeployRequest {
  jobId: string;
  tier: "PREMIUM" | "BALANCED" | "ECONOMIC";
}

export interface DeploySelection {
  phase: number;
  modelId: string;
  modelName: string;
  score: number;
  reason: string;
}

export interface DeployResponse {
  success: true;
  jobId: string;
  tier: Tier;
  deployedAt: string;
  selections: DeploySelection[];
  skipped?: string[];
}

export interface DeployErrorResponse {
  success: false;
  error: string;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<DeployResponse | DeployErrorResponse>> {
  try {
    // 1. Parse request body
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { jobId, tier } = body as Record<string, unknown>;

    if (typeof jobId !== "string" || !jobId.trim()) {
      return NextResponse.json(
        { success: false, error: "`jobId` must be a non-empty string" },
        { status: 400 }
      );
    }

    if (tier !== "PREMIUM" && tier !== "BALANCED" && tier !== "ECONOMIC") {
      return NextResponse.json(
        {
          success: false,
          error: "`tier` must be one of: PREMIUM, BALANCED, ECONOMIC",
        },
        { status: 400 }
      );
    }

    // 2. Load the OptimizationJob
    const job = await prisma.optimizationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: `OptimizationJob not found: ${jobId}` },
        { status: 404 }
      );
    }

    if (job.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: `Job is not completed. Current status: ${job.status}`,
        },
        { status: 409 }
      );
    }

    // 3. Extract TeamRecommendation from stored JSON
    const recommendation = job.results as unknown as TeamRecommendation;

    // 4. Get the selected profile
    let profile: TeamProfile;
    if (tier === "PREMIUM") profile = recommendation.premium;
    else if (tier === "BALANCED") profile = recommendation.balanced;
    else profile = recommendation.economic;

    // 5. Create ModelSelection for each phase
    const selections: DeploySelection[] = [];
    const skipped: string[] = [];

    for (const assignment of profile.phases) {
      const phaseIndex = SDD_PHASES.indexOf(assignment.phase as SddPhase) + 1;

      // Verify model exists in DB before creating selection (referential integrity)
      const dbModel = await prisma.model.findUnique({
        where: { id: assignment.primary.id },
      });

      if (!dbModel) {
        skipped.push(
          `${assignment.primary.id} (phase ${phaseIndex}: ${assignment.phase})`
        );
        continue;
      }

      const created = await prisma.modelSelection.create({
        data: {
          jobId,
          modelId: assignment.primary.id,
          phase: phaseIndex,
          tier: tier as Tier,
          reasoning: assignment.reason,
          score: assignment.score,
        },
        include: {
          model: { select: { id: true, name: true } },
        },
      });

      selections.push({
        phase: phaseIndex,
        modelId: created.modelId,
        modelName: created.model.name,
        score: created.score,
        reason: created.reasoning,
      });
    }

    return NextResponse.json({
      success: true,
      jobId,
      tier: tier as Tier,
      deployedAt: new Date().toISOString(),
      selections,
      skipped: skipped.length > 0 ? skipped : undefined,
    });
  } catch (err) {
    console.error("[POST /api/deploy] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}