"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Cpu,
  History,
  Layers,
  BookOpen,
  Settings,
  Search,
  Activity,
  User,
  Globe,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  HelpInfoModal,
  HelpInfoTrigger,
} from "@/components/landing/HelpInfoModal";
import { LanguageToggle } from "@/components/landing/LanguageToggle";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Full nav matching the Sidebar — visible on ALL pages
const NAV_ITEMS = [
  { href: "/", icon: Home, labelKey: "home" as const },
  { href: "/optimizer", icon: Cpu, labelKey: "optimizer" as const },
  { href: "/history", icon: History, labelKey: "history" as const },
  { href: "/models", icon: Layers, labelKey: "models" as const },
  { href: "/docs", icon: BookOpen, labelKey: "docs" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
  { href: "/profiles", icon: UserCircle, labelKey: "profiles" as const },
] as const;

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === "/";
  const [helpOpen, setHelpOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <header
        className={cn(
          "fixed top-0 w-full flex justify-between items-center px-8 py-4 z-50 transition-all",
          isLanding
            ? "bg-stone-950/90 backdrop-blur-md border-b border-stone-800/50"
            : "bg-surface border-b border-outline-variant/10",
        )}
      >
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-black tracking-tighter text-pink-500 text-xl uppercase"
          >
            {t("common", "appName")}
          </Link>

          {/* Single unified nav — always visible */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                    isActive
                      ? "text-primary border-b-2 border-primary"
                      : "text-on-surface-variant hover:text-primary hover:border-b-2 hover:border-primary/40",
                  )}
                >
                  <Icon size={14} />
                  {t("nav", labelKey)}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {!isLanding && (
            <div className="hidden md:flex items-center gap-4 bg-surface-container-low px-3 py-1.5">
              <Search size={14} className="text-on-surface-variant" />
              <input
                type="text"
                placeholder={t("nav", "queryHistoryPlaceholder")}
                className="bg-transparent border-none focus:ring-0 text-[10px] text-on-surface font-mono w-48 uppercase tracking-widest placeholder:text-outline-variant outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-4 text-on-surface-variant">
            {/* Info — opens Help/Info modal */}
            <HelpInfoTrigger onOpen={() => setHelpOpen(true)} />

            {/* Language toggle — cycles ES/EN */}
            <LanguageToggle />

            {/* Refresh */}
            <button
              onClick={() => router.refresh()}
              title={t("common", "refresh")}
              className="hover:text-primary transition-colors relative group"
            >
              <Activity size={18} />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/0 group-hover:text-primary/80 uppercase tracking-widest whitespace-nowrap transition-colors">
                {t("common", "refresh")}
              </span>
            </button>

            {/* Models Directory */}
            <Link
              href="/models"
              title={t("common", "models")}
              className="hover:text-primary transition-colors relative group"
            >
              <Globe size={18} />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/0 group-hover:text-primary/80 uppercase tracking-widest whitespace-nowrap transition-colors">
                {t("common", "models")}
              </span>
            </Link>

            {/* Settings */}
            <Link
              href="/settings"
              title={t("common", "settings")}
              className="hover:text-primary transition-colors relative group"
            >
              <Settings size={18} />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/0 group-hover:text-primary/80 uppercase tracking-widest whitespace-nowrap transition-colors">
                {t("common", "settings")}
              </span>
            </Link>

            {/* Profile */}
            <Link
              href="/profiles"
              title={t("common", "profile")}
              className="hover:text-primary transition-colors relative group"
            >
              <User size={18} />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-primary/0 group-hover:text-primary/80 uppercase tracking-widest whitespace-nowrap transition-colors">
                {t("common", "profile")}
              </span>
            </Link>
          </div>

          {isLanding && (
            <Link
              href="/optimizer"
              className="bg-primary-container text-on-primary-container px-4 py-2 font-sans font-bold uppercase tracking-tighter text-xs hover:bg-primary transition-all active:scale-95"
            >
              {t("nav", "runCommand")}
            </Link>
          )}
        </div>
      </header>

      {/* Modal rendered outside header to avoid z-index stacking */}
      <HelpInfoModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}