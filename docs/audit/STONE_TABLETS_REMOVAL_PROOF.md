# STONE TABLETS REMOVAL PROOF — Complete Audit

**Date**: 2026-01-26
**Purpose**: Document all Stone Tablets references that must be removed
**Status**: ⚠️ NOT YET REMOVED - Cataloged for deletion after endpoint parity

---

## Executive Summary

Stone Tablets is the **user-scoped caching pattern** that conflicts with Library Book (global deduplication). All references must be removed after 30-day transition period.

### Stone Tablets Pattern (PROHIBITED)

```
User → Profile → User-Scoped Cache Table → Computation
         (one record per user)
```

**Examples**:
- `soul_paths` table (user_id PRIMARY KEY)
- User-scoped `numerology_profiles` (user_id column)
- `profiles.birth_chart_placements_json` (inline cache)

### Library Book Pattern (TARGET)

```
User → Profile → Pointer → Global Library → Computation
         (official_*_key)   (deterministic_key PRIMARY KEY)
```

**Examples**:
- `charts` table (chart_key PRIMARY KEY)
- `numerology_library` table (numerology_key PRIMARY KEY)
- `profiles.official_chart_key` (pointer)

---

## 1. Stone Tablets Database Objects

### 1.1 Soul Paths Table

**Table**: `public.soul_paths`
**Pattern**: User-scoped caching
**Created by**: [sql/002_create_soul_paths_table.sql](sql/002_create_soul_paths_table.sql)

**Schema**:
```sql
CREATE TABLE public.soul_paths (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- ⚠️ User-scoped
  schema_version INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  birth_input_hash TEXT NOT NULL,
  soul_path_json JSONB NOT NULL,
  -- Narrative caching columns (added later):
  soul_path_narrative_json JSONB,
  narrative_prompt_version INTEGER,
  narrative_language TEXT,
  narrative_model TEXT,
  narrative_generated_at TIMESTAMPTZ
);
```

**Conflicts with**: `charts` table (global deduplication)

**Removal Timeline**: After `/api/birth-chart` endpoint deprecated (30 days)

**Verification Query**:
```sql
-- Should return 1 row (before removal), 0 rows (after removal)
SELECT COUNT(*) as soul_paths_exists
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'soul_paths';
```

---

### 1.2 User-Scoped Numerology Profiles

**Table**: `public.numerology_profiles` (user-scoped version)
**Pattern**: User-scoped caching
**Created by**:
- [supabase/migrations/20250101000000_numerology_schema.sql](supabase/migrations/20250101000000_numerology_schema.sql)
- [supabase/migrations/20260106140000_reconcile_public_schema_from_prod.sql](supabase/migrations/20260106140000_reconcile_public_schema_from_prod.sql) (line 248)

**Schema**:
```sql
CREATE TABLE public.numerology_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- ⚠️ User-scoped
  system TEXT NOT NULL DEFAULT 'pythagorean',
  input_hash TEXT NOT NULL,
  profile_json JSONB NOT NULL,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, system, input_hash)
);
```

**Conflicts with**: `numerology_library` table (global deduplication)

**Removal Timeline**: After `/api/numerology` endpoint deprecated (30 days)

**Verification Query**:
```sql
-- Check if table has user_id column (Stone Tablets)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'numerology_profiles'
  AND column_name = 'user_id';

-- Should return 1 row (before removal), 0 rows (after removal)
```

---

### 1.3 Legacy Profile Columns

**Table**: `public.profiles`
**Columns**: `birth_chart_placements_json`, `birth_chart_computed_at`
**Pattern**: Inline user-scoped caching
**Created by**: [supabase/migrations/20240101_profiles_baseline.sql](supabase/migrations/20240101_profiles_baseline.sql) (lines 37-38)

**Schema**:
```sql
-- Legacy columns in profiles table
birth_chart_placements_json JSONB,  -- ⚠️ Inline cache
birth_chart_computed_at TIMESTAMPTZ  -- ⚠️ Cache timestamp
```

**Conflicts with**: Separation of concerns (profiles = user data, library = computations)

**Removal Timeline**: After `/api/birth-chart` endpoint deprecated (30 days)

**Verification Query**:
```sql
-- Should return 2 rows (before removal), 0 rows (after removal)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('birth_chart_placements_json', 'birth_chart_computed_at');
```

---

## 2. Stone Tablets Code Files

