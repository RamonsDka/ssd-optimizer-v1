// ─── POST /api/admin/[action] ─────────────────────────────────────────────────
// Admin action dispatcher. Handles maintenance operations.
//
// Supported actions:
//   clear-history  — Deletes all OptimizationJob records (cascades ModelSelections via schema)
//   reset-models   — Deletes all providers (cascades models and selections via schema)
//   force-sync     — Triggers OpenRouter model sync (same as POST /api/sync)
//
// Security: requires a valid ADMIN_PASSWORD in the Authorization header.
//   Header format: Authorization: Bearer <ADMIN_PASSWORD>
//   The ADMIN_PASSWORD env var MUST be set in production.

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

// ─── Auth guard ───────────────────────────────────────────────────────────────

/**
 * Validate the incoming request against ADMIN_PASSWORD.
 * Expected header: Authorization: Bearer <ADMIN_PASSWORD>
 *
 * Returns true when the request is authorized, false otherwise.
 * When ADMIN_PASSWORD is not set in env, the guard rejects ALL requests
 * to prevent accidental production exposure with no credentials.
 */
function isAuthorized(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Reject when the env variable is missing or empty — fail-closed.
  if (!adminPassword) return false;

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  return token === adminPassword;
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
  // ── Auth check ──────────────────────────────────────────────────────────────
  if (!isAuthorized(_req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Provide a valid Authorization: Bearer <ADMIN_PASSWORD> header." },
      { status: 401 }
    );
  }

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
