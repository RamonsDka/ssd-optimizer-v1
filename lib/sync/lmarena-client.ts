// ─── LM Arena Client ──────────────────────────────────────────────────────────
// Fetches leaderboard data from Hugging Face dataset: lmarena-ai/leaderboard-dataset
// with retry logic, timeout handling, and in-memory caching.
//
// The dataset contains historical snapshots with leaderboard_publish_date per row.
// Each row represents a model's score in a category at a specific publish date.
//
// Usage:
//   import { fetchLeaderboard, fetchAllCategories } from "@/lib/sync/lmarena-client";
//
//   const codingData = await fetchLeaderboard("coding");
//   const allData = await fetchAllCategories();

// ─── Constants ────────────────────────────────────────────────────────────────

const HF_DATASET_URL = "https://datasets-server.huggingface.co/rows";
const HF_DATASET_NAME = "lmarena-ai/leaderboard-dataset";
const HF_DATASET_CONFIG = "text_style_control";
const HF_DATASET_SPLIT = "latest";
const REQUEST_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [1000, 2000, 4000]; // exponential backoff for 5xx
const RETRY_DELAYS_429_MS = [2000, 5000, 10000, 20000, 40000]; // aggressive backoff for rate limits
const PAGE_DELAY_MS = 500; // pause between successful pages to reduce throttling
const PAGE_SIZE = 100; // HF datasets-server page size

/**
 * Complete list of LM Arena categories as of 2026.
 * These slugs are used in API requests and database IDs.
 */
export const LMARENA_CATEGORIES = [
  "overall",
  "coding",
  "instruction-following",
  "long-context",
  "hard-prompts",
  "creative-writing",
  "math",
  "reasoning",
  "multilingual",
  "safety",
  "function-calling",
  "structured-output",
  "vision",
  "multimodal",
  "speed",
  "cost-efficiency",
  "context-window",
  "tool-use",
  "agent-tasks",
  "summarization",
  "translation",
  "question-answering",
  "dialogue",
  "roleplay",
  "analysis",
  "research",
  "planning",
] as const;

export type LMArenaCategory = (typeof LMARENA_CATEGORIES)[number];

// ─── API Response Types ───────────────────────────────────────────────────────

export interface LMArenaModelEntry {
  model: string; // e.g. "claude-sonnet-4-5"
  rank: number | null;
  score: number;
  votes: number | null;
  ci: string | null; // confidence interval e.g. "+5/-5"
  license: string | null; // e.g. "proprietary", "apache-2.0"
  organization: string | null; // e.g. "Anthropic"
  leaderboardPublishDate: string; // ISO date from dataset
}

export interface LMArenaLeaderboardResponse {
  category: string;
  lastUpdated: string; // ISO timestamp (most recent leaderboardPublishDate)
  models: LMArenaModelEntry[];
}

// ─── Hugging Face Dataset Types ──────────────────────────────────────────────

interface HFDatasetRow {
  row: {
    model_name?: string;
    organization?: string;
    license?: string;
    rating?: number;
    rating_lower?: number;
    rating_upper?: number;
    variance?: number;
    vote_count?: number;
    rank?: number;
    category?: string;
    leaderboard_publish_date?: string; // ISO date
    [key: string]: unknown;
  };
}

interface HFDatasetResponse {
  rows: HFDatasetRow[];
  truncated?: boolean;
  num_rows_total?: number;
  num_rows_per_page?: number;
}

// ─── Cache Implementation ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const leaderboardCache = new InMemoryCache<LMArenaLeaderboardResponse>();
const datasetRowsCache = new InMemoryCache<HFDatasetRow[]>();

// ─── Retry Logic ──────────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout support.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SDD-Team-Optimizer/1.0",
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch with exponential backoff retry.
 * Retries on network errors, 5xx server errors, and 429 rate limits.
 * Respects Retry-After header for 429 responses.
 */
