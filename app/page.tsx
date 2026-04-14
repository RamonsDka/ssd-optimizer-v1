"use client";

import Image from "next/image";
import {
  LayoutGrid,
  Github,
  Youtube,
  Terminal,
  ClipboardCopy,
  MousePointerClick,
  Rocket,
} from "lucide-react";
import LandingHero from "@/components/landing/LandingHero";
import AuthorSection from "@/components/landing/AuthorSection";
import { SOCIAL_LINKS } from "@/lib/constants/social-links";
import { ASSETS } from "@/lib/constants/asset-mapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function LandingPage() {
  const { t } = useLanguage();

  return (
    <div className="relative">
      {/* Hero Section — animated, needs client wrapper */}
      <LandingHero />

      {/* About & Credits */}
      <section className="py-24 px-8 bg-surface-container-lowest relative border-y border-outline-variant/10">
        <div className="max-w-6xl mx-auto flex flex-col gap-10">
          <div className="w-full border border-pink-500/30 overflow-hidden shadow-[0_0_40px_rgba(235,24,137,0.1)]">
            <Image
              src={ASSETS.banner}
              alt="Gentleman Programming Banner"
              width={1200}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>

          <div className="flex flex-col">
            <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4 text-pink-500">
              {t("landing", "acknowledgements")}
            </h2>
            <p className="text-on-surface-variant text-xl leading-relaxed mb-8">
              {t("landing", "acknowledgementsDesc")}
            </p>

            <div className="flex items-start gap-4 mb-10 italic border-l-4 border-pink-500 pl-6">
              <Image
                src={ASSETS.authorAvatar}
                alt="Author"
                width={128}
                height={128}
                className="w-16 h-16 border-2 border-pink-500 shrink-0 object-cover"
              />
              <p className="text-on-surface-variant text-xl leading-relaxed">
                &ldquo;{t("landing", "quote")}&rdquo;
              </p>
            </div>

            <div className="flex flex-wrap gap-6">
              <SocialLink
                icon={<Github size={20} />}
                label="GitHub"
                href={SOCIAL_LINKS.alanGitHub}
              />
              <SocialLink
                icon={<Youtube size={20} />}
                label="YouTube"
                href={SOCIAL_LINKS.alanYouTube}
              />
              <SocialLink
                icon={<LayoutGrid size={20} />}
                label="Doras"
                href={SOCIAL_LINKS.alanDoras}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Guide Section */}
      <section id="guide" className="py-24 px-8 bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="mb-14 text-center">
            <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter mb-4 text-pink-500">
              {t("landing", "guide")}
            </h2>
            <p className="text-on-surface-variant font-mono uppercase tracking-widest text-sm max-w-2xl mx-auto leading-relaxed">
              {t("landing", "guideDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GuideStep
              number="01"
              icon={<Terminal size={24} />}
              text={t("landing", "step1")}
              stepLabel={t("common", "step")}
            />
            <GuideStep
              number="02"
              icon={<ClipboardCopy size={24} />}
              text={t("landing", "step2")}
              stepLabel={t("common", "step")}
            />
            <GuideStep
              number="03"
              icon={<MousePointerClick size={24} />}
              text={t("landing", "step3")}
              stepLabel={t("common", "step")}
            />
            <GuideStep
              number="04"
              icon={<Rocket size={24} />}
              text={t("landing", "step4")}
              stepLabel={t("common", "step")}
            />
          </div>

          <div className="mt-10 p-8 bg-surface-container-lowest border-l-4 border-pink-500 italic text-on-surface-variant font-medium text-lg">
            &ldquo;{t("landing", "bottomQuote")}&rdquo;
          </div>
        </div>
      </section>

      {/* Author Section — client component with Digital Identity, Stack Tags, Terminal Access, and Live Clock */}
      <AuthorSection />
    </div>
  );
}

function SocialLink({
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
      className="flex items-center gap-2 group"
    >
      <span className="text-secondary group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="font-mono text-sm uppercase tracking-widest group-hover:text-secondary transition-colors">
        {label}
      </span>
    </a>
  );
}

function GuideStep({
  number,
  icon,
  text,
  stepLabel,
}: {
  number: string;
  icon: React.ReactNode;
  text: string;
  stepLabel: string;
}) {
  return (
    <div className="p-6 bg-surface-container-low border border-outline-variant/30 hover:border-pink-500/50 transition-colors">
      {/* Number + step label on same line, same pink color — bold & big */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-pink-500 font-mono text-5xl font-black leading-none">
          {number}
        </span>
        <span className="text-pink-500 font-mono text-lg font-black uppercase tracking-widest">
          {stepLabel}
        </span>
      </div>
      {/* Icon */}
      <div className="text-primary mb-3">{icon}</div>
      {/* Instructional text */}
      <p className="font-bold text-xl uppercase tracking-tight">{text}</p>
    </div>
  );
}
