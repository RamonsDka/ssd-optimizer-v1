import { getGeminiClient } from "./lib/ai/gemini";

async function test() {
  console.log("Testing Gemini client...");
  const client = getGeminiClient();
  if (!client) {
    console.error("No gemini client configured");
    return;
  }
  try {
    console.log("Attempting to categorize 'gpt-4'...");
    const res = await client.categorizeModels(["gpt-4"]);
    console.log("Gemini response:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Gemini error:", e);
  }
}
test();
