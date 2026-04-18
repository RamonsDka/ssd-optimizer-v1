"use client";

// ─── Settings Page ────────────────────────────────────────────────────────────
// Displays system configuration: DB stats, feature flags, environment info.
// Also includes Admin Panel (maintenance actions) and Deployment Recommendations.
// V2 Update: Now uses session-scoped keys for localStorage operations.
// Phase 4.2.1 / 4.2.2: Added Language & Region + Appearance sections.

import { useState, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Database,
  Cpu,
  Layers,
  Zap,
  CloudUpload,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Lightbulb,
  GitBranch,
  Server,
  Lock,
  Monitor,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_VERSION, APP_NAME } from "@/lib/constants/version";
import { getOrCreateSessionId } from "@/lib/session/session-manager";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

import { LanguageRegionSection } from "@/components/settings/sections/LanguageRegionSection";
import { AppearanceSection } from "@/components/settings/sections/AppearanceSection";
import { DataSyncSection } from "@/components/settings/sections/DataSyncSection";
import { AdvancedScoringSection } from "@/components/settings/sections/AdvancedScoringSection";
import { DataManagementSection } from "@/components/settings/sections/DataManagementSection";
import { SystemMaintenanceSection } from "@/components/settings/sections/SystemMaintenanceSection";
import { useSettings } from "@/lib/hooks/useSettings";
import { useUIPreferences } from "@/lib/hooks/useUIPreferences";

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

// ─── Local action status ──────────────────────────────────────────────────────

type ActionStatus = "idle" | "loading" | "success" | "error";

// ─── Deployment Recommendation Item ───────────────────────────────────────────

interface RecommendationProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

