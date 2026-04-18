// ─── Score Cache — In-Memory TTL Cache para V4 ───────────────────────────────
//
// Cache en memoria con TTL para scores del motor V4.
// Diseñado para evitar queries redundantes a BD en el mismo ciclo de optimización.
//
// TTLs:
//   - ModelCapabilities (perfil de capacidades): 1h  (se actualizan raramente)
//   - PhaseScores calculados: 24h                    (scores operacionales)
//   - Scores de benchmarks: 7d                       (datos de fuentes externas)
//
// El cache degrada de forma transparente: si no hay entrada, retorna null
// y el caller debe resolver desde BD (no hay error, solo miss).
//
// Thread-safety: Node.js es single-threaded, por lo que un Map es suficiente.

// ─── TTL Constants ────────────────────────────────────────────────────────────

/** 1 hora en milisegundos — para ModelCapabilities (perfil completo del modelo) */
export const TTL_CAPABILITIES_MS = 60 * 60 * 1_000;

/** 24 horas en milisegundos — para phase scores calculados (operacionales) */
export const TTL_PHASE_SCORE_MS = 24 * 60 * 60 * 1_000;

/** 7 días en milisegundos — para scores provenientes de benchmarks externos */
export const TTL_BENCHMARK_SCORE_MS = 7 * 24 * 60 * 60 * 1_000;

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Entrada genérica del cache con TTL y timestamp */
interface CacheEntry<T> {
  value: T;
  /** Timestamp de inserción (Date.now()) */
  insertedAt: number;
  /** Milisegundos de vida útil desde `insertedAt` */
  ttlMs: number;
}

// ─── Cache Stores ─────────────────────────────────────────────────────────────

/**
 * Cache para perfiles completos de ModelCapabilities.
 * Clave: `modelId`
 */
const capabilitiesCache = new Map<string, CacheEntry<Record<string, unknown>>>();

/**
 * Cache para scores de fases (calculados por el motor V4).
 * Clave: `{modelId}:{phase}:{profileId}`
 */
const phaseScoreCache = new Map<string, CacheEntry<number>>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna true si la entrada está vigente (no ha expirado). */
function isAlive<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.insertedAt < entry.ttlMs;
}

/** Elimina todas las entradas expiradas de un Map. */
function evictExpired<K, T>(store: Map<K, CacheEntry<T>>): void {
  for (const [key, entry] of store) {
    if (!isAlive(entry)) {
      store.delete(key);
    }
  }
}

// ─── API Pública: ModelCapabilities Cache ────────────────────────────────────

/**
 * Recupera el perfil de capacidades cacheado para un modelo.
 *
 * @param modelId - ID canónico del modelo (e.g. "anthropic/claude-sonnet-4-5")
 * @returns El perfil cacheado o `null` si no existe / expiró.
 */
export function getCachedCapabilities(
  modelId: string
): Record<string, unknown> | null {
  const entry = capabilitiesCache.get(modelId);
  if (!entry || !isAlive(entry)) {
    capabilitiesCache.delete(modelId);
    return null;
  }
  return entry.value;
}

/**
 * Almacena el perfil de capacidades de un modelo en cache.
 *
 * @param modelId      - ID canónico del modelo
 * @param capabilities - Objeto con las 17 dimensiones (cualquier shape Record)
 * @param ttlMs        - TTL en ms. Por defecto: TTL_CAPABILITIES_MS (1h)
 */
export function setCachedCapabilities(
  modelId: string,
  capabilities: Record<string, unknown>,
  ttlMs: number = TTL_CAPABILITIES_MS
): void {
  capabilitiesCache.set(modelId, {
    value: capabilities,
    insertedAt: Date.now(),
    ttlMs,
  });
}

/**
 * Invalida la entrada de cache para un modelo específico.
 * Debe llamarse después de un `upsert` en BD para mantener coherencia.
 *
 * @param modelId - ID canónico del modelo
 */
export function invalidateCachedCapabilities(modelId: string): void {
  capabilitiesCache.delete(modelId);
}

// ─── API Pública: Phase Score Cache ──────────────────────────────────────────

/**
 * Construye la clave del cache de score de fase.
 * Formato: `{modelId}:{phase}:{profileId}`
 */
function phaseScoreKey(modelId: string, phase: string, profileId: string): string {
  return `${modelId}:${phase}:${profileId}`;
}

/**
 * Recupera un score de fase cacheado.
 *
 * @param modelId   - ID canónico del modelo
 * @param phase     - Fase SDD (e.g. "sdd-propose")
 * @param profileId - ID del perfil de usuario (e.g. "premium", "mixto", "free")
 * @returns El score cacheado (0.0-10.0) o `null` si no existe / expiró.
 */
export function getCachedPhaseScore(
  modelId: string,
  phase: string,
  profileId: string
): number | null {
  const key = phaseScoreKey(modelId, phase, profileId);
  const entry = phaseScoreCache.get(key);
  if (!entry || !isAlive(entry)) {
    phaseScoreCache.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Almacena un score de fase calculado en cache.
 *
 * @param modelId   - ID canónico del modelo
 * @param phase     - Fase SDD
 * @param profileId - ID del perfil de usuario
 * @param score     - Score calculado (0.0-10.0)
 * @param ttlMs     - TTL en ms. Por defecto: TTL_PHASE_SCORE_MS (24h)
 */
export function setCachedPhaseScore(
  modelId: string,
  phase: string,
  profileId: string,
  score: number,
  ttlMs: number = TTL_PHASE_SCORE_MS
): void {
  const key = phaseScoreKey(modelId, phase, profileId);
  phaseScoreCache.set(key, {
    value: score,
    insertedAt: Date.now(),
    ttlMs,
  });
}

/**
 * Invalida todos los scores de fase cacheados para un modelo.
 * Llamar tras actualizar capacidades para evitar datos stale.
 *
 * @param modelId - ID canónico del modelo
 */
export function invalidateCachedPhaseScores(modelId: string): void {
  for (const key of phaseScoreCache.keys()) {
    if (key.startsWith(`${modelId}:`)) {
      phaseScoreCache.delete(key);
    }
  }
}

// ─── Gestión del Cache ────────────────────────────────────────────────────────

/** Estadísticas del estado actual del cache (útil para debugging y monitoring). */
export interface CacheStats {
  capabilitiesEntries: number;
  phaseScoreEntries: number;
  /** Entradas de capabilities que aún están vigentes */
  capabilitiesAlive: number;
  /** Entradas de phase scores que aún están vigentes */
  phaseScoresAlive: number;
}

/**
 * Retorna estadísticas del estado actual del cache.
 * No tiene efecto secundario (read-only).
 */
export function getCacheStats(): CacheStats {
  let capabilitiesAlive = 0;
  for (const entry of capabilitiesCache.values()) {
    if (isAlive(entry)) capabilitiesAlive++;
  }

  let phaseScoresAlive = 0;
  for (const entry of phaseScoreCache.values()) {
    if (isAlive(entry)) phaseScoresAlive++;
  }

  return {
    capabilitiesEntries: capabilitiesCache.size,
    phaseScoreEntries: phaseScoreCache.size,
    capabilitiesAlive,
    phaseScoresAlive,
  };
}

/**
 * Evicta proactivamente todas las entradas expiradas de ambos caches.
 * En producción puede llamarse periódicamente (e.g. cada hora) para liberar memoria.
 * El cache es correctamente pequeño para las dimensiones del proyecto.
 */
export function evictAllExpired(): void {
  evictExpired(capabilitiesCache);
  evictExpired(phaseScoreCache);
}

/**
 * Vacía completamente ambos caches.
 * Útil en tests o al recargar la configuración del servidor.
 */
export function clearAllCaches(): void {
  capabilitiesCache.clear();
  phaseScoreCache.clear();
}
