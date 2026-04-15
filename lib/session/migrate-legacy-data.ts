// lib/session/migrate-legacy-data.ts
// Migración de datos existentes de localStorage a formato con session ID

import { getOrCreateSessionId } from './session-manager';

/**
 * Migra datos existentes en localStorage al nuevo formato con session ID.
 * 
 * Esto se ejecuta una sola vez cuando el usuario carga la app por primera vez
 * después de actualizar a V2.
 * 
 * Ejemplo:
 * - Antes: localStorage.getItem('optimizer_result')
 * - Después: localStorage.getItem('abc123:optimizer_result')
 */
export function migrateLegacyData(): void {
  if (typeof window === 'undefined') return;

  // Verificar si ya se migró
  const migrationCompleted = localStorage.getItem('migration_v2_completed');
  if (migrationCompleted === 'true') {
    console.log('[Migration] Ya se ejecutó la migración anteriormente');
    return;
  }

  console.log('[Migration] Iniciando migración de datos...');

  const sessionId = getOrCreateSessionId();
  let migratedCount = 0;

  // Lista de keys a migrar
  const keysToMigrate = [
    'optimizer_result',
    'optimizer_history',
    'user_preferences',
    'view_mode',
    'language',
    'theme',
    'advanced_options',
    'custom_sdd_phases',
  ];

  for (const key of keysToMigrate) {
    const oldData = localStorage.getItem(key);
    
    if (oldData) {
      // Mover a nuevo formato con session ID
      const newKey = `${sessionId}:${key}`;
      localStorage.setItem(newKey, oldData);
      
      // Eliminar viejo
      localStorage.removeItem(key);
      
      migratedCount++;
      console.log(`[Migration] Migrado: ${key} → ${newKey}`);
    }
  }

  // Marcar migración como completada
  localStorage.setItem('migration_v2_completed', 'true');

  console.log(`[Migration] Completada. ${migratedCount} keys migradas.`);
}

/**
 * Fuerza una re-migración (útil para testing).
 * ⚠️ CUIDADO: Esto puede causar pérdida de datos si se ejecuta en producción.
 */
export function resetMigration(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('migration_v2_completed');
  console.log('[Migration] Flag de migración eliminado');
}
