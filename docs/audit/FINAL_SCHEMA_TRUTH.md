# FINAL SCHEMA TRUTH — Library Book Model

**Date**: 2026-01-26
**Purpose**: Document the target database schema state for Library Book implementation
**Status**: ⚠️ CRITICAL ISSUES FOUND

---

## Executive Summary

### ✅ Target State (What Should Exist)

```
public.charts (chart_key TEXT PRIMARY KEY)
public.numerology_library (numerology_key TEXT PRIMARY KEY)
public.profiles.official_chart_key TEXT
public.profiles.official_numerology_key TEXT
```

### ❌ Legacy State (What Must Be Removed)

```
public.soul_paths (user_id PRIMARY KEY) - Stone Tablets
public.numerology_profiles (user_id in schema) - Stone Tablets
public.profiles.birth_chart_placements_json JSONB - Stone Tablets
public.profiles.birth_chart_computed_at TIMESTAMPTZ - Stone Tablets
```

### 🚨 CRITICAL FINDING: Wrong Migration Applied

**Migration**: `supabase/migrations/20260126090000_patch_library_book_remote.sql`

**Issue**: Creates table with WRONG name:
```sql
-- Line 32 - WRONG TABLE NAME
CREATE TABLE IF NOT EXISTS public.numerology_profiles (
  numerology_key text PRIMARY KEY,
  ...
);
```

**Should be**: `numerology_library` (global deduplication)
**Actually created**: `numerology_profiles` (misleading name suggests user-scoping)

**Status**:
- File created: 2026-01-26 06:10 AM
- Git status: UNTRACKED
- Applied to database: ⚠️ **CANNOT VERIFY** (no database connection)
- Appears in migration list: YES (timestamp 20260126090000)

**Action Required**:
1. Verify if this migration was applied to local/remote database
2. If applied: Create corrective migration to rename `numerology_profiles` → `numerology_library`
3. If not applied: DELETE this migration and use the correct one (20260125000000)

---

## 1. Target State Tables

### 1.1 Global Charts Library

**Table**: `public.charts`

```sql
CREATE TABLE public.charts (
  chart_key TEXT PRIMARY KEY,              -- SHA-256 hash of inputs + config
  input_json JSONB NOT NULL,               -- {birth_date, birth_time, birth_lat, birth_lon, timezone}
  geometry_json JSONB NOT NULL,            -- SwissPlacements (planets, houses, angles, aspects)
  engine_config JSONB NOT NULL,            -- {house_system, zodiac, schema_version}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX idx_charts_last_accessed ON charts(last_accessed_at DESC);
CREATE INDEX idx_charts_created_at ON charts(created_at DESC);
```

**Purpose**: Global deduplication of birth chart computations
**Key Property**: Multiple users with same birth data share ONE record
**RLS**: Read-only for authenticated users, write-only for service role

**Source Migration**: `20260125000000_library_book_model.sql` (lines 22-69)

---

### 1.2 Global Numerology Library

**Table**: `public.numerology_library` ✅ CORRECT NAME

```sql
CREATE TABLE public.numerology_library (
  numerology_key TEXT PRIMARY KEY,        -- SHA-256 hash of name + birth_date + config
  input_json JSONB NOT NULL,              -- {first_name, middle_name, last_name, birth_date}
  numerology_json JSONB NOT NULL,         -- {lifePathNumber, expressionNumber, ...}
  config_version INTEGER NOT NULL,        -- Algorithm version (for cache invalidation)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX idx_numerology_last_accessed ON numerology_library(last_accessed_at DESC);
CREATE INDEX idx_numerology_created_at ON numerology_library(created_at DESC);
```

**Purpose**: Global deduplication of numerology computations
**Key Property**: Multiple users with same name+birthdate share ONE record
**RLS**: Read-only for authenticated users, write-only for service role

**Source Migration**: `20260125000000_library_book_model.sql` (lines 75-113)

---

### 1.3 Profiles Table (Pointer Columns Only)

**Table**: `public.profiles`

