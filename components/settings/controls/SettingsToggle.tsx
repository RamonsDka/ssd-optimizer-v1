"use client";

// ─── SettingsToggle ───────────────────────────────────────────────────────────
// Reusable switch/toggle control for settings rows.
//
// Visual contract (matches existing page aesthetic):
//   - Font-mono uppercase tracking-widest labels
//   - primary color accent when enabled
//   - Disabled state with reduced opacity
//   - Optional description text below the label
//   - Pill-style toggle track (no external UI library dependency)
//
// Usage:
//   <SettingsToggle
//     id="gemini-ai"
//     label="Gemini AI"
//     description="Enables AI model discovery and categorization."
//     checked={flags.geminiConfigured}
//     onChange={(val) => update({ geminiConfigured: val })}
//   />

import { cn } from "@/lib/utils/cn";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsToggleProps {
  /** Unique identifier — links the label's htmlFor. */
  id: string;
  /** Toggle label displayed in uppercase mono. */
  label: string;
  /** Optional description rendered below the label in muted text. */
  description?: string;
  /** Controlled checked value. */
  checked: boolean;
  /** Called with the new boolean value when the toggle changes. */
  onChange: (value: boolean) => void;
  /** Renders the toggle in a non-interactive, visually dimmed state. */
  disabled?: boolean;
  /** Optional hint shown in lieu of description when disabled. */
  disabledReason?: string;
  /** Additional class names for the outer row container. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsToggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  disabledReason,
  className,
}: SettingsToggleProps) {
  const handleClick = () => {
    if (!disabled) onChange(!checked);
  };

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
            disabled ? "text-on-surface-variant/40 cursor-not-allowed" : "text-on-surface cursor-pointer"
          )}
        >
          {label}
        </label>

        {(description || disabledReason) && (
          <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5 leading-relaxed">
            {disabled && disabledReason ? disabledReason : description}
          </p>
        )}
      </div>

      {/* ── Toggle switch ────────────────────────────────────────────── */}
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          // Track
          "relative inline-flex h-5 w-9 shrink-0 items-center",
          "border transition-colors duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          checked
            ? "bg-primary/20 border-primary/60"
            : "bg-surface-container-low border-outline-variant/30",
          disabled
            ? "cursor-not-allowed"
            : "cursor-pointer hover:border-primary/40"
        )}
      >
        {/* Thumb */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-3 w-3 transform transition-transform duration-200 ease-in-out",
            checked
              ? "translate-x-[22px] bg-primary"
              : "translate-x-1 bg-on-surface-variant/40"
          )}
        />
      </button>
    </div>
  );
}
