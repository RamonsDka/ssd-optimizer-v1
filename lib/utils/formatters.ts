// ─── Formatters ───────────────────────────────────────────────────────────────
// Utility functions for sanitizing and formatting display text.
// Always import from here — never do inline string manipulation in components.

/**
 * Removes underscores, replaces them with spaces, and capitalizes each word.
 * Useful for converting snake_case or kebab-case identifiers into human-readable labels.
 *
 * @example
 * sanitizeLabel("sdd_explore")    // → "Sdd Explore"
 * sanitizeLabel("sdd-apply")      // → "Sdd Apply"
 * sanitizeLabel("MODEL_CONTEXT")  // → "Model Context"
 * sanitizeLabel("  hello_world ") // → "Hello World"
 */
export function sanitizeLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")           // underscores & hyphens → spaces
    .replace(/\s+/g, " ")             // collapse multiple spaces
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase()); // capitalize each word
}

/**
 * Removes ONLY underscores (replaces with space) without changing casing.
 * Use when the original casing must be preserved.
 *
 * @example
 * removeUnderscores("CLEAR_HISTORY") // → "CLEAR HISTORY"
 */
export function removeUnderscores(value: string): string {
  return value.replace(/_/g, " ");
}

/**
 * Formats a number of milliseconds into a human-readable duration string.
 *
 * @example
 * formatDuration(2340)   // → "2.3s"
 * formatDuration(65000)  // → "1m 5s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${(ms / 1000).toFixed(1)}s`;
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