### 2.1 Soul Path Storage

**File**: [lib/soulPath/storage.ts](lib/soulPath/storage.ts)
**Lines**: 287 total
**Pattern**: User-scoped caching
**Status**: ⚠️ Active (used by old endpoint)

**Key Functions**:
```typescript
// Line 43: Get or compute soul path (user-scoped)
export async function getCurrentSoulPath(
  userId: string,
  profile: ProfileData
): Promise<SwissPlacements | null>

// Line 184: ⚠️ NOON DEFAULTING VIOLATION
const timeForSwiss = profile.birth_time || "12:00";
```

**Database Operations**:
- Queries `soul_paths` table (line 67)
- Inserts/updates `soul_paths` records (line 120)
- User-scoped: one record per user

**Referenced by**:
- [app/api/birth-chart/route.ts](app/api/birth-chart/route.ts) - old endpoint
- [__tests__/api/birth-chart.test.ts](__tests__/api/birth-chart.test.ts) - tests

**Removal Actions**:
1. Delete file: `lib/soulPath/storage.ts`
2. Delete tests: `__tests__/lib/soulPath/` (if exists)
3. Verify no imports remain

---

### 2.2 Birth Chart Storage

**File**: [lib/birthChart/storage.ts](lib/birthChart/storage.ts)
**Lines**: ~200
**Pattern**: Inline caching in profiles table
**Status**: ⚠️ Active (legacy code path)

**Key Functions**:
```typescript
// Get or compute birth chart from inline cache
export async function getBirthChartPlacements(
  userId: string,
  profile: ProfileData
): Promise<SwissPlacements | null>

// Line 68: ⚠️ NOON DEFAULTING VIOLATION
const timeForSwiss = profile.birth_time || "12:00";
```

**Database Operations**:
- Reads `profiles.birth_chart_placements_json` (inline cache)
- Updates `profiles.birth_chart_placements_json`
- User-scoped: stored directly in user's profile row

**Referenced by**:
- Unclear if still actively used (old code path)
- May be dead code already

**Removal Actions**:
1. Verify if still referenced anywhere
2. Delete file: `lib/birthChart/storage.ts`
3. Drop columns: `birth_chart_placements_json`, `birth_chart_computed_at`

---

### 2.3 Numerology Storage

**File**: [lib/numerology/storage.ts](lib/numerology/storage.ts)
**Lines**: ~400
**Pattern**: User-scoped caching
**Status**: ⚠️ Active (used by old endpoint)

**Key Functions**:
```typescript
// Get or compute numerology (user-scoped)
export async function getNumerologyProfile(
  userId: string,
  options: { system?: string }
): Promise<NumerologyProfile>

// Stores in user-scoped numerology_profiles table
```

**Database Operations**:
- Queries user-scoped `numerology_profiles` table
- Inserts/updates per-user records
- Pattern: one record per user per system per input_hash

**Referenced by**:
- [app/api/numerology/route.ts](app/api/numerology/route.ts) - old endpoint

**Removal Actions**:
1. Delete file: `lib/numerology/storage.ts`
2. Delete tests: `__tests__/lib/numerology/storage.test.ts` (if exists)
3. Drop user-scoped `numerology_profiles` table

---

## 3. Stone Tablets API Endpoints

### 3.1 Old Birth Chart Endpoint

**File**: [app/api/birth-chart/route.ts](app/api/birth-chart/route.ts)
**Lines**: ~1044
**Pattern**: Uses Stone Tablets (soul_paths)
**Status**: ⚠️ Active (temporary - UI reverted to use this)

**Stone Tablets References**:
```typescript
// Line 912: Uses user-scoped soul_paths
import { getCurrentSoulPath } from "@/lib/soulPath/storage";

// Calls user-scoped storage
const swissPlacements = await getCurrentSoulPath(user.id, profile);

// Stores narratives in soul_paths table
await storeCachedNarrative(userId, narrative, ...);
```

**Replacement**: `/api/birth-chart-library` (after parity achieved)

**Removal Actions**:
1. Achieve endpoint parity (add `insight` field to new endpoint)
2. Migrate UI to new endpoint
3. Add deprecation warning to old endpoint
4. Monitor usage for 30 days
5. Delete file: `app/api/birth-chart/route.ts`

---

### 3.2 Old Numerology Endpoint

