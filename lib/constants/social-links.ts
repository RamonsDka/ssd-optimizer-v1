// ─── Social Links ─────────────────────────────────────────────────────────────
// Centralized real URLs for GitHub, YouTube, and Gentleman Programming.
// Always import from here — never hardcode URLs in components.

export const SOCIAL_LINKS = {
  /** Ramon's YouTube channel */
  ramonYouTube: "https://www.youtube.com/@RamonsDk-Dev",

  /** Ramon's project repository */
  projectGitHub: "https://github.com/RamonsDka/ssd-optimizer-v1",

  /** Gentleman Programming — GitHub profile */
  alanGitHub: "https://github.com/Gentleman-Programming",

  /** Gentleman Programming — YouTube channel */
  alanYouTube: "https://www.youtube.com/@gentlemanprogramming",

  /** Gentleman Programming — Doras link aggregator */
  alanDoras: "https://doras.to/gentleman-programming",
} as const;

export type SocialLinkKey = keyof typeof SOCIAL_LINKS;
