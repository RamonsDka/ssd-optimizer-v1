"use client";

// ─── AddCustomSddModal ────────────────────────────────────────────────────────
// Modal for adding/editing custom SDD phases with category weight configuration.

import { useState, useEffect } from "react";
import { AlertCircle, Info } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils/cn";
import { LMARENA_CATEGORIES } from "@/lib/sync/lmarena-client";
import type { LMArenaCategory } from "@/lib/sync/lmarena-client";
import {
  addCustomPhase,
  updateCustomPhase,
  validateCategoryWeights,
  validatePhaseName,
  type CustomSddPhase,
} from "@/lib/optimizer/custom-phases";

interface AddCustomSddModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** If provided, modal is in edit mode */
  editPhase?: CustomSddPhase | null;
}

// Default weights: distribute evenly across top categories
const DEFAULT_WEIGHTS: Record<LMArenaCategory, number> = {
  overall: 0,
  coding: 0.25,
  "instruction-following": 0.25,
  "long-context": 0,
  "hard-prompts": 0,
  "creative-writing": 0,
  math: 0,
  reasoning: 0.25,
  multilingual: 0,
  safety: 0,
  "function-calling": 0,
  "structured-output": 0.25,
  vision: 0,
  multimodal: 0,
  speed: 0,
  "cost-efficiency": 0,
  "context-window": 0,
  "tool-use": 0,
  "agent-tasks": 0,
  summarization: 0,
  translation: 0,
  "question-answering": 0,
  dialogue: 0,
  roleplay: 0,
  analysis: 0,
  research: 0,
  planning: 0,
};

export default function AddCustomSddModal({
  open,
  onClose,
  onSuccess,
  editPhase,
}: AddCustomSddModalProps) {
  const isEditMode = !!editPhase;

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [weights, setWeights] = useState<Record<LMArenaCategory, number>>(DEFAULT_WEIGHTS);
  const [error, setError] = useState<string | null>(null);

  // Load edit data
  useEffect(() => {
    if (editPhase) {
      setName(editPhase.name);
      setDisplayName(editPhase.displayName);
      setDescription(editPhase.description ?? "");
      setWeights(editPhase.categoryWeights);
    } else {
      // Reset for add mode
      setName("");
      setDisplayName("");
      setDescription("");
      setWeights(DEFAULT_WEIGHTS);
    }
    setError(null);
  }, [editPhase, open]);

  const handleWeightChange = (category: LMArenaCategory, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWeights((current) => ({
      ...current,
      [category]: Math.max(0, Math.min(1, numValue)), // clamp 0-1
    }));
  };

  const handleSubmit = () => {
    setError(null);

    // Validate name (only in add mode)
    if (!isEditMode) {
      const nameValidation = validatePhaseName(name);
      if (!nameValidation.valid) {
        setError(nameValidation.error ?? "Invalid phase name");
        return;
      }
    }

    // Validate display name
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    // Validate weights
    const weightValidation = validateCategoryWeights(weights);
    if (!weightValidation.valid) {
      setError(weightValidation.error ?? "Weights must sum to 1.0");
      return;
    }

    // Save
    let result: string | null;
    if (isEditMode) {
      result = updateCustomPhase(editPhase.name, {
        displayName,
        description: description.trim() || undefined,
        categoryWeights: weights,
      });
    } else {
      result = addCustomPhase({
        name,
        displayName,
        description: description.trim() || undefined,
        categoryWeights: weights,
      });
    }

    if (result) {
      setError(result);
      return;
    }

    // Success
    onSuccess?.();
    onClose();
  };

  const weightSum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  const isValidSum = Math.abs(weightSum - 1.0) <= 0.001;

  // Filter out categories with zero weight for cleaner display
  const activeCategories = LMARENA_CATEGORIES.filter((cat) => weights[cat] > 0);
  const inactiveCategories = LMARENA_CATEGORIES.filter((cat) => weights[cat] === 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? "Edit Custom Phase" : "Add Custom SDD Phase"}
      maxWidth="max-w-4xl"
    >
      <div className="p-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-error/10 border border-error/30 text-error">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Basic info */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-2">
              Phase Name (slug)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              disabled={isEditMode}
              placeholder="my-custom-phase"
              className={cn(
                "w-full px-4 py-2 bg-surface-container-highest border border-outline-variant/40",
                "text-on-surface placeholder:text-on-surface-variant/50",
                "focus:outline-none focus:border-primary transition-colors",
                isEditMode && "opacity-50 cursor-not-allowed"
              )}
            />
            <p className="text-xs text-on-surface-variant/70 mt-1">
              Lowercase with hyphens only (e.g., "sdd-custom-review")
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Custom Review Phase"
              className="w-full px-4 py-2 bg-surface-container-highest border border-outline-variant/40 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this phase does..."
              rows={2}
              className="w-full px-4 py-2 bg-surface-container-highest border border-outline-variant/40 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
        </div>

        {/* Category weights */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-mono uppercase tracking-widest text-on-surface-variant">
              Category Weights
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">Sum:</span>
              <span
                className={cn(
                  "font-mono text-sm font-bold",
                  isValidSum ? "text-primary" : "text-error"
                )}
              >
                {weightSum.toFixed(3)}
              </span>
              <span className="text-xs text-on-surface-variant">/ 1.000</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-surface-container-highest border border-outline-variant/20">
            <Info size={16} className="shrink-0 mt-0.5 text-on-surface-variant" />
            <p className="text-xs text-on-surface-variant">
              Assign weights to LM Arena categories. Weights must sum to exactly 1.0. Higher
              weights mean the category is more important for this phase.
            </p>
          </div>

          {/* Active categories (non-zero) */}
          {activeCategories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-on-surface-variant">
                Active Categories ({activeCategories.length})
              </p>
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-3 bg-surface-container-highest border border-outline-variant/20">
                {activeCategories.map((category) => (
                  <CategoryWeightInput
                    key={category}
                    category={category}
                    weight={weights[category]}
                    onChange={handleWeightChange}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive categories (zero) */}
          {inactiveCategories.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
                Inactive Categories ({inactiveCategories.length})
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-2 max-h-64 overflow-y-auto p-3 bg-surface-container-highest border border-outline-variant/20">
                {inactiveCategories.map((category) => (
                  <CategoryWeightInput
                    key={category}
                    category={category}
                    weight={weights[category]}
                    onChange={handleWeightChange}
                  />
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-mono uppercase tracking-widest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValidSum || !displayName.trim() || (!isEditMode && !name.trim())}
            className={cn(
              "px-6 py-2 text-sm font-mono uppercase tracking-widest",
              "bg-primary text-on-primary",
              "hover:bg-primary/90 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isEditMode ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Category Weight Input ────────────────────────────────────────────────────

function CategoryWeightInput({
  category,
  weight,
  onChange,
}: {
  category: LMArenaCategory;
  weight: number;
  onChange: (category: LMArenaCategory, value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 text-xs text-on-surface truncate" title={category}>
        {category}
      </label>
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        value={weight}
        onChange={(e) => onChange(category, e.target.value)}
        className="w-20 px-2 py-1 text-xs text-right bg-surface-container border border-outline-variant/40 text-on-surface focus:outline-none focus:border-primary transition-colors"
      />
      <span className="text-xs text-on-surface-variant w-8 text-right">
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}
