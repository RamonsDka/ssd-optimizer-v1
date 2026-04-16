"use client";

// ─── LogDetailModal ───────────────────────────────────────────────────────────
// Shows full OptimizationJob details:
//  - Raw input text
//  - Execution time
//  - Model count
//  - Generated team mapping (ModelSelection list grouped by phase)
//
// Data fetched on-demand from GET /api/history/[id].

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Loader2, Clock, Cpu, RotateCcw } from "lucide-react";
import Modal, { ModalSkeleton, ModalSection } from "@/components/ui/Modal";
import { cn } from "@/lib/utils/cn";
import type { JobDetailResponse } from "@/app/api/history/[id]/route";
import type { AdvancedOptions, RecreateQueryPayload } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogDetailModalProps {
  jobId: string | null;
  onClose: () => void;
  onRecreate: (payload: RecreateQueryPayload) => void;
}

type JobDetail = JobDetailResponse["data"];

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  COMPLETED: {
    label: "COMPLETED",
    icon: <CheckCircle size={12} />,
    color: "text-emerald-400",
  },
  FAILED: {
    label: "FAILED",
    icon: <XCircle size={12} />,
    color: "text-red-400",
  },
  OPTIMIZING: {
    label: "RUNNING",
    icon: <Loader2 size={12} className="animate-spin" />,
    color: "text-yellow-400",
  },
  PENDING: {
    label: "PENDING",
    icon: <AlertCircle size={12} />,
    color: "text-on-surface-variant",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest", config.color)}>
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const TIER_COLOR: Record<string, string> = {
  PREMIUM: "text-secondary",
  BALANCED: "text-primary",
  ECONOMIC: "text-on-surface-variant",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LogDetailModal({ jobId, onClose, onRecreate }: LogDetailModalProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setJob(null);

    fetch(`/api/history/${encodeURIComponent(jobId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          setError(json.error ?? "Error desconocido");
        } else {
          setJob((json as JobDetailResponse).data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error de red");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [jobId]);

  const handleRecreate = () => {
    if (!job) return;

    // Use the advancedOptions snapshot persisted with the job in the DB,
    // so the historical options are restored exactly — not the current localStorage state.
    const advancedOptions = job.advancedOptions
      ? (job.advancedOptions as AdvancedOptions)
      : undefined;

    onRecreate({
      input: job.input,
      advancedOptions,
      sourceJobId: job.id,
    });

    onClose();
  };

  return (
    <Modal
      open={!!jobId}
      onClose={onClose}
      title="JOB DETAIL"
      subtitle={jobId ? `ID: ${jobId}` : undefined}
      maxWidth="max-w-3xl"
    >
      {/* Loading */}
      {loading && <ModalSkeleton rows={5} />}

      {/* Error */}
      {!loading && error && (
        <div className="p-6">
          <div className="border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
            <span className="font-bold">[ERROR]</span> {error}
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && job && (
        <div className="p-6 space-y-8">

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRecreate}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest",
                "border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              )}
            >
              <RotateCcw size={12} />
              Recreate Query
            </button>
          </div>

          {/* ── Meta row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetaChip label="STATUS">
              <StatusBadge status={job.status} />
            </MetaChip>
            <MetaChip label="MODELOS">
              <span className="font-mono text-sm font-bold text-primary">{job.modelCount}</span>
            </MetaChip>
            <MetaChip label="DURACIÓN">
              <span className="font-mono text-sm text-on-surface flex items-center gap-1">
                <Clock size={10} />
                {formatDuration(job.executionMs)}
              </span>
            </MetaChip>
            <MetaChip label="FECHA">
              <span className="font-mono text-[10px] text-on-surface-variant">
                {formatDate(job.createdAt)}
              </span>
            </MetaChip>
          </div>

          {/* ── Raw input ─────────────────────────────────────────────────── */}
          <ModalSection label="Raw Input">
            <div className="bg-surface-container-highest border-l-2 border-primary p-4 font-mono text-xs text-on-surface whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
              {job.input}
            </div>
          </ModalSection>

          {/* ── Team mapping ──────────────────────────────────────────────── */}
          <ModalSection label={`Team Mapping (${job.selections.length} asignaciones)`}>
            {job.selections.length === 0 ? (
              <div className="font-mono text-xs text-on-surface-variant/40 py-4 text-center">
                [ SIN ASIGNACIONES REGISTRADAS ]
              </div>
            ) : (
              <div className="space-y-px">
                {/* Header */}
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 bg-surface-container border border-outline-variant/20">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant w-12">
                    FASE
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                    MODELO
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant text-right">
                    TIER
                  </span>
                </div>

                {/* Rows */}
                {job.selections.map((sel) => (
                  <div
                    key={sel.id}
                    className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 bg-surface-container-low border border-outline-variant/10 hover:bg-surface-container transition-colors"
                  >
                    <span className="font-mono text-[10px] text-on-surface-variant w-12 tabular-nums">
                      P-{String(sel.phase).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex items-center gap-2">
                      <Cpu size={10} className="text-on-surface-variant/40 shrink-0" />
                      <span className="font-mono text-xs text-on-surface break-words leading-tight" title={sel.modelName}>
                        {sel.modelName}
                      </span>
                    </div>
                    <span className={cn("font-mono text-[10px] uppercase tracking-widest shrink-0", TIER_COLOR[sel.tier] ?? "text-on-surface-variant")}>
                      {sel.tier}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ModalSection>
        </div>
      )}
    </Modal>
  );
}

// ─── MetaChip ─────────────────────────────────────────────────────────────────

function MetaChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-highest px-4 py-3 space-y-1">
      <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/60 block">
        {label}
      </span>
      {children}
    </div>
  );
}
