import type { RecreateQueryPayload } from "@/types";

const RECREATE_QUERY_KEY = "sdd_optimizer_recreate_query";

export function saveRecreateQueryPayload(payload: RecreateQueryPayload): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RECREATE_QUERY_KEY, JSON.stringify(payload));
}

export function readRecreateQueryPayload(): RecreateQueryPayload | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(RECREATE_QUERY_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as RecreateQueryPayload;
  } catch {
    return null;
  }
}

export function clearRecreateQueryPayload(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RECREATE_QUERY_KEY);
}
