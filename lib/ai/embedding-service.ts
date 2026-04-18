// ─── Embedding Service — all-mpnet-base-v2 ────────────────────────────────
// Runs ONLY in Node.js (Next.js API routes / server-side).
// Uses @xenova/transformers with in-memory model cache.
// The pipeline is loaded once and reused across calls.
//
// When the ONNX model is unavailable (production, missing native bindings),
// `categorizeModel()` automatically falls back to the LLM-based categorizer
// in `lib/ai/llm-categorizer.ts` which uses the Gemini API.

// @xenova/transformers ships as ESM-only. The pipeline function returns a
// FeatureExtractionPipeline when called with "feature-extraction".
// We import with `await import()` inside loadModel() to keep module-level
// side-effects out of the browser bundle.

// ─── Types ─────────────────────────────────────────────────────────────────

/** Raw tensor-like output returned by @xenova/transformers */
interface TransformersTensor {
  data: Float32Array | number[];
  dims: number[];
  size: number;
  mean(dim?: number, keepdim?: boolean): TransformersTensor;
  squeeze(dim?: number): TransformersTensor;
  tolist(): number[] | number[][];
}

/** Minimal shape of a FeatureExtractionPipeline instance */
interface FeatureExtractionPipeline {
  (
    input: string | string[],
    options?: { pooling?: "mean" | "cls" | "none"; normalize?: boolean }
  ): Promise<TransformersTensor>;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MODEL_ID = "Xenova/all-mpnet-base-v2";
const EMBEDDING_DIM = 768; // all-mpnet-base-v2 output dimension

// ─── In-memory cache ────────────────────────────────────────────────────────

/**
 * Module-level singleton.  In Next.js API routes this lives in the Node.js
 * process for the lifetime of the server, so the heavy ONNX model is loaded
 * only once even across many requests.
 */
let _pipeline: FeatureExtractionPipeline | null = null;
let _loadingPromise: Promise<FeatureExtractionPipeline | null> | null = null;

/**
 * Set to `true` when ONNX/OrtRuntime initialization fails.
 * Once failed, subsequent calls to `loadModel()` return `null` immediately
 * instead of retrying and crashing the process.
 */
let _initFailed = process.env.NODE_ENV === 'production';

/**
 * Returns `true` when the embedding model loaded successfully and is ready
 * for inference.  Returns `false` when ONNX initialization failed or when
 * the model has not yet been loaded (cold start).
 *
 * Call this before `embed()` / `embedBatch()` / `categorizeModel()` when you
 * want to degrade gracefully instead of propagating errors.
 */
export function isEmbeddingServiceAvailable(): boolean {
  return _pipeline !== null && !_initFailed;
}

// ─── loadModel ──────────────────────────────────────────────────────────────

/**
 * Loads the all-mpnet-base-v2 model and returns the feature-extraction
 * pipeline.  Subsequent calls return the cached instance without re-loading.
 *
 * Returns `null` (and logs the error) when ONNX/OrtRuntime initialization
 * fails so that callers can degrade gracefully instead of crashing the process.
 *
 * Must run in a Node.js environment (Next.js API route, server action, or
 * standalone script via tsx).  Will throw if called from a browser context.
 *
 * @throws {Error} When called outside a Node.js environment.
 * @returns The feature-extraction pipeline, or `null` if ONNX init failed.
 */
export async function loadModel(): Promise<FeatureExtractionPipeline | null> {
  // Guard: this file must never execute in the browser.
  if (typeof window !== "undefined") {
    throw new Error(
      "[EmbeddingService] loadModel() must only be called server-side (Node.js)."
    );
  }

  // Return cached instance immediately — zero overhead on warm calls.
  if (_pipeline !== null) {
    return _pipeline;
  }

  // If a previous initialization attempt already failed, bail out immediately
  // without retrying — the process is still running and we should not hammer
  // OrtRuntime again (which could crash the process or exhaust memory).
  if (_initFailed) {
    return null;
  }

  // Deduplicate concurrent calls: if a load is already in progress, all
  // callers await the same promise instead of launching parallel downloads.
  if (_loadingPromise !== null) {
    return _loadingPromise;
  }

  _loadingPromise = (async (): Promise<FeatureExtractionPipeline | null> => {
    try {
      // In production, we skip ONNX loading to avoid native module crashes
      if (process.env.NODE_ENV === 'production') {
        console.warn("[EmbeddingService] ONNX model loading is disabled in production.");
        _initFailed = true;
        return null;
      }
      
      // Dynamic import keeps @xenova/transformers out of the browser bundle.
      // Next.js will tree-shake this when the module is only imported from
      // server-only files.
      const { pipeline, env } = await import("@xenova/transformers");

      // Configure transformers.js for a server-only Node.js environment.
      // Disable the browser-specific WASM backend fallback so ONNX Runtime
      // Node is used instead (faster on server).
      env.useBrowserCache = false;

      // If MODEL_CACHE_DIR is set (injected by Docker at runtime), point
      // transformers.js to the pre-downloaded model cache baked into the image.
      // This avoids hitting HuggingFace Hub on every cold start and prevents
      // network errors when the container has no outbound internet access.
      const modelCacheDir = process.env.MODEL_CACHE_DIR;
      if (modelCacheDir) {
        env.cacheDir = modelCacheDir;
        env.allowLocalModels = true;
        env.localModelPath = modelCacheDir;
      } else {
        // Development / environments without a pre-baked cache: fetch from Hub.
        env.allowLocalModels = false;
      }

      const pipe = await pipeline("feature-extraction", MODEL_ID, {
        // Use the quantized (int8) ONNX model — ~4× smaller, marginal quality
        // loss on sentence similarity tasks.
        quantized: true,
      });

      // Cast to our minimal interface — the actual object is a Callable class
      // instance from transformers.js that is callable as a function.
      _pipeline = pipe as unknown as FeatureExtractionPipeline;
      return _pipeline;
    } catch (err) {
      // ONNX / OrtRuntime initialization failed (e.g. Ort::Exception, missing
      // native binding, incompatible Node.js ABI).  Mark as failed so that
      // subsequent calls return null immediately without retrying.
      _initFailed = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[EmbeddingService] ONNX model initialization failed — embedding features will be disabled. Error: ${msg}`
      );
      return null;
    }
  })();

  try {
    const result = await _loadingPromise;
    if (result !== null) {
      _pipeline = result;
    }
    return result;
  } finally {
    // Clear loading promise regardless of success/failure so retries work.
    _loadingPromise = null;
  }
}

// ─── embed ───────────────────────────────────────────────────────────────────

/**
 * Encodes a single text string into a normalized embedding vector.
 *
 * Returns `null` when the ONNX model failed to initialize.
 * Callers MUST check for `null` before using the result.
 *
 * @param text - Input text to embed.
 * @returns A `Float32Array` of length 768 (normalized L2), or `null` if the
 *          embedding service is unavailable.
 */
export async function embed(text: string): Promise<Float32Array | null> {
  const pipe = await loadModel();

  // ONNX init failed — return null instead of crashing.
  if (pipe === null) {
    console.warn(
      `[EmbeddingService] embed() called but model is unavailable (ONNX init failed). Returning null.`
    );
    return null;
  }

  // pooling: "mean" → average token embeddings (standard for sentence similarity)
  // normalize: true → L2-normalize the output so cosine similarity = dot product
  const output = await pipe(text, { pooling: "mean", normalize: true });

  return toFloat32Array(output);
}

/**
 * Encodes multiple texts in a single batch.
 *
 * Returns `null` when the ONNX model failed to initialize.
 * Callers MUST check for `null` before using the result.
 *
 * @param texts - Array of input strings.
 * @returns An array of `Float32Array` vectors, one per input text, or `null`
 *          if the embedding service is unavailable.
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[] | null> {
  if (texts.length === 0) return [];

  const pipe = await loadModel();

  // ONNX init failed — return null instead of crashing.
  if (pipe === null) {
    console.warn(
      `[EmbeddingService] embedBatch() called but model is unavailable (ONNX init failed). Returning null.`
    );
    return null;
  }

  const output = await pipe(texts, { pooling: "mean", normalize: true });

  return batchToFloat32Arrays(output, texts.length);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converts a single-sample transformer output tensor to Float32Array.
 * Handles both (1, dim) and (dim,) shapes.
 */
function toFloat32Array(tensor: TransformersTensor): Float32Array {
  const raw = tensor.data;
  const size = raw.length;

  // If the tensor is batched with a leading 1 dimension, extract the first row.
  const effectiveSize =
    tensor.dims.length === 2 && tensor.dims[0] === 1
      ? tensor.dims[1]
      : size;

  const arr = new Float32Array(effectiveSize);
  for (let i = 0; i < effectiveSize; i++) {
    arr[i] = raw[i] as number;
  }
  return arr;
}

/**
 * Splits a batched (N, dim) tensor into N individual Float32Array vectors.
 */
function batchToFloat32Arrays(
  tensor: TransformersTensor,
  n: number
): Float32Array[] {
  const dim = EMBEDDING_DIM;
  const raw = tensor.data;
  const results: Float32Array[] = [];

  for (let i = 0; i < n; i++) {
    const arr = new Float32Array(dim);
    const offset = i * dim;
    for (let j = 0; j < dim; j++) {
      arr[j] = raw[offset + j] as number;
    }
    results.push(arr);
  }

  return results;
}

// ─── Utility — cosine similarity ─────────────────────────────────────────────

/**
 * Computes cosine similarity between two normalized embedding vectors.
 * Since `embed()` normalizes to L2 = 1, this is equivalent to the dot product.
 *
 * @param a - Normalized embedding vector (length 768).
 * @param b - Normalized embedding vector (length 768).
 * @returns A score in [-1, 1], where 1 = identical, 0 = orthogonal.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(
      `[EmbeddingService] Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] as number) * (b[i] as number);
  }
  return dot;
}

// ─── Model Categorization via Semantic Similarity ────────────────────────────

/**
 * A capability category with its description and an optional pre-computed
 * embedding (populated lazily on the first call to `categorizeModel`).
 */
interface CapabilityDefinition {
  /** Human-readable description used as the anchor text for embedding. */
  description: string;
  /** Cached embedding — computed once, reused on every subsequent call. */
  embedding: Float32Array | null;
}

/**
 * Result returned by `categorizeModel`.
 * Each entry maps an LM-Arena-compatible category slug to a confidence value
 * in [0, 1] derived from the cosine similarity between the model's embedding
 * and that category's anchor embedding.
 */
export interface ModelCapabilities {
  /** Sorted descending by confidence — highest-matching category first. */
  categories: Array<{
    category: string;
    confidence: number;
  }>;
  /** Composite confidence: average of the top-3 similarities (0-1). */
  overallConfidence: number;
}

// ─── Known categories ─────────────────────────────────────────────────────────
// Each category is represented by a rich description so the embedding model
// can produce a semantically meaningful anchor vector.
// Descriptions intentionally cover synonyms and representative tasks to
// maximise recall when matching against short model names + descriptions.

const CAPABILITY_DEFINITIONS: Record<string, CapabilityDefinition> = {
  coding: {
    description:
      "Code generation, programming, software development, debugging, code review, " +
      "writing functions, classes, algorithms, fixing bugs, refactoring, unit tests.",
    embedding: null,
  },
  reasoning: {
    description:
      "Logical reasoning, step-by-step problem solving, chain-of-thought, deductive " +
      "inference, mathematical word problems, causal analysis, multi-step deduction.",
    embedding: null,
  },
  analysis: {
    description:
      "Data analysis, document analysis, research synthesis, critical evaluation, " +
      "root-cause analysis, comparing options, summarising insights from complex data.",
    embedding: null,
  },
  planning: {
    description:
      "Project planning, task decomposition, roadmap creation, milestone definition, " +
      "scheduling, breaking large goals into actionable steps, sprint planning.",
    embedding: null,
  },
  "instruction-following": {
    description:
      "Following precise instructions, adhering to formats, respecting constraints, " +
      "executing multi-step directives, rule-following, template completion.",
    embedding: null,
  },
  "structured-output": {
    description:
      "Generating JSON, YAML, XML, markdown tables, structured data, schemas, " +
      "formatted reports, extracting data into strict output formats.",
    embedding: null,
  },
  "long-context": {
    description:
      "Processing very long documents, large codebases, extended conversations, " +
      "multi-document synthesis, summarising large corpora, book-length inputs.",
    embedding: null,
  },
  summarization: {
    description:
      "Summarising documents, articles, meetings, conversations, extracting key points, " +
      "condensing information, executive summaries, TLDR generation.",
    embedding: null,
  },
  "creative-writing": {
    description:
      "Creative writing, storytelling, fiction, poetry, brainstorming, ideation, " +
      "narrative generation, imaginative content creation, marketing copy.",
    embedding: null,
  },
  dialogue: {
    description:
      "Conversational AI, chat, multi-turn dialogue, question answering, assistants, " +
      "customer support, interactive sessions, back-and-forth exchanges.",
    embedding: null,
  },
  "function-calling": {
    description:
      "Tool use, function calling, API invocation, agent actions, structured tool " +
      "selection, parameter extraction, tool-augmented generation.",
    embedding: null,
  },
  "tool-use": {
    description:
      "Using external tools, web search, calculator, code interpreter, browser use, " +
      "agentic workflows, chaining tool calls, multi-tool orchestration.",
    embedding: null,
  },
  "agent-tasks": {
    description:
      "Autonomous agent tasks, goal-directed behaviour, multi-step task execution, " +
      "planning and acting, self-directed workflows, agentic reasoning.",
    embedding: null,
  },
  math: {
    description:
      "Mathematics, arithmetic, algebra, calculus, statistics, proofs, numerical " +
      "computation, quantitative reasoning, mathematical problem solving.",
    embedding: null,
  },
  multimodal: {
    description:
      "Multimodal understanding, vision-language, image captioning, visual question " +
      "answering, processing images, charts, diagrams alongside text.",
    embedding: null,
  },
  "fast-inference": {
    description:
      "Fast inference, low latency, high throughput, real-time response, speed " +
      "optimised models, streaming, sub-second completion.",
    embedding: null,
  },
  "cost-efficiency": {
    description:
      "Cost-efficient AI, cheap inference, low cost per token, budget-friendly models, " +
      "economical AI, price-performance ratio optimised models.",
    embedding: null,
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Warm up all category embeddings in a single batch call (faster than N serial calls). */
async function warmUpCategoryEmbeddings(): Promise<void> {
  const pending = Object.entries(CAPABILITY_DEFINITIONS).filter(
    ([, def]) => def.embedding === null
  );

  if (pending.length === 0) return;

  const descriptions = pending.map(([, def]) => def.description);
  const embeddings = await embedBatch(descriptions);

  // embedBatch returns null when ONNX init failed — skip population silently.
  if (embeddings === null) return;

  pending.forEach(([, def], idx) => {
    def.embedding = embeddings[idx] ?? null;
  });
}

// ─── categorizeModel ─────────────────────────────────────────────────────────

/**
 * Classify an AI model into LM-Arena capability categories using semantic
 * similarity between the model's name+description embedding and each
 * category's anchor embedding.
 *
 * The function:
 * 1. Embeds the category anchors (lazy batch, cached after first call).
 * 2. Embeds the model text (`modelName + ". " + description`).
 * 3. Computes cosine similarity between the model vector and each anchor.
 * 4. Normalises similarities to [0, 1] and returns them sorted descending.
 *
 * When the ONNX embedding service is unavailable (production environment,
 * missing native bindings), the function automatically falls back to the
 * Gemini LLM-based categorizer (`lib/ai/llm-categorizer.ts`) so that callers
 * always receive meaningful capabilities rather than all-zero scores.
 *
 * @param modelName   Human-readable or canonical model ID (e.g. "claude-sonnet-4-5").
 * @param description Short description of the model's capabilities (may be empty).
 * @returns           `ModelCapabilities` with per-category confidences and an
 *                    overall confidence score.
 *
 * @throws {Error} When called outside a Node.js environment (same constraint as `embed`).
 */
export async function categorizeModel(
  modelName: string,
  description: string
): Promise<ModelCapabilities> {
  // Guard: server-side only (same as embed / loadModel).
  if (typeof window !== "undefined") {
    throw new Error(
      "[EmbeddingService] categorizeModel() must only be called server-side (Node.js)."
    );
  }

  // ── LLM fallback: when ONNX is unavailable, delegate to Gemini ────────────
  // This covers production deployments where @xenova/transformers / OrtRuntime
  // native bindings cannot be loaded.  The LLM categorizer returns the same
  // ModelCapabilities shape so all downstream callers are unaffected.
  if (!isEmbeddingServiceAvailable()) {
    const { categorizeModelViaLLM } = await import("@/lib/ai/llm-categorizer");
    return categorizeModelViaLLM(modelName, description);
  }

  // Build the text to embed: combine name + description for richer signal.
  const modelText = description.trim()
    ? `${modelName}. ${description.trim()}`
    : modelName;

  // Warm up category embeddings (batch, cached) and embed model text in parallel.
  const [modelEmbedding] = await Promise.all([
    embed(modelText),
    warmUpCategoryEmbeddings(),
  ]);

  // ONNX init failed after initial availability check — embed() returns null.
  // Fall back to LLM categorizer for a meaningful result instead of all-zeros.
  if (modelEmbedding === null) {
    const { categorizeModelViaLLM } = await import("@/lib/ai/llm-categorizer");
    return categorizeModelViaLLM(modelName, description);
  }

  // Compute cosine similarities against all category anchors.
  const rawSimilarities: Array<{ category: string; similarity: number }> = [];

  for (const category of Object.keys(CAPABILITY_DEFINITIONS)) {
    const categoryEmbedding = CAPABILITY_DEFINITIONS[category]!.embedding;
    // categoryEmbedding may be null if warm-up was skipped (ONNX unavailable)
    if (categoryEmbedding === null) continue;
    const similarity = cosineSimilarity(modelEmbedding, categoryEmbedding);
    rawSimilarities.push({ category, similarity });
  }

  // If no category anchors were computed (all null), return zero confidence.
  if (rawSimilarities.length === 0) {
    const zeroCategories = Object.keys(CAPABILITY_DEFINITIONS).map((category) => ({
      category,
      confidence: 0,
    }));
    return { categories: zeroCategories, overallConfidence: 0 };
  }

  // Sort descending by raw similarity.
  rawSimilarities.sort((a, b) => b.similarity - a.similarity);

  // Normalise similarities to [0, 1]:
  // cosine similarity is in [-1, 1] but in practice for sentence embeddings
  // the values cluster in [0.1, 0.9].  We clamp to [0, 1] for safety.
  const normalised = rawSimilarities.map(({ category, similarity }) => ({
    category,
    confidence: Math.max(0, Math.min(1, (similarity + 1) / 2)),
  }));

  // Overall confidence: average of top-3 category confidences.
  const top3 = normalised.slice(0, 3);
  const overallConfidence =
    top3.length > 0
      ? top3.reduce((sum, c) => sum + c.confidence, 0) / top3.length
      : 0;

  return {
    categories: normalised,
    overallConfidence,
  };
}

// ─── Info ─────────────────────────────────────────────────────────────────────

export const EMBEDDING_SERVICE_INFO = {
  model: MODEL_ID,
  dimension: EMBEDDING_DIM,
  backend: "onnxruntime-node (quantized)",
  pooling: "mean",
  normalized: true,
} as const;
