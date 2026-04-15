"use client";

// ─── Settings Page ────────────────────────────────────────────────────────────
// Displays system configuration: DB stats, feature flags, environment info.
// Also includes Admin Panel (maintenance actions) and Deployment Recommendations.
// V2 Update: Now uses session-scoped keys for localStorage operations.

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Database,
  Cpu,
  Layers,
  Zap,
  Trash2,
  RotateCcw,
  CloudUpload,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Lightbulb,
  GitBranch,
  Server,
  Lock,
  Monitor,
  ExternalLink,
  BookOpen,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_VERSION, APP_NAME } from "@/lib/constants/version";
import { getOrCreateSessionId } from "@/lib/session/session-manager";
import type {
  SettingsResponse,
  SettingsErrorResponse,
  SystemStats,
  FeatureFlags,
} from "@/app/api/settings/route";
import type { AdminAction, AdminActionResponse } from "@/app/api/admin/[action]/route";

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: boolean;
}

function StatCard({ label, value, icon, accent = false }: StatCardProps) {
  return (
    <div
      className={cn(
        "p-6 border flex flex-col gap-3",
        accent
          ? "border-primary/30 bg-primary/5"
          : "border-outline-variant/20 bg-surface-container-low"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest",
          accent ? "text-primary" : "text-on-surface-variant"
        )}
      >
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "text-3xl font-black tabular-nums tracking-tighter",
          accent ? "text-primary" : "text-on-surface"
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Feature flag row ─────────────────────────────────────────────────────────

interface FlagRowProps {
  label: string;
  description: string;
  enabled: boolean;
}

function FlagRow({ label, description, enabled }: FlagRowProps) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-outline-variant/10 last:border-b-0">
      <div>
        <p className="font-mono text-xs text-on-surface uppercase tracking-widest">{label}</p>
        <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5">{description}</p>
      </div>
      <span
        className={cn(
          "px-3 py-1 font-mono text-[10px] uppercase tracking-widest font-bold shrink-0",
          enabled
            ? "bg-emerald-400/10 text-emerald-400"
            : "bg-outline-variant/10 text-on-surface-variant/40"
        )}
      >
        {enabled ? "[ ACTIVE ]" : "[ OFF ]"}
      </span>
    </div>
  );
}

// ─── ENV badge ────────────────────────────────────────────────────────────────

const ENV_COLORS: Record<string, string> = {
  production: "text-emerald-400 bg-emerald-400/10",
  development: "text-yellow-400 bg-yellow-400/10",
  test: "text-blue-400 bg-blue-400/10",
};

// ─── Admin Action Button ───────────────────────────────────────────────────────

type ActionStatus = "idle" | "loading" | "success" | "error";

interface AdminButtonProps {
  action: AdminAction;
  label: string;
  description: string;
  icon: React.ReactNode;
  dangerous?: boolean;
  onAction: (action: AdminAction) => Promise<void>;
  status: ActionStatus;
  lastMessage?: string;
}

function AdminActionButton({
  action,
  label,
  description,
  icon,
  dangerous = false,
  onAction,
  status,
  lastMessage,
}: AdminButtonProps) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (dangerous && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onAction(action);
  };

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

      {/* Confirmation prompt */}
      {confirming && (
        <div className="font-mono text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2">
          ⚠ Esta acción es irreversible. ¿Confirmar?
        </div>
      )}

      {/* Status message */}
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

      {/* Action button */}
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "self-start px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          confirming
            ? "bg-red-500 text-white hover:bg-red-600"
            : dangerous
            ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
            : "border border-primary/30 text-primary hover:bg-primary/10"
        )}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={10} className="animate-spin" />
            Ejecutando...
          </span>
        ) : confirming ? (
          "Sí, confirmar"
        ) : (
          label
        )}
      </button>
    </div>
  );
}

// ─── Deployment Recommendation Item ───────────────────────────────────────────

interface RecommendationProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