**Library Book Columns Added**:
```sql
ALTER TABLE public.profiles
  ADD COLUMN official_chart_key TEXT;          -- Points to charts.chart_key

ALTER TABLE public.profiles
  ADD COLUMN official_numerology_key TEXT;     -- Points to numerology_library.numerology_key

-- Indexes
CREATE INDEX idx_profiles_official_chart_key
  ON profiles(official_chart_key) WHERE official_chart_key IS NOT NULL;

CREATE INDEX idx_profiles_official_numerology_key
  ON profiles(official_numerology_key) WHERE official_numerology_key IS NOT NULL;
```

**Semantics**:
- `official_chart_key` is NULL when Settings has incomplete birth data
- `official_numerology_key` is NULL when Settings has incomplete name data
- Keys are computed from Settings (source of truth) only
- Preview mode does NOT touch these columns

**Source Migration**: `20260125000000_library_book_model.sql` (lines 119-154)

---

## 2. Legacy Tables to Remove (Stone Tablets)

### 2.1 Soul Paths Table

**Table**: `public.soul_paths`

```sql
-- Created by: sql/002_create_soul_paths_table.sql
CREATE TABLE public.soul_paths (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  birth_input_hash TEXT NOT NULL,
  soul_path_json JSONB NOT NULL
);
```

**Pattern**: User-scoped caching (one record per user)
**Conflicts with**: Global deduplication (Library Book)
**Status**: ❌ MUST BE REMOVED

**Referenced by**:
- `lib/soulPath/storage.ts` (230 lines)
- `app/api/birth-chart/route.ts` (old endpoint)
- Multiple RLS migrations

**Removal Timeline**: After old `/api/birth-chart` endpoint deprecated (30-day transition)

---

### 2.2 User-Scoped Numerology Profiles

**Table**: `public.numerology_profiles` (user-scoped version)

```sql
-- Created by: 20260106140000_reconcile_public_schema_from_prod.sql (line 248)
-- Also: 20250101000000_numerology_schema.sql (line 4)
CREATE TABLE public.numerology_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                   -- ⚠️ User-scoped (Stone Tablets pattern)
  system TEXT NOT NULL DEFAULT 'pythagorean',
  input_hash TEXT NOT NULL,
  profile_json JSONB NOT NULL,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one profile per user per system per hash
CREATE UNIQUE INDEX idx_numerology_profiles_user_system_hash
  ON numerology_profiles(user_id, system, input_hash);
```

**Pattern**: User-scoped caching (has `user_id` column)
**Conflicts with**: Global deduplication (Library Book)
**Status**: ❌ MUST BE REMOVED

**Note**: This is NOT the same as `numerology_library` (which is global and has `numerology_key` as PK)

**Referenced by**:
- `lib/numerology/storage.ts` (old Stone Tablets implementation)
- Old `/api/numerology` endpoint

**Removal Timeline**: After old `/api/numerology` endpoint deprecated

---

### 2.3 Legacy Profile Columns

**Table**: `public.profiles`

**Columns to Remove**:
```sql
birth_chart_placements_json JSONB           -- Line 37 in baseline migration
birth_chart_computed_at TIMESTAMPTZ          -- Line 38 in baseline migration
```

**Pattern**: Inline caching in profiles table (Stone Tablets)
**Conflicts with**: Separation of concerns (profiles = user data, library = computations)
**Status**: ❌ MUST BE REMOVED

**Referenced by**:
- `lib/birthChart/storage.ts:68` (uses birth_chart_placements_json)

**Removal Timeline**: After old `/api/birth-chart` endpoint deprecated

---

## 3. Schema Conflicts

### 3.1 Table Name Collision

**Problem**: TWO different tables both named `numerology_profiles`:

1. **User-scoped Stone Tablets version** (WRONG for Library Book):
   - Has `user_id` column (user-scoped)
   - Created by: `20260106140000_reconcile_public_schema_from_prod.sql`
   - Pattern: One record per user per hash

2. **Incorrectly Named Global Library** (from patch migration):
   - Has `numerology_key` as PRIMARY KEY (global)
   - Created by: `20260126090000_patch_library_book_remote.sql` (line 32)
   - Pattern: Global deduplication (correct pattern, wrong name)

**Resolution**:
- The global library table MUST be named `numerology_library` (not `numerology_profiles`)
- Only ONE numerology table should exist in final state
- User-scoped `numerology_profiles` must be dropped entirely

---

### 3.2 Migration Conflict Timeline