async function fetchWithRetry(
  url: string,
  timeoutMs: number,
  maxRetries: number
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);

      // Retry on 429 rate limit with aggressive backoff
      if (response.status === 429 && attempt < maxRetries) {
        lastError = new Error(
          `Rate limit exceeded (429 Too Many Requests)`
        );

        // Check for Retry-After header (can be seconds or HTTP date)
        const retryAfter = response.headers.get("Retry-After");
        let delay: number;

        if (retryAfter) {
          // Try parsing as seconds first
          const retrySeconds = parseInt(retryAfter, 10);
          if (!isNaN(retrySeconds)) {
            delay = retrySeconds * 1000;
          } else {
            // Try parsing as HTTP date
            const retryDate = new Date(retryAfter);
            if (!isNaN(retryDate.getTime())) {
              delay = Math.max(0, retryDate.getTime() - Date.now());
            } else {
              // Fallback to exponential backoff
              delay = RETRY_DELAYS_429_MS[attempt] ?? RETRY_DELAYS_429_MS[RETRY_DELAYS_429_MS.length - 1];
            }
          }
        } else {
          // No Retry-After header, use aggressive exponential backoff
          delay = RETRY_DELAYS_429_MS[attempt] ?? RETRY_DELAYS_429_MS[RETRY_DELAYS_429_MS.length - 1];
        }

        console.warn(
          `[lmarena-client] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }

      // Retry on 5xx server errors
      if (response.status >= 500 && attempt < maxRetries) {
        lastError = new Error(
          `Server error ${response.status} ${response.statusText}`
        );
        const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        console.warn(
          `[lmarena-client] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }

      // Return response for caller to handle (including other 4xx errors)
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Retry on network errors (timeout, connection refused, etc.)
      if (attempt < maxRetries) {
        const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        console.warn(
          `[lmarena-client] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Failed after ${maxRetries + 1} attempts: ${lastError?.message ?? "Unknown error"}`
  );
}

// ─── Dataset fetching helpers ─────────────────────────────────────────────────

/**
 * Fetch all rows from the HF dataset with pagination.
 * Continues fetching until all rows are retrieved.
 * Results are cached to avoid re-fetching the entire dataset.
 */
async function fetchAllDatasetRows(): Promise<HFDatasetRow[]> {
  // Check cache first
  const cacheKey = "dataset:all-rows";
  const cached = datasetRowsCache.get(cacheKey);
  if (cached) {
    console.log(`[lmarena-client] Using cached dataset rows (${cached.length} rows)`);
    return cached;
  }

  const allRows: HFDatasetRow[] = [];
  let offset = 0;
  let hasMore = true;

  console.log(`[lmarena-client] Fetching all rows from HF dataset...`);

  while (hasMore) {
    const url = `${HF_DATASET_URL}?dataset=${HF_DATASET_NAME}&config=${HF_DATASET_CONFIG}&split=${HF_DATASET_SPLIT}&offset=${offset}&length=${PAGE_SIZE}`;

    try {
      const response = await fetchWithRetry(url, REQUEST_TIMEOUT_MS, MAX_RETRIES);

      if (!response.ok) {
        throw new Error(
          `Hugging Face API returned ${response.status} ${response.statusText} for dataset: ${HF_DATASET_NAME}`
        );
      }

      const hfData = (await response.json()) as HFDatasetResponse;

      // Validate response shape
      if (!hfData || !Array.isArray(hfData.rows)) {
        throw new Error("Invalid HF response: missing or invalid 'rows' array");
      }

      allRows.push(...hfData.rows);
      
      // Enhanced progress logging
      const totalEstimate = hfData.num_rows_total ?? "unknown";
      console.log(
        `[lmarena-client] Fetched ${hfData.rows.length} rows at offset ${offset} (total so far: ${allRows.length}/${totalEstimate})`
      );

      // Check if there are more rows to fetch
      if (hfData.rows.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
        
        // Pause between pages to reduce throttling risk
        if (hasMore) {
          console.log(`[lmarena-client] Pausing ${PAGE_DELAY_MS}ms before next page...`);
          await sleep(PAGE_DELAY_MS);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[lmarena-client] Failed to fetch rows at offset ${offset}: ${message}`);
      throw new Error(`Failed to fetch dataset rows at offset ${offset}: ${message}`);
    }
  }

  console.log(`[lmarena-client] Total rows fetched: ${allRows.length}`);
  
  // Cache the result
  datasetRowsCache.set(cacheKey, allRows, CACHE_TTL_MS);
  
  return allRows;
}

/**
 * Transform HF dataset row to our model entry format.
 */
function transformRowToModelEntry(row: HFDatasetRow["row"]): LMArenaModelEntry | null {
  // Skip rows with missing required fields
  if (!row.model_name || row.rating === undefined || !row.leaderboard_publish_date) {
    return null;
  }

  // Calculate CI string from rating bounds if available
  let ci: string | null = null;
  if (row.rating_lower !== undefined && row.rating_upper !== undefined && row.rating !== undefined) {
    const lower = Math.round(row.rating - row.rating_lower);
    const upper = Math.round(row.rating_upper - row.rating);
    ci = `+${upper}/-${lower}`;
  }

  return {
    model: row.model_name,
    rank: row.rank ?? null,
    score: row.rating,
    votes: row.vote_count ?? null,
    ci,
    license: row.license ?? null,
    organization: row.organization ?? null,
    leaderboardPublishDate: row.leaderboard_publish_date,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch leaderboard data for a specific category from Hugging Face dataset.
 * Results are cached in memory for 5 minutes.
 *
 * @param category  LM Arena category slug (e.g. "coding", "long-context")
 * @returns         Leaderboard data with model rankings and scores
 * @throws          Error if the request fails after retries or returns invalid data
 */
export async function fetchLeaderboard(
  category: string
): Promise<LMArenaLeaderboardResponse> {
  // Check cache first
  const cacheKey = `leaderboard:${category}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached) {
    console.log(`[lmarena-client] Cache hit for category: ${category}`);
    return cached;
  }

  console.log(`[lmarena-client] Fetching leaderboard for category: ${category} from HF dataset`);

  try {
    // Fetch all rows from dataset
    const allRows = await fetchAllDatasetRows();

    // Filter rows by category and transform to our format
    const models: LMArenaModelEntry[] = [];
    let mostRecentDate = "";

    for (const item of allRows) {
      const row = item.row;
      
      // Skip rows that don't match the requested category
      if (row.category !== category) continue;

      const entry = transformRowToModelEntry(row);
      if (!entry) {
        console.warn(`[lmarena-client] Skipping incomplete row for category ${category}`);
        continue;
      }

      models.push(entry);

      // Track most recent publish date
      if (entry.leaderboardPublishDate > mostRecentDate) {
        mostRecentDate = entry.leaderboardPublishDate;
      }
    }

    const data: LMArenaLeaderboardResponse = {
      category,
      lastUpdated: mostRecentDate || new Date().toISOString(),
      models,
    };

    // Cache the result
    leaderboardCache.set(cacheKey, data, CACHE_TTL_MS);

    console.log(
      `[lmarena-client] Successfully fetched ${data.models.length} models for category: ${category}`
    );

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lmarena-client] Failed to fetch category ${category}: ${message}`);
    throw new Error(`Failed to fetch leaderboard for ${category}: ${message}`);
  }
}

/**
 * Fetch leaderboard data for all known categories.
 * Fetches the dataset once and derives all categories from it.
 * Failed categories are logged but don't stop the entire operation.
 *
 * @returns  Map of category slug to leaderboard data (only successful fetches)
 */
export async function fetchAllCategories(): Promise<
  Map<string, LMArenaLeaderboardResponse>
> {
  console.log(
    `[lmarena-client] Fetching all categories from HF dataset...`
  );

  const results = new Map<string, LMArenaLeaderboardResponse>();
  const errors: Array<{ category: string; error: string }> = [];

  try {
    // Fetch all rows once
    const allRows = await fetchAllDatasetRows();

    // Group rows by category
    const rowsByCategory = new Map<string, HFDatasetRow[]>();
    for (const row of allRows) {
      const category = row.row.category;
      if (!category) continue;

      if (!rowsByCategory.has(category)) {
        rowsByCategory.set(category, []);
      }
      rowsByCategory.get(category)!.push(row);
    }

    console.log(`[lmarena-client] Found ${rowsByCategory.size} categories in dataset`);

    // Process each category
    rowsByCategory.forEach((rows, category) => {
      try {
        const models: LMArenaModelEntry[] = [];
        let mostRecentDate = "";

        for (const item of rows) {
          const entry = transformRowToModelEntry(item.row);
          if (!entry) {
            console.warn(`[lmarena-client] Skipping incomplete row for category ${category}`);
            continue;
          }

          models.push(entry);

          // Track most recent publish date
          if (entry.leaderboardPublishDate > mostRecentDate) {
            mostRecentDate = entry.leaderboardPublishDate;
          }
        }

        const data: LMArenaLeaderboardResponse = {
          category,
          lastUpdated: mostRecentDate || new Date().toISOString(),
          models,
        };

        // Cache the result
        const cacheKey = `leaderboard:${category}`;
        leaderboardCache.set(cacheKey, data, CACHE_TTL_MS);

        results.set(category, data);
        console.log(`[lmarena-client] Processed category ${category}: ${models.length} models`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ category, error: message });
        console.error(
          `[lmarena-client] Skipping category ${category} due to error: ${message}`
        );
      }
    });

    console.log(
      `[lmarena-client] Completed: ${results.size} successful, ${errors.length} failed`
    );

    if (errors.length > 0) {
      console.warn(
        `[lmarena-client] Failed categories: ${errors.map((e) => e.category).join(", ")}`
      );
    }

    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lmarena-client] Failed to fetch all categories: ${message}`);
    throw new Error(`Failed to fetch all categories: ${message}`);
  }
}

/**
 * Clear the in-memory cache.
 * Useful for testing or forcing fresh data.
 */
export function clearCache(): void {
  leaderboardCache.clear();
  datasetRowsCache.clear();
  console.log("[lmarena-client] Cache cleared");
}

/**
 * Check if a category is valid.
 */
export function isValidCategory(category: string): category is LMArenaCategory {
  return LMARENA_CATEGORIES.includes(category as LMArenaCategory);
}
