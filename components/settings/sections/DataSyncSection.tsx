"use client";

// ─── DataSyncSection (4.2.3) ──────────────────────────────────────────────────
// Settings section for Data Sync.
// Responsibilities:
//   - Display LM Arena sync status (derived from FeatureFlags / SystemStats)
//   - Provide a "Sync Now" button that calls POST /api/admin/force-sync
//
// Props:
//   - openrouterConfigured: boolean — controls whether sync is available
//   - modelCount: number           — shows current catalogue size as proxy for last sync
//
// Does NOT manage its own settings fetch — receives data from the parent page
// via props (page already fetches /api/settings).

import { useState, useCallback } from "react";
import { CloudUpload, CheckCircle, XCircle, Loader2, RefreshCw, Database } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SettingsSection } from "@/components/settings/SettingsSection";
import type { AdminActionResponse } from "@/app/api/admin/[action]/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = "idle" | "loading" | "success" | "error";

interface SyncState {
  status: SyncStatus;
  message: string;
  lastSyncedCount?: number;
}

interface DataSyncSectionProps {
  /** Whether OPENROUTER_API_KEY is configured (controls sync availability). */
  openrouterConfigured: boolean;
  /** Current model count from DB — used as a proxy indicator for data freshness. */
  modelCount: number;
  /** Called after a successful sync so the parent can refresh its stats. */
  onSyncComplete?: () => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataSyncSection({
  openrouterConfigured,
  modelCount,
  onSyncComplete,
}: DataSyncSectionProps) {
  const [syncState, setSyncState] = useState<SyncState>({
    status: "idle",
    message: "",
  });

  const handleSyncNow = useCallback(async () => {
    setSyncState({ status: "loading", message: "" });

    try {
      const res = await fetch("/api/admin/force-sync", { method: "POST" });
      const json = (await res.json()) as AdminActionResponse | { success: false; error: string };

      if (!res.ok || !json.success) {
        const errMsg = (json as { success: false; error: string }).error ?? `Error ${res.status}`;
        setSyncState({ status: "error", message: errMsg });
        return;
      }

      const data = json as AdminActionResponse;
      setSyncState({
        status: "success",
        message: data.message,
        lastSyncedCount: data.affected,
      });

      // Notify parent to refresh stats
      if (onSyncComplete) {
        await onSyncComplete();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      setSyncState({ status: "error", message: msg });
    }
  }, [onSyncComplete]);

  const isLoading = syncState.status === "loading";

  return (
    <SettingsSection
      title="Data Sync"
      description="Synchronize the model catalogue from LM Arena / OpenRouter. Keeps model data up to date."
      accent="primary"
    >
      <div className="border border-outline-variant/20 bg-surface-container-low">
        {/* ── Status row ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-6 px-6 py-4 border-b border-outline-variant/10">
          {/* Left: label + status pill */}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
              LM Arena Sync Status
            </p>
            <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5 leading-relaxed">
              Model catalogue sourced from OpenRouter / LM Arena. Requires{" "}
              <span className="text-on-surface-variant">OPENROUTER_API_KEY</span>.
            </p>
          </div>

          {/* Right: status badge */}
          <span
            className={cn(
              "shrink-0 px-3 py-1 font-mono text-[10px] uppercase tracking-widest font-bold",
              openrouterConfigured
                ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                : "bg-outline-variant/10 text-on-surface-variant/40 border border-outline-variant/20"
            )}
          >
            {openrouterConfigured ? "[ CONNECTED ]" : "[ NOT CONFIGURED ]"}
          </span>
        </div>

        {/* ── Catalogue size indicator ────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant/10">
          <Database size={12} className="text-on-surface-variant/50 shrink-0" />
          <span className="font-mono text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
            Models in catalogue:
          </span>
          <span className="font-mono text-sm font-bold text-primary tabular-nums">
            {modelCount}
          </span>
        </div>

        {/* ── Feedback message ─────────────────────────────────────────── */}
        {syncState.message && syncState.status !== "loading" && (
          <div
            className={cn(
              "mx-6 mt-4 px-3 py-2 flex items-start gap-2 font-mono text-[10px]",
              syncState.status === "success"
                ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}
          >
            {syncState.status === "success" ? (
              <CheckCircle size={10} className="shrink-0 mt-0.5" />
            ) : (
              <XCircle size={10} className="shrink-0 mt-0.5" />
            )}
            {syncState.message}
          </div>
        )}

        {/* ── Sync Now button ──────────────────────────────────────────── */}
        <div className="px-6 py-4 flex items-center gap-4">
          <button
            onClick={handleSyncNow}
            disabled={!openrouterConfigured || isLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2",
              "font-mono text-[10px] uppercase tracking-widest",
              "border transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              openrouterConfigured && !isLoading
                ? "border-primary/40 text-primary hover:bg-primary/10"
                : "border-outline-variant/20 text-on-surface-variant/40"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={10} />
                Sync Now
              </>
            )}
          </button>

          {!openrouterConfigured && (
            <span className="font-mono text-[9px] text-on-surface-variant/40">
              ⚠ OPENROUTER_API_KEY not configured
            </span>
          )}

          {syncState.status === "success" && syncState.lastSyncedCount !== undefined && (
            <span className="font-mono text-[9px] text-emerald-400/70">
              ✓ {syncState.lastSyncedCount} model(s) upserted
            </span>
          )}
        </div>

        {/* ── LM Arena note ────────────────────────────────────────────── */}
        <div className="px-6 pb-4">
          <div className="flex items-start gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10">
            <CloudUpload size={10} className="text-on-surface-variant/40 shrink-0 mt-0.5" />
            <p className="font-mono text-[9px] text-on-surface-variant/50 leading-relaxed">
              Data sourced from OpenRouter API which aggregates LM Arena rankings. Sync updates
              model providers, pricing, and capability metadata.
            </p>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