**File**: [app/api/numerology/route.ts](app/api/numerology/route.ts)
**Lines**: ~140
**Pattern**: Uses Stone Tablets (user-scoped numerology_profiles)
**Status**: ⚠️ Active (temporary - UI reverted to use this)

**Stone Tablets References**:
```typescript
// Line 89: Uses user-scoped storage
import { getNumerologyProfile } from "@/lib/numerology/storage";

// Calls user-scoped storage
const numerologyProfile = await getNumerologyProfile(user.id, { system });
```

**Replacement**: `/api/numerology-library` (after parity achieved)

**Removal Actions**:
1. Achieve endpoint parity (add `cycles` field to new endpoint)
2. Migrate UI to new endpoint
3. Add deprecation warning to old endpoint
4. Monitor usage for 30 days
5. Delete file: `app/api/numerology/route.ts`

---

## 4. Stone Tablets SQL Files

### 4.1 Create Soul Paths Table

**File**: [sql/002_create_soul_paths_table.sql](sql/002_create_soul_paths_table.sql)
**Purpose**: Creates user-scoped `soul_paths` table
**Status**: Historical reference only (already applied to production)

**Action**: Keep for historical record, document as deprecated

---

### 4.2 Backfill Soul Paths

**File**: [sql/003_backfill_soul_paths_from_profiles.sql](sql/003_backfill_soul_paths_from_profiles.sql)
**Purpose**: Backfills soul_paths from profiles.birth_chart_placements_json
**Status**: One-time migration (historical)

**Action**: Keep for historical record

---

### 4.3 Add Soul Path Narrative Caching

**File**: [sql/004_add_soul_path_narrative_caching.sql](sql/004_add_soul_path_narrative_caching.sql)
**Purpose**: Adds narrative columns to soul_paths table
**Status**: Historical reference

**Action**: Keep for historical record

---

### 4.4 Add Birth Chart Cache

**File**: [sql/001_add_birth_chart_cache.sql](sql/001_add_birth_chart_cache.sql)
**Purpose**: Adds inline cache columns to profiles
**Status**: Historical reference

**Action**: Keep for historical record

---

## 5. Stone Tablets Migrations

### 5.1 RLS for Soul Paths

**Files**:
- [supabase/migrations/20260107020000_rls_soul_paths.sql](supabase/migrations/20260107020000_rls_soul_paths.sql)
- [supabase/migrations/20260121231338_fix_soul_paths_rls.sql](supabase/migrations/20260121231338_fix_soul_paths_rls.sql)

**Purpose**: RLS policies for user-scoped soul_paths table
**Status**: Applied to production (will be removed with table drop)

**Action**: Policies automatically deleted when table is dropped

---

### 5.2 Create User-Scoped Numerology Profiles

**Files**:
- [supabase/migrations/20250101000000_numerology_schema.sql](supabase/migrations/20250101000000_numerology_schema.sql)
- [supabase/migrations/20260106140000_reconcile_public_schema_from_prod.sql](supabase/migrations/20260106140000_reconcile_public_schema_from_prod.sql) (line 248)

**Purpose**: Creates user-scoped numerology_profiles table
**Status**: Applied to production (conflicts with Library Book)

**Action**: Table will be dropped in final cleanup migration

---

## 6. Complete File Touch List

### Files to DELETE (after 30-day transition)

**Library Code**:
- [ ] `lib/soulPath/storage.ts` (287 lines)
- [ ] `lib/birthChart/storage.ts` (~200 lines)
- [ ] `lib/numerology/storage.ts` (~400 lines)

**API Endpoints**:
- [ ] `app/api/birth-chart/route.ts` (1044 lines)
- [ ] `app/api/numerology/route.ts` (140 lines)

**Tests** (if exist):
- [ ] `__tests__/api/birth-chart.test.ts` (update to use new endpoint)
- [ ] `__tests__/lib/soulPath/*.test.ts` (delete entire directory)
- [ ] `__tests__/lib/birthChart/*.test.ts` (delete if exists)
- [ ] `__tests__/lib/numerology/storage.test.ts` (delete)

**SQL Files** (keep for historical record):
- Keep: `sql/001_add_birth_chart_cache.sql`
- Keep: `sql/002_create_soul_paths_table.sql`
- Keep: `sql/003_backfill_soul_paths_from_profiles.sql`
- Keep: `sql/004_add_soul_path_narrative_caching.sql`

---

