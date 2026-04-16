"use client";

// ─── SystemMaintenanceSection (4.2.6) ─────────────────────────────────────────
// Settings section for System Maintenance.
// Responsibilities:
//   - "Force Sync LM Arena" — calls POST /api/admin/force-sync (reuses AdminAction flow)
//   - "Clear Cache" — removes app-specific localStorage keys for the current session
//
// Both actions show visual feedback (success / error) using AdminActionButton.
// "Force Sync LM Arena" is non-destructive; "Clear Cache" has no confirmation step
// (data is local, easily reconstructed on next use).
//
// Props received from parent page (SettingsPage):
//   - onSyncComplete: () => Promise<void>  — parent refreshes its stats after sync

import { useState, useCallback } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { getOrCreateSessionId } from "@/lib/session/session-manager";
import type { AdminAction, AdminActionResponse } from "@/app/api/admin/[action]/route";

// ─── Local types ──────────────────────────────────────────────────────────────

type ActionStatus = "idle" | "loading" | "success" | "error";

interface ActionState {
  status: ActionStatus;
  message: string;
}

// ─── AdminActionButton ────────────────────────────────────────────────────────
// Local re-export of the inline component from the page so this section is
// fully self-contained without duplicating the design.

import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AdminButtonProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  dangerous?: boolean;
  onAction: () => void | Promise<void>;
  status: ActionStatus;
  lastMessage?: string;
}

function MaintenanceButton({
  label,
  description,
  icon,
  dangerous = false,
  onAction,
  status,
  lastMessage,
}: AdminButtonProps) {
  const isLoading = status === "loading";

  return (
    <div
      className={cn(
        "p-5 border flex flex-col gap-3 transition-colors",
        dangerous
          ? "border-red-500/20 bg-red-500/5 hover:border-red-500/40"
          : "border-outline-variant/20 bg-surface-container-low hover:border-primary/30"
      )}
    >
      {/* Label + icon */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex-shrink-0",
            dangerous ? "text-red-400" : "text-primary"
          )}
        >
          {icon}
        </span>
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
            {label}
          </p>
          <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      {/* Status feedback */}
      {lastMessage && status !== "idle" && status !== "loading" && (
        <div
          className={cn(
            "font-mono text-[10px] px-3 py-2 flex items-start gap-2",
            status === "success"
              ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          )}
        >
          {status === "success" ? (
            <CheckCircle size={10} className="shrink-0 mt-0.5" />
          ) : (
            <XCircle size={10} className="shrink-0 mt-0.5" />
          )}
          {lastMessage}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={onAction}
        disabled={isLoading}
        className={cn(
          "self-start px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          dangerous
            ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
            : "border border-primary/30 text-primary hover:bg-primary/10"
        )}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={10} className="animate-spin" />
            Ejecutando...
          </span>
        ) : (
          label
        )}
      </button>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SystemMaintenanceSectionProps {
  /** Called after a successful Force Sync so the parent can refresh its stats. */
  onSyncComplete?: () => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SystemMaintenanceSection({
  onSyncComplete,
}: SystemMaintenanceSectionProps) {
  // Individual action states
  const [syncState, setSyncState] = useState<ActionState>({ status: "idle", message: "" });
  const [clearState, setClearState] = useState<ActionState>({ status: "idle", message: "" });

  // ── Force Sync LM Arena ──────────────────────────────────────────────────────
  // Delegates to POST /api/admin/force-sync — same endpoint used by AdminPanel.

  const handleForceSync = useCallback(async () => {
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
      setSyncState({ status: "success", message: data.message });

      if (onSyncComplete) {
        await onSyncComplete();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      setSyncState({ status: "error", message: msg });
    }
  }, [onSyncComplete]);

  // ── Clear Cache ──────────────────────────────────────────────────────────────
  // Removes localStorage keys scoped to the current session and known app prefixes.
  // Uses getOrCreateSessionId() so only THIS browser's session data is cleared.

  const handleClearCache = useCallback(() => {
    setClearState({ status: "loading", message: "" });
    try {
      const sessionId = getOrCreateSessionId();
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (
            key.startsWith(`${sessionId}:`) ||
            key.startsWith("sdd-") ||
            key.startsWith("sdd_") ||
            key.startsWith("sdd-user-profile")
          )
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((k) => localStorage.removeItem(k));

      setClearState({
        status: "success",
        message:
          keysToRemove.length > 0
            ? `Cache limpiado: ${keysToRemove.length} clave(s) eliminada(s) de localStorage.`
            : "Cache ya estaba vacío — no se encontraron claves de la app.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al acceder a localStorage";
      setClearState({ status: "error", message: msg });
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SettingsSection
      title="System Maintenance"
      description="Acciones de mantenimiento del sistema. Force Sync actualiza el catálogo desde LM Arena; Clear Cache elimina datos locales de esta sesión."
      accent="danger"
      headerAction={
        <span className="font-mono text-[9px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-widest">
          Admin Only
        </span>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Force Sync LM Arena */}
        <MaintenanceButton
          label="Force Sync LM Arena"
          description="Fuerza sincronización del catálogo de modelos desde LM Arena / OpenRouter vía /api/admin/force-sync."
          icon={<RefreshCw size={16} />}
          dangerous={false}
          onAction={handleForceSync}
          status={syncState.status}
          lastMessage={syncState.message}
        />

        {/* Clear Cache */}
        <MaintenanceButton
          label="Clear Cache"
          description="Elimina las claves de localStorage de esta sesión (resultados guardados, preferencias de UI, perfil local)."
          icon={<Trash2 size={16} />}
          dangerous={false}
          onAction={handleClearCache}
          status={clearState.status}
          lastMessage={clearState.message}
        />
      </div>
    </SettingsSection>
  );
}
