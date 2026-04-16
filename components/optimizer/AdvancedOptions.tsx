"use client";

// ─── AdvancedOptions ──────────────────────────────────────────────────────────
// Phase 3.1: Advanced Options UI for optimizer configuration.
// Four sections: Model Usage Limits, Phase Preferences, Model Exclusions, Account Tier Selection.

import { useState, useEffect } from "react";
import { Plus, X, ChevronDown, ChevronUp, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getSessionKey } from "@/lib/session/session-manager";
import { SDD_PHASES, getPhaseLabel } from "@/types";
import type { 
  AdvancedOptions as AdvancedOptionsType,
  ModelLimit,
  PhasePreference,
  ModelExclusion,
  ProviderAccountTier,
  AccountTier,
  SddPhase
} from "@/types";

const STORAGE_KEY = "advanced_options";

// ─── Read helper (usable outside React) ────────────────────────────────────────
// Returns the current AdvancedOptions snapshot from localStorage, or null.
// Used by InputModule to include options in the POST body.
export function readAdvancedOptions(): AdvancedOptionsType | null {
  if (typeof window === "undefined") return null;
  const key = getSessionKey(STORAGE_KEY);
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as AdvancedOptionsType;
  } catch {
    return null;
  }
}

const ACCOUNT_TIERS: { value: AccountTier; label: string; rateLimit: string }[] = [
  { value: "free", label: "Free", rateLimit: "20 req/min" },
  { value: "tier1", label: "Tier 1", rateLimit: "200 req/min" },
  { value: "tier2", label: "Tier 2", rateLimit: "2000 req/min" },
  { value: "tier3", label: "Tier 3", rateLimit: "5000 req/min" },
];

