"use client";

import { Languages } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

/**
 * LanguageToggle — cycles between ES/EN.
 * Wired to the LanguageProvider context so all components re-render
 * with the new language when toggled.
 */
export function LanguageToggle() {
  const { lang, toggleLanguage } = useLanguage();

  const displayLang = lang === "es" ? "ES" : "EN";

  return (
    <button
      onClick={toggleLanguage}
      title={lang === "es" ? "Switch to English" : "Cambiar a español"}
      className="hover:text-primary transition-colors relative group flex items-center gap-1.5"
    >
      <Languages size={18} />
      <AnimatePresence mode="wait">
        <motion.span
          key={displayLang}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="font-mono text-[9px] font-bold uppercase tracking-widest"
        >
          {displayLang}
        </motion.span>
      </AnimatePresence>
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/0 group-hover:text-primary/80 uppercase tracking-widest whitespace-nowrap transition-colors">
        Language
      </span>
    </button>
  );
}