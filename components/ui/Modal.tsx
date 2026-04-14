"use client";

// ─── Modal ────────────────────────────────────────────────────────────────────
// Reusable modal/dialog using Framer Motion (AnimatePresence) + React createPortal.
// No Radix dependency — pure custom implementation for maximum control.
//
// Usage:
//   <Modal open={open} onClose={() => setOpen(false)} title="My Modal">
//     {children}
//   </Modal>

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Optional subtitle / tag line shown below title */
  subtitle?: string;
  children: React.ReactNode;
  /** Max-width class override. Default: "max-w-2xl" */
  maxWidth?: string;
  /** Hide the default header (title + close button) */
  hideHeader?: boolean;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden:  { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1     },
  exit:    { opacity: 0, y: 16, scale: 0.98  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-2xl",
  hideHeader = false,
}: ModalProps) {
  // Close on ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll while modal is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  // Render into document.body via portal
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ──────────────────────────────────────────────────── */}
          <motion.div
            key="modal-backdrop"
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* ── Panel ─────────────────────────────────────────────────────── */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : "Modal"}
          >
            <motion.div
              key="modal-panel"
              className={cn(
                "pointer-events-auto w-full bg-surface-container-low",
                "border border-outline-variant/20",
                "flex flex-col max-h-[90vh]",
                maxWidth
              )}
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              // Prevent clicks inside the panel from closing the modal
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ─────────────────────────────────────────────────── */}
              {!hideHeader && (
                <div className="flex items-start justify-between px-6 py-4 border-b border-outline-variant/20 shrink-0">
                  <div>
                    {title && (
                      <h2 className="font-black text-on-surface tracking-tighter uppercase text-lg">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className={cn(
                      "shrink-0 ml-4 p-1.5 text-on-surface-variant",
                      "hover:text-on-surface hover:bg-surface-container-high",
                      "transition-colors"
                    )}
                    aria-label="Cerrar modal"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* ── Content ────────────────────────────────────────────────── */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Sub-components for composition ───────────────────────────────────────────

/** Skeleton row helper — use inside modal bodies during loading */
export function ModalSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 bg-surface-container-highest animate-pulse"
          style={{ width: `${60 + (i % 3) * 15}%` }}
        />
      ))}
    </div>
  );
}

/** Section divider for use inside modal bodies */
export function ModalSection({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>
      {children}
    </div>
  );
}
