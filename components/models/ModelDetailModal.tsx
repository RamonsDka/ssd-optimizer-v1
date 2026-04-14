"use client";

// ─── ModelDetailModal ─────────────────────────────────────────────────────────
// Displays full technical metadata for a single AI model:
//  - Provider info + context section
//  - Context window, cost
//  - Interactive capability score bar
//  - All strength tags (expanded)
//  - Best Used For heuristic based on phase compatibility
//
// Data fetched on-demand from GET /api/models/[id].

import { useState, useEffect, useMemo } from "react";
import {
  ExternalLink,
  Cpu,
  Crosshair,
  Globe,
  Building2,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import Modal, { ModalSkeleton, ModalSection } from "@/components/ui/Modal";
import { cn } from "@/lib/utils/cn";
import type { ModelDetailResponse } from "@/app/api/models/[id]/route";
import type { Tier, SddPhase } from "@/types";
import { SDD_PHASES, SDD_PHASE_LABELS } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelDetailModalProps {
  modelId: string | null;
  onClose: () => void;
}

type ModelDetail = ModelDetailResponse["data"];

// ─── Tier styles ──────────────────────────────────────────────────────────────

const TIER_ACCENT: Record<Tier, string> = {
  PREMIUM: "text-secondary",
  BALANCED: "text-primary",
  ECONOMIC: "text-on-surface-variant",
};

const TIER_BAR: Record<Tier, string> = {
  PREMIUM: "bg-secondary",
  BALANCED: "bg-primary",
  ECONOMIC: "bg-outline-variant",
};

const TIER_BORDER: Record<Tier, string> = {
  PREMIUM: "border-secondary",
  BALANCED: "border-primary",
  ECONOMIC: "border-outline-variant",
};

// ─── Provider URL helper ──────────────────────────────────────────────────────

function getProviderUrl(providerId: string): string | null {
  const MAP: Record<string, string> = {
    anthropic:  "https://anthropic.com",
    openai:     "https://openai.com",
    google:     "https://deepmind.google",
    meta:       "https://ai.meta.com",
    mistral:    "https://mistral.ai",
    cohere:     "https://cohere.com",
    groq:       "https://groq.com",
    together:   "https://together.ai",
    perplexity: "https://perplexity.ai",
  };
  const key = providerId.toLowerCase();
  return MAP[key] ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Phase compatibility heuristic ────────────────────────────────────────────
// Maps model strengths to the SDD phases they're best suited for.

const STRENGTH_PHASE_MAP: Record<string, SddPhase[]> = {
  reasoning:  ["sdd-explore", "sdd-propose", "sdd-design"],
  architecture: ["sdd-design", "sdd-spec"],
  analysis:   ["sdd-verify", "sdd-explore"],
  creative:    ["sdd-explore", "sdd-propose"],
  coding:      ["sdd-apply", "sdd-tasks", "sdd-verify"],
  code:        ["sdd-apply", "sdd-tasks"],
  speed:       ["sdd-archive", "sdd-tasks"],
  "cost-efficient": ["sdd-archive", "sdd-onboard"],
  context:     ["sdd-init", "sdd-onboard", "sdd-propose"],
  multimodal:  ["sdd-explore", "sdd-design"],
  "structured-output": ["sdd-spec", "sdd-tasks"],
};

function computeBestPhases(strengths: string[]): { phase: SddPhase; label: string; score: number }[] {
  const phaseScores = new Map<SddPhase, number>();
  for (const tag of strengths) {
    const key = tag.toLowerCase();
    const phases = STRENGTH_PHASE_MAP[key];
    if (phases) {
      for (const phase of phases) {
        phaseScores.set(phase, (phaseScores.get(phase) ?? 0) + 1);
      }
    }
  }
  return SDD_PHASES
    .map((phase) => ({
      phase,
      label: SDD_PHASE_LABELS[phase].en,
      score: phaseScores.get(phase) ?? 0,
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ─── Provider context data ─────────────────────────────────────────────────────

interface ProviderContext {
  name: string;
  description: string;
  specialty: string;
}

const PROVIDER_CONTEXT: Record<string, ProviderContext> = {
  anthropic:  { name: "Anthropic",   description: "AI safety company focused on building reliable, interpretable, and steerable AI systems.", specialty: "Long-context reasoning, constitutional AI" },
  openai:     { name: "OpenAI",      description: "AI research lab creating general-purpose language and multimodal models at scale.", specialty: "General-purpose coding, GPT series, multimodal" },
  google:     { name: "Google DeepMind", description: "DeepMind research division producing state-of-the-art models for reasoning and multimodal tasks.", specialty: "Gemini multimodal, long-context, search grounding" },
  meta:       { name: "Meta AI",     description: "Open-source AI initiative releasing powerful models for the community.", specialty: "Open-weight models, cost-efficient at scale" },
  mistral:    { name: "Mistral AI",  description: "European AI lab specializing in efficient, high-performance language models.", specialty: "Fast inference, open-weight, European compliance" },
  cohere:     { name: "Cohere",      description: "Enterprise AI platform focused on RAG, search, and retrieval-augmented generation.", specialty: "Enterprise RAG, embeddings, search" },
  groq:       { name: "Groq",        description: "Inference hardware company delivering ultra-low-latency LLM serving.", specialty: "Fastest inference speed, LPU hardware" },
  together:   { name: "Together AI", description: "Cloud platform for running open-source models with optimized serving.", specialty: "Open-source model hosting, fine-tuning" },
  perplexity: { name: "Perplexity",  description: "AI-powered search engine with real-time web-grounded answers.", specialty: "Web-grounded answers, real-time search" },
};

export default function ModelDetailModal({ modelId, onClose }: ModelDetailModalProps) {
  const [model, setModel] = useState<ModelDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelId) {
      setModel(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setModel(null);

    fetch(`/api/models/${encodeURIComponent(modelId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          setError(json.error ?? "Error desconocido");
        } else {
          setModel((json as ModelDetailResponse).data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error de red");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [modelId]);

  const scoreProxy = model ? Math.min(100, model.strengths.length * 20 + 40) : 0;
  const tier = model?.tier as Tier | undefined;

  const bestPhases = useMemo(
    () => (model ? computeBestPhases(model.strengths) : []),
    [model]
  );
  const providerCtx = model ? PROVIDER_CONTEXT[model.providerId.toLowerCase()] : undefined;

  return (
    <Modal
      open={!!modelId}
      onClose={onClose}
      title={model ? model.name : "MODEL DETAIL"}
      subtitle={model ? `${model.providerId} // ${model.tier}` : undefined}
      maxWidth="max-w-2xl"
    >
      {/* Loading */}
      {loading && <ModalSkeleton rows={6} />}

      {/* Error */}
      {!loading && error && (
        <div className="p-6">
          <div className="border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
            <span className="font-bold">[ERROR]</span> {error}
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && model && tier && (
        <div className="p-6 space-y-8">

          {/* ── Top meta strip ──────────────────────────────────────────── */}
          <div
            className={cn(
              "border-l-4 pl-4 py-2",
              TIER_BORDER[tier]
            )}
          >
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-on-surface-variant" />
              <span className={cn("font-mono text-xs font-bold uppercase tracking-widest", TIER_ACCENT[tier])}>
                {model.tier}
              </span>
              {model.discoveredByAI && (
                <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/50 border border-outline-variant/30 px-1.5 py-0.5">
                  AI-DISCOVERED
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-on-surface-variant mt-1">
              Provider: {model.providerName}
              {getProviderUrl(model.providerId) && (
                <a
                  href={getProviderUrl(model.providerId)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-0.5 hover:text-primary transition-colors"
                  aria-label={`Visitar ${model.providerName}`}
                >
                  <ExternalLink size={9} />
                  visit
                </a>
              )}
            </p>
          </div>

          {/* ── Specs grid ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-px bg-outline-variant/10">
            <SpecBlock label="CONTEXT WINDOW">
              <span className="font-mono text-2xl font-black text-on-surface tabular-nums">
                {(model.contextWindow / 1000).toFixed(0)}
                <span className="text-sm font-normal text-on-surface-variant ml-1">K tokens</span>
              </span>
            </SpecBlock>
            <SpecBlock label="COST / 1M TOKENS">
              <span className={cn("font-mono text-2xl font-black tabular-nums", TIER_ACCENT[tier])}>
                ${model.costPer1M.toFixed(2)}
              </span>
            </SpecBlock>
            <SpecBlock label="TOTAL USES">
              <span className="font-mono text-lg font-bold text-on-surface tabular-nums">
                {model.totalSelections}
                <span className="text-sm font-normal text-on-surface-variant ml-1">jobs</span>
              </span>
            </SpecBlock>
            <SpecBlock label="LAST UPDATED">
              <span className="font-mono text-xs text-on-surface-variant">
                {new Date(model.updatedAt).toLocaleDateString("es-AR")}
              </span>
            </SpecBlock>
          </div>

          {/* ── Capability score bar ─────────────────────────────────────── */}
          <ModalSection label="Capability Score">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-on-surface-variant">
                  Score basado en fortalezas catalogadas
                </span>
                <span className={cn("font-mono text-sm font-bold", TIER_ACCENT[tier])}>
                  {scoreProxy}%
                </span>
              </div>
              <div className="h-2 w-full bg-surface-container-highest">
                <motion.div
                  className={cn("h-full", TIER_BAR[tier])}
                  initial={{ width: 0 }}
                  animate={{ width: `${scoreProxy}%` }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                />
              </div>
            </div>
          </ModalSection>

          {/* ── Strengths ────────────────────────────────────────────────── */}
          <ModalSection label={`Strengths (${model.strengths.length})`}>
            {model.strengths.length === 0 ? (
              <span className="font-mono text-xs text-on-surface-variant/40">— Sin datos —</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {model.strengths.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "px-2 py-1 text-[10px] font-mono text-on-surface-variant border-l bg-surface-container-highest",
                      TIER_BORDER[tier]
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </ModalSection>

          {/* ── Provider Context ─────────────────────────────────────────── */}
          {providerCtx && (
            <ModalSection label="Provider Context">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 size={14} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono text-xs text-on-surface font-bold">
                      {providerCtx.name}
                    </p>
                    <p className="font-mono text-[10px] text-on-surface-variant/70 mt-0.5 leading-relaxed">
                      {providerCtx.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Crosshair size={10} className="text-secondary shrink-0" />
                  <span className="font-mono text-[10px] text-on-surface-variant">
                    Specialty: {providerCtx.specialty}
                  </span>
                </div>
                {getProviderUrl(model.providerId) && (
                  <a
                    href={getProviderUrl(model.providerId)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] text-primary hover:text-secondary transition-colors"
                  >
                    <Globe size={10} />
                    Visit provider site
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </ModalSection>
          )}

          {/* ── Best Used For (phase heuristic) ──────────────────────────── */}
          {bestPhases.length > 0 && (
            <ModalSection label="Best Used For">
              <div className="flex flex-wrap gap-2">
                {bestPhases.map(({ phase, label, score }) => (
                  <span
                    key={phase}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5",
                      "border-l-2 bg-surface-container-highest",
                      "font-mono text-[10px] uppercase tracking-widest",
                      score >= 2
                        ? "border-secondary text-secondary"
                        : "border-primary text-primary"
                    )}
                  >
                    <Zap size={9} className={score >= 2 ? "text-secondary" : "text-primary"} />
                    {label}
                    {score >= 2 && (
                      <span className="text-[8px] text-on-surface-variant/50 ml-0.5">
                        ★
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <p className="font-mono text-[9px] text-on-surface-variant/40 mt-2">
                Based on strength-to-phase compatibility heuristic
              </p>
            </ModalSection>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── SpecBlock ────────────────────────────────────────────────────────────────

function SpecBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-highest px-5 py-4 space-y-1.5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/60 block">
        {label}
      </span>
      {children}
    </div>
  );
}
