// lib/session/session-manager.ts
// Session Manager - Aislamiento de sesiones por navegador usando cookies

import { v4 as uuidv4 } from 'uuid';

/**
 * Obtiene o crea un Session ID único para este navegador.
 * El ID se guarda en una cookie con duración de 30 días.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    // Server-side: no hay cookies, retornar ID temporal
    return 'server-session';
  }

  // 1. Buscar en cookie existente
  let sessionId = getCookie('sdd_session_id');

  if (!sessionId) {
    // 2. Generar nuevo UUID
    sessionId = uuidv4();

    // 3. Guardar en cookie (30 días)
    setCookie('sdd_session_id', sessionId, 30);

    console.log('[SessionManager] Nueva sesión creada:', sessionId);
  }

  return sessionId;
}

/**
 * Genera una key de localStorage con prefijo de session ID.
 * Esto asegura que cada navegador tenga su propio espacio de datos.
 * 
 * @param key - Key original (ej: 'optimizer_result')
 * @returns Key con prefijo de session (ej: 'abc123:optimizer_result')
 */
export function getSessionKey(key: string): string {
  const sessionId = getOrCreateSessionId();
  return `${sessionId}:${key}`;
}

/**
 * Obtiene el valor de una cookie por nombre.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const nameEQ = name + '=';
  const cookies = document.cookie.split(';');

  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1, cookie.length);
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length, cookie.length);
    }
  }

  return null;
}

/**
 * Guarda una cookie con nombre, valor y días de expiración.
 */
export function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;

  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }

  document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
}

/**
 * Elimina una cookie por nombre.
 */
export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

/**
 * Limpia la sesión actual (útil para testing o logout).
 */
export function clearSession(): void {
  deleteCookie('sdd_session_id');
  console.log('[SessionManager] Sesión eliminada');
}
