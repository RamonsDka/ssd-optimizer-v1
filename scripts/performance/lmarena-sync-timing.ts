import { performance } from "node:perf_hooks";
import { clearCache, fetchAllCategories } from "@/lib/sync/lmarena-client";

async function main(): Promise<void> {
  clearCache();

  const start = performance.now();
  const categoryMap = await fetchAllCategories();
  const end = performance.now();

  const totalCategories = categoryMap.size;
  const totalModels = Array.from(categoryMap.values()).reduce(
    (sum, category) => sum + category.models.length,
    0
  );
  const totalMs = end - start;

  console.log(JSON.stringify({
    metric: "lmarena-client-full-sync",
    source: "lib/sync/lmarena-client.ts::fetchAllCategories",
    totalCategories,
    totalModels,
    totalMs: Number(totalMs.toFixed(3)),
    totalSeconds: Number((totalMs / 1000).toFixed(3)),
    totalMinutes: Number((totalMs / 60000).toFixed(3)),
    targetMinutes: 5,
    passesTarget: totalMs < 5 * 60 * 1000,
  }, null, 2));
}

main().catch((error) => {
  console.error("lmarena-sync-timing error", error);
  process.exit(1);
});
