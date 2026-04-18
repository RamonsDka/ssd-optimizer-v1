"use client";

// ─── TerminalOverlay ──────────────────────────────────────────────────────────
// A monospaced dark-terminal panel that streams OIM orchestration log events
// in real-time.  Designed to be embedded inline (not a modal) so users can
// watch the scoring pipeline while it runs.
//
// Props:
//   events  — Array of { message, type } tuples produced by the event bus
//   title   — Optional header label (default: "OIM ORCHESTRATOR LOG")
//   maxRows — Maximum visible rows before scrolling (default: 12)
//   loading — Show blinking cursor animation while the pipeline is running
//   onClear — Optional handler for the "CLEAR" action button
//
// Design notes:
//   - font-mono throughout (Tailwind `font-mono`)
//   - bg-zinc-950 panel, text in semantic colors per event type
//   - Auto-scrolls to the bottom on every new event (useEffect + ref)
//   - AnimatePresence for row enter animations (slide-in from left)

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, CheckCircle2, AlertTriangle, XCircle, Info, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TerminalEventType = "info" | "progress" | "success" | "warning" | "error";

export interface TerminalEvent {
  /** Display message (plain text) */
  message: string;
  /** Visual category — controls color and icon */
  type: TerminalEventType;
  /** Optional ISO-8601 timestamp; if provided it is shown in the gutter */
  timestamp?: string;
}

export interface TerminalOverlayProps {
  /** Stream of events to display */
  events: TerminalEvent[];
  /** Panel header label */
  title?: string;
  /** Max visible rows before the panel scrolls.  Controls `max-h`. */
  maxRows?: number;
  /** Show blinking cursor at the bottom while the pipeline is active */
  loading?: boolean;
  /** Called when the user clicks the "CLEAR" button */
  onClear?: () => void;
  /** Extra Tailwind classes on the root element */
  className?: string;
}

// ─── Event Type → visual config ───────────────────────────────────────────────

interface EventVisuals {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  colorClass: string;
  prefixChar: string;
}

const EVENT_VISUALS: Record<TerminalEventType, EventVisuals> = {
  info:     { icon: Info,          colorClass: "text-sky-400",    prefixChar: "›" },
  progress: { icon: Loader2,       colorClass: "text-amber-400",  prefixChar: "⟳" },
  success:  { icon: CheckCircle2,  colorClass: "text-emerald-400", prefixChar: "✓" },
  warning:  { icon: AlertTriangle, colorClass: "text-yellow-400", prefixChar: "⚠" },
  error:    { icon: XCircle,       colorClass: "text-red-400",    prefixChar: "✗" },
};

// ─── Row animation variants ───────────────────────────────────────────────────

const rowVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  } catch {
    return "??:??:??";
  }
}

// ─── Sub-component: single log row ────────────────────────────────────────────

function TerminalRow({ event, index }: { event: TerminalEvent; index: number }) {
  const visuals = EVENT_VISUALS[event.type] ?? EVENT_VISUALS.info;
  const Icon = visuals.icon;

  return (
    <motion.div
      layout
      key={index}
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex items-start gap-2 py-0.5 group"
    >
      {/* ── Line number gutter ── */}
      <span className="shrink-0 w-6 text-right font-mono text-[10px] text-zinc-600 select-none tabular-nums">
        {String(index + 1).padStart(3, " ")}
      </span>

      {/* ── Timestamp (if present) ── */}
      {event.timestamp && (
        <span className="shrink-0 font-mono text-[10px] text-zinc-500 select-none tabular-nums">
          [{formatTimestamp(event.timestamp)}]
        </span>
      )}

      {/* ── Type prefix char ── */}
      <span className={cn("shrink-0 font-mono text-xs font-bold select-none", visuals.colorClass)}>
        {visuals.prefixChar}
      </span>

      {/* ── Icon ── */}
      <Icon
        size={12}
        className={cn("shrink-0 mt-0.5", visuals.colorClass,
          event.type === "progress" && "animate-spin"
        )}
      />

      {/* ── Message ── */}
      <span
        className={cn(
          "font-mono text-xs leading-relaxed break-all",
          visuals.colorClass,
          event.type === "info" && "text-zinc-300",   // info rows slightly dimmer
        )}
      >
        {event.message}
      </span>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TerminalOverlay({
  events,
  title = "OIM ORCHESTRATOR LOG",
  maxRows = 12,
  loading = false,
  onClear,
  className,
}: TerminalOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever a new event arrives
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events]);

  // Row height ≈ 24px (text-xs leading-relaxed + py-0.5)
  const rowHeightPx = 24;
  const maxHeightPx = maxRows * rowHeightPx + 48; // +48 for header + padding

  return (
    <div
      className={cn(
        "w-full bg-zinc-950 border border-zinc-800 font-mono",
        "flex flex-col overflow-hidden",
        className
      )}
      style={{ maxHeight: `${maxHeightPx}px` }}
      role="log"
      aria-label={title}
      aria-live="polite"
      aria-atomic="false"
    >
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          {/* Fake traffic lights */}
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <Terminal size={12} className="ml-2 text-zinc-400" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-mono">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Event count badge */}
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>

          {/* Loading indicator */}
          {loading && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <Loader2 size={10} className="animate-spin" />
              RUNNING
            </span>
          )}

          {/* Clear button */}
          {onClear && events.length > 0 && (
            <button
              onClick={onClear}
              title="Clear log"
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={10} />
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* ── Log body ───────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0 scroll-smooth"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}
      >
        {events.length === 0 ? (
          /* Empty state */
          <div className="flex items-center gap-2 py-2 text-zinc-600 text-[11px]">
            <Terminal size={12} />
            <span>Waiting for OIM pipeline events…</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <TerminalRow key={i} event={event} index={i} />
            ))}
          </AnimatePresence>
        )}

        {/* Blinking cursor — shown while pipeline is active */}
        {loading && (
          <div className="flex items-center gap-1 py-0.5">
            <span className="w-6 shrink-0 select-none" />
            <motion.span
              className="inline-block w-2 h-3.5 bg-emerald-400"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Named export for convenience ─────────────────────────────────────────────
// Allows both:  import TerminalOverlay from "…"
//        and:  import { TerminalOverlay } from "…"
export { TerminalOverlay };