```
20250101000000_numerology_schema.sql
  └─> Creates user-scoped `numerology_profiles` (Stone Tablets)

20260106140000_reconcile_public_schema_from_prod.sql
  └─> Creates user-scoped `numerology_profiles` (Stone Tablets, from prod)

20260125000000_library_book_model.sql ✅ CORRECT
  └─> Creates global `numerology_library` (Library Book)

20260126090000_patch_library_book_remote.sql ❌ WRONG
  └─> Creates global table but names it `numerology_profiles` (misleading)

20260126120000_fix_numerology_table_name.sql ❌ DELETED (was wrong direction)
  └─> Attempted to rename `numerology_library` → `numerology_profiles` (backwards!)
```

---

## 4. SQL Verification Queries

### 4.1 Check Library Book Tables Exist

```sql
-- Should return 2 rows: charts, numerology_library
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('charts', 'numerology_library');
```

**Expected Output**:
```
 table_name
-------------------
 charts
 numerology_library
```

---

### 4.2 Check Profiles Has Official Keys

```sql
-- Should return 2 rows: official_chart_key, official_numerology_key
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('official_chart_key', 'official_numerology_key')
ORDER BY column_name;
```

**Expected Output**:
```
       column_name        | data_type | is_nullable
--------------------------+-----------+-------------
 official_chart_key       | text      | YES
 official_numerology_key  | text      | YES
```

---

### 4.3 Check Stone Tablets Tables Still Exist (Pre-Removal)

```sql
-- Should return 2 rows: soul_paths, numerology_profiles
-- After removal: should return 0 rows
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('soul_paths', 'numerology_profiles');
```

**Current State** (before removal):
```
    table_name
---------------------
 soul_paths
 numerology_profiles
```

**Target State** (after removal):
```
 table_name
------------
(0 rows)
```

---

### 4.4 Check Legacy Profile Columns Still Exist (Pre-Removal)

```sql
-- Should return 2 rows: birth_chart_placements_json, birth_chart_computed_at
-- After removal: should return 0 rows
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('birth_chart_placements_json', 'birth_chart_computed_at')
ORDER BY column_name;
```

**Current State** (before removal):
```
         column_name          | data_type
------------------------------+----------------------------
 birth_chart_placements_json  | jsonb
 birth_chart_computed_at      | timestamp with time zone
```

**Target State** (after removal):
```
 column_name | data_type
-------------+-----------
(0 rows)
```

---

### 4.5 Check for Wrong Table Name

```sql
-- Check if numerology_profiles has user_id (Stone Tablets) or numerology_key (Library Book)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'numerology_profiles'
  AND column_name IN ('user_id', 'numerology_key')
ORDER BY column_name;
```

**If returns `numerology_key`**: Table exists but has wrong name (should be `numerology_library`)
**If returns `user_id`**: Stone Tablets table still exists (needs removal)
**If returns both**: CONFLICT - both tables exist with same name (impossible, but check anyway)

---

## 5. Migration Action Items

### 5.1 CRITICAL: Verify Patch Migration Status

**Command**:
```bash
# Check if patch migration was applied to local database
psql "$DATABASE_URL" -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20260126090000';"

# Or use Supabase CLI
npx supabase db remote commit
```

**If applied** (returns a row):
- Migration created `numerology_profiles` table (wrong name)
- Need corrective migration to rename `numerology_profiles` → `numerology_library`

**If not applied** (returns 0 rows):
- Safe to delete patch migration file
- Use the correct migration (20260125000000_library_book_model.sql) instead

---

### 5.2 Create Corrective Migration (If Patch Was Applied)

**File**: `supabase/migrations/20260127000000_fix_numerology_table_name.sql`

```sql
-- Corrective migration: Rename numerology_profiles → numerology_library
-- Only needed if 20260126090000_patch_library_book_remote.sql was applied

-- Check if the wrongly-named table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'numerology_profiles'
      AND table_schema = 'public'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'numerology_profiles'
      AND column_name = 'numerology_key'
      AND table_schema = 'public'
  ) THEN
    -- This is the Library Book table with wrong name
    ALTER TABLE public.numerology_profiles RENAME TO numerology_library;

    -- Rename indexes
    ALTER INDEX IF EXISTS numerology_profiles_pkey RENAME TO numerology_library_pkey;
    ALTER INDEX IF EXISTS numerology_profiles_created_at_idx RENAME TO idx_numerology_created_at;
  END IF;
END $$;
```

