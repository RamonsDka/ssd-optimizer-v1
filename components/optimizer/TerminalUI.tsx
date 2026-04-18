"use client";

// ─── TerminalUI ───────────────────────────────────────────────────────────────
// Wraps TerminalOverlay and provides a self-contained widget for the /optimizer
// page.  In the current implementation, events are fed in via props (lifted
// state from the parent page).  A future iteration can swap in an SSE-backed
// hook without changing this component's API.
//
// Responsibilities:
//   1. Render TerminalOverlay with the provided events
//   2. Show a "scoring reasoning" section that summarises the top phase/model
//      selection rationale once results arrive
//   3. Expose a clear handler
//
// Task alignment:
//   7.4.1  — This file is the "TerminalUI.tsx" referenced in TASK-TRACKER.md
//   7.4.3  — Used by /optimizer page (see integration instructions at bottom of file)
//   7.4.4  — "Feedback visual of scoring reasoning" is the <ScoringReasoning> section

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronRight, Cpu, Zap, CheckCircle2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import TerminalOverlay, { type TerminalEvent } from "@/components/ui/TerminalOverlay";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single "reasoning step" produced by the scoring engine for a phase/model pair.
 * Displayed in the collapsible ScoringReasoning panel.
 */
export interface ScoringReasoningEntry {
  /** The SDD phase identifier (e.g. "sdd-apply") */
  phase: string;
  /** Human-friendly phase label */
  phaseLabel: string;
  /** The winning model name */
  modelName: string;
  /** Final V2/V3 score (0–1) */
  score: number;
  /** Free-text reasoning from the selector */
  reason: string;
}

export interface TerminalUIProps {
  /** Ordered list of pipeline events to stream in the terminal */
  events: TerminalEvent[];
  /** Whether the OIM pipeline is currently running */
  loading?: boolean;
  /** Called when the user wants to clear the log */
  onClear?: () => void;
  /** Optional scoring reasoning entries (from latest recommendation) */
  reasoningEntries?: ScoringReasoningEntry[];
  /** Additional Tailwind classes on the root element */
  className?: string;
}

// ─── Score bar helper ─────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-emerald-400" :
    pct >= 60 ? "bg-amber-400" :
    pct >= 40 ? "bg-orange-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-zinc-400 w-8">
        {pct}%
      </span>
    </div>
  );
}

// ─── ScoringReasoning panel ───────────────────────────────────────────────────

function ScoringReasoning({ entries }: { entries: ScoringReasoningEntry[] }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  if (entries.length === 0) return null;

  return (
    <div className="border-t border-zinc-800">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900 hover:bg-zinc-800/60 transition-colors"
        aria-expanded={open}
        aria-controls="scoring-reasoning-panel"
      >
        <div className="flex items-center gap-2">
          <Cpu size={11} className="text-violet-400" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            {t("optimizer", "scoringReasoningTitle")}
          </span>
          <span className="font-mono text-[10px] text-zinc-600">
            ({entries.length} {t("optimizer", "phasesLabel")})
          </span>
        </div>
        {open ? (
          <ChevronDown size={12} className="text-zinc-500" />
        ) : (
          <ChevronRight size={12} className="text-zinc-500" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="scoring-reasoning-panel"
            key="reasoning-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-zinc-800/60 bg-zinc-950">
              {entries.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2">
                  {/* Phase label */}
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-violet-400 w-24 truncate">
                    {entry.phaseLabel}
                  </span>

                  {/* Model + reason */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <Zap size={9} className="text-amber-400 shrink-0" />
                      <span className="font-mono text-[10px] text-zinc-200 truncate">
                        {entry.modelName}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">
                      {entry.reason}
                    </p>
                  </div>

                  {/* Score bar */}
                  <ScoreBar score={entry.score} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TerminalUI({
  events,
  loading = false,
  onClear,
  reasoningEntries = [],
  className,
}: TerminalUIProps) {
  const { t } = useLanguage();

  const handleClear = useCallback(() => {
    onClear?.();
  }, [onClear]);

  // Don't render anything if there are no events and the pipeline isn't running
  if (events.length === 0 && !loading && reasoningEntries.length === 0) {
    return null;
  }

  // Determine loading state: rely strictly on the loading prop from parent.
  // Inferring from event content was fragile and caused false-positive spinner states.
  const isRunning = loading;

  // Pipeline is done when there are events but it's no longer running.
  const isDone = events.length > 0 && !isRunning;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("w-full rounded-none overflow-hidden", className)}
    >
      {/* ── Terminal log ─────────────────────────────────────────────────────── */}
      <TerminalOverlay
        events={events}
        title={t("optimizer", "oimLogTitle")}
        maxRows={12}
        loading={isRunning}
        onClear={handleClear}
      />

      {/* ── "FINALIZADO" completion banner — shown once pipeline ends ──────── */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            key="finalizado-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-3 px-4 py-3 bg-emerald-950/60 border-t border-emerald-500/30"
          >
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-400 font-bold">
              {t("optimizer", "terminalFinalized")}
            </span>
            <ArrowDown size={12} className="text-emerald-400/70 shrink-0 ml-auto animate-bounce" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scoring Reasoning (collapsible, only if reasoning data is provided) ─ */}
      <ScoringReasoning entries={reasoningEntries} />
    </motion.div>
  );
}

// ─── Named export ─────────────────────────────────────────────────────────────
export { TerminalUI };

// ─── Integration Guide ────────────────────────────────────────────────────────
// To wire TerminalUI into /optimizer/page.tsx (Task 7.4.3):
//
//   1. Import in page:
//      import TerminalUI, { type ScoringReasoningEntry } from "@/components/optimizer/TerminalUI";
//      import type { TerminalEvent } from "@/components/ui/TerminalOverlay";
//
//   2. Add state:
//      const [terminalEvents, setTerminalEvents] = useState<TerminalEvent[]>([]);
//      const [scoringReasoning, setScoringReasoning] = useState<ScoringReasoningEntry[]>([]);
//
//   3. Push events during /api/optimize call:
//      setTerminalEvents(prev => [...prev, { type: "info", message: "Starting pipeline…", timestamp: new Date().toISOString() }]);
//
//   4. Populate reasoning from recommendation result:
//      setScoringReasoning(
//        recommendation.balanced.phases.map(p => ({
//          phase: p.phase,
//          phaseLabel: getPhaseLabel(p.phase as SddPhase),
//          modelName: p.primary.name,
//          score: p.score,
//          reason: p.reason,
//        }))
//      );
//
//   5. Render (e.g. after InputModule):
//      <AnimatePresence>
//        {(terminalEvents.length > 0 || loadingProfiles) && (
//          <TerminalUI
//            events={terminalEvents}
//            loading={loadingProfiles}
//            onClear={() => setTerminalEvents([])}
//            reasoningEntries={scoringReasoning}
//          />
//        )}
//      </AnimatePresence>
