// ─── Model Pre-download Script ────────────────────────────────────────────────
// Runs during Docker build to cache Xenova/all-mpnet-base-v2 (quantized ONNX)
// so the production container starts instantly without fetching from HuggingFace.
//
// Usage (inside Docker builder stage):
//   npx tsx scripts/download-model.ts
//
// Env vars:
//   MODEL_CACHE_DIR  — destination directory (default: /app/model-cache)
//   MODEL_ID         — HuggingFace model ID (default: Xenova/all-mpnet-base-v2)

import { pipeline, env } from "@xenova/transformers";

// ...
async function main() {
  const MODEL_ID = process.env.MODEL_ID ?? "Xenova/all-mpnet-base-v2";
  const MODEL_CACHE_DIR = process.env.MODEL_CACHE_DIR ?? "/app/model-cache";

  console.log(`[download-model] Downloading model: ${MODEL_ID}`);
  console.log(`[download-model] Cache directory  : ${MODEL_CACHE_DIR}`);

  // Point transformers.js to the deterministic build-time cache directory.
  env.cacheDir = MODEL_CACHE_DIR;
  // Fetch from HuggingFace Hub — we are in the builder stage with internet access.
  env.allowLocalModels = false;
  env.useBrowserCache = false;

  try {
    const pipe = await pipeline("feature-extraction", MODEL_ID, {
      quantized: true, // int8 ONNX — same flag used in embedding-service.ts
    });

    // Run a tiny warm-up inference to confirm the model loaded correctly.
    const out = await (pipe as (input: string, opts: object) => Promise<{ data: Float32Array }>)(
      "warm-up ping",
      { pooling: "mean", normalize: true }
    );

    console.log(
      `[download-model] ✓ Model ready. Output dim: ${out.data.length}`
    );
    console.log(`[download-model] ✓ Cached to: ${MODEL_CACHE_DIR}`);
    process.exit(0);
  } catch (err) {
    console.error("[download-model] ✗ Failed to download model:", err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
