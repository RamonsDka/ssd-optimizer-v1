// ─── OIM Service — UnifiedModelScores + ModelCapabilities CRUD ───────────────
// Provides typed read / write operations for:
//   - `unified_model_scores`  (V2/V3 scoring snapshots)
//   - `model_capabilities`    (V4 17-dimensional capability profile)
//   - `models`                (is_thinking_model flag, V4 extension)
//
// All public functions throw on unexpected DB errors; callers are responsible
// for catching and surfacing errors as needed (e.g. in API route handlers).
//
// Cache integration: ModelCapabilities queries use the in-memory score-cache
// module for TTL-based caching. The cache is OPTIONAL — if unavailable or
// evicted, queries fall back transparently to the database.

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type {
  UnifiedModelScores,
  UnifiedModelScoresData,
  UnifiedModelScoresUpsertResult,
} from "@/types";
import type { ModelCapabilitiesV4 } from "@/lib/optimizer/v4/scoring-engine-v4";
import {
  getCachedCapabilities,
  setCachedCapabilities,
  invalidateCachedCapabilities,
  invalidateCachedPhaseScores,
  TTL_CAPABILITIES_MS,
} from "@/lib/db/score-cache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps a raw Prisma `UnifiedModelScores` record to the typed domain interface.
 * `rawData` is stored as Prisma `Json` (unknown); we cast it to the expected shape.
 */