function RecommendationItem({ icon, title, description, priority }: RecommendationProps) {
  const priorityStyle = {
    high: "text-red-400 bg-red-400/10 border border-red-400/20",
    medium: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
    low: "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20",
  }[priority];

  const priorityLabel = {
    high: "Alta",
    medium: "Media",
    low: "Baja",
  }[priority];

  return (
    <div className="flex items-start gap-4 py-4 border-b border-outline-variant/10 last:border-b-0">
      <span className="text-primary mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-bold text-on-surface uppercase tracking-widest">
          {title}
        </p>
        <p className="font-mono text-[10px] text-on-surface-variant/70 mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest font-bold",
          priorityStyle
        )}
      >
        {priorityLabel}
      </span>
    </div>
  );
}

// ─── Recommended Toolkit Link ──────────────────────────────────────────────────

interface ToolkitLinkProps {
  icon: React.ReactNode;
  name: string;
  url: string;
  description: string;
}

function ToolkitLink({ icon, name, url, description }: ToolkitLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-start gap-4 p-5 border transition-colors group",
        "border-outline-variant/20 bg-surface-container-low hover:border-primary/30"
      )}
    >
      <span className="text-primary mt-0.5 shrink-0 group-hover:text-secondary transition-colors">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-bold text-on-surface uppercase tracking-widest group-hover:text-primary transition-colors">
          {name}
        </p>
        <p className="font-mono text-[10px] text-on-surface-variant/70 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <ExternalLink size={12} className="text-on-surface-variant/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
    </a>
  );
}

// ─── Settings Page Component ─────────────────────────────────────────────────

interface ActionState {
  status: ActionStatus;
  message: string;
}

type SystemAction = "clear-local-persistence" | "trigger-catalog-sync";

