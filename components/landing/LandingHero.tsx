"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ASSETS } from "@/lib/constants/asset-mapping";

// ─── Animated SVG Lines ────────────────────────────────────────────────────
// Each line glows/pulses independently for a subtle tactical data-stream feel.
function AnimatedLines() {
  const lines = [
    { x1: "0%", y1: "20%", x2: "100%", y2: "60%", delay: 0, duration: 6 },
    { x1: "0%", y1: "50%", x2: "100%", y2: "10%", delay: 1.5, duration: 8 },
    { x1: "0%", y1: "80%", x2: "100%", y2: "35%", delay: 0.8, duration: 7 },
    { x1: "20%", y1: "0%", x2: "70%", y2: "100%", delay: 2, duration: 9 },
    { x1: "60%", y1: "0%", x2: "30%", y2: "100%", delay: 0.4, duration: 6.5 },
    { x1: "0%", y1: "35%", x2: "100%", y2: "85%", delay: 3, duration: 10 },
  ];

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow-line">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {lines.map((_, i) => (
          <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34,211,238,0)" />
            <stop offset="30%" stopColor="rgba(34,211,238,0.4)" />
            <stop offset="70%" stopColor="rgba(138,235,255,0.3)" />
            <stop offset="100%" stopColor="rgba(138,235,255,0)" />
          </linearGradient>
        ))}
      </defs>
      {lines.map((line, i) => (
        <motion.line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={`url(#grad-${i})`}
          strokeWidth="1"
          filter="url(#glow-line)"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{
            opacity: [0, 0.6, 0.2, 0.8, 0],
            pathLength: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: line.duration,
            delay: line.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Glitch accent — a single bright streak that fires occasionally */}
      <motion.line
        x1="0%"
        y1="45%"
        x2="100%"
        y2="45%"
        stroke="rgba(138,235,255,0.7)"
        strokeWidth="0.5"
        filter="url(#glow-line)"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{
          opacity: [0, 0, 0.9, 0, 0, 0],
          scaleX: [0, 0, 1, 1, 0, 0],
        }}
        style={{ transformOrigin: "0% 45%" }}
        transition={{
          duration: 0.4,
          delay: 3.5,
          repeat: Infinity,
          repeatDelay: 7,
          ease: "easeOut",
        }}
      />
    </svg>
  );
}

export default function LandingHero() {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[85vh] flex flex-col justify-center items-center px-8 grid-overlay pt-20">
      {/* ── Background image ─────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      >
        <Image
          src={ASSETS.landingBg}
          alt=""
          fill
          priority
          className="object-cover opacity-20 mix-blend-luminosity"
          sizes="100vw"
        />
      </div>

      {/* ── Animated moving lines overlay ────────────────────────────────── */}
      <AnimatedLines />

      {/* Translucent gradient overlay */}
      <div className="gradient-overlay" />
      {/* CSS scan-lines */}
      <div className="scan-lines" />
      {/* Base fade-to-background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-0" />

      {/* ── Hero text content ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-5xl w-full text-center"
      >
        <h1 className="text-6xl md:text-8xl font-black text-on-surface tracking-tighter mb-6 leading-tight uppercase">
          {t("hero", "titleLine1")} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-container to-primary italic pb-2 inline-block">
            {t("hero", "titleLine2")}
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-on-surface-variant font-light max-w-2xl mx-auto mb-12 leading-relaxed">
          {t("hero", "description")}
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/optimizer"
            className="px-10 py-5 bg-primary-container text-on-primary-container font-bold uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all"
          >
            {t("hero", "ctaOptimizer")}
          </Link>
          <Link
            href="/docs"
            className="px-10 py-5 border border-outline-variant text-on-surface font-bold uppercase tracking-widest text-sm hover:bg-surface-container-high transition-all"
          >
            {t("hero", "ctaDocs")}
          </Link>
        </div>
      </motion.div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-60 animate-bounce z-20">
        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">
          {t("common", "scroll")}
        </span>
        <ChevronDown size={16} className="text-primary" />
      </div>
    </section>
  );
}