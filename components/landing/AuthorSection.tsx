"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Youtube,
  Code,
  ScanLine,
  Terminal,
  X,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SOCIAL_LINKS } from "@/lib/constants/social-links";
import { ASSETS } from "@/lib/constants/asset-mapping";
import { APP_VERSION } from "@/lib/constants/version";

// ─── Primary Stack tag data ──────────────────────────────────────────────────

const STACK_TAGS = [
  { label: "Next.js 15", accent: true },
  { label: "Prisma", accent: false },
  { label: "TypeScript", accent: false },
  { label: "Tailwind 4", accent: true },
  { label: "Motion", accent: false },
  { label: "Gemini AI", accent: true },
  { label: "SDD", accent: true },
  { label: "PostgreSQL", accent: false },
  { label: "OpenRouter", accent: false },
  { label: "React 19", accent: true },
];

// ─── Mock terminal log lines ──────────────────────────────────────────────────

const TERMINAL_LINES = [
  { text: "$ sdd-optimizer --init", type: "command" as const },
  { text: "▸ Booting tactical console...", type: "info" as const },
  { text: "▸ Connected to SDD Architectural Labs", type: "info" as const },
  { text: "▸ Loading model catalog... 142 providers synced", type: "success" as const },
  { text: "▸ Gemini AI module: ONLINE", type: "success" as const },
  { text: "▸ OpenRouter sync: ACTIVE", type: "success" as const },
  { text: "▸ Scanning sub-agent matrix...", type: "info" as const },
  { text: "▸ Phase 01: Architect → pr/claude-3.5-sonnet", type: "data" as const },
  { text: "▸ Phase 02: Coder → pr/gpt-4o", type: "data" as const },
  { text: "▸ Phase 03: Reviewer → pr/gemini-2.5-pro", type: "data" as const },
  { text: "▸ Phase 04: Tester → pr/claude-3.5-haiku", type: "data" as const },
  { text: "▸ Optimization complete. Latency: 1.2s", type: "success" as const },
  { text: "▸ Building digital futures... ✓", type: "success" as const },
  { text: "$ ", type: "cursor" as const },
];

// ─── Live Clock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-[10px] text-primary tabular-nums tracking-widest">
      {time || "--:--:--"}
    </span>
  );
}

// ─── Author Section Component ──────────────────────────────────────────────────

export default function AuthorSection() {
  const [terminalOpen, setTerminalOpen] = useState(false);

  return (
    <section className="py-16 px-8 bg-surface-container-low">
      <div className="max-w-3xl mx-auto border border-outline-variant/20 bg-surface-container p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
        {/* ── Avatar with Digital Identity scanning badge ─────────────── */}
        <div className="relative w-32 h-32 shrink-0 group">
          {/* Scanning line animation */}
          <div className="absolute inset-0 border-2 border-dashed border-pink-500/40 animate-spin [animation-duration:8s]" />

          {/* Digital Identity scanning overlay */}
          <motion.div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent z-20"
            initial={{ top: "0%" }}
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Corner badges */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary z-20" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary z-20" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary z-20" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary z-20" />

          {/* Scan label */}
          <motion.div
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 bg-surface-container px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <span className="font-mono text-[8px] text-primary uppercase tracking-[0.3em] flex items-center gap-1">
              <ScanLine size={8} />
              DIGITAL ID
            </span>
          </motion.div>

          <div className="absolute inset-2 overflow-hidden bg-surface-container-highest">
            <Image
              src={ASSETS.profileAvatar}
              alt="RamonsDk-Dev"
              width={128}
              height={128}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          {/* Name */}
          <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 text-on-surface">
            RamonsDk-Dev
          </h3>

          {/* Digital Identity subtitle */}
          <motion.p
            className="font-mono text-[10px] text-primary/80 uppercase tracking-[0.2em] mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            ◈ DIGITAL IDENTITY VERIFIED ◈
          </motion.p>

          {/* Author Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <AuthorLink
              icon={<Youtube size={18} />}
              label="@RamonsDk-Dev"
              href={SOCIAL_LINKS.ramonYouTube}
            />
            <AuthorLink
              icon={<Code size={18} />}
              label="Project GitHub"
              href={SOCIAL_LINKS.projectGitHub}
            />
          </div>

          {/* ── Primary Stack tag cloud ────────────────────────────── */}
          <div className="mb-5">
            <p className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-[0.25em] mb-2">
              Primary Stack
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STACK_TAGS.map((tag, i) => (
                <motion.span
                  key={tag.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className={`font-mono text-[10px] px-2 py-0.5 uppercase tracking-widest ${
                    tag.accent
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-surface-container-high text-on-surface-variant border border-outline-variant/20"
                  }`}
                >
                  {tag.label}
                </motion.span>
              ))}
            </div>
          </div>

          {/* ── Terminal Access button ─────────────────────────────── */}
          <button
            onClick={() => setTerminalOpen(true)}
            className="group flex items-center gap-2 bg-surface-container-highest border border-outline-variant/30 px-4 py-2 hover:border-primary/40 transition-colors"
          >
            <Terminal size={14} className="text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">
              Terminal Access
            </span>
            <ChevronRight size={12} className="text-on-surface-variant/40 group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>

      {/* ── Digital Futures Section ──────────────────────────────────── */}
      <div className="max-w-3xl mx-auto mt-6 border border-outline-variant/20 bg-surface-container p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-2 h-2 bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
              Node Status: <span className="text-emerald-400 font-bold">Online</span>
            </span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-widest">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span>System Time:</span>
              <LiveClock />
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span>Node Location:</span>
              <span className="text-primary">Santo Domingo, DR</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-outline-variant/10 mt-4 text-center">
          <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-[0.2em]">
            Building digital futures
          </span>
        </div>
      </div>

      {/* ── Terminal Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {terminalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={() => setTerminalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xl"
            >
              {/* Terminal header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500" />
                  <div className="w-2 h-2 bg-yellow-500" />
                  <div className="w-2 h-2 bg-emerald-400" />
                  <span className="ml-2 font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
                    SDD Terminal v{APP_VERSION}
                  </span>
                </div>
                <button
                  onClick={() => setTerminalOpen(false)}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Terminal body */}
              <div className="p-4 max-h-[50vh] overflow-y-auto">
                {TERMINAL_LINES.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.15 }}
                    className={`font-mono text-xs leading-relaxed ${
                      line.type === "command"
                        ? "text-primary"
                        : line.type === "success"
                        ? "text-emerald-400"
                        : line.type === "data"
                        ? "text-secondary"
                        : line.type === "cursor"
                        ? "text-primary animate-pulse"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {line.text}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Author Link ──────────────────────────────────────────────────────────────

function AuthorLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 group"
    >
      <span className="text-primary group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="font-mono text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
        {label}
      </span>
    </a>
  );
}