// ─── POST /api/admin/[action] ─────────────────────────────────────────────────
// Admin action dispatcher. Handles maintenance operations.
//
// Supported actions:
//   clear-history  — Deletes all OptimizationJob records (cascades ModelSelections via schema)
//   reset-models   — Deletes all providers (cascades models and selections via schema)
//   force-sync     — Triggers OpenRouter model sync (same as POST /api/sync)
//
// WARNING: These are destructive operations. No auth guard (dev tool).
//          Add middleware auth before exposing in production.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { syncOpenRouterModels } from "@/lib/sync/openrouter-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Response types ───────────────────────────────────────────────────────────

export type AdminAction = "clear-history" | "reset-models" | "force-sync";

export interface AdminActionResponse {
  success: true;
  action: AdminAction;
  message: string;
  affected?: number;
}

export interface AdminActionErrorResponse {
  success: false;
  error: string;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleClearHistory(): Promise<AdminActionResponse> {
  // ModelSelection rows are cascade-deleted by Prisma schema relations
  const deleted = await prisma.optimizationJob.deleteMany({});
  return {
    success: true,
    action: "clear-history",
    message: `Historial eliminado: ${deleted.count} consultas y sus selecciones asociadas.`,
    affected: deleted.count,
  };
}

async function handleResetModels(): Promise<AdminActionResponse> {
  // 1. Delete all providers (this cascades to models and their selections)
  const deletedProviders = await prisma.provider.deleteMany({});
  
  // 2. Note: seeding should be done manually or via a separate trigger 
  // if we want to restore the reference models.
  
  return {
    success: true,
    action: "reset-models",
    message: `Catálogo reseteado: ${deletedProviders.count} proveedores (y todos sus modelos) eliminados.`,
    affected: deletedProviders.count,
  };
}

async function handleForceSync(): Promise<AdminActionResponse> {
  const result = await syncOpenRouterModels(false);
  return {
    success: true,
    action: "force-sync",
    message: `OpenRouter sync complete. Upserted: ${result.upserted}, Skipped: ${result.skipped}, Errors: ${result.errors}. Duration: ${result.durationMs}ms.`,
    affected: result.upserted,
  };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
): Promise<NextResponse<AdminActionResponse | AdminActionErrorResponse>> {
  try {
    const { action } = await params;

    switch (action as AdminAction) {
      case "clear-history":
        return NextResponse.json(await handleClearHistory());

      case "reset-models":
        return NextResponse.json(await handleResetModels());

      case "force-sync":
        return NextResponse.json(await handleForceSync());

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: "${action}". Valid actions: clear-history, reset-models, force-sync.`,
          },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[POST /api/admin/[action]] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
