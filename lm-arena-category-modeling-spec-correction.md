# Delta for LMArena Category Modeling

## ADDED Requirements

### Requirement: Model Core Entity Remains Unchanged for Leaderboard Dates

The system MUST keep the core `Model` entity unchanged when processing LM Arena leaderboard data. Model metadata such as name, provider, tier, context window, and cost MUST NOT be modified during LM Arena score synchronization.

#### Scenario: Sync Latest Leaderboard Data

- GIVEN a Model entity exists with id "openai/gpt-4-turbo"
- WHEN LM Arena sync runs and fetches latest leaderboard data
- THEN the Model entity's core fields (name, providerId, tier, contextWindow, costPer1M) remain unchanged
- AND only the lastSyncedAt timestamp is updated if the model's LM Arena scores changed

#### Scenario: Sync Full Historical Data

- GIVEN multiple historical leaderboards exist in LM Arena
- WHEN a full sync is performed
- THEN all historical LMArenaScore records are appended or updated
- AND the core Model entity remains unchanged
- AND no model metadata fields are modified during the process

## MODIFIED Requirements

### Requirement: LMArenaCategory Entity is Static Lookup

The system MUST model `LMArenaCategory` as a static lookup/enum equivalent entity. The category data MUST be predefined and not dynamically modified during normal operation.

(Previously: LMArenaCategory was modeled as a dynamic entity that could be modified)

#### Scenario: Define Category Lookup Data

- GIVEN the system needs to map LM Arena categories
- WHEN the application starts
- THEN a predefined list of 27 categories is loaded from static configuration
- AND each category has immutable properties (id, name, description)
- AND no new categories are created dynamically during sync

### Requirement: LMArenaScore Entity is Append-Only with Unique Constraint

The system MUST treat `LMArenaScore` as an append-only/historical entity with a unique constraint on `(modelId, categoryId, leaderboardPublishDate)`. Existing scores for the same model-category-date combination MUST be updated rather than duplicated.

(Previously: LMArenaScore was not explicitly specified as append-only with this unique constraint)

#### Scenario: Sync Existing Score for Same Date

- GIVEN an LMArenaScore exists for model "openai/gpt-4-turbo", category "coding", date "2026-04-15"
- WHEN a new sync provides updated data for the same model-category-date
- THEN the existing score record is updated with new rank/score/votes
- AND no duplicate record is created
- AND the core Model entity remains unchanged

#### Scenario: Sync New Score for Different Date

- GIVEN an LMArenaScore exists for model "openai/gpt-4-turbo", category "coding", date "2026-04-15"
- WHEN a new sync provides data for the same model-category with a different date "2026-04-22"
- THEN a new LMArenaScore record is created
- AND the previous record remains unchanged
- AND the core Model entity remains unchanged

#### Scenario: Idempotent Sync Operation

- GIVEN LMArenaScore records exist for various model-category combinations
- WHEN the same sync operation is run multiple times with identical input data
- THEN the database state remains consistent
- AND no duplicate records are created
- AND no errors occur due to constraint violations
- AND the core Model entity remains unchanged

## REMOVED Requirements

### Requirement: Model Modification for Leaderboard Dates

(Reason: This requirement contradicts the design principle that core Model entity should remain unchanged. Leaderboard data should be stored separately in LMArenaScore entity.)

## Affected Artifacts

- prisma/schema.prisma - LMArenaCategory model definition
- prisma/schema.prisma - LMArenaScore model definition
- prisma/schema.prisma - Model model extension with arenaScores relation
- lib/sync/lmarena-client.ts - LM Arena data fetching logic
- lib/optimizer/scoring-engine-v2.ts - Scoring calculation using LM Arena data

## Non-Goals

- Modifying core Model entity fields during LM Arena synchronization
- Creating dynamic LMArenaCategory entities from leaderboard data
- Storing pairwise battle details in LMArenaScore entity
- Duplicating model metadata (organization, license) in LMArenaScore entity

## Risks

- Data inconsistency if core Model entity is incorrectly modified during sync
- Storage bloat if LMArenaScore is not properly constrained as append-only
- Performance degradation if LM Arena sync operations are not idempotent
- Incorrect scoring if duplicate LMArenaScore records are created

## Next Step

Ready for design (sdd-design). The corrected specification aligns with the minimal design approach that keeps core entities stable while enabling historical score tracking.