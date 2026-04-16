"use client";

// ─── SettingsSelect ───────────────────────────────────────────────────────────
// Reusable select/dropdown control for settings rows.
//
// Visual contract (matches existing page aesthetic):
//   - Font-mono uppercase tracking-widest labels
//   - primary color accent outline on focus
//   - border-b divider between rows (last:border-b-0)
//   - ChevronDown icon indicates interactivity
//
// Usage:
//   <SettingsSelect
//     id="timezone"
//     label="Timezone"
//     description="Used for date display across the UI."
//     value={preferences.timezone}
//     onChange={(val) => setTimezone(val)}
//     options={timezoneOptions}
//   />

import { cn } from "@/lib/utils/cn";
import { ChevronDown } from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
}

interface SettingsSelectProps {
  /** Unique identifier — links the label's htmlFor. */
  id: string;
  /** Field label displayed in uppercase mono. */
  label: string;
  /** Optional description rendered below the label in muted text. */
  description?: string;
  /** Currently selected value. */
  value: string;
  /** Called with the new value when selection changes. */
  onChange: (value: string) => void;
  /** Array of {value, label} options. */
  options: SelectOption[];
  /** Renders the select in a non-interactive, visually dimmed state. */
  disabled?: boolean;
  /** Additional class names for the outer row container. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsSelect({
  id,
  label,
  description,
  value,
  onChange,
  options,
  disabled = false,
  className,
}: SettingsSelectProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-6 py-4",
        "border-b border-outline-variant/10 last:border-b-0",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* ── Label + description ──────────────────────────────────────── */}
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

      {/* ── Select control ───────────────────────────────────────────── */}
      <div className="relative shrink-0">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            // Sizing + layout
            "appearance-none pr-7 pl-3 py-1.5",
            // Typography
            "font-mono text-[10px] uppercase tracking-widest",
            // Colors
            "bg-surface-container-low text-on-surface",
            "border border-outline-variant/30",
            // Focus
            "focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30",
            // Disabled
            "disabled:cursor-not-allowed",
            // Transition
            "transition-colors"
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface">
              {opt.label}
            </option>
          ))}
        </select>

        {/* Chevron overlay */}
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
          <ChevronDown size={10} />
        </span>
      </div>
    </div>
  );
}
