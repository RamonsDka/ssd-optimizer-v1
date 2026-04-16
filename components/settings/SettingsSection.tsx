// ─── SettingsSection ──────────────────────────────────────────────────────────
// Wrapper component that renders a titled, described settings group.
//
// Visual contract (matches existing page aesthetic):
//   - border-l-4 accent bar on the section title (configurable color)
//   - Font-mono uppercase tracking-widest for title
//   - Font-mono smaller muted text for description
//   - Children rendered below the header with consistent spacing
//
// Usage:
//   <SettingsSection title="Feature Flags" description="...">
//     <SettingsToggle ... />
//   </SettingsSection>

import React from "react";
import { cn } from "@/lib/utils/cn";

// ─── Props ────────────────────────────────────────────────────────────────────

type AccentVariant = "primary" | "secondary" | "tertiary" | "danger" | "muted";

interface SettingsSectionProps {
  /** Section heading displayed above the children. */
  title: string;
  /** Optional description rendered below the title. */
  description?: string;
  /** Accent color for the left border indicator. Defaults to "primary". */
  accent?: AccentVariant;
  /** Optional trailing element in the header row (e.g. a badge or button). */
  headerAction?: React.ReactNode;
  /** Section content — typically SettingsToggle, StatCard, or custom elements. */
  children: React.ReactNode;
  /** Additional class names for the outer wrapper. */
  className?: string;
}

// ─── Accent map ──────────────────────────────────────────────────────────────

const ACCENT_CLASSES: Record<AccentVariant, string> = {
  primary:   "border-primary",
  secondary: "border-secondary",
  tertiary:  "border-tertiary",
  danger:    "border-red-500/60",
  muted:     "border-outline-variant",
};

const ACCENT_TEXT_CLASSES: Record<AccentVariant, string> = {
  primary:   "text-primary",
  secondary: "text-secondary",
  tertiary:  "text-tertiary",
  danger:    "text-red-400",
  muted:     "text-on-surface-variant",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsSection({
  title,
  description,
  accent = "primary",
  headerAction,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className={cn("border-l-4 pl-4", ACCENT_CLASSES[accent])}>
          <h2
            className={cn(
              "font-mono text-xs font-bold uppercase tracking-widest",
              ACCENT_TEXT_CLASSES[accent]
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1 leading-relaxed max-w-prose">
              {description}
            </p>
          )}
        </div>

        {headerAction && (
          <div className="shrink-0 mt-0.5">{headerAction}</div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div>{children}</div>
    </section>
  );
}
