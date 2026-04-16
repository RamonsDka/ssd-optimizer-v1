import { performance } from "node:perf_hooks";

interface RequestResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  error?: string;
}

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 100);
const TARGET_URL = process.env.TARGET_URL ?? "http://localhost:3000/api/optimize";

const payload = {
  modelList: [
    "anthropic/claude-sonnet-4-5",
    "openai/gpt-4o",
    "google/gemini-2.5-pro-preview",
    "openai/o3-mini",
    "mistral/mistral-large-latest",
  ].join("\n"),
};

async function oneRequest(): Promise<RequestResult> {
  const start = performance.now();

  try {
    const response = await fetch(TARGET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const end = performance.now();

    return {
      ok: response.ok,
      status: response.status,
      latencyMs: end - start,
    };
  } catch (error) {
    const end = performance.now();
    return {
      ok: false,
      status: 0,
      latencyMs: end - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const start = performance.now();
  const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => oneRequest()));
  const end = performance.now();

  const statusCounts = results.reduce<Record<string, number>>((acc, result) => {
    const key = String(result.status);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const successful = results.filter((result) => result.ok).length;
  const failures = results.length - successful;
  const hardErrors = (statusCounts["503"] ?? 0) + (statusCounts["504"] ?? 0);

  const percentile = (p: number): number => {
    if (latencies.length === 0) return 0;
    const idx = Math.min(latencies.length - 1, Math.floor(p * latencies.length));
    return latencies[idx];
  };

  const avgLatency =
    latencies.length > 0
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : 0;

  console.log(JSON.stringify({
    metric: "optimize-load-test",
    targetUrl: TARGET_URL,
    concurrency: CONCURRENCY,
    totalDurationMs: Number((end - start).toFixed(3)),
    successful,
    failures,
    statusCounts,
    avgLatencyMs: Number(avgLatency.toFixed(3)),
    p50LatencyMs: Number(percentile(0.5).toFixed(3)),
    p95LatencyMs: Number(percentile(0.95).toFixed(3)),
    p99LatencyMs: Number(percentile(0.99).toFixed(3)),
    has503or504: hardErrors > 0,
    sampleErrors: results.filter((result) => result.error).slice(0, 5),
  }, null, 2));
}

main().catch((error) => {
  console.error("load-optimize error", error);
  process.exit(1);
});
