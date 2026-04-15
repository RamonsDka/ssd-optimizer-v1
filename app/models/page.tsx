"use client";

// ─── Models Page ─────────────────────────────────────────────────────────────
// Next.js 15 App Router — Client Component.
// Wires search input + tier filter to GET /api/models and renders the grid.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Cpu,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils/cn";
import type { ModelRecord, Tier } from "@/types";
import ModelDetailModal from "@/components/models/ModelDetailModal";

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Tier display helpers ─────────────────────────────────────────────────────

const TIER_ACCENT: Record<Tier, string> = {
  PREMIUM: "text-secondary",
  BALANCED: "text-primary",
  ECONOMIC: "text-on-surface-variant",
};

const TIER_DOT: Record<Tier, string> = {
  PREMIUM: "bg-secondary shadow-[0_0_8px_#ffc640]",
  BALANCED: "bg-primary",
  ECONOMIC: "bg-outline-variant",
};

// ─── Page component ───────────────────────────────────────────────────────────

export default function ModelsPage() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<Tier | "">("");
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 320);
  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch from /api/models ──────────────────────────────────────────────────
  const fetchModels = useCallback(async () => {
    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("query", debouncedQuery);
      if (tier) params.set("tier", tier);
      params.set("limit", "60");

      const res = await fetch(`/api/models?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setModels(json.data as ModelRecord[]);
        setTotal(json.total as number);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, tier]);

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, tier]);

  return (
    <div className="p-6 md:p-10 pb-24">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className="font-black text-4xl text-on-surface tracking-tighter uppercase mb-2">
            MODELS DIRECTORY
          </h1>
          <p className="font-mono text-xs text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-primary inline-block" />
            Directorio global de proveedores //
            {loading ? (
              <Loader2 size={10} className="animate-spin inline" />
            ) : (
              <span className="text-primary">{total} modelos disponibles</span>
            )}
          </p>
        </div>

        {/* Filter Bar */}
        <div className="w-full md:w-auto flex flex-col md:flex-row gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              size={14}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                "bg-surface-container-highest border-none outline-none",
                "focus:ring-0 focus:bg-surface-bright",
                "pl-10 pr-4 py-2 font-mono text-xs w-full md:w-64",
                "border-l-2 border-transparent focus:border-primary",
                "transition-colors placeholder:text-outline-variant"
              )}
              placeholder="ID SEARCH..."
              aria-label="Buscar modelos"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier | "")}
              className="bg-surface-container-highest border-none outline-none text-xs font-mono py-2 px-4 cursor-pointer hover:bg-surface-bright text-on-surface"
              aria-label="Filtrar por tier"
            >
              <option value="">TODOS LOS TIERS</option>
              <option value="PREMIUM">PREMIUM</option>
              <option value="BALANCED">BALANCED</option>
              <option value="ECONOMIC">ECONOMIC</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Error state ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 border-l-4 border-error bg-error-container/10 px-6 py-4 flex items-center gap-3"
            role="alert"
          >
            <AlertCircle size={16} className="text-error shrink-0" />
            <span className="font-mono text-xs text-error">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Models Grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
        {loading &&
          models.length === 0 &&
          Array.from({ length: 6 }).map((_, i) => (
            <ModelCardSkeleton key={i} />
          ))}

        <AnimatePresence>
          {models.map((model, i) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: i * 0.02 }}
            >
              <ModelCard model={model} onClick={() => setSelectedModelId(model.id)} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {!loading && models.length === 0 && !error && (
          <div className="col-span-full py-20 text-center">
            <p className="font-mono text-xs text-on-surface-variant uppercase tracking-widest">
              [ NO MODELS FOUND ]
            </p>
            <p className="font-mono text-[10px] text-on-surface-variant/40 mt-2">
              Ajusta los filtros o verifica la conexión a la base de datos
            </p>
          </div>
        )}

</div>

      {/* ── Model Detail Modal ─────────────────────────────────────────────── */}
      <ModelDetailModal
        modelId={selectedModelId}
        onClose={() => setSelectedModelId(null)}
      />

      {/* ── Comparison Matrix ─────────────────────────────────────────────── */}
      {models.length > 0 && (
        <div className="mt-16 overflow-x-auto">
          <div className="bg-surface-container-low">
            <div className="px-6 py-4 bg-surface-container-high border-l-4 border-secondary">
              <h2 className="font-mono font-bold text-xs uppercase tracking-[0.2em] text-secondary">
                ADVANCED METRICS // COMPARISON MATRIX
              </h2>
            </div>
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-on-surface-variant border-b border-outline-variant/10">
                  <th className="px-6 py-4 font-normal uppercase tracking-widest">MODEL ID</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-widest">TIER</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-widest">CONTEXT WINDOW</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-widest">COST/1M</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-widest">STRENGTHS</th>
                  <th className="px-6 py-4 font-normal uppercase tracking-widest">SCORE</th>
                </tr>
              </thead>
              <tbody className="text-on-surface">
                {models.slice(0, 10).map((model) => (
                  <MatrixRow key={model.id} model={model} />
                ))}
              </tbody>
            </table>
            {models.length > 10 && (
              <div className="px-6 py-3 border-t border-outline-variant/5 text-[9px] font-mono text-on-surface-variant/40">
                Mostrando 10/{models.length} — usa el buscador para filtrar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ModelCard ────────────────────────────────────────────────────────────────

function ModelCard({ model, onClick }: { model: ModelRecord; onClick?: () => void }) {
  const isPremium = model.tier === "PREMIUM";
  const isBalanced = model.tier === "BALANCED";

  // Compute a simple "reasoning" percentage from strengths count
  const scoreProxy = Math.min(100, model.strengths.length * 20 + 40);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) onClick(); }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Ver detalle de ${model.name}` : undefined}
      className={cn(
        "group bg-surface-container-low flex flex-col transition-all duration-300",
        isPremium && "border-l-4 border-secondary",
        isBalanced && "border-l-4 border-primary",
        onClick && "cursor-pointer hover:ring-1 hover:ring-primary/30"
      )}
    >
      {/* Tier badge row */}
      <div className="bg-surface-container-high flex justify-between items-center px-4 py-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2", TIER_DOT[model.tier])} />
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
            SYS READY
          </span>
        </div>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            TIER_ACCENT[model.tier]
          )}
        >
          {model.tier}
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3
              className={cn(
                "font-bold text-lg text-on-surface transition-colors break-words leading-tight",
                isPremium ? "group-hover:text-secondary" : "group-hover:text-primary"
              )}
              title={model.name}
            >
              {model.name}
            </h3>
            <p className="font-mono text-[10px] text-on-surface-variant">{model.providerId}</p>
          </div>
          <div className="w-10 h-10 bg-background flex items-center justify-center p-2">
            <Cpu
              size={20}
              className="text-on-surface-variant opacity-40 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-on-surface-variant block uppercase tracking-widest">
              Context Window
            </span>
            <span className="font-mono text-sm text-on-surface font-bold">
              {(model.contextWindow / 1000).toFixed(0)}K Tokens
            </span>
          </div>
          <div className="space-y-1 text-right">
            <span className="font-mono text-[10px] text-on-surface-variant block uppercase tracking-widest">
              Cost/1M
            </span>
            <span
              className={cn(
                "font-mono text-sm font-bold",
                isPremium ? "text-secondary" : "text-primary"
              )}
            >
              ${model.costPer1M.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div className="space-y-2">
          <span className="font-mono text-[10px] text-on-surface-variant block uppercase tracking-widest">
            Capability Score
          </span>
          <div className="flex gap-1 h-1.5 w-full bg-surface-container-highest">
            <div
              className={cn(
                "h-full transition-all duration-500",
                isPremium
                  ? "bg-secondary"
                  : isBalanced
                  ? "bg-primary"
                  : "bg-on-surface-variant"
              )}
              style={{ width: `${scoreProxy}%` }}
            />
          </div>
        </div>

        {/* Strengths tags */}
        <div className="flex flex-wrap gap-2">
          {model.strengths.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className={cn(
                "px-2 py-1 bg-surface-container-highest text-[10px] font-mono text-on-surface-variant border-l",
                isPremium ? "border-secondary" : "border-primary"
              )}
            >
              {tag}
            </span>
          ))}
          {model.strengths.length > 4 && (
            <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-mono text-on-surface-variant/40">
              +{model.strengths.length - 4}
            </span>
          )}
          {model.discoveredByAI && (
            <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-mono text-on-surface-variant/60 border-l border-outline-variant">
              AI-cat
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ModelCard Skeleton ───────────────────────────────────────────────────────

function ModelCardSkeleton() {
  return (
    <div className="bg-surface-container-low animate-pulse">
      <div className="bg-surface-container-high px-4 py-2 flex justify-between items-center">
        <div className="h-3 w-16 bg-surface-container-highest" />
        <div className="h-3 w-12 bg-surface-container-highest" />
      </div>
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-5 w-36 bg-surface-container-highest" />
          <div className="h-3 w-24 bg-surface-container-highest" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-8 bg-surface-container-highest" />
          <div className="h-8 bg-surface-container-highest" />
        </div>
        <div className="h-2 w-full bg-surface-container-highest" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-surface-container-highest" />
          <div className="h-6 w-16 bg-surface-container-highest" />
        </div>
      </div>
    </div>
  );
}

// ─── MatrixRow ────────────────────────────────────────────────────────────────

function MatrixRow({ model }: { model: ModelRecord }) {
  const scoreProxy = Math.min(100, model.strengths.length * 20 + 40);

  return (
    <tr className="border-b border-outline-variant/5 hover:bg-surface-container-highest/50 transition-colors">
      <td className="px-6 py-4 max-w-[160px] truncate" title={model.id}>
        {model.id.length > 28 ? model.id.slice(0, 26) + "…" : model.id}
      </td>
      <td className={cn("px-6 py-4", TIER_ACCENT[model.tier])}>{model.tier}</td>
      <td className="px-6 py-4 text-on-surface-variant">
        {(model.contextWindow / 1000).toFixed(0)}k
      </td>
      <td
        className={cn(
          "px-6 py-4",
          model.tier === "PREMIUM"
            ? "text-secondary"
            : model.tier === "BALANCED"
            ? "text-primary"
            : "text-on-surface-variant"
        )}
      >
        ${model.costPer1M.toFixed(2)}
      </td>
      <td className="px-6 py-4 text-on-surface-variant max-w-[200px] truncate">
        {model.strengths.slice(0, 3).join(", ") || "—"}
      </td>
      <td className="px-6 py-4">
        <div className="w-16 h-1 bg-surface-container-highest">
          <div
            className={cn(
              "h-full",
              model.tier === "PREMIUM"
                ? "bg-secondary"
                : model.tier === "BALANCED"
                ? "bg-primary"
                : "bg-outline"
            )}
            style={{ width: `${scoreProxy}%` }}
          />
        </div>
      </td>
    </tr>
  );
}
