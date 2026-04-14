"use client";

import {
  Info,
  X,
  Terminal,
  Cpu,
  Globe,
  Layers,
  Zap,
  BookOpen,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { APP_NAME, APP_VERSION } from "@/lib/constants/version";

interface HelpInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpInfoModal({ open, onClose }: HelpInfoModalProps) {
  const { t } = useLanguage();

  const SECTIONS = [
    {
      icon: <Terminal size={14} />,
      title: t("helpInfo", "optimizer"),
      description: t("helpInfo", "optimizerDesc"),
    },
    {
      icon: <Layers size={14} />,
      title: t("helpInfo", "models"),
      description: t("helpInfo", "modelsDesc"),
    },
    {
      icon: <Cpu size={14} />,
      title: t("helpInfo", "aiDiscovery"),
      description: t("helpInfo", "aiDiscoveryDesc"),
    },
    {
      icon: <Globe size={14} />,
      title: t("helpInfo", "sync"),
      description: t("helpInfo", "syncDesc"),
    },
    {
      icon: <BookOpen size={14} />,
      title: t("nav", "docs"),
      description:
        t("helpInfo", "settingsDesc"),
    },
    {
      icon: <Shield size={14} />,
      title: t("common", "settings"),
      description: t("helpInfo", "settingsDesc"),
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-lg bg-surface-container border border-outline-variant/30 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <Info size={16} className="text-primary" />
                <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
                  {t("helpInfo", "title")}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-on-surface-variant hover:text-primary transition-colors"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* System badge */}
              <div className="flex items-center gap-3 bg-surface-container-low p-4 border border-outline-variant/20">
                <Zap size={18} className="text-primary" />
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-on-surface">
                    {APP_NAME}
                  </p>
                  <p className="font-mono text-[10px] text-on-surface-variant/70 mt-0.5">
                    v{APP_VERSION} // Spec-Driven Development // Arquitectura Táctica
                  </p>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-3">
                {SECTIONS.map((section) => (
                  <div
                    key={section.title}
                    className="flex items-start gap-3 p-3 bg-surface-container-low border border-outline-variant/15 hover:border-primary/30 transition-colors"
                  >
                    <span className="text-primary mt-0.5 shrink-0">
                      {section.icon}
                    </span>
                    <div>
                      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-on-surface">
                        {section.title}
                      </p>
                      <p className="font-mono text-[10px] text-on-surface-variant/70 mt-0.5 leading-relaxed">
                        {section.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer info */}
              <div className="pt-3 border-t border-outline-variant/10 text-center">
                <p className="font-mono text-[9px] text-on-surface-variant/40 uppercase tracking-widest">
                  v{APP_VERSION} // Gentleman Programming // RamonsDk-Dev
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Icon button trigger — place in Topbar or wherever needed */
export function HelpInfoTrigger({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const { t } = useLanguage();

  return (
    <button
      onClick={onOpen}
      title={t("common", "info")}
      className="hover:text-primary transition-colors relative group"
    >
      <Info size={18} />
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/0 group-hover:text-primary/80 uppercase tracking-widest whitespace-nowrap transition-colors">
        {t("common", "info")}
      </span>
    </button>
  );
}