---

### 5.3 Create Final Cleanup Migration (After 30-Day Transition)

**File**: `supabase/migrations/20260227000000_remove_stone_tablets.sql`

```sql
-- Remove all Stone Tablets tables and columns
-- Run AFTER old endpoints deprecated (30-day transition period)

-- Drop Stone Tablets tables
DROP TABLE IF EXISTS public.soul_paths CASCADE;
DROP TABLE IF EXISTS public.numerology_profiles CASCADE;  -- User-scoped version only

-- Drop legacy profile columns
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS birth_chart_placements_json,
  DROP COLUMN IF EXISTS birth_chart_computed_at;

-- Verification
SELECT 'Stone Tablets removed successfully' AS status;
```

---

## 6. Current State Summary

### ✅ Confirmed Correct

1. **Migration 20260125000000** creates correct schema:
   - `charts` table with `chart_key` PK ✅
   - `numerology_library` table with `numerology_key` PK ✅
   - Adds `official_chart_key` and `official_numerology_key` to profiles ✅

2. **Code uses correct table names**:
   - `lib/library/charts.ts` queries `charts` ✅
   - `lib/library/numerology.ts` queries `numerology_library` ✅ (fixed in latest commit)

### ❌ Issues Found

1. **Wrong migration exists**: `20260126090000_patch_library_book_remote.sql`
   - Creates `numerology_profiles` instead of `numerology_library`
   - File status: UNTRACKED in git
   - Database status: ⚠️ CANNOT VERIFY (appears in migration list but no DB connection)

2. **Stone Tablets not yet removed**:
   - `soul_paths` table still exists
   - User-scoped `numerology_profiles` table still exists
   - Legacy profile columns still exist
   - Old endpoint implementations still active

3. **Noon defaulting violations** (in Stone Tablets code):
   - `lib/soulPath/storage.ts:184` - `birth_time || "12:00"`
   - `lib/birthChart/storage.ts:68` - `birth_time || "12:00"`
   - Will be removed when Stone Tablets files deleted

---

## 7. Next Steps

### Immediate (Day 1)

1. ✅ Delete wrong migration if not applied:
   ```bash
   rm supabase/migrations/20260126090000_patch_library_book_remote.sql
   ```

2. ⚠️ Verify database state:
   ```bash
   # Connect to database and run verification queries from Section 4
   psql "$DATABASE_URL" -f docs/audit/verify_schema.sql
   ```

3. 🔧 Create corrective migration if needed (see Section 5.2)

### Short-term (Day 2-4)

4. Complete endpoint parity (Birth Chart + Numerology AI narratives)
5. Migrate UI to new endpoints
6. Deprecate old endpoints (add warning logs)

### Long-term (Day 30+)

7. Drop Stone Tablets tables and columns (see Section 5.3)
8. Delete Stone Tablets implementation files
9. Monitor library table growth and access patterns

---

## Appendix A: File References

### Library Book Files
- `lib/library/charts.ts` - Global charts library implementation
- `lib/library/numerology.ts` - Global numerology library implementation ✅ FIXED
- `lib/library/keyNormalization.ts` - Deterministic key generation
- `app/api/birth-chart-library/route.ts` - New chart endpoint (incomplete)
- `app/api/numerology-library/route.ts` - New numerology endpoint (incomplete)

### Stone Tablets Files (TO DELETE)
- `lib/soulPath/storage.ts` - User-scoped soul path caching
- `lib/birthChart/storage.ts` - Legacy inline caching
- `lib/numerology/storage.ts` - User-scoped numerology caching
- `sql/002_create_soul_paths_table.sql` - Creates soul_paths table
- `app/api/birth-chart/route.ts` - Old endpoint using Stone Tablets
- `app/api/numerology/route.ts` - Old endpoint using Stone Tablets

### Migrations
- ✅ `20260125000000_library_book_model.sql` - CORRECT (creates Library Book schema)
- ❌ `20260126090000_patch_library_book_remote.sql` - WRONG (wrong table name)
- ✅ DELETED: `20260126120000_fix_numerology_table_name.sql` - Was backwards

---

**END OF SCHEMA TRUTH DOCUMENT**
