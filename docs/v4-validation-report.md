# V4 Score Validation Report

> Generated: 2026-04-18T02:59:39.959Z
> Models evaluated: 24
> Phases evaluated: 11
> Total combinations: 264

## Validation Summary

| Check | Status | Details |
|-------|--------|---------|
| Scores in [0,10] range | ✅ PASS | All 223 active scores valid |
| Anti-thinking rules | ✅ PASS | orchestrator, tasks, archive |
| Prefer-thinking bonus | ✅ PASS | explore, propose, verify |
| Context min (orchestrator) | ✅ PASS | 260k token minimum |

## Statistics

- **Excluded** (anti-thinking + context): 41 (15.5%)
- **Active scores**: 223
- **Avg delta V4 vs V3**: -0.0802
- **V4 > V3 (+0.05)**: 9 combinations
- **V4 < V3 (-0.05)**: 146 combinations

## Top Differences V3 vs V4

| Model | Phase | V3-est | V4-norm | Delta |
|-------|-------|--------|---------|-------|
| `deepseek/deepseek-chat` | explore | 0.815 | 0.554 | -0.260 |
| `deepseek/deepseek-chat` | verify | 0.815 | 0.555 | -0.259 |
| `deepseek/deepseek-chat` | propose | 0.815 | 0.555 | -0.259 |
| `groq/llama-3.3-70b-versatile` | verify | 0.762 | 0.532 | -0.230 |
| `groq/llama-3.3-70b-versatile` | propose | 0.762 | 0.532 | -0.230 |
| `groq/llama-3.3-70b-versatile` | explore | 0.762 | 0.533 | -0.229 |
| `deepseek/deepseek-r1` | design | 0.892 | 0.669 | -0.222 |
| `deepseek/deepseek-r1` | init | 0.892 | 0.671 | -0.221 |
| `deepseek/deepseek-r1` | onboard | 0.892 | 0.676 | -0.216 |
| `deepseek/deepseek-r1` | spec | 0.892 | 0.681 | -0.211 |
| `anthropic/claude-haiku-3-5` | propose | 0.756 | 0.546 | -0.210 |
| `openai/gpt-4o-mini` | propose | 0.754 | 0.545 | -0.210 |
| `openai/gpt-4o-mini` | verify | 0.754 | 0.545 | -0.209 |
| `anthropic/claude-haiku-3-5` | verify | 0.756 | 0.547 | -0.209 |
| `deepseek/deepseek-r1` | apply | 0.892 | 0.682 | -0.209 |

## Propose Phase Ranking (V4)

| Model | Thinking | V3-est | V4-norm | Rules Applied |
|-------|----------|--------|---------|---------------|
| `openai/o3` | ✓ | 0.940 | 1.000 | prefer-thinking-bonus |
| `google/gemini-2.5-pro-preview` | ✓ | 0.907 | 1.000 | prefer-thinking-bonus |
| `anthropic/claude-3-7-sonnet-latest` | ✓ | 0.900 | 0.900 | prefer-thinking-bonus |
| `openai/o4-mini` | ✓ | 0.889 | 0.900 | prefer-thinking-bonus |
| `google/gemini-2.5-flash-preview` | ✓ | 0.839 | 0.900 | prefer-thinking-bonus |
| `openai/o3-mini` | ✓ | 0.860 | 0.898 | prefer-thinking-bonus |
| `anthropic/claude-opus-4-5` | — | 0.926 | 0.812 | penalty-for-non-thinking |
| `deepseek/deepseek-r1` | ✓ | 0.892 | 0.800 | prefer-thinking-bonus |
| `openai/gpt-4o` | — | 0.859 | 0.789 | penalty-for-non-thinking |
| `xai/grok-3-mini-beta` | ✓ | 0.781 | 0.757 | prefer-thinking-bonus |
| `groq/deepseek-r1-distill-llama-70b` | ✓ | 0.802 | 0.755 | prefer-thinking-bonus |
| `openai/gpt-4.5-preview` | — | 0.825 | 0.739 | penalty-for-non-thinking |
| `anthropic/claude-sonnet-4-5` | — | 0.882 | 0.706 | penalty-for-non-thinking |
| `anthropic/claude-sonnet-3-5` | — | 0.858 | 0.690 | penalty-for-non-thinking |
| `xai/grok-3-beta` | — | 0.848 | 0.676 | penalty-for-non-thinking |
| `mistral/codestral-latest` | — | 0.802 | 0.659 | penalty-for-non-thinking |
| `mistral/mistral-large-latest` | — | 0.798 | 0.651 | penalty-for-non-thinking |
| `google/gemini-2.0-flash` | — | 0.772 | 0.568 | penalty-for-non-thinking |
| `deepseek/deepseek-chat` | — | 0.815 | 0.555 | penalty-for-non-thinking |
| `anthropic/claude-haiku-3-5` | — | 0.756 | 0.546 | penalty-for-non-thinking |
| `openai/gpt-4o-mini` | — | 0.754 | 0.545 | penalty-for-non-thinking |
| `groq/llama-3.3-70b-versatile` | — | 0.762 | 0.532 | penalty-for-non-thinking |
| `mistral/mistral-small-latest` | — | 0.648 | 0.471 | penalty-for-non-thinking |
| `groq/llama-3.1-8b-instant` | — | 0.623 | 0.462 | penalty-for-non-thinking |