export default function SettingsPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin action states keyed by action name
  const [actionStates, setActionStates] = useState<Record<AdminAction, ActionState>>({
    "clear-history": { status: "idle", message: "" },
    "reset-stats":   { status: "idle", message: "" },
    "force-sync":    { status: "idle", message: "" },
  });

  // System action states (localStorage clear + catalog sync)
  const [sysActionStates, setSysActionStates] = useState<Record<SystemAction, ActionState>>({
    "clear-local-persistence": { status: "idle", message: "" },
    "trigger-catalog-sync":    { status: "idle", message: "" },
  });

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const json = (await res.json()) as SettingsResponse | SettingsErrorResponse;

      if (!res.ok || !json.success) {
        setError((json as SettingsErrorResponse).error ?? `Error ${res.status}`);
        return;
      }

      const data = json as SettingsResponse;
      setStats(data.stats);
      setFlags(data.flags);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = useCallback(async (action: AdminAction) => {
    setActionStates((prev) => ({
      ...prev,
      [action]: { status: "loading", message: "" },
    }));

    try {
      const res = await fetch(`/api/admin/${action}`, { method: "POST" });
      const json = (await res.json()) as AdminActionResponse | { success: false; error: string };

      if (!res.ok || !json.success) {
        const errMsg = (json as { success: false; error: string }).error ?? `Error ${res.status}`;
        setActionStates((prev) => ({
          ...prev,
          [action]: { status: "error", message: errMsg },
        }));
        return;
      }

      const data = json as AdminActionResponse;
      setActionStates((prev) => ({
        ...prev,
        [action]: { status: "success", message: data.message },
      }));

      // Refresh settings stats after successful action
      await fetchSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      setActionStates((prev) => ({
        ...prev,
        [action]: { status: "error", message: msg },
      }));
    }
  }, []);

  // ── System Actions ───────────────────────────────────────────────────────────

  const handleClearLocalPersistence = useCallback(() => {
    setSysActionStates((prev) => ({
      ...prev,
      "clear-local-persistence": { status: "loading", message: "" },
    }));
    try {
      // Clear all localStorage keys for THIS session only
      const sessionId = getOrCreateSessionId();
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Remove keys that belong to this session OR old global keys
        if (key && (key.startsWith(`${sessionId}:`) || key.startsWith("sdd-") || key.startsWith("sdd_"))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      
      setSysActionStates((prev) => ({
        ...prev,
        "clear-local-persistence": {
          status: "success",
          message: `${keysToRemove.length} clave(s) eliminada(s) de localStorage para esta sesión.`,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al acceder a localStorage";
      setSysActionStates((prev) => ({
        ...prev,
        "clear-local-persistence": { status: "error", message: msg },
      }));
    }
  }, []);

  const handleTriggerCatalogSync = useCallback(async () => {
    setSysActionStates((prev) => ({
      ...prev,
      "trigger-catalog-sync": { status: "loading", message: "" },
    }));
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json() as { success: boolean; result?: { upserted: number; skipped: number; errors: number; durationMs: number }; error?: string };
      if (!res.ok || !json.success) {
        setSysActionStates((prev) => ({
          ...prev,
          "trigger-catalog-sync": { status: "error", message: json.error ?? `Error ${res.status}` },
        }));
        return;
      }
      const r = json.result!;
      setSysActionStates((prev) => ({
        ...prev,
        "trigger-catalog-sync": {
          status: "success",
          message: `Sync completado. Upserted: ${r.upserted}, Skipped: ${r.skipped}, Errors: ${r.errors}. (${r.durationMs}ms)`,
        },
      }));
      await fetchSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      setSysActionStates((prev) => ({
        ...prev,
        "trigger-catalog-sync": { status: "error", message: msg },
      }));
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen pt-14 px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div className="border-l-4 border-primary pl-6">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-on-surface">
              SYS SETTINGS
            </h1>
            <p className="font-mono text-xs text-primary/60 uppercase tracking-widest mt-2">
              System Configuration // Diagnostic &amp; Admin Panel
            </p>
          </div>
          <button
            onClick={fetchSettings}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest",
              "border border-outline-variant/30 text-on-surface-variant",
              "hover:border-primary hover:text-primary transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Error state ────────────────────────────────────────────────────── */}
        {error && (
          <div className="border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
            <span className="font-bold">[ERROR]</span> {error}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-on-surface-variant font-mono text-xs uppercase tracking-widest">
            <Loader2 size={14} className="animate-spin text-primary" />
            Cargando configuración...
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {!loading && stats && flags && (
          <>
            {/* ENV banner */}
            <div className="flex items-center gap-3 border border-outline-variant/20 bg-surface-container-low px-6 py-3">
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
                Environment:
              </span>
              <span
                className={cn(
                  "font-mono text-xs font-bold uppercase px-2 py-0.5",
                  ENV_COLORS[flags.nodeEnv] ?? "text-on-surface bg-surface-container"
                )}
              >
                {flags.nodeEnv}
              </span>
            </div>

            {/* ── Build Information ─────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-secondary" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  Build Information
                </h2>
              </div>
              <div className="border border-outline-variant/20 bg-surface-container-low px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-widest block mb-1">
                      Application
                    </span>
                    <span className="font-mono text-sm text-on-surface font-bold uppercase tracking-wider">
                      {APP_NAME}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-widest block mb-1">
                      Version
                    </span>
                    <span className="font-mono text-sm text-primary font-bold tracking-wider">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-widest block mb-1">
                      Stack
                    </span>
                    <span className="font-mono text-sm text-on-surface tracking-wider">
                      Next.js 15 + Prisma + Tailwind
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── DB Stats ─────────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-primary" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  Database Stats
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Modelos"
                  value={stats.modelCount}
                  icon={<Layers size={10} />}
                  accent
                />
                <StatCard
                  label="Providers"
                  value={stats.providerCount}
                  icon={<Database size={10} />}
                />
                <StatCard
                  label="Jobs"
                  value={stats.jobCount}
                  icon={<Zap size={10} />}
                />
                <StatCard
                  label="AI Discovered"
                  value={stats.aiDiscoveredCount}
                  icon={<Cpu size={10} />}
                />
              </div>
            </section>

            {/* ── Feature Flags ─────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-secondary" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  Feature Flags
                </h2>
              </div>
              <div className="border border-outline-variant/20 bg-surface-container-low px-6">
                <FlagRow
                  label="Gemini AI"
                  description="GEMINI_API_KEY — model categorization + AI discovery"
                  enabled={flags.geminiConfigured}
                />
                <FlagRow
                  label="OpenRouter Sync"
                  description="OPENROUTER_API_KEY — auto-populate model dictionary from OpenRouter"
                  enabled={flags.openrouterConfigured}
                />
                <FlagRow
                  label="Database"
                  description="PostgreSQL connection — required for all operations"
                  enabled={flags.databaseConnected}
                />
              </div>
            </section>

            {/* ── Recommended Toolkit ─────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-primary" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  Recommended Toolkit
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ToolkitLink
                  icon={<Database size={14} />}
                  name="Prisma"
                  url="https://www.prisma.io/docs"
                  description="Next-gen ORM for Node.js & TypeScript. Database access, migrations, and studio — all type-safe."
                />
                <ToolkitLink
                  icon={<Layers size={14} />}
                  name="Tailwind CSS"
                  url="https://tailwindcss.com/docs"
                  description="Utility-first CSS framework. Build modern, responsive interfaces directly in your markup."
                />
                <ToolkitLink
                  icon={<Zap size={14} />}
                  name="Framer Motion"
                  url="https://motion.dev/docs"
                  description="Production-ready animation library for React. Declarative animations, gestures, and layout transitions."
                />
              </div>
            </section>

            {/* ── System Actions ────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-tertiary" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  System Actions
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Clear Local Persistence */}
                <div className="p-5 border border-outline-variant/20 bg-surface-container-low flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-primary shrink-0"><Eraser size={16} /></span>
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
                        Clear Local Persistence
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5">
                        Elimina todas las claves de localStorage (resultados guardados, preferencias de UI).
                      </p>
                    </div>
                  </div>
                  {sysActionStates["clear-local-persistence"].status !== "idle" && sysActionStates["clear-local-persistence"].status !== "loading" && (
                    <div className={cn(
                      "font-mono text-[10px] px-3 py-2 flex items-start gap-2",
                      sysActionStates["clear-local-persistence"].status === "success"
                        ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    )}>
                      {sysActionStates["clear-local-persistence"].status === "success" ? (
                        <CheckCircle size={10} className="shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={10} className="shrink-0 mt-0.5" />
                      )}
                      {sysActionStates["clear-local-persistence"].message}
                    </div>
                  )}
                  <button
                    onClick={handleClearLocalPersistence}
                    disabled={sysActionStates["clear-local-persistence"].status === "loading"}
                    className={cn(
                      "self-start px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                      "border border-primary/30 text-primary hover:bg-primary/10",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    {sysActionStates["clear-local-persistence"].status === "loading" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={10} className="animate-spin" />
                        Limpiando...
                      </span>
                    ) : (
                      "Clear Persistence"
                    )}
                  </button>
                </div>

                {/* Trigger Catalog Sync */}
                <div className="p-5 border border-outline-variant/20 bg-surface-container-low flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-primary shrink-0"><CloudUpload size={16} /></span>
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
                        Trigger Catalog Sync
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5">
                        Sincroniza el catálogo de modelos desde OpenRouter vía <span className="text-primary">/api/sync</span>.
                      </p>
                    </div>
                  </div>
                  {sysActionStates["trigger-catalog-sync"].status !== "idle" && sysActionStates["trigger-catalog-sync"].status !== "loading" && (
                    <div className={cn(
                      "font-mono text-[10px] px-3 py-2 flex items-start gap-2",
                      sysActionStates["trigger-catalog-sync"].status === "success"
                        ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    )}>
                      {sysActionStates["trigger-catalog-sync"].status === "success" ? (
                        <CheckCircle size={10} className="shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={10} className="shrink-0 mt-0.5" />
                      )}
                      {sysActionStates["trigger-catalog-sync"].message}
                    </div>
                  )}
                  <button
                    onClick={handleTriggerCatalogSync}
                    disabled={
                      !flags.openrouterConfigured ||
                      sysActionStates["trigger-catalog-sync"].status === "loading"
                    }
                    className={cn(
                      "self-start px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                      "border border-primary/30 text-primary hover:bg-primary/10",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    {sysActionStates["trigger-catalog-sync"].status === "loading" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={10} className="animate-spin" />
                        Sincronizando...
                      </span>
                    ) : (
                      "Trigger Sync"
                    )}
                  </button>
                </div>
              </div>
              {!flags.openrouterConfigured && (
                <p className="font-mono text-[9px] text-on-surface-variant/40 mt-2 pl-4">
                  ⚠ OPENROUTER_API_KEY no configurada — Catalog Sync deshabilitado.
                </p>
              )}
            </section>

            {/* ── System Maintenance (Admin Panel) ─────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-6 bg-red-500/60" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  System Maintenance
                </h2>
                <span className="font-mono text-[9px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-widest">
                  Admin Only
                </span>
              </div>
              <p className="font-mono text-[10px] text-on-surface-variant/50 mb-5 pl-4">
                Acciones destructivas. Confirmación requerida en operaciones irreversibles.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <AdminActionButton
                  action="clear-history"
                  label="Clear History"
                  description="Elimina todos los jobs de optimización y sus selecciones de modelos."
                  icon={<Trash2 size={16} />}
                  dangerous
                  onAction={handleAdminAction}
                  status={actionStates["clear-history"].status}
                  lastMessage={actionStates["clear-history"].message}
                />
                <AdminActionButton
                  action="reset-stats"
                  label="Reset AI Models"
                  description="Elimina todos los modelos descubiertos por IA. Conserva el seed manual."
                  icon={<RotateCcw size={16} />}
                  dangerous
                  onAction={handleAdminAction}
                  status={actionStates["reset-stats"].status}
                  lastMessage={actionStates["reset-stats"].message}
                />
                <AdminActionButton
                  action="force-sync"
                  label="Force Sync"
                  description="Fuerza sincronización con OpenRouter vía /api/admin/force-sync."
                  icon={<CloudUpload size={16} />}
                  dangerous={false}
                  onAction={handleAdminAction}
                  status={actionStates["force-sync"].status}
                  lastMessage={actionStates["force-sync"].message}
                />
              </div>

              </section>

            {/* ── Deployment Recommendations ───────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-yellow-500" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  Deployment Recommendations
                </h2>
              </div>
              <div className="border border-outline-variant/20 bg-surface-container-low px-6">
                <RecommendationItem
                  icon={<Lock size={14} />}
                  title="Agregar Auth Guard al Admin Panel"
                  description="Las acciones de mantenimiento no tienen control de acceso. Implementar middleware JWT o NextAuth antes de un deploy en producción."
                  priority="high"
                />
                <RecommendationItem
                  icon={<Server size={14} />}
                  title="Variables de entorno en plataforma de CI/CD"
                  description="Mover DATABASE_URL, GEMINI_API_KEY y OPENROUTER_API_KEY a secretos de Vercel/Railway. Nunca commitear el archivo .env."
                  priority="high"
                />
                <RecommendationItem
                  icon={<GitBranch size={14} />}
                  title="Implementar Migrations automáticas en CI"
                  description="Ejecutar prisma migrate deploy como parte del pipeline de build para garantizar que el esquema esté actualizado en cada deploy."
                  priority="medium"
                />
                <RecommendationItem
                  icon={<ShieldAlert size={14} />}
                  title="Rate Limiting en /api/optimize"
                  description="El endpoint de optimización llama a Gemini AI. Sin rate limit, un usuario puede generar costos elevados. Usar Upstash Redis + @upstash/ratelimit."
                  priority="medium"
                />
                <RecommendationItem
                  icon={<Monitor size={14} />}
                  title="Logging estructurado con Pino o Winston"
                  description="Reemplazar console.log/error con un logger estructurado. Facilita debug en producción y permite integración con Datadog o Grafana Loki."
                  priority="low"
                />
                <RecommendationItem
                  icon={<Lightbulb size={14} />}
                  title="Caché de resultados con Redis"
                  description="El mismo input al optimizer siempre produce el mismo resultado. Cachear la respuesta de Gemini por 1h reduciría latencia y costos de API."
                  priority="low"
                />
              </div>
            </section>

            {/* ── Env vars reference ───────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-outline-variant" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  Required Environment Variables
                </h2>
              </div>
              <div className="bg-surface-container border border-outline-variant/20 p-6 font-mono text-xs space-y-2">
                {[
                  { key: "DATABASE_URL", required: true, desc: "PostgreSQL connection string" },
                  { key: "GEMINI_API_KEY", required: false, desc: "Enables AI model discovery" },
                  { key: "OPENROUTER_API_KEY", required: false, desc: "Enables OpenRouter sync" },
                  { key: "NEXT_PUBLIC_APP_URL", required: false, desc: "Public URL for metadata" },
                ].map(({ key, required, desc }) => (
                  <div key={key} className="flex items-baseline gap-4">
                    <span className="text-primary w-56 shrink-0">{key}</span>
                    <span className="text-on-surface-variant/40 text-[10px] uppercase tracking-widest w-20 shrink-0">
                      {required ? "[required]" : "[optional]"}
                    </span>
                    <span className="text-on-surface-variant">{desc}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