function toUnifiedModelScores(
  row: Awaited<ReturnType<typeof prisma.unifiedModelScores.findFirst>>
): UnifiedModelScores {
  if (!row) throw new Error("Unexpected null row in toUnifiedModelScores");

  return {
    id: row.id,
    modelId: row.modelId,
    source: row.source as UnifiedModelScores["source"],
    snapshotDate: row.snapshotDate,
    codingScore: row.codingScore,
    thinkingScore: row.thinkingScore,
    designScore: row.designScore,
    instructionScore: row.instructionScore,
    contextEfficiency: row.contextEfficiency,
    rawData: row.rawData as Record<string, unknown> | null,
    syncedAt: row.syncedAt,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieves the **latest** score snapshot for a given model (ordered by
 * `snapshotDate` descending). Returns `null` when no record exists yet.
 *
 * @param modelId - The canonical model identifier (e.g. "anthropic/claude-sonnet-4-5")
 */
export async function getUnifiedScores(
  modelId: string
): Promise<UnifiedModelScores | null> {
  const row = await prisma.unifiedModelScores.findFirst({
    where: { modelId },
    orderBy: { snapshotDate: "desc" },
  });

  return row ? toUnifiedModelScores(row) : null;
}

/**
 * Returns **all** score snapshots for a model, ordered newest-first.
 * Useful for trend analysis and history display.
 *
 * @param modelId - The canonical model identifier
 */
export async function getAllUnifiedScores(
  modelId: string
): Promise<UnifiedModelScores[]> {
  const rows = await prisma.unifiedModelScores.findMany({
    where: { modelId },
    orderBy: { snapshotDate: "desc" },
  });

  return rows.map(toUnifiedModelScores);
}

/**
 * Inserts or updates a score snapshot identified by the unique composite key
 * `(modelId, source, snapshotDate)`.
 *
 * - If no matching record exists → **creates** a new row.
 * - If a matching record exists → **updates** the score fields and resets `syncedAt`.
 *
 * @param data - Score payload. `id` and `syncedAt` are generated server-side.
 * @returns A summary result including whether the record was newly created.
 */
export async function upsertUnifiedScores(
  data: UnifiedModelScoresData
): Promise<UnifiedModelScoresUpsertResult> {
  const {
    modelId,
    source,
    snapshotDate,
    codingScore = null,
    thinkingScore = null,
    designScore = null,
    instructionScore = null,
    contextEfficiency = null,
    rawData = null,
  } = data;

  // Check whether the record already exists so we can report `created` correctly.
  const existing = await prisma.unifiedModelScores.findUnique({
    where: { modelId_source_snapshotDate: { modelId, source, snapshotDate } },
    select: { id: true },
  });

  // Prisma's Json? field requires the JsonNull sentinel for explicit nulls.
  // We cast rawData to InputJsonValue because Record<string, unknown> matches
  // the runtime shape but TypeScript requires the narrower Prisma type.
  const rawDataValue: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
    rawData === null
      ? Prisma.JsonNull
      : rawData != null
        ? (rawData as Prisma.InputJsonValue)
        : undefined;

  const record = await prisma.unifiedModelScores.upsert({
    where: { modelId_source_snapshotDate: { modelId, source, snapshotDate } },
    create: {
      modelId,
      source,
      snapshotDate,
      codingScore,
      thinkingScore,
      designScore,
      instructionScore,
      contextEfficiency,
      rawData: rawDataValue,
    },
    update: {
      codingScore,
      thinkingScore,
      designScore,
      instructionScore,
      contextEfficiency,
      rawData: rawDataValue,
      syncedAt: new Date(),
    },
    select: { id: true, modelId: true, source: true, snapshotDate: true },
  });

  return {
    id: record.id,
    modelId: record.modelId,
    source: record.source as UnifiedModelScores["source"],
    snapshotDate: record.snapshotDate,
    created: existing === null,
  };
}

/**
 * Deletes **all** score snapshots for the given model.
 * Intended for cleanup, re-sync, or removing a model entirely.
 *
 * @param modelId - The canonical model identifier
 * @returns The number of records deleted.
 */
export async function deleteUnifiedScores(modelId: string): Promise<number> {
  const result = await prisma.unifiedModelScores.deleteMany({
    where: { modelId },
  });

  return result.count;
}

// ─── V4: ModelCapabilities CRUD ───────────────────────────────────────────────

/**
 * Shape de los campos de las 17 dimensiones que puede actualizarse.
 * Omite los campos de metadata que se gestionan automáticamente.
 */
export type ModelCapabilitiesData = Omit<ModelCapabilitiesV4, "modelId"> & {
  dataQualityScore?: number;
  source?: "manual" | "benchmark" | "inferred";
};

/**
 * Resultado de un upsert de ModelCapabilities.
 */
export interface ModelCapabilitiesUpsertResult {
  id: string;
  modelId: string;
  created: boolean;
}

/**
 * Tipo de retorno de getAllModelsWithCapabilities.
 * Combina el modelo base con su perfil de capabilities V4 (si existe).
 */
export interface ModelWithCapabilities {
  id: string;
  name: string;
  providerId: string;
  tier: string;
  contextWindow: number;
  costPer1M: number;
  strengths: string[];
  isThinkingModel: boolean;
  capabilities: ModelCapabilitiesV4 | null;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Convierte el row de Prisma de `ModelCapabilities` al tipo de dominio V4.
 * Los defaults de 5.0 en el schema garantizan que los campos nunca sean null.
 */
function toModelCapabilitiesV4(
  row: NonNullable<
    Awaited<ReturnType<typeof prisma.modelCapabilities.findUnique>>
  >
): ModelCapabilitiesV4 {
  return {
    modelId: row.modelId,
    a1_overall_intelligence: row.a1_overall_intelligence,
    a2_reasoning_depth: row.a2_reasoning_depth,
    a3_instruction_following: row.a3_instruction_following,
    a4_hallucination_resistance: row.a4_hallucination_resistance,
    b1_coding_quality: row.b1_coding_quality,
    b2_coding_multilang: row.b2_coding_multilang,
    b3_context_window_score: row.b3_context_window_score,
    b4_context_effective_score: row.b4_context_effective_score,
    b5_tool_calling_accuracy: row.b5_tool_calling_accuracy,
    b6_agentic_reliability: row.b6_agentic_reliability,
    c1_visual_understanding: row.c1_visual_understanding,
    c2_format_adherence: row.c2_format_adherence,
    c3_long_context_coherence: row.c3_long_context_coherence,
    c4_architecture_awareness: row.c4_architecture_awareness,
    d1_speed_score: row.d1_speed_score,
    d2_cost_score: row.d2_cost_score,
    d3_availability_score: row.d3_availability_score,
  };
}

// ─── 3.1 CRUD para ModelCapabilities ─────────────────────────────────────────

/**
 * Recupera el perfil de capacidades V4 de un modelo con cache integrado (TTL 1h).
 *
 * Estrategia:
 *   1. Consulta cache en memoria → retorna inmediatamente si hay hit.
 *   2. Cache miss → consulta BD con índice `modelId` (O(log n)).
 *   3. Popula cache antes de retornar.
 *
 * Usado en el hot path del motor V4. Sin cache, cada ciclo de optimización
 * de N modelos × M fases generaría N queries duplicadas por modelo.
 *
 * @param modelId - ID canónico del modelo (e.g. "anthropic/claude-sonnet-4-5")
 * @returns El perfil de capacidades V4 o `null` si el modelo no tiene datos V4.
 */
export async function getCapabilitiesByModelId(
  modelId: string
): Promise<ModelCapabilitiesV4 | null> {
  // ── 1. Cache hit ──────────────────────────────────────────────────────────
  const cached = getCachedCapabilities(modelId);
  if (cached) {
    return cached as unknown as ModelCapabilitiesV4;
  }

  // ── 2. BD lookup (usa índice @@index([modelId])) ──────────────────────────
  const row = await prisma.modelCapabilities.findUnique({
    where: { modelId },
  });

  if (!row) {
    return null;
  }

  const capabilities = toModelCapabilitiesV4(row);

  // ── 3. Populate cache (TTL 1h por defecto) ───────────────────────────────
  setCachedCapabilities(
    modelId,
    capabilities as unknown as Record<string, unknown>,
    TTL_CAPABILITIES_MS
  );

  return capabilities;
}

/**
 * Inserta o actualiza el perfil de capacidades V4 de un modelo.
 *
 * - Si no existe → **crea** un nuevo registro.
 * - Si ya existe → **actualiza** los campos provistos y resetea `lastUpdated`.
 *
 * Invalida el cache del modelo automáticamente para evitar lecturas stale.
 *
 * @param modelId      - ID canónico del modelo
 * @param capabilities - Datos de las 17 dimensiones (parcial o completo)
 * @returns Resultado del upsert indicando si se creó un registro nuevo.
 */
export async function upsertModelCapabilities(
  modelId: string,
  capabilities: Partial<ModelCapabilitiesData>
): Promise<ModelCapabilitiesUpsertResult> {
  // Check existence para reportar `created` correctamente
  const existing = await prisma.modelCapabilities.findUnique({
    where: { modelId },
    select: { id: true },
  });

  const {
    dataQualityScore,
    source,
    ...dimensionFields
  } = capabilities;

  const record = await prisma.modelCapabilities.upsert({
    where: { modelId },
    create: {
      modelId,
      ...dimensionFields,
      ...(dataQualityScore !== undefined && { dataQualityScore }),
      ...(source !== undefined && { source }),
    },
    update: {
      ...dimensionFields,
      ...(dataQualityScore !== undefined && { dataQualityScore }),
      ...(source !== undefined && { source }),
      // `lastUpdated` se actualiza automáticamente vía @updatedAt
    },
    select: { id: true, modelId: true },
  });

  // Invalidar cache tras escritura para mantener coherencia
  invalidateCachedCapabilities(modelId);
  invalidateCachedPhaseScores(modelId);

  return {
    id: record.id,
    modelId: record.modelId,
    created: existing === null,
  };
}

/**
 * Retorna todos los modelos con su perfil de capacidades V4 (eager loading).
 *
 * Hace un JOIN entre `models` y `model_capabilities` para evitar N+1 queries
 * en el ciclo de optimización cuando se carga el pool completo de modelos.
 *
 * Usar esta función en lugar de cargar modelos y luego capabilities por separado.
 *
 * @returns Array de modelos con su capabilities V4 o `null` si no tienen datos V4.
 */
export async function getAllModelsWithCapabilities(): Promise<
  ModelWithCapabilities[]
> {
  const rows = await prisma.model.findMany({
    include: {
      capabilities: true,
    },
    orderBy: { id: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    providerId: row.providerId,
    tier: row.tier,
    contextWindow: row.contextWindow,
    costPer1M: row.costPer1M,
    strengths: row.strengths,
    isThinkingModel: row.isThinkingModel,
    capabilities: row.capabilities
      ? toModelCapabilitiesV4(row.capabilities)
      : null,
  }));
}

/**
 * Actualiza únicamente el flag `isThinkingModel` en la tabla `models`.
 *
 * Este flag es consumido por las reglas especiales del motor V4
 * (exclusión de thinking models en `tasks`/`archive`, bonus en `propose`/`verify`).
 *
 * Invalida el cache del modelo para que la próxima lectura refleje el cambio.
 *
 * @param modelId     - ID canónico del modelo
 * @param isThinking  - Nuevo valor del flag
 */
export async function updateIsThinkingModel(
  modelId: string,
  isThinking: boolean
): Promise<void> {
  await prisma.model.update({
    where: { id: modelId },
    data: { isThinkingModel: isThinking },
  });

  // El flag afecta las reglas especiales → invalidar phase scores cacheados
  invalidateCachedPhaseScores(modelId);
}

// ─── 3.3 Persistir resultados de benchmarks ───────────────────────────────────

/**
 * Datos de un benchmark externo listos para persistir en ModelCapabilities.
 * El campo `source` identifica la procedencia para auditoría.
 */
export interface ModelScoresUpdateData {
  /** Dimensiones a actualizar (parcial — solo las disponibles en el benchmark) */
  dimensions: Partial<Omit<ModelCapabilitiesV4, "modelId">>;
  /** Origen de los datos (para trazabilidad) */
  source: "manual" | "benchmark" | "inferred";
  /** Confianza en la calidad de los datos (0.0-1.0) */
  dataQualityScore?: number;
}

/**
 * Persiste los resultados de un benchmark en el perfil de capacidades V4.
 *
 * Diseñado para ser llamado por scripts de ingestión de datos (e.g. migración
 * de V3 a V4, sync de ArtificialAnalysis, etc.). Hace un upsert para que el
 * primer benchmark en correr cree el registro y los siguientes lo actualicen.
 *
 * Invalida cache automáticamente.
 *
 * @param modelId - ID canónico del modelo
 * @param data    - Datos del benchmark con dimensions, source y calidad
 * @returns Resultado del upsert
 */
export async function updateModelScores(
  modelId: string,
  data: ModelScoresUpdateData
): Promise<ModelCapabilitiesUpsertResult> {
  return upsertModelCapabilities(modelId, {
    ...data.dimensions,
    source: data.source,
    ...(data.dataQualityScore !== undefined && {
      dataQualityScore: data.dataQualityScore,
    }),
  });
}

/**
 * Recupera el perfil de capacidades directamente desde la BD (sin cache).
 *
 * Usar en contextos de escritura donde se necesita el estado más reciente
 * (e.g. verificar datos tras un upsert, comparar versiones, debugging).
 *
 * @param modelId - ID canónico del modelo
 * @returns El perfil V4 fresco desde BD o `null` si no existe.
 */
export async function getModelCapabilitiesFresh(
  modelId: string
): Promise<ModelCapabilitiesV4 | null> {
  const row = await prisma.modelCapabilities.findUnique({
    where: { modelId },
  });

  return row ? toModelCapabilitiesV4(row) : null;
}

/**
 * Elimina el perfil de capacidades V4 de un modelo.
 * Usado en tests y scripts de reset de datos.
 *
 * @param modelId - ID canónico del modelo
 */
export async function deleteModelCapabilities(modelId: string): Promise<void> {
  await prisma.modelCapabilities.delete({
    where: { modelId },
  });

  invalidateCachedCapabilities(modelId);
  invalidateCachedPhaseScores(modelId);
}
