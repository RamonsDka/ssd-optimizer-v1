"use client";

// ─── SettingsSlider ───────────────────────────────────────────────────────────
// Reusable range slider control for settings rows.
//
// Visual contract (matches existing page aesthetic):
//   - Font-mono uppercase tracking-widest labels
//   - primary color accent on the thumb and track fill
//   - Current value displayed as a monospace badge at the right
//   - border-b divider between rows (last:border-b-0)
//   - Optional min/max labels beneath the track
//
// Usage:
//   <SettingsSlider
//     id="confidence-threshold"
//     label="Confidence Threshold"
//     description="Minimum confidence score to include a model in results."
//     value={threshold}
//     onChange={setThreshold}
//     min={0}
//     max={1}
//     step={0.05}
//     format={(v) => `${Math.round(v * 100)}%`}
//   />

import { cn } from "@/lib/utils/cn";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsSliderProps {
  /** Unique identifier — links the label's htmlFor. */
  id: string;
  /** Field label displayed in uppercase mono. */
  label: string;
  /** Optional description rendered below the label in muted text. */
  description?: string;
  /** Current numeric value. */
  value: number;
  /** Called with the new value when the slider changes. */
  onChange: (value: number) => void;
  /** Minimum slider value. Defaults to 0. */
  min?: number;
  /** Maximum slider value. Defaults to 1. */
  max?: number;
  /** Step increment. Defaults to 0.01. */
  step?: number;
  /** Optional formatter for the displayed value badge. Defaults to `String(v)`. */
  format?: (value: number) => string;
  /** Renders the slider in a non-interactive, visually dimmed state. */
  disabled?: boolean;
  /** Additional class names for the outer row container. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsSlider({
  id,
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v) => String(v),
  disabled = false,
  className,
}: SettingsSliderProps) {
  // Percentage for the custom track fill
  const pct = Math.round(((value - min) / (max - min)) * 100);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-4",
        "border-b border-outline-variant/10 last:border-b-0",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* ── Label row + value badge ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <label
            htmlFor={id}
            className={cn(
              "font-mono text-xs font-bold uppercase tracking-widest select-none",
              disabled
                ? "text-on-surface-variant/40 cursor-not-allowed"
                : "text-on-surface cursor-pointer"
            )}
          >
            {label}
          </label>

          {description && (
            <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Value badge */}
        <span
          className={cn(
            "shrink-0 font-mono text-[10px] font-bold tracking-widest",
            "px-2 py-0.5 border",
            disabled
              ? "border-outline-variant/20 text-on-surface-variant/30"
              : "border-primary/30 text-primary bg-primary/5"
          )}
        >
          {format(value)}
        </span>
      </div>

      {/* ── Slider track ─────────────────────────────────────────────── */}
      <div className="relative flex items-center gap-2">
        {/* Min label */}
        <span className="font-mono text-[9px] text-on-surface-variant/40 shrink-0 tabular-nums">
          {format(min)}
        </span>

        {/* Track container */}
        <div className="relative flex-1 h-1.5 bg-outline-variant/20 border border-outline-variant/10">
          {/* Fill */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 transition-all duration-75",
              disabled ? "bg-on-surface-variant/20" : "bg-primary/40"
            )}
            style={{ width: `${pct}%` }}
          />

          {/* Native range input (positioned on top for interaction) */}
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            className={cn(
              // Reset and stretch over the track
              "absolute inset-0 w-full h-full opacity-0",
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            )}
          />

          {/* Visible thumb */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
              "w-3 h-3 border-2 transition-all duration-75",
              disabled
                ? "border-on-surface-variant/30 bg-surface-container"
                : "border-primary bg-surface-container"
            )}
            style={{ left: `${pct}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Max label */}
        <span className="font-mono text-[9px] text-on-surface-variant/40 shrink-0 tabular-nums">
          {format(max)}
        </span>
      </div>
    </div>
  );
}
