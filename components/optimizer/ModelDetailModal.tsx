"use client";

// ─── ModelDetailModal ─────────────────────────────────────────────────────────
// Displays detailed information for a model including:
//  - Reasoning for selection
//  - Calculated score
//  - Detailed list of capabilities matching the SDD phase
//  - Context window, cost, and other specs

import { useEffect, useState } from "react";
import { X, Cpu, TrendingUp, FileText, Brain, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";
import type { ModelRecord, SddPhase } from "@/types";
import { SDD_PHASE_LABELS } from "@/types";

interface ModelDetailModalProps {
  model: ModelRecord | null;
  phase: SddPhase | null;
  reason: string | null;
  score: number | null;
  onClose: () => void;
}

const TIER_ACCENT: Record<string, string> = {
  PREMIUM: "text-secondary",
  BALANCED: "text-primary",
  ECONOMIC: "text-on-surface-variant",
};

const TIER_BG: Record<string, string> = {
  PREMIUM: "bg-secondary",
  BALANCED: "bg-primary",
  ECONOMIC: "bg-outline-variant",
};

const TIER_BORDER: Record<string, string> = {
  PREMIUM: "border-secondary",
  BALANCED: "border-primary",
  ECONOMIC: "border-outline-variant",
};

const TERTIARY_COLOR = "text-tertiary";

// Map model strengths to SDD phase capabilities
const STRENGTH_TO_CAPABILITY: Record<string, string> = {
  reasoning: "Advanced logical reasoning and problem-solving",
  architecture: "System architecture design capabilities",
  analysis: "Deep analytical processing of complex information",
  creative: "Creative ideation and novel solution generation",
  coding: "Code generation and software development expertise",
  code: "Code generation and software development expertise",
  speed: "Fast inference and rapid response times",
  "cost-efficient": "Optimized cost-performance ratio",
  context: "Large context window handling and memory retention",
  multimodal: "Processing of multiple input types (text, image, audio)",
  "structured-output": "Consistent and well-formatted output generation",
};

export default function ModelDetailModal({
  model,
  phase,
  reason,
  score,
  onClose,
}: ModelDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (model) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [model, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  const phaseLabel = phase ? SDD_PHASE_LABELS[phase].en : "";

  return createPortal(
    <AnimatePresence>
      {model && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-label={`Model Details: ${model.name}`}
          >
            <motion.div
              key="modal-panel"
              className="pointer-events-auto w-full bg-surface-container-low border border-outline-variant/20 flex flex-col max-h-[90vh] max-w-2xl"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-6 py-4 border-b border-outline-variant/20 shrink-0">
                <div>
                  <h2 className="font-black text-on-surface tracking-tighter uppercase text-lg">
                    MODEL DETAILS
                  </h2>
                  <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                    {model.name}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 ml-4 p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 min-h-0 p-6 space-y-6">
                {/* Model Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Cpu size={16} className="text-on-surface-variant" />
                    <span className={cn("font-mono text-sm font-bold uppercase tracking-widest", TIER_ACCENT[model.tier])}>
                      {model.tier}
                    </span>
                    {model.discoveredByAI && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/50 border border-outline-variant/30 px-1.5 py-0.5">
                        AI-DISCOVERED
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-container-highest p-4">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/60 block mb-2">
                        CONTEXT WINDOW
                      </span>
                      <span className="font-mono text-xl font-black text-on-surface tabular-nums">
                        {(model.contextWindow / 1000).toFixed(0)}<span className="text-sm font-normal text-on-surface-variant ml-1">K tokens</span>
                      </span>
                    </div>
                    <div className="bg-surface-container-highest p-4">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/60 block mb-2">
                        COST / 1M TOKENS
                      </span>
                      <span className={cn("font-mono text-xl font-black tabular-nums", TIER_ACCENT[model.tier])}>
                        ${model.costPer1M.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reasoning */}
                {reason && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain size={16} className="text-primary" />
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                        Selection Reasoning
                      </h3>
                    </div>
                    <div className="bg-surface-container-highest p-4 border-l-2 border-primary">
                      <p className="text-sm text-on-surface leading-relaxed">
                        {reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Score */}
                {score !== null && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className="text-secondary" />
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                        Capability Score
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] text-on-surface-variant">
                          Match for {phaseLabel} phase
                        </span>
                        <span className={cn("font-mono text-sm font-bold", TIER_ACCENT[model.tier])}>
                          {Math.round(score * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-highest">
                        <motion.div
                          className={cn("h-full", TIER_BG[model.tier])}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(score * 100)}%` }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Capabilities */}
                {model.strengths.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-tertiary" />
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                        Key Capabilities
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {model.strengths.map((strength, index) => {
                        const capability = STRENGTH_TO_CAPABILITY[strength.toLowerCase()] || strength;
                        return (
                          <div 
                            key={index} 
                            className="flex items-start gap-3 p-3 bg-surface-container-highest border-l-2 border-tertiary"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-tertiary mt-2 flex-shrink-0" />
                            <span className="text-sm text-on-surface">
                              {capability}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}