### Database Objects to DROP (after 30-day transition)

**Tables**:
- [ ] `public.soul_paths` (DROP TABLE CASCADE)
- [ ] User-scoped `public.numerology_profiles` (DROP TABLE CASCADE)

**Columns**:
- [ ] `profiles.birth_chart_placements_json` (ALTER TABLE DROP COLUMN)
- [ ] `profiles.birth_chart_computed_at` (ALTER TABLE DROP COLUMN)

**Migration File**: `supabase/migrations/20260227000000_remove_stone_tablets.sql`

```sql
-- Remove all Stone Tablets database objects
-- Run AFTER 30-day transition period (old endpoints deprecated)

-- Drop tables
DROP TABLE IF EXISTS public.soul_paths CASCADE;

-- Drop user-scoped numerology_profiles
-- (ONLY if it has user_id column - don't drop the global library!)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'numerology_profiles'
      AND column_name = 'user_id'
      AND table_schema = 'public'
  ) THEN
    DROP TABLE IF EXISTS public.numerology_profiles CASCADE;
  END IF;
END $$;

-- Drop legacy profile columns
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS birth_chart_placements_json,
  DROP COLUMN IF EXISTS birth_chart_computed_at;

-- Verification
SELECT
  'Stone Tablets removed' AS status,
  COUNT(*) AS remaining_tables
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('soul_paths', 'numerology_profiles');
-- Should return: status = 'Stone Tablets removed', remaining_tables = 0 or 1 (global numerology_library)
```

---

## 7. Import/Reference Verification

### 7.1 Files Importing Soul Path Storage

```bash
# Find all imports of soul path storage
grep -r "from.*soulPath/storage" --include="*.ts" --include="*.tsx"
```

**Current Results**:
- `app/api/birth-chart/route.ts:12` - old endpoint
- `__tests__/api/birth-chart.test.ts` (if exists)

**After Removal**: Should return 0 results

---

### 7.2 Files Importing Birth Chart Storage

```bash
# Find all imports of birth chart storage
grep -r "from.*birthChart/storage" --include="*.ts" --include="*.tsx"
```

**Current Results**:
- Possibly none (dead code)

**After Removal**: Should return 0 results

---

### 7.3 Files Importing Numerology Storage

```bash
# Find all imports of numerology storage
grep -r "from.*numerology/storage" --include="*.ts" --include="*.tsx"
```

**Current Results**:
- `app/api/numerology/route.ts:11` - old endpoint

**After Removal**: Should return 0 results

---

### 7.4 Files Querying soul_paths Table

```bash
# Find all queries to soul_paths table
grep -r "soul_paths" --include="*.ts" --include="*.tsx" | grep -E "(from\(|\.from)"
```

**Current Results**:
- `lib/soulPath/storage.ts` - multiple queries
- `app/api/birth-chart/route.ts` - narrative caching
- `lib/account/deleteAccountCore.ts` - cleanup on account deletion

**After Removal**: Should return 0 results

---

### 7.5 Files Querying User-Scoped numerology_profiles

```bash
# Find all queries to numerology_profiles table
grep -r "numerology_profiles" --include="*.ts" --include="*.tsx" | grep -E "(from\(|\.from)"
```

**Current Results**:
- `lib/numerology/storage.ts` - user-scoped queries
- `lib/library/numerology.ts` - ✅ FIXED to use `numerology_library` instead

**After Removal**: Should return 0 results (or only global `numerology_library` references)

---

### 7.6 Files Using profiles.birth_chart_placements_json

```bash
# Find all references to inline cache column
grep -r "birth_chart_placements_json" --include="*.ts" --include="*.tsx"
```

**Current Results**:
- `lib/birthChart/storage.ts` - inline caching
- `lib/account/deleteAccountCore.ts` - mentioned in comments
- Documentation files (audits)

**After Removal**: Should return 0 code results (only doc references)

---

## 8. Verification Runbook

### Step 1: Before Removal (Current State)

```bash
# Verify Stone Tablets tables exist
psql "$DATABASE_URL" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('soul_paths', 'numerology_profiles');
"
# Expected: 2 rows

# Verify legacy profile columns exist
psql "$DATABASE_URL" -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('birth_chart_placements_json', 'birth_chart_computed_at');
"
# Expected: 2 rows

# Count Stone Tablets code references
echo "Soul Path Storage imports:"
grep -r "from.*soulPath/storage" --include="*.ts" --include="*.tsx" | wc -l

echo "Birth Chart Storage imports:"
grep -r "from.*birthChart/storage" --include="*.ts" --include="*.tsx" | wc -l

echo "Numerology Storage imports:"
grep -r "from.*numerology/storage" --include="*.ts" --include="*.tsx" | wc -l
```