export default function AdvancedOptions({ initialOptions }: { initialOptions?: AdvancedOptionsType | null } = {}) {
  const { lang } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  
  const [options, setOptions] = useState<AdvancedOptionsType>(() => {
    if (initialOptions) {
      return initialOptions;
    }

    if (typeof window === "undefined") {
      return {
        modelLimits: [],
        phasePreferences: [],
        modelExclusions: [],
        accountTiers: [],
      };
    }

    const key = getSessionKey(STORAGE_KEY);
    const saved = localStorage.getItem(key);

    if (!saved) {
      return {
        modelLimits: [],
        phasePreferences: [],
        modelExclusions: [],
        accountTiers: [],
      };
    }

    try {
      return JSON.parse(saved) as AdvancedOptionsType;
    } catch (error) {
      console.error("[AdvancedOptions] Failed to parse saved options", error);
      return {
        modelLimits: [],
        phasePreferences: [],
        modelExclusions: [],
        accountTiers: [],
      };
    }
  });

  // Save to localStorage on change
  useEffect(() => {
    const key = getSessionKey(STORAGE_KEY);
    localStorage.setItem(key, JSON.stringify(options));
  }, [options]);

  return (
    <section className="border-l-4 border-outline-variant/40 bg-surface-container-low p-1">
      <div className="bg-surface-container p-6 space-y-4">
        {/* Header */}
        <button
          onClick={() => setExpanded((current) => !current)}
          type="button"
          className="w-full flex items-center justify-between group"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 transition-colors",
              expanded ? "bg-primary" : "bg-outline-variant"
            )} />
            <h3 className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant group-hover:text-primary transition-colors">
              {lang === "es" ? "Opciones Avanzadas" : "Advanced Options"}
            </h3>
          </div>
          {expanded ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-outline-variant" />}
        </button>

        {/* Collapsible content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 overflow-hidden"
            >
              {/* Section 1: Model Usage Limits */}
              <ModelLimitsSection
                limits={options.modelLimits}
                onChange={(limits) => setOptions((current) => ({ ...current, modelLimits: limits }))}
              />

              {/* Section 2: Phase Preferences */}
              <PhasePreferencesSection
                preferences={options.phasePreferences}
                onChange={(prefs) => setOptions((current) => ({ ...current, phasePreferences: prefs }))}
              />

              {/* Section 3: Model Exclusions */}
              <ModelExclusionsSection
                exclusions={options.modelExclusions}
                onChange={(excl) => setOptions((current) => ({ ...current, modelExclusions: excl }))}
              />

              {/* Section 4: Account Tier Selection */}
              <AccountTierSection
                tiers={options.accountTiers}
                onChange={(tiers) => setOptions((current) => ({ ...current, accountTiers: tiers }))}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── Section 1: Model Usage Limits ────────────────────────────────────────────

function ModelLimitsSection({ 
  limits, 
  onChange 
}: { 
  limits: ModelLimit[]; 
  onChange: (limits: ModelLimit[]) => void;
}) {
  const { lang } = useLanguage();
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [maxUses, setMaxUses] = useState(1);

  const handleAdd = () => {
    if (!provider.trim() || !model.trim()) return;
    onChange([...limits, { providerId: provider.trim(), modelId: model.trim(), maxUses }]);
    setProvider("");
    setModel("");
    setMaxUses(1);
  };

  const handleRemove = (index: number) => {
    onChange(limits.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-secondary" />
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-secondary">
          {lang === "es" ? "Límites de Uso por Modelo" : "Model Usage Limits"}
        </h4>
      </div>
      
      <p className="text-[9px] font-mono text-on-surface-variant/60 pl-3">
        {lang === "es" 
          ? "Limita cuántas veces un modelo puede ser asignado en el equipo optimizado."
          : "Limit how many times a model can be assigned in the optimized team."}
      </p>

      {/* Add form */}
      <div className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 pl-3">
        <input
          type="text"
          inputMode="text"
          placeholder={lang === "es" ? "Provider" : "Provider"}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder={lang === "es" ? "Modelo" : "Model"}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="number"
          min={1}
          step={1}
          value={maxUses}
          onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleAdd}
          type="button"
          className="flex items-center justify-center bg-secondary text-on-secondary px-3 py-1.5 hover:bg-secondary/90 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* List */}
      {limits.length > 0 && (
        <div className="space-y-1 pl-3">
          {limits.map((limit, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-surface-container-highest px-3 py-2 group"
            >
              <span className="font-mono text-[10px] text-on-surface">
                {limit.providerId}/{limit.modelId} → max {limit.maxUses}
              </span>
              <button
                onClick={() => handleRemove(idx)}
                className="opacity-0 group-hover:opacity-100 text-error hover:text-error/80 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section 2: Phase Preferences ─────────────────────────────────────────────
function PhasePreferencesSection({ 
  preferences, 
  onChange 
}: { 
  preferences: PhasePreference[]; 
  onChange: (prefs: PhasePreference[]) => void;
}) {
  const { lang } = useLanguage();
  const [phase, setPhase] = useState<SddPhase>("sdd-apply");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");

  const handleAdd = () => {
    if (!provider.trim() || !model.trim()) return;
    onChange([...preferences, { phase, providerId: provider.trim(), modelId: model.trim() }]);
    setProvider("");
    setModel("");
  };

  const handleRemove = (index: number) => {
    onChange(preferences.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-primary" />
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-primary">
          {lang === "es" ? "Preferencias por Fase" : "Phase Preferences"}
        </h4>
      </div>
      
      <p className="text-[9px] font-mono text-on-surface-variant/60 pl-3">
        {lang === "es" 
          ? "Forzar un modelo específico para una fase determinada."
          : "Force a specific model for a given phase."}
      </p>

      {/* Add form */}
      <div className="grid grid-cols-[120px_1fr_1fr_auto] gap-2 pl-3">
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as SddPhase)}
          aria-label={lang === "es" ? "Seleccionar fase" : "Select phase"}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        >
          {SDD_PHASES.map((p) => (
            <option key={p} value={p}>
              {getPhaseLabel(p, lang)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={lang === "es" ? "Provider" : "Provider"}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder={lang === "es" ? "Modelo" : "Model"}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleAdd}
          type="button"
          className="flex items-center justify-center bg-primary text-on-primary px-3 py-1.5 hover:bg-primary/90 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* List */}
      {preferences.length > 0 && (
        <div className="space-y-1 pl-3">
          {preferences.map((pref, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-surface-container-highest px-3 py-2 group"
            >
              <span className="font-mono text-[10px] text-on-surface">
                {getPhaseLabel(pref.phase, lang)} → {pref.providerId}/{pref.modelId}
              </span>
              <button
                onClick={() => handleRemove(idx)}
                className="opacity-0 group-hover:opacity-100 text-error hover:text-error/80 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section 3: Model Exclusions ──────────────────────────────────────────────

function ModelExclusionsSection({ 
  exclusions, 
  onChange 
}: { 
  exclusions: ModelExclusion[]; 
  onChange: (excl: ModelExclusion[]) => void;
}) {
  const { lang } = useLanguage();
  const [phase, setPhase] = useState<SddPhase>("sdd-apply");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");

  const handleAdd = () => {
    if (!provider.trim() || !model.trim()) return;
    onChange([...exclusions, { phase, providerId: provider.trim(), modelId: model.trim() }]);
    setProvider("");
    setModel("");
  };

  const handleRemove = (index: number) => {
    onChange(exclusions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-error" />
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-error">
          {lang === "es" ? "Exclusiones de Modelo" : "Model Exclusions"}
        </h4>
      </div>
      
      <p className="text-[9px] font-mono text-on-surface-variant/60 pl-3">
        {lang === "es" 
          ? "Excluir un modelo de ser asignado a una fase específica."
          : "Exclude a model from being assigned to a specific phase."}
      </p>

      {/* Add form */}
      <div className="grid grid-cols-[120px_1fr_1fr_auto] gap-2 pl-3">
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as SddPhase)}
          aria-label={lang === "es" ? "Seleccionar fase" : "Select phase"}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        >
          {SDD_PHASES.map((p) => (
            <option key={p} value={p}>
              {getPhaseLabel(p, lang)}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={lang === "es" ? "Provider" : "Provider"}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder={lang === "es" ? "Modelo" : "Model"}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleAdd}
          type="button"
          className="flex items-center justify-center bg-error text-on-error px-3 py-1.5 hover:bg-error/90 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* List */}
      {exclusions.length > 0 && (
        <div className="space-y-1 pl-3">
          {exclusions.map((excl, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-surface-container-highest px-3 py-2 group"
            >
              <span className="font-mono text-[10px] text-on-surface">
                {getPhaseLabel(excl.phase, lang)} ✗ {excl.providerId}/{excl.modelId}
              </span>
              <button
                onClick={() => handleRemove(idx)}
                className="opacity-0 group-hover:opacity-100 text-error hover:text-error/80 transition-all"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section 4: Account Tier Selection ────────────────────────────────────────

function AccountTierSection({ 
  tiers, 
  onChange 
}: { 
  tiers: ProviderAccountTier[]; 
  onChange: (tiers: ProviderAccountTier[]) => void;
}) {
  const { lang } = useLanguage();
  const [provider, setProvider] = useState("");
  const [tier, setTier] = useState<AccountTier>("free");

  const handleAdd = () => {
    if (!provider.trim()) return;
    // Remove existing entry for this provider if any
    const filtered = tiers.filter((t) => t.providerId !== provider.trim());
    onChange([...filtered, { providerId: provider.trim(), tier }]);
    setProvider("");
  };

  const handleRemove = (providerId: string) => {
    onChange(tiers.filter((t) => t.providerId !== providerId));
  };

  const selectedTierInfo = ACCOUNT_TIERS.find((t) => t.value === tier);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-tertiary" />
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
          {lang === "es" ? "Tier de Cuenta por Provider" : "Account Tier per Provider"}
        </h4>
      </div>
      
      <p className="text-[9px] font-mono text-on-surface-variant/60 pl-3">
        {lang === "es" 
          ? "Define el tier de tu cuenta para cada provider (afecta rate limits)."
          : "Define your account tier for each provider (affects rate limits)."}
      </p>

      {/* Add form */}
      <div className="grid grid-cols-[1fr_140px_auto] gap-2 pl-3">
        <input
          type="text"
          placeholder={lang === "es" ? "Provider" : "Provider"}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as AccountTier)}
          aria-label={lang === "es" ? "Seleccionar tier" : "Select tier"}
          className="bg-surface-container-highest text-on-surface font-mono text-[10px] px-2 py-1.5 border-none outline-none focus:ring-1 focus:ring-primary"
        >
          {ACCOUNT_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          type="button"
          className="flex items-center justify-center bg-tertiary text-on-tertiary px-3 py-1.5 hover:bg-tertiary/90 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Rate limit hint */}
      {selectedTierInfo && (
        <div className="flex items-center gap-2 pl-3 text-[9px] font-mono text-on-surface-variant/50">
          <Info size={10} />
          <span>
            {lang === "es" ? "Rate limit:" : "Rate limit:"} {selectedTierInfo.rateLimit}
          </span>
        </div>
      )}

      {/* List */}
      {tiers.length > 0 && (
        <div className="space-y-1 pl-3">
          {tiers.map((t, idx) => {
            const tierInfo = ACCOUNT_TIERS.find((at) => at.value === t.tier);
            return (
              <div
                key={idx}
                className="flex items-center justify-between bg-surface-container-highest px-3 py-2 group"
              >
                <span className="font-mono text-[10px] text-on-surface">
                  {t.providerId} → {tierInfo?.label} ({tierInfo?.rateLimit})
                </span>
                <button
                  onClick={() => handleRemove(t.providerId)}
                  className="opacity-0 group-hover:opacity-100 text-error hover:text-error/80 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
