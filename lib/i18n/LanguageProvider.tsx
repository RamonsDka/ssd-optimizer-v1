"use client";

// ─── LanguageProvider ──────────────────────────────────────────────────────────
// React Context that stores the selected language ('es' | 'en').
// Persists to localStorage under key "sdd-lang" for client-side hydration.
// V2 Update: Now uses session-scoped keys to isolate data per browser.
// Provides `t(section, key)` translation function and `setLanguage()` setter.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { type Language, t } from "./translations";
import { getSessionKey } from "@/lib/session/session-manager";

// ─── Context shape ─────────────────────────────────────────────────────────

interface LanguageContextValue {
  /** Current language ('es' | 'en') */
  lang: Language;
  /** Set a new language and persist to localStorage */
  setLanguage: (lang: Language) => void;
  /** Toggle between 'es' and 'en' */
  toggleLanguage: () => void;
  /** Translate a string by section and key */
  t: (section: Parameters<typeof t>[0], key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ─── Storage key ────────────────────────────────────────────────────────────

const STORAGE_KEY = "sdd-lang";

// ─── Provider ───────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("es");

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const sessionKey = getSessionKey(STORAGE_KEY);
      const stored = localStorage.getItem(sessionKey);
      if (stored === "en" || stored === "es") {
        setLang(stored);
      }
    } catch {
      // localStorage unavailable, keep default
    }
  }, []);

  const setLanguage = useCallback((newLang: Language) => {
    setLang(newLang);
    try {
      const sessionKey = getSessionKey(STORAGE_KEY);
      localStorage.setItem(sessionKey, newLang);
    } catch {
      // localStorage unavailable, state still updates in-memory
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLang((prev) => {
      const next: Language = prev === "es" ? "en" : "es";
      try {
        const sessionKey = getSessionKey(STORAGE_KEY);
        localStorage.setItem(sessionKey, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const translate = useCallback(
    (section: Parameters<typeof t>[0], key: string) =>
      t(section, key, lang),
    [lang],
  );

  return (
    <LanguageContext.Provider
      value={{ lang, setLanguage, toggleLanguage, t: translate }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a <LanguageProvider>");
  }
  return ctx;
}