---

### Step 2: After Endpoint Parity (Pre-Migration)

```bash
# Verify new endpoints have parity
npm run test __tests__/api/birth-chart-library.test.ts
npm run test __tests__/api/numerology-library.test.ts

# Verify old and new endpoints return same shape
# (Run manual comparison tests)
```

---

### Step 3: After UI Migration (Deprecation Period)

```bash
# Monitor old endpoint usage
# Should trend toward 0%

# Check logs for deprecation warnings
# (Add deprecation warnings to old endpoints first)
```

---

### Step 4: After 30 Days (Removal)

```bash
# Delete code files
rm lib/soulPath/storage.ts
rm lib/birthChart/storage.ts
rm lib/numerology/storage.ts
rm app/api/birth-chart/route.ts
rm app/api/numerology/route.ts

# Apply cleanup migration
npx supabase migration new remove_stone_tablets
# (Copy SQL from Section 6)

npx supabase db push

# Verify removal
psql "$DATABASE_URL" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('soul_paths', 'numerology_profiles');
"
# Expected: 0 rows (or 1 row if global numerology_library exists)

# Verify no code references remain
grep -r "soul_paths" --include="*.ts" --include="*.tsx" | grep -v "docs/"
grep -r "from.*soulPath" --include="*.ts" --include="*.tsx"
grep -r "from.*birthChart/storage" --include="*.ts" --include="*.tsx"
grep -r "from.*numerology/storage" --include="*.ts" --include="*.tsx"
# Expected: 0 results each
```

---

## 9. Risks and Mitigations

### Risk 1: Accidental Data Loss

**Scenario**: Drop tables before migration complete, losing user data

**Mitigation**:
- HARD RULE: NO table drops until 30 days after UI migration
- Verify old endpoint usage is 0% before removal
- Take database backup before cleanup migration
- Test migration on staging first

---

### Risk 2: Incomplete Code Removal

**Scenario**: Miss some Stone Tablets references, causing runtime errors

**Mitigation**:
- Use comprehensive grep searches (Section 7)
- Run full test suite before and after removal
- Deploy to staging first
- Monitor error rates after deployment

---

### Risk 3: Wrong Table Dropped

**Scenario**: Drop global `numerology_library` thinking it's the user-scoped `numerology_profiles`

**Mitigation**:
- Cleanup migration checks for `user_id` column before dropping (see SQL in Section 6)
- Only drop if table has user-scoped pattern
- Verify table schema before DROP command
- Test migration on staging first

---

## 10. Timeline

### Day 1 (Today)
- ✅ Document all Stone Tablets references (this file)
- ⏳ Fix endpoint parity issues

### Day 2-3
- Complete endpoint parity (AI narratives, cycles)
- Write parity tests
- Verify exact response shape matching

### Day 4
- Migrate UI to new endpoints
- Deploy with monitoring
- Add deprecation warnings to old endpoints

### Days 5-34 (30-day deprecation)
- Monitor old endpoint usage
- Verify trending toward 0%
- Fix any remaining issues

### Day 35
- Delete Stone Tablets code files
- Apply cleanup migration (drop tables/columns)
- Verify complete removal
- Deploy to production

---

## 11. Success Criteria

### Code Removal Complete ✅ When:
- [ ] All Stone Tablets files deleted
- [ ] No imports of deleted files remain
- [ ] Full test suite passes
- [ ] No references to deleted code in active files

### Database Removal Complete ✅ When:
- [ ] `soul_paths` table dropped
- [ ] User-scoped `numerology_profiles` table dropped (if exists)
- [ ] Legacy profile columns dropped
- [ ] Verification queries return 0 rows
- [ ] Production deployment successful

### Library Book Fully Operational ✅ When:
- [ ] New endpoints have 100% usage
- [ ] Old endpoints have 0% usage
- [ ] All UI using Library Book pattern
- [ ] No Stone Tablets references in codebase
- [ ] Documentation updated

---

**END OF STONE TABLETS REMOVAL PROOF**
