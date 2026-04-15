"use client";

// ─── Profiles Page ────────────────────────────────────────────────────────────
// User preferences: Default Tier, Theme, Language.
// All preferences are persisted in localStorage.

import { useState, useEffect, useCallback } from "react";
import {
  UserCircle,
  Globe,
  Palette,
  Cpu,
  Save,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Tier } from "@/types";

// ─── localStorage keys ──────────────────────────────────────────────────────

const LS_TIER = "sdd-profiles-default-tier";
const LS_THEME = "sdd-profiles-theme";

// ─── Tier options ────────────────────────────────────────────────────────────

type TierLabelKey = "tierPremium" | "tierBalanced" | "tierEconomic";
type TierDescKey = "tierPremiumDesc" | "tierBalancedDesc" | "tierEconomicDesc";

const TIER_OPTIONS: { value: Tier; labelKey: TierLabelKey; descKey: TierDescKey }[] = [
  { value: "PREMIUM", labelKey: "tierPremium", descKey: "tierPremiumDesc" },
  { value: "BALANCED", labelKey: "tierBalanced", descKey: "tierBalancedDesc" },
  { value: "ECONOMIC", labelKey: "tierEconomic", descKey: "tierEconomicDesc" },
];

// ─── Profile Page Component ──────────────────────────────────────────────────

export default function ProfilesPage() {
  const { lang, setLanguage, t } = useLanguage();

  const [defaultTier, setDefaultTier] = useState<Tier>("BALANCED");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [saved, setSaved] = useState(false);
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const storedTier = localStorage.getItem(LS_TIER) as Tier | null;
      if (storedTier && ["PREMIUM", "BALANCED", "ECONOMIC"].includes(storedTier)) {
        setDefaultTier(storedTier);
      }
      const storedTheme = localStorage.getItem(LS_THEME);
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(LS_TIER, defaultTier);
      localStorage.setItem(LS_THEME, theme);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // localStorage unavailable
    }
  }, [defaultTier, theme]);

  const selectedTierOption = TIER_OPTIONS.find((opt) => opt.value === defaultTier)!;

  return (
    <div className="min-h-screen pt-14 px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div className="border-l-4 border-primary pl-6">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-on-surface">
              {t("profiles", "title")}
            </h1>
            <p className="font-mono text-xs text-primary/60 uppercase tracking-widest mt-2">
              {t("profiles", "subtitle")}
            </p>
          </div>
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors",
              saved
                ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                : "border border-primary/30 text-primary hover:bg-primary/10",
            )}
          >
            {saved ? (
              <>
                <CheckCircle size={12} />
                {t("profiles", "savedToast")}
              </>
            ) : (
              <>
                <Save size={12} />
                {t("profiles", "saveButton")}
              </>
            )}
          </button>
        </div>

        {/* ── Language ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-secondary" />
            <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <Globe size={14} className="text-secondary" />
              {t("profiles", "languageSection")}
            </h2>
          </div>
          <div className="border border-outline-variant/20 bg-surface-container-low px-6 py-5">
            <p className="font-mono text-[10px] text-on-surface-variant/60 mb-4 uppercase tracking-widest">
              {t("profiles", "languageDesc")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLanguage("es")}
                className={cn(
                  "flex-1 p-4 border font-mono text-sm uppercase tracking-widest transition-colors",
                  lang === "es"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-primary/30",
                )}
              >
                🇪🇸 Español
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={cn(
                  "flex-1 p-4 border font-mono text-sm uppercase tracking-widest transition-colors",
                  lang === "en"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-primary/30",
                )}
              >
                🇬🇧 English
              </button>
            </div>
          </div>
        </section>

        {/* ── Default Tier ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-primary" />
            <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <Cpu size={14} className="text-primary" />
              {t("profiles", "tierSection")}
            </h2>
          </div>
          <div className="border border-outline-variant/20 bg-surface-container-low px-6 py-5">
            <p className="font-mono text-[10px] text-on-surface-variant/60 mb-4 uppercase tracking-widest">
              {t("profiles", "tierDesc")}
            </p>
            <div className="relative">
              <button
                onClick={() => setTierDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between p-4 border border-outline-variant/30 bg-surface-container font-mono text-sm text-on-surface hover:border-primary/40 transition-colors"
              >
                <span>
                  {t("profiles", selectedTierOption.labelKey)}
                </span>
                <ChevronDown size={16} className="text-on-surface-variant" />
              </button>
              {tierDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-outline-variant/30 bg-surface-container z-20">
                  {TIER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setDefaultTier(opt.value);
                        setTierDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full p-4 text-left hover:bg-primary/10 transition-colors",
                        defaultTier === opt.value && "bg-primary/5",
                      )}
                    >
                      <p className="font-mono text-sm text-on-surface uppercase tracking-widest">
                        {t("profiles", opt.labelKey)}
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1">
                        {t("profiles", opt.descKey)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Theme (placeholder) ────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-secondary" />
            <h2 className="font-label text-xs uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <Palette size={14} className="text-secondary" />
              {t("profiles", "themeSection")}
            </h2>
          </div>
          <div className="border border-outline-variant/20 bg-surface-container-low px-6 py-5">
            <p className="font-mono text-[10px] text-on-surface-variant/60 mb-4 uppercase tracking-widest">
              {t("profiles", "themeDesc")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 p-4 border font-mono text-sm uppercase tracking-widest transition-colors",
                  theme === "dark"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-primary/30",
                )}
              >
                🌙 {t("profiles", "themeDark")}
              </button>
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 p-4 border font-mono text-sm uppercase tracking-widest transition-colors opacity-50 cursor-not-allowed",
                  theme === "light"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-primary/30",
                )}
                disabled
                title="Coming soon"
              >
                ☀️ {t("profiles", "themeLight")} (soon)
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}