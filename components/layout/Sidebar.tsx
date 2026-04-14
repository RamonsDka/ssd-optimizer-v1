"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  History,
  Layers,
  Settings,
  Cpu,
  Activity,
  Github,
  Youtube,
  LayoutGrid,
  ShieldCheck,
  BookOpen,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SOCIAL_LINKS } from "@/lib/constants/social-links";
import { ASSETS } from "@/lib/constants/asset-mapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

function NavItem({ href, icon, label }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-all duration-200 group",
        isActive
          ? "bg-primary/10 text-primary border-l-4 border-primary"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
      )}
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === "/";
  const { t } = useLanguage();

  if (isLanding) return null;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface border-r border-outline-variant/10 flex flex-col z-40 pt-14">
      <div className="px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-surface-container-highest flex items-center justify-center border-l-2 border-primary">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-on-surface">
              {t("sidebar", "architectLabel")}
            </div>
            <div className="font-mono text-[10px] text-primary/60 tracking-tighter uppercase">
              {t("sidebar", "status")}
            </div>
          </div>
        </div>

        <nav className="space-y-1 font-mono text-sm">
          <NavItem href="/optimizer" icon={<Cpu size={18} />} label={t("nav", "optimizer")} />
          <NavItem href="/history" icon={<History size={18} />} label={t("nav", "history")} />
          <NavItem href="/models" icon={<Layers size={18} />} label={t("nav", "models")} />
          <NavItem href="/settings" icon={<Settings size={18} />} label={t("nav", "settings")} />
          <NavItem href="/docs" icon={<BookOpen size={18} />} label={t("nav", "docs")} />
          <NavItem href="/profiles" icon={<UserCircle size={18} />} label={t("nav", "profiles")} />
        </nav>
      </div>

      <div className="mt-auto flex flex-col border-t border-outline-variant/10">
        {/* Social Links */}
        <div className="px-4 py-4 flex flex-col gap-2 border-b border-outline-variant/10">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/50 mb-1">
            {t("common", "links")}
          </span>
          <a
            href={SOCIAL_LINKS.projectGitHub}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-xs text-on-surface-variant hover:text-primary transition-colors group"
          >
            <Github size={14} className="group-hover:scale-110 transition-transform" />
            <span>{t("sidebar", "projectGitHub")}</span>
          </a>
          <a
            href={SOCIAL_LINKS.ramonYouTube}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-xs text-on-surface-variant hover:text-primary transition-colors group"
          >
            <Youtube size={14} className="group-hover:scale-110 transition-transform" />
            <span>@RamonsDk-Dev</span>
          </a>
          <a
            href={SOCIAL_LINKS.alanGitHub}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-xs text-on-surface-variant hover:text-secondary transition-colors group"
          >
            <Github size={14} className="group-hover:scale-110 transition-transform" />
            <span>Gentleman-Programming</span>
          </a>
          <a
            href={SOCIAL_LINKS.alanYouTube}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-xs text-on-surface-variant hover:text-secondary transition-colors group"
          >
            <Youtube size={14} className="group-hover:scale-110 transition-transform" />
            <span>@gentlemanprogramming</span>
          </a>
          <a
            href={SOCIAL_LINKS.alanDoras}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-xs text-on-surface-variant hover:text-secondary transition-colors group"
          >
            <LayoutGrid size={14} className="group-hover:scale-110 transition-transform" />
            <span>Doras / Gentleman</span>
          </a>
        </div>

        {/* User Profile — click to open profiles page */}
        <div className="p-6">
          <button
            onClick={() => router.push("/profiles")}
            title="User Profile — click to open preferences"
            className={cn(
              "w-full bg-surface-container-low p-4 flex items-center gap-3 group",
              "border border-transparent hover:border-primary/30 transition-all duration-200",
              pathname === "/profiles" && "border-primary/30 bg-primary/5"
            )}
            aria-label="Abrir Perfil de Usuario"
          >
            {/* Avatar with admin indicator overlay */}
            <div className="relative w-10 h-10 shrink-0">
              <div className="w-10 h-10 bg-surface-container-highest overflow-hidden border border-primary/20 group-hover:border-primary/60 transition-colors">
                <Image
                  src={ASSETS.adminAvatar}
                  alt="Admin Avatar"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                />
              </div>
              {/* Admin badge */}
              <span className="absolute -bottom-1 -right-1 bg-primary rounded-none w-4 h-4 flex items-center justify-center">
                <ShieldCheck size={9} className="text-surface" />
              </span>
            </div>

            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                {t("sidebar", "adminLabel")}
              </span>
              <span className="text-[10px] text-primary/70 group-hover:text-primary transition-colors">
                {t("sidebar", "adminLevel")}
              </span>
            </div>

            <Settings
              size={12}
              className="ml-auto text-on-surface-variant/30 group-hover:text-primary transition-colors shrink-0"
            />
          </button>
        </div>
      </div>
    </aside>
  );
}