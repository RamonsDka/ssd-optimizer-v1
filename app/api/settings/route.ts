// ─── GET /api/settings ────────────────────────────────────────────────────────
// Returns read-only system configuration: DB stats + env feature flags.
// No secrets are exposed — only boolean/count data.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

// ─── Response types ───────────────────────────────────────────────────────────

export interface SystemStats {
  modelCount: number;
  providerCount: number;
  jobCount: number;
  aiDiscoveredCount: number;
}

export interface FeatureFlags {
  geminiConfigured: boolean;
  openrouterConfigured: boolean;
  databaseConnected: boolean;
  nodeEnv: string;
}

export interface SettingsResponse {
  success: true;
  stats: SystemStats;
  flags: FeatureFlags;
}

export interface SettingsErrorResponse {
  success: false;
  error: string;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<SettingsResponse | SettingsErrorResponse>> {
  try {
    // Run all DB count queries in parallel
    const [modelCount, providerCount, jobCount, aiDiscoveredCount, dbConnected] =
      await Promise.allSettled([
        prisma.model.count(),
        prisma.provider.count(),
        prisma.optimizationJob.count(),
        prisma.model.count({ where: { discoveredByAI: true } }),
        // Connectivity probe — if any query above failed, this serves as fallback check
        prisma.$queryRaw<[{ one: number }]>`SELECT 1 AS one`,
      ]).then((results) => results.map((r) => (r.status === "fulfilled" ? r.value : null)));

    const stats: SystemStats = {
      modelCount: (modelCount as number | null) ?? 0,
      providerCount: (providerCount as number | null) ?? 0,
      jobCount: (jobCount as number | null) ?? 0,
      aiDiscoveredCount: (aiDiscoveredCount as number | null) ?? 0,
    };

    const flags: FeatureFlags = {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      databaseConnected: dbConnected !== null,
      nodeEnv: process.env.NODE_ENV ?? "development",
    };

    return NextResponse.json({ success: true, stats, flags });
  } catch (err) {
    console.error("[GET /api/settings] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
