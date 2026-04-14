// ─── POST /api/sync ───────────────────────────────────────────────────────────
// Triggers OpenRouter model sync.
// Body: { dryRun?: boolean }
// Requires OPENROUTER_API_KEY to be configured.

import { NextRequest, NextResponse } from "next/server";
import { syncOpenRouterModels } from "@/lib/sync/openrouter-sync";
import type { SyncResult } from "@/lib/sync/openrouter-sync";

export const runtime = "nodejs";
export const maxDuration = 60; // sync can take a while

export interface SyncResponse {
  success: true;
  result: SyncResult;
}

export interface SyncErrorResponse {
  success: false;
  error: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<SyncResponse | SyncErrorResponse>> {
  try {
    // Parse optional dryRun flag
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const dryRun = body.dryRun === true;

    const result = await syncOpenRouterModels(dryRun);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[POST /api/sync] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
