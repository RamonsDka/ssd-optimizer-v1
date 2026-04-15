# LM Arena Integration - Implementation Status

## ✅ Completed

### 1. Schema Changes
**File**: `prisma/schema.prisma`

Added `leaderboardPublishDate` field to `LMArenaScore` model:
- Field: `leaderboardPublishDate DateTime` (source of truth from HF dataset)
- Changed unique constraint from `@@unique([modelId, categoryId])` to `@@unique([modelId, categoryId, leaderboardPublishDate])`
- This enables historical/append-only tracking of scores across different leaderboard snapshots

**Migration needed**: Run `npx prisma migrate dev` when database is available.

### 2. Data Source Migration
**File**: `lib/sync/lmarena-client.ts`

Migrated from non-existent lmarena.ai API to Hugging Face dataset:
- **Old source**: `https://lmarena.ai/api/leaderboard/{category}` (returned 403)
- **New source**: `https://datasets-server.huggingface.co/rows?dataset=lmarena-ai/leaderboard-dataset`
- Added HF dataset types: `HFDatasetRow`, `HFDatasetResponse`
- Updated `LMArenaModelEntry` to include `leaderboardPublishDate: string`
- Rewrote `fetchLeaderboard()` to:
  - Fetch rows from HF Datasets API
  - Filter by category client-side
  - Transform HF row format to internal format
  - Extract `leaderboard_publish_date` from dataset

### 3. Sync Logic Updates
**File**: `lib/sync/lmarena-sync.ts`

Updated `processModelEntry()` to use `leaderboardPublishDate`:
- Parse `entry.leaderboardPublishDate` to Date object
- Changed upsert `where` clause to use `modelId_categoryId_leaderboardPublishDate` (3-field unique key)
- Include `leaderboardPublishDate` in both `create` and `update` operations
- Maintains idempotency: same model + category + publish date = same record

### 4. Type Safety
**File**: `app/api/models/route.ts`

Fixed type error in trigram search mapping:
- Added `lastSyncedAt: null` to raw query result mapping
- Ensures compatibility with updated Model type

## 📋 Design Decisions

### Why Hugging Face Dataset?
- LM Arena's API endpoint doesn't exist or is blocked (403 Forbidden)
- HF dataset `lmarena-ai/leaderboard-dataset` is the official public source
- Dataset includes `leaderboard_publish_date` per row (temporal key)

### Why Historical Tracking?
- `leaderboardPublishDate` enables tracking score evolution over time
- Append-only pattern: never overwrite historical data
- Unique constraint `(modelId, categoryId, leaderboardPublishDate)` prevents duplicates
- Supports future features: trend analysis, score history charts

### Why NOT Duplicate organization/license?
- `organization` and `license` are model-level metadata, not score-level
- These fields exist in the HF dataset but should NOT be stored in `LMArenaScore`
- If needed, they should be added to the `Model` table (not implemented in this phase)

## 🚧 Known Limitations

### 1. HF API Pagination
Current implementation fetches only first 100 rows (`length=100`).
- **Impact**: May miss models if dataset has >100 rows per category
- **Fix needed**: Implement pagination loop to fetch all rows
- **Not blocking**: Can be added incrementally

### 2. Category Filtering
HF Datasets API doesn't support server-side filtering by category.
- **Current approach**: Fetch all rows, filter client-side
- **Impact**: Inefficient for large datasets (fetches unnecessary data)
- **Alternative**: Use HF `parquet-convert` API or download full dataset once

### 3. Model Matching
Uses fuzzy matching strategies (exact ID, suffix match, normalized match).
- **Risk**: May fail to match models with very different naming conventions
- **Mitigation**: Logs warnings for unmatched models (doesn't fail sync)
- **Future**: Consider adding manual mapping table for edge cases

## 🔧 Next Steps

### Before First Sync
1. **Start database**: `docker-compose up -d` (or equivalent)
2. **Run migration**: `npx prisma migrate dev --name add_leaderboard_publish_date`
3. **Verify schema**: Check that unique constraint was updated correctly

### Testing
```bash
# Dry-run (no DB writes)
npx tsx lib/sync/lmarena-sync.ts

# Commit to database
npx tsx lib/sync/lmarena-sync.ts --commit
```

### Expected Behavior
- Fetches rows from HF dataset for each category
- Filters by category client-side
- Matches models using existing fuzzy logic
- Upserts scores with `leaderboardPublishDate` as part of unique key
- Logs warnings for unmatched models (doesn't fail)
- Creates `SyncLog` with status: SUCCESS | PARTIAL | FAILED

## 📊 Data Flow

```
HF Dataset (lmarena-ai/leaderboard-dataset)
  ↓
fetchLeaderboard(category)
  ↓ (fetch rows, filter by category)
LMArenaLeaderboardResponse { models: [...] }
  ↓
syncLMArenaCategories()
  ↓ (for each model entry)
processModelEntry()
  ↓ (find matching Model)
findModelByArenaName()
  ↓ (upsert with leaderboardPublishDate)
LMArenaScore.upsert({
  where: { modelId_categoryId_leaderboardPublishDate },
  create: { ..., leaderboardPublishDate },
  update: { ..., leaderboardPublishDate }
})
```

## ✅ Verification Checklist

- [x] Schema updated with `leaderboardPublishDate` field
- [x] Unique constraint changed to 3-field key
- [x] Client migrated to HF dataset source
- [x] Sync logic uses `leaderboardPublishDate` in upsert
- [x] Type errors resolved (Prisma regenerated)
- [x] TypeScript compiles without errors
- [ ] Migration applied to database (blocked: DB not running)
- [ ] Dry-run test executed (blocked: DB not running)
- [ ] Commit test executed (blocked: DB not running)

## 🎯 Success Criteria

Implementation is **COMPLETE** for Fase 1. Remaining work is **operational** (run migration, test with real DB).

**Code changes**: ✅ Done
**Schema changes**: ✅ Done
**Type safety**: ✅ Done
**Migration file**: ⏳ Pending (DB not available)
**Runtime testing**: ⏳ Pending (DB not available)
