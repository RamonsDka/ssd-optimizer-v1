// ─── Asset Mapping ────────────────────────────────────────────────────────────
// Maps friendly asset names to their Next.js /public paths.
// All images use local /public/ paths — no external picsum URLs.
// Import from here instead of hardcoding image paths.

export const ASSETS = {
  // ─── Local assets (in /public/) ──────────────────────────────────────────
  panel: "/panel.jpeg" as const,
  mia: "/mia.jpeg" as const,
  profile: "/yo.jpeg" as const,
  plataforma: "/plataforma.jpg" as const,
  autor: "/autor.jpg" as const,
  icono: "/icono.png" as const,

  // ─── Semantic aliases (map to local assets) ────────────────────────────────
  landingBg: "/panel.jpeg" as const,
  banner: "/plataforma.jpg" as const,
  authorAvatar: "/autor.jpg" as const,
  adminAvatar: "/yo.jpeg" as const,
  profileAvatar: "/yo.jpeg" as const,
} as const;

export type AssetKey = keyof typeof ASSETS;