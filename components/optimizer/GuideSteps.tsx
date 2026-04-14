"use client";

// ─── GuideSteps ──────────────────────────────────────────────────────────────
// Inline guide displayed in the Optimizer console BEFORE results arrive.
// Hidden (via AnimatePresence in parent) once a recommendation is generated.
// All labels are i18n-aware via useLanguage().

import { Terminal, ClipboardCopy, MousePointerClick, Rocket } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function GuideSteps() {
  const { t } = useLanguage();

  const steps = [
    {
      number: "01",
      icon: Terminal,
      title: t("guideSteps", "step1Title"),
      description: t("guideSteps", "step1Desc"),
    },
    {
      number: "02",
      icon: ClipboardCopy,
      title: t("guideSteps", "step2Title"),
      description: t("guideSteps", "step2Desc"),
    },
    {
      number: "03",
      icon: MousePointerClick,
      title: t("guideSteps", "step3Title"),
      description: t("guideSteps", "step3Desc"),
    },
    {
      number: "04",
      icon: Rocket,
      title: t("guideSteps", "step4Title"),
      description: t("guideSteps", "step4Desc"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3 border-l-4 border-secondary pl-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-on-surface font-label">
            {t("guideSteps", "title")}
          </h2>
          <p className="font-mono text-xs text-on-surface-variant/60 uppercase tracking-widest mt-1">
            {t("guideSteps", "subtitle")}
          </p>
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="p-6 bg-surface-container-low border border-outline-variant/30 hover:border-secondary/50 transition-colors group"
            >
              {/* Number + PASO label */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-secondary font-mono text-3xl font-black leading-none">
                  {step.number}
                </span>
                <span className="text-secondary font-mono text-xs font-bold uppercase tracking-widest">
                  {t("common", "step")}
                </span>
              </div>

              {/* Icon */}
              <div className="text-primary mb-3 group-hover:text-secondary transition-colors">
                <Icon size={22} />
              </div>

              {/* Text */}
              <h3 className="font-black uppercase tracking-tight text-on-surface text-base mb-2">
                {step.title}
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tip banner */}
      <div className="p-5 bg-surface-container-lowest border-l-4 border-secondary text-on-surface-variant text-sm italic leading-relaxed">
        <span className="not-italic font-mono text-xs text-secondary uppercase tracking-widest mr-2">
          {t("common", "tip")}
        </span>
        {t("guideSteps", "tipText")}
      </div>
    </div>
  );
}