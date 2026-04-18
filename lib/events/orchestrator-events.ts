// ─── OIM Orchestrator Event Emitter ──────────────────────────────────────────
// Lightweight in-process event bus that passes structured log events from the
// backend OIM processing layer up to the API route, where they can be forwarded
// to the frontend via SSE (Server-Sent Events) or collected for batch delivery.
//
// Architecture:
//   OIM service   ──emit()──▶  orchestratorEvents  ──subscribe()──▶  API route
//   API route     ──SSE──────▶  useOrchestratorStream (React hook)
//   Hook          ──events[]──▶  TerminalOverlay component
//
// This module runs exclusively in the Node.js runtime (server-side).
// It must NOT be imported in client-only modules.

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Severity / category of an orchestration log event.
 *
 *  - `info`     — General pipeline step information (phase started, model scored, etc.)
 *  - `progress` — Incremental progress update (e.g. "3 of 10 models processed")
 *  - `success`  — A sub-task completed successfully
 *  - `warning`  — Non-fatal issue detected (fallback used, low confidence, etc.)
 *  - `error`    — A recoverable error occurred during orchestration
 */
export type OrchestratorEventType =
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "error";

/**
 * A single structured event emitted by the OIM orchestration pipeline.
 */
export interface OrchestratorEvent {
  /** ISO-8601 timestamp of when this event was emitted */
  timestamp: string;
  /** Human-readable log message (plain text, no markdown) */
  message: string;
  /** Severity / category */
  type: OrchestratorEventType;
  /** Optional structured metadata (e.g. modelId, phase, score) */
  metadata?: Record<string, unknown>;
}

/**
 * Callback invoked by subscribers when a new event is emitted.
 */
export type OrchestratorEventListener = (event: OrchestratorEvent) => void;

// ─── Event Emitter ────────────────────────────────────────────────────────────

/**
 * Minimal typed event emitter for OIM orchestration events.
 *
 * Usage (server-side service):
 *   ```ts
 *   import { orchestratorEvents } from "@/lib/events/orchestrator-events";
 *
 *   orchestratorEvents.emit({ type: "info", message: "Starting OIM pipeline…" });
 *   ```
 *
 * Usage (API route / SSE handler):
 *   ```ts
 *   const unsub = orchestratorEvents.subscribe((ev) => {
 *     controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
 *   });
 *   // …on connection close:
 *   unsub();
 *   ```
 */
class OrchestratorEventEmitter {
  private readonly listeners = new Set<OrchestratorEventListener>();

  /**
   * Register a new listener.  Returns an unsubscribe function — call it when
   * the consumer (e.g. an SSE response stream) is closed.
   */
  subscribe(listener: OrchestratorEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a new event.  `timestamp` is injected automatically if not provided.
   */
  emit(
    event: Omit<OrchestratorEvent, "timestamp"> & { timestamp?: string }
  ): void {
    const full: OrchestratorEvent = {
      timestamp: event.timestamp ?? new Date().toISOString(),
      message: event.message,
      type: event.type,
      ...(event.metadata !== undefined && { metadata: event.metadata }),
    };

    for (const listener of this.listeners) {
      try {
        listener(full);
      } catch (err) {
        // Never let a subscriber crash the emitter
        console.error("[orchestratorEvents] listener threw:", err);
      }
    }
  }

  /**
   * Convenience emitters for each event type.
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.emit({ type: "info", message, ...(metadata && { metadata }) });
  }

  progress(message: string, metadata?: Record<string, unknown>): void {
    this.emit({ type: "progress", message, ...(metadata && { metadata }) });
  }

  success(message: string, metadata?: Record<string, unknown>): void {
    this.emit({ type: "success", message, ...(metadata && { metadata }) });
  }

  warning(message: string, metadata?: Record<string, unknown>): void {
    this.emit({ type: "warning", message, ...(metadata && { metadata }) });
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.emit({ type: "error", message, ...(metadata && { metadata }) });
  }

  /** Returns the current number of active subscribers (useful for debugging). */
  get listenerCount(): number {
    return this.listeners.size;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// Single shared instance for the entire Node.js process.  In development, the
// module is re-evaluated on hot-reload, so we attach the instance to `globalThis`
// to avoid creating multiple emitters across HMR cycles.

const GLOBAL_KEY = "__sdd_orchestratorEvents__" as const;

declare global {
  // eslint-disable-next-line no-var
  var __sdd_orchestratorEvents__: OrchestratorEventEmitter | undefined;
}

function getOrCreateEmitter(): OrchestratorEventEmitter {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = new OrchestratorEventEmitter();
  }
  return globalThis[GLOBAL_KEY]!;
}

/**
 * The global OIM orchestration event bus.
 *
 * Import this wherever you need to emit or listen to OIM pipeline events.
 */
export const orchestratorEvents: OrchestratorEventEmitter = getOrCreateEmitter();

// ─── SSE Formatting Helper ────────────────────────────────────────────────────

/**
 * Formats a single `OrchestratorEvent` as an SSE-compatible text chunk.
 *
 * ```
 * data: {"timestamp":"…","message":"…","type":"info"}\n\n
 * ```
 *
 * Use inside a `ReadableStream` controller or `TransformStream` to push events
 * to the browser via a `text/event-stream` response.
 */
export function formatEventAsSSE(event: OrchestratorEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
