"use client";

// ─── History Page ─────────────────────────────────────────────────────────────
// Shows paginated list of past OptimizationJob runs fetched from /api/history.
// Client component — fetches on mount + handles pagination.

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { HistoryJobSummary, HistoryResponse } from "@/app/api/history/route";
import LogDetailModal from "@/components/history/LogDetailModal";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  COMPLETED: {
    label: "COMPLETED",
    icon: <CheckCircle size={12} />,
    className: "text-emerald-400 bg-emerald-400/10",
  },
  FAILED: {
    label: "FAILED",
    icon: <XCircle size={12} />,
    className: "text-red-400 bg-red-400/10",
  },
  OPTIMIZING: {
    label: "RUNNING",
    icon: <Loader2 size={12} className="animate-spin" />,
    className: "text-yellow-400 bg-yellow-400/10",
  },
  PENDING: {
    label: "PENDING",
    icon: <AlertCircle size={12} />,
    className: "text-on-surface-variant bg-surface-container",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Format date ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── History Page ─────────────────────────────────────────────────────────────

const LIMIT = 15;

export default function HistoryPage() {
  const [jobs, setJobs] = useState<HistoryJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const fetchHistory = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/history?page=${p}&limit=${LIMIT}`);
      const json = (await res.json()) as HistoryResponse | { success: false; error: string };

      if (!res.ok || !json.success) {
        setError((json as { success: false; error: string }).error ?? `Error ${res.status}`);
        return;
      }

      const data = json as HistoryResponse;
      setJobs(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(page);
  }, [page, fetchHistory]);

  return (
    <div className="min-h-screen pt-14 px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div className="border-l-4 border-primary pl-6">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-on-surface">
              SYS LOGS
            </h1>
            <p className="font-mono text-xs text-primary/60 uppercase tracking-widest mt-2">
              Optimization History // {total} jobs registrados
            </p>
          </div>
          <button
            onClick={() => fetchHistory(page)}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest",
              "border border-outline-variant/30 text-on-surface-variant",
              "hover:border-primary hover:text-primary transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
            aria-label="Refresh history"
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

        {/* ── Loading skeleton ──────────────────────────────────────────────── */}
        {loading && !error && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-surface-container-low border border-outline-variant/10 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!loading && !error && jobs.length === 0 && (
          <div className="bg-surface-container-low border border-outline-variant/30 p-16 text-center">
            <Clock size={32} className="text-on-surface-variant/30 mx-auto mb-4" />
            <div className="font-mono text-on-surface-variant text-sm">
              [ HISTORY LOG :: EMPTY ]
            </div>
            <p className="font-mono text-xs text-on-surface-variant/40 mt-2 uppercase tracking-widest">
              No hay optimizaciones registradas todavía
            </p>
          </div>
        )}

        {/* ── Jobs table ────────────────────────────────────────────────────── */}
        {!loading && !error && jobs.length > 0 && (
          <div className="space-y-px">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2 bg-surface-container border border-outline-variant/20">
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Modelos de entrada
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant text-right">
                Modelos
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant text-right">
                Estado
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant text-right">
                Fecha
              </span>
            </div>

            {/* Rows */}
            {jobs.map((job, idx) => (
              <div
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={cn(
                  "grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4",
                  "border border-outline-variant/10 transition-colors cursor-pointer",
                  "hover:bg-surface-container-low hover:border-primary/30",
                  idx % 2 === 0 ? "bg-surface" : "bg-surface-container"
                )}
                role="button"
                tabIndex={0}
                aria-label={`Ver detalle del job ${job.id}`}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedJobId(job.id); }}
              >
                {/* Model list preview */}
                <div className="min-w-0">
                  <p className="font-mono text-xs text-on-surface break-words leading-tight">
                    {job.userInput}
                  </p>
                  <p className="font-mono text-[10px] text-on-surface-variant/40 mt-0.5 uppercase tracking-widest">
                    ID: {job.id.slice(0, 12)}…
                  </p>
                </div>

                {/* Model count */}
                <div className="flex items-center justify-end">
                  <span className="font-mono text-xs text-primary font-bold tabular-nums">
                    {job.modelCount}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center justify-end">
                  <StatusBadge status={job.status} />
                </div>

                {/* Date */}
                <div className="flex items-center justify-end">
                  <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
                    {formatDate(job.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
                  "border border-outline-variant/30 text-on-surface-variant",
                  "hover:border-primary hover:text-primary transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <ChevronLeft size={12} />
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 font-mono text-xs uppercase tracking-widest",
                  "border border-outline-variant/30 text-on-surface-variant",
                  "hover:border-primary hover:text-primary transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                Siguiente
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Log Detail Modal ───────────────────────────────────────────────── */}
      <LogDetailModal
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
      />
    </div>
  );
}