function RecommendationItem({ icon, title, description, priority }: RecommendationProps) {
  const { t } = useLanguage();

  const priorityStyle = {
    high: "text-red-400 bg-red-400/10 border border-red-400/20",
    medium: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
    low: "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20",
  }[priority];

  const priorityLabel = {
    high: t("settings", "priorityHigh"),
    medium: t("settings", "priorityMedium"),
    low: t("settings", "priorityLow"),
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

// ─── Settings Page Component ─────────────────────────────────────────────────

interface ActionState {
  status: ActionStatus;
  message: string;
}

type SystemAction = "clear-local-persistence" | "trigger-catalog-sync";

export default function SettingsPage() {
  const { t } = useLanguage();

  // ── useSettings replaces inline fetch for stats + flags ─────────────────────
  const {
    data: settingsData,
    loading,
    error,
    refresh,
    update: updateFlags,
  } = useSettings();

  const stats = settingsData?.stats ?? null;
  const flags = settingsData?.flags ?? null;

  // ── UI preferences (local) ───────────────────────────────────────────────────
  const {
    preferences,
    setAutoSave,
    setHistoryRetention,
    setConfidenceThreshold,
  } = useUIPreferences();

  // System action states (localStorage clear + catalog sync)
  const [sysActionStates, setSysActionStates] = useState<Record<SystemAction, ActionState>>({
    "clear-local-persistence": { status: "idle", message: "" },
    "trigger-catalog-sync":    { status: "idle", message: "" },
  });

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
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      setSysActionStates((prev) => ({
        ...prev,
        "trigger-catalog-sync": { status: "error", message: msg },
      }));
    }
  }, [refresh]);

  // Note: useSettings handles initial fetch automatically — no useEffect needed here.

  return (
    <div className="min-h-screen pt-14 px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div className="border-l-4 border-primary pl-6">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-on-surface">
              {t("settings", "title")}
            </h1>
            <p className="font-mono text-xs text-primary/60 uppercase tracking-widest mt-2">
              {t("settings", "subtitle")}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest",
              "border border-outline-variant/30 text-on-surface-variant",
              "hover:border-primary hover:text-primary transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            {t("settings", "refresh")}
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
            {t("settings", "loading")}
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {!loading && stats && flags && (
          <>
            {/* ENV banner */}
            <div className="flex items-center gap-3 border border-outline-variant/20 bg-surface-container-low px-6 py-3">
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
                {t("settings", "environment")}:
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

            {/* ── Language & Region (4.2.1) ─────────────────────────────────── */}
            <LanguageRegionSection />

            {/* ── Appearance (4.2.2) ────────────────────────────────────────── */}
            <AppearanceSection />

            {/* ── Data Sync (4.2.3) ─────────────────────────────────────────── */}
            <DataSyncSection
              openrouterConfigured={flags.openrouterConfigured}
              modelCount={stats.modelCount}
              onSyncComplete={refresh}
            />

            {/* ── Advanced Scoring (4.2.4) ──────────────────────────────────── */}
            <AdvancedScoringSection
              flags={flags}
              onFlagChange={updateFlags}
              confidenceThreshold={preferences.confidenceThreshold}
              onThresholdChange={setConfidenceThreshold}
            />

            {/* ── Data Management (4.2.5) ───────────────────────────────────── */}
            <DataManagementSection
              autoSave={preferences.autoSave}
              onAutoSaveChange={setAutoSave}
              historyRetention={preferences.historyRetention}
              onHistoryRetentionChange={setHistoryRetention}
            />

            {/* ── Build Information ─────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-secondary" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  {t("settings", "buildInfo")}
                </h2>
              </div>
              <div className="border border-outline-variant/20 bg-surface-container-low px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-widest block mb-1">
                      {t("settings", "application")}
                    </span>
                    <span className="font-mono text-sm text-on-surface font-bold uppercase tracking-wider">
                      {APP_NAME}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-widest block mb-1">
                      {t("settings", "version")}
                    </span>
                    <span className="font-mono text-sm text-primary font-bold tracking-wider">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-widest block mb-1">
                      {t("settings", "stack")}
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
                  {t("settings", "dbStats")}
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
                  {t("settings", "featureFlags")}
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


            {/* ── System Actions ────────────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-tertiary" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  {t("settings", "systemActions")}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Clear Local Persistence */}
                <div className="p-5 border border-outline-variant/20 bg-surface-container-low flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-primary shrink-0"><Eraser size={16} /></span>
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
                        {t("settings", "clearPersistence")}
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5">
                        {t("settings", "clearPersistenceDesc")}
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
                        {t("settings", "clearing")}
                      </span>
                    ) : (
                      t("settings", "clearPersistence")
                    )}
                  </button>
                </div>

                {/* Trigger Catalog Sync */}
                <div className="p-5 border border-outline-variant/20 bg-surface-container-low flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-primary shrink-0"><CloudUpload size={16} /></span>
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
                        {t("settings", "triggerSync")}
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5">
                        {t("settings", "triggerSyncDesc")}
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
                        {t("settings", "syncing")}
                      </span>
                    ) : (
                      t("settings", "triggerSync")
                    )}
                  </button>
                </div>
              </div>
              {!flags.openrouterConfigured && (
                <p className="font-mono text-[9px] text-on-surface-variant/40 mt-2 pl-4">
                  {t("settings", "openrouterNotConfigured")}
                </p>
              )}
            </section>

            {/* ── System Maintenance (4.2.6) — Admin-only section ──────────── */}
            <SystemMaintenanceSection
              onSyncComplete={refresh}
              isAdmin={flags.nodeEnv === "development" || process.env.NEXT_PUBLIC_ADMIN_MODE === "true"}
            />

            {/* ── Deployment Recommendations ───────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-yellow-500" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  {t("settings", "deploymentRecs")}
                </h2>
              </div>
              <div className="border border-outline-variant/20 bg-surface-container-low px-6">
                <RecommendationItem
                  icon={<Lock size={14} />}
                  title={t("settings", "recAuth")}
                  description={t("settings", "recAuthDesc")}
                  priority="high"
                />
                <RecommendationItem
                  icon={<Server size={14} />}
                  title={t("settings", "recEnvVars")}
                  description={t("settings", "recEnvVarsDesc")}
                  priority="high"
                />
                <RecommendationItem
                  icon={<GitBranch size={14} />}
                  title={t("settings", "recMigrations")}
                  description={t("settings", "recMigrationsDesc")}
                  priority="medium"
                />
                <RecommendationItem
                  icon={<ShieldAlert size={14} />}
                  title={t("settings", "recRateLimit")}
                  description={t("settings", "recRateLimitDesc")}
                  priority="medium"
                />
                <RecommendationItem
                  icon={<Monitor size={14} />}
                  title={t("settings", "recLogging")}
                  description={t("settings", "recLoggingDesc")}
                  priority="low"
                />
                <RecommendationItem
                  icon={<Lightbulb size={14} />}
                  title={t("settings", "recCache")}
                  description={t("settings", "recCacheDesc")}
                  priority="low"
                />
              </div>
            </section>

            {/* ── Env vars reference ───────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-outline-variant" />
                <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  {t("settings", "envVars")}
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
                      {required ? t("settings", "required") : t("settings", "optional")}
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
