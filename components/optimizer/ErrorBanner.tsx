"use client";

// ─── ErrorBanner ──────────────────────────────────────────────────────────────
// Dismissable error display with red left border (tactical style).

import { AnimatePresence, motion } from "motion/react";
import { XCircle, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const { t } = useLanguage();
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="error-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="border-l-4 border-error bg-error-container/10 px-6 py-4 flex items-start justify-between gap-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <XCircle size={16} className="text-error shrink-0 mt-0.5" />
            <div className="font-mono text-xs text-error">
              <span className="uppercase tracking-widest font-bold block mb-1">
                {t("optimizer", "errorTitle")}
              </span>
              <span className="text-error/70">{message}</span>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Cerrar error"
            className="text-error/40 hover:text-error transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
