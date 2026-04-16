"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import AddCustomSddModal from "@/components/optimizer/AddCustomSddModal";
import {
  listCustomPhases,
  removeCustomPhase,
  type CustomSddPhase,
} from "@/lib/optimizer/custom-phases";

export default function CustomPhasesManager() {
  const { lang } = useLanguage();
  const [phases, setPhases] = useState<CustomSddPhase[]>([]);
  const [open, setOpen] = useState(false);
  const [editPhase, setEditPhase] = useState<CustomSddPhase | null>(null);

  const refresh = () => setPhases(listCustomPhases());

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = (name: string) => {
    removeCustomPhase(name);
    refresh();
  };

  return (
    <section className="border-l-4 border-secondary/40 bg-surface-container-low p-1">
      <div className="bg-surface-container p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">
              {lang === "es" ? "Fases Custom SDD" : "Custom SDD Phases"}
            </h3>
            <p className="text-[10px] font-mono text-on-surface-variant/60 mt-1">
              {lang === "es"
                ? "Crear fases nuevas con pesos personalizados de LM Arena."
                : "Create new phases with custom LM Arena weights."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest",
              "border border-secondary/30 text-secondary hover:bg-secondary/10 transition-colors"
            )}
          >
            <Plus size={12} />
            {lang === "es" ? "Nueva Fase" : "New Phase"}
          </button>
        </div>

        {phases.length > 0 ? (
          <div className="space-y-2">
            {phases.map((phase) => (
              <div key={phase.name} className="flex items-start justify-between gap-4 bg-surface-container-highest p-4">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-on-surface break-words">{phase.displayName}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-1">
                    {phase.name}
                  </div>
                  {phase.description && (
                    <div className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                      {phase.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPhase(phase);
                      setOpen(true);
                    }}
                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                    aria-label="Edit custom phase"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(phase.name)}
                    className="p-2 text-on-surface-variant hover:text-error hover:bg-surface-container-high transition-colors"
                    aria-label="Delete custom phase"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/40 border border-outline-variant/20 p-4">
            {lang === "es" ? "No hay fases custom todavía." : "No custom phases yet."}
          </div>
        )}
      </div>

      <AddCustomSddModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditPhase(null);
        }}
        onSuccess={refresh}
        editPhase={editPhase}
      />
    </section>
  );
}
