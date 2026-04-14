"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import { cn } from "@/lib/utils/cn";
import { Github, Youtube, LayoutGrid, Info, Settings, Globe, UserCircle } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/constants/social-links";
import { HelpInfoModal } from "@/components/landing/HelpInfoModal";
import { APP_VERSION } from "@/lib/constants/version";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface ShellProps {
  children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [helpOpen, setHelpOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar />
        <main
          className={cn(
            "flex-1 transition-all",
            !isLanding && "lg:pl-64 pt-14",
          )}
        >
          {children}
        </main>
      </div>

      <footer
        className={cn(
          "w-full py-3 px-8 flex justify-between items-center z-50 font-mono text-[10px] uppercase tracking-widest",
          isLanding
            ? "bg-stone-950 border-t border-stone-800"
            : "fixed bottom-0 bg-[#0d0d12] border-t border-white/5",
        )}
      >
        <div className="text-primary/60">
          © 2026 SDD ARCHITECTURAL LABS // v{APP_VERSION}
        </div>

        {/* Center: functional utility icons */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => setHelpOpen(true)}
            title="System Info"
            className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
          >
            <Info size={13} />
            <span>{t("common", "info")}</span>
          </button>
          <Link
            href="/models"
            title="Models Directory"
            className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
          >
            <Globe size={13} />
            <span>{t("common", "models")}</span>
          </Link>
          <Link
            href="/profiles"
            title="User Profiles"
            className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
          >
            <UserCircle size={13} />
            <span>{t("common", "profile")}</span>
          </Link>
          <Link
            href="/settings"
            title="Settings"
            className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
          >
            <Settings size={13} />
            <span>{t("common", "settings")}</span>
          </Link>
        </div>

        {/* Right: social links */}
        <div className="flex gap-6 items-center">
          <a
            href={SOCIAL_LINKS.projectGitHub}
            target="_blank"
            rel="noopener noreferrer"
            title="Project GitHub"
            className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Github size={14} />
            <span>{t("footer", "repo")}</span>
          </a>
          <a
            href={SOCIAL_LINKS.ramonYouTube}
            target="_blank"
            rel="noopener noreferrer"
            title="@RamonsDk-Dev YouTube"
            className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Youtube size={14} />
            <span>@RamonsDk</span>
          </a>
          <a
            href={SOCIAL_LINKS.alanDoras}
            target="_blank"
            rel="noopener noreferrer"
            title="Gentleman Programming — Doras"
            className="text-on-surface-variant hover:text-secondary transition-colors flex items-center gap-1.5"
          >
            <LayoutGrid size={14} />
            <span>Gentleman</span>
          </a>
        </div>
      </footer>

      {/* Help Info Modal — shared with Topbar */}
      <HelpInfoModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}