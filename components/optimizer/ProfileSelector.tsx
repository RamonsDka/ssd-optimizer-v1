"use client";

// ─── ProfileSelector ─────────────────────────────────────────────────────────
// 3 interactive profile cards: Premium / Balanced / Economic.
// Uses motion for selection animation and conic-gradient accent.

import { motion } from "motion/react";
import { Trophy, Scale, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Tier } from "@/types";

interface ProfileSelectorProps {
  selected: Tier;
  onSelect: (tier: Tier) => void;
  /** Optional cost/context aggregates per profile for display */
  stats?: Partial<Record<Tier, { totalCost: number; avgContext: number }>>;
}

interface ProfileConfig {
  tier: Tier;
  title: string;
  descKey: "premiumDesc" | "balancedDesc" | "economicDesc";
  icon: React.ReactNode;
  accentClass: string;
  borderClass: string;
  costLabel: string;
  latencyLabel: string;
}

const PROFILES: ProfileConfig[] = [
  {
    tier: "PREMIUM",
    title: "PREMIUM",
    descKey: "premiumDesc",
    icon: <Trophy className="w-10 h-10 text-secondary" />,
    accentClass: "text-secondary",
    borderClass: "border-secondary",
    costLabel: "Alto",
    latencyLabel: "2.4s",
  },
  {
    tier: "BALANCED",
    title: "BALANCED",
    descKey: "balancedDesc",
    icon: <Scale className="w-10 h-10 text-primary" />,
    accentClass: "text-primary",
    borderClass: "border-primary",
    costLabel: "Medio",
    latencyLabel: "1.1s",
  },
  {
    tier: "ECONOMIC",
    title: "ECONOMIC",
    descKey: "economicDesc",
    icon: <PiggyBank className="w-10 h-10 text-on-surface-variant" />,
    accentClass: "text-on-surface-variant",
    borderClass: "border-dashed border-outline-variant",
    costLabel: "Bajo",
    latencyLabel: "0.4s",
  },
];

export default function ProfileSelector({
  selected,
  onSelect,
  stats,
}: ProfileSelectorProps) {
  const { t } = useLanguage();

  return (
    <section>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-8 bg-primary" />
        <h2 className="text-xl font-black tracking-widest uppercase font-label">
          {t("optimizer", "profileTitle")}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PROFILES.map((profile) => {
          const isSelected = selected === profile.tier;
          const stat = stats?.[profile.tier];

          return (
            <motion.div
              key={profile.tier}
              onClick={() => onSelect(profile.tier)}
              role="button"
              aria-pressed={isSelected}
              aria-label={`Select profile ${profile.title}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(profile.tier);
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              animate={
                isSelected
                  ? { boxShadow: profile.tier === "PREMIUM" ? "0 0 24px rgba(255,198,64,0.3)" : "0 0 24px rgba(138,235,255,0.2)" }
                  : { boxShadow: "none" }
              }
              transition={{ duration: 0.2 }}
              className={cn(
                "relative cursor-pointer bg-surface-container-low border p-8 flex flex-col justify-between min-h-[320px] transition-all",
                profile.borderClass,
                isSelected && "bg-surface-container",
                profile.tier !== "ECONOMIC" && "hover:bg-surface-container"
              )}
            >
              {/* Selected indicator — conic gradient accent bar */}
              {isSelected && (
                <motion.div
                  layoutId="profile-selected-bar"
                  className={cn(
                    "absolute top-0 left-0 right-0 h-0.5",
                    profile.tier === "PREMIUM"
                      ? "bg-secondary"
                      : profile.tier === "BALANCED"
                      ? "bg-primary"
                      : "bg-outline-variant"
                  )}
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  {profile.icon}
                  {profile.tier === "PREMIUM" && (
                    <div className="w-3 h-3 bg-secondary animate-pulse" />
                  )}
                  {isSelected && profile.tier !== "PREMIUM" && (
                    <div
                      className={cn(
                        "w-3 h-3",
                        profile.tier === "BALANCED"
                          ? "bg-primary"
                          : "bg-outline-variant"
                      )}
                    />
                  )}
                </div>

                <h3 className={cn("text-3xl font-black tracking-tighter", profile.accentClass)}>
                  {profile.title}
                </h3>

                <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                  {t("optimizer", profile.descKey)}
                </p>
              </div>

              {/* Footer stats */}
              <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
                <div
                  className={cn(
                    "flex justify-between text-[10px] font-mono uppercase",
                    profile.accentClass
                  )}
                >
                  <span>{t("optimizer", "costLabel")}: {profile.costLabel}</span>
                  <span>{t("optimizer", "latencyLabel")}: {profile.latencyLabel}</span>
                </div>

                {/* Live stats if available */}
                {stat && (
                  <div className="flex justify-between text-[10px] font-mono text-on-surface-variant/60">
                    <span>
                      ~${stat.totalCost.toFixed(2)}/1M {t("optimizer", "avgLabel")}
                    </span>
                    <span>
                      ctx: {(stat.avgContext / 1000).toFixed(0)}k
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
