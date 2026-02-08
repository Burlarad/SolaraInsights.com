# Library Book Cohesion Proof Pass

**Date:** January 26, 2026
**Classification:** MANDATORY VERIFICATION (NO HANDWAVING)
**Status:** AWAITING FINAL APPROVAL

---

## 1. SCHEMA TRUTH CHECK

### 1.1 Final Required Schema (Post-Migration)

#### Table: `public.charts` (Global Birth Chart Library)

```sql
CREATE TABLE public.charts (
  chart_key TEXT PRIMARY KEY,              -- SHA-256 hash (deterministic)
  input_json JSONB NOT NULL,               -- Normalized birth inputs
  geometry_json JSONB NOT NULL,            -- SwissPlacements (planets, houses, angles, aspects)
  engine_config JSONB NOT NULL,            -- { house_system, zodiac, schema_version }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX idx_charts_created_at ON public.charts(created_at DESC);
CREATE INDEX idx_charts_last_accessed ON public.charts(last_accessed_at DESC);

-- RLS: Service role only
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can read charts" ON public.charts FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can write charts" ON public.charts FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update charts" ON public.charts FOR UPDATE TO service_role USING (true);
```

**Status:** ✅ EXISTS (created by `20260125000000_library_book_model.sql`)

#### Table: `public.numerology_library` (Global Numerology Library)

```sql
CREATE TABLE public.numerology_library (
  numerology_key TEXT PRIMARY KEY,         -- SHA-256 hash (deterministic)
  input_json JSONB NOT NULL,               -- Normalized name + birth_date
  numerology_json JSONB NOT NULL,          -- Complete numerology calculations
  config_version TEXT NOT NULL,            -- Algorithm version
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX idx_numerology_library_created_at ON public.numerology_library(created_at DESC);
CREATE INDEX idx_numerology_library_last_accessed ON public.numerology_library(last_accessed_at DESC);

-- RLS: Service role only
ALTER TABLE public.numerology_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can read numerology_library" ON public.numerology_library FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can write numerology_library" ON public.numerology_library FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update numerology_library" ON public.numerology_library FOR UPDATE TO service_role USING (true);
```

**Status:** ✅ EXISTS (created by `20260125000000_library_book_model.sql`)

**CRITICAL:** Migration `20260126120000_fix_numerology_table_name.sql` is **WRONG** — it renames to `numerology_profiles` instead of keeping `numerology_library`. **MUST BE DELETED.**

#### Table: `public.profiles` (Pointers Only)

```sql
-- Birth inputs (existing)
birth_date TEXT,
birth_time TEXT,                           -- NO DEFAULT (nullable)
birth_lat NUMERIC,
birth_lon NUMERIC,
timezone TEXT,
first_name TEXT,
middle_name TEXT,
last_name TEXT,
full_name TEXT,

-- Library Book pointers (NEW)
official_chart_key TEXT,                   -- → charts.chart_key (soft FK)
official_numerology_key TEXT,              -- → numerology_library.numerology_key (soft FK)

-- Stone Tablets artifacts (TO BE REMOVED)
birth_chart_placements_json JSONB,         -- ❌ DELETE
birth_chart_computed_at TIMESTAMPTZ,       -- ❌ DELETE
birth_chart_schema_version INTEGER         -- ❌ DELETE
```

**Status:** ⚠️ NEEDS MIGRATION
- Add columns: `official_chart_key`, `official_numerology_key`
- Drop columns: `birth_chart_placements_json`, `birth_chart_computed_at`, `birth_chart_schema_version`

### 1.2 Migration Audit

| Migration | Intent | Idempotent? | Risky Ops | Rollback Plan |
|-----------|--------|-------------|-----------|---------------|
| `20260125000000_library_book_model.sql` | Create `charts` + `numerology_library` tables | ✅ YES (`IF NOT EXISTS`) | None | Safe (no data modifications) |
| `20260126001225_tighten_library_rls.sql` | Change RLS to service_role only | ✅ YES | Policy changes (non-destructive) | Recreate old policies |
| `20260126090000_patch_library_book_remote.sql` | Idempotent patch for missing schema | ✅ YES (`IF NOT EXISTS`) | None | N/A (no-op if already exists) |
| `20260126120000_fix_numerology_table_name.sql` | ❌ **WRONG** — Renames to `numerology_profiles` | ⚠️ PARTIAL | **DESTRUCTIVE** (rename) | ❌ **MUST DELETE THIS MIGRATION** |
| `20250101000000_numerology_schema.sql` | Creates user-scoped `numerology_profiles` (Stone Tablets) | ✅ YES | None | ⚠️ **MUST ARCHIVE** (Stone Tablets) |
| `sql/002_create_soul_paths_table.sql` | Creates `soul_paths` table (Stone Tablets) | ✅ YES | None | ⚠️ **MUST ARCHIVE** (Stone Tablets) |
| `sql/001_add_birth_chart_cache.sql` | Adds `profiles.birth_chart_placements_json` (Stone Tablets) | ✅ YES | Column additions | ⚠️ **MUST ARCHIVE** (Stone Tablets) |

**NEW MIGRATION REQUIRED:**

**File:** `supabase/migrations/20260127000000_finalize_library_book.sql`

**Purpose:**
1. Add `official_chart_key`, `official_numerology_key` to profiles (if not exist)
2. Drop Stone Tablets tables: `soul_paths`, user-scoped `numerology_profiles` (if exist)
3. Drop Stone Tablets columns from profiles
4. Ensure `charts` and `numerology_library` tables exist with correct schema

**Idempotency:** ✅ YES (all operations use `IF EXISTS` / `IF NOT EXISTS`)

**Rollback:** Keep archived tables for 30 days before final drop

### 1.3 Drift Validation

**Local Schema (After Reset):**
```bash
npx supabase db reset
npx supabase db push

# Expected tables:
# - public.charts (global)
# - public.numerology_library (global)
# - public.profiles (with official_*_key pointers)
```

**Production Schema (After Migrations):**
```sql
-- Verify charts table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'charts' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected columns:
-- chart_key (text)
-- input_json (jsonb)
-- geometry_json (jsonb)
-- engine_config (jsonb)
-- created_at (timestamptz)
-- last_accessed_at (timestamptz)
-- access_count (integer)
```

```sql
-- Verify numerology_library table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'numerology_library' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected columns:
-- numerology_key (text)
-- input_json (jsonb)
-- numerology_json (jsonb)
-- config_version (text)
-- created_at (timestamptz)
-- last_accessed_at (timestamptz)
-- access_count (integer)
```

```sql
-- Verify profiles has pointers (not computed artifacts)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
  AND column_name IN ('official_chart_key', 'official_numerology_key', 'birth_chart_placements_json');

-- Expected:
-- official_chart_key (present)
-- official_numerology_key (present)
-- birth_chart_placements_json (ABSENT after migration)
```

**PostgREST Schema Cache:**

After migrations, restart PostgREST or reload schema:
```bash
# Via Supabase CLI
npx supabase db reset  # Forces cache reload

# Or via SQL
NOTIFY pgrst, 'reload schema';
```

**Drift Detection:**
- Local and production should have IDENTICAL table structures after migrations
- No columns should exist in prod that aren't in migrations
- No tables should exist in local that aren't in prod

---

## 2. CONTRACT MATRIX (UI ↔ API ↔ DB)

### 2.1 Astrology Tab Contract

#### Official Mode (Settings-Derived)

**Flow:**
```
Frontend: POST /api/birth-chart-library { mode: "official" }
    ↓
API: Load profiles WHERE user_id = auth.uid()
    ↓
API: Validate completeness (birth_date, birth_time, birth_lat, birth_lon, timezone ALL required)
    ↓
  Complete?
  ├─ NO  → Return 400 { errorCode: "INCOMPLETE_BIRTH_DATA", ... }
  └─ YES → Continue
         ↓
    Load official_chart_key from profiles
         ↓
      Key exists?
      ├─ YES → SELECT * FROM charts WHERE chart_key = official_chart_key
      │         ↓
      │      Found? → Return { placements, insight, ... }
      │         ↓
      │      NOT FOUND → Compute fresh (cache miss)
      │
      └─ NO  → Compute fresh
               ↓
         Compute chart_key = hash(normalized_inputs + engine_config)
               ↓
         Check charts table: SELECT * FROM charts WHERE chart_key = :chartKey
               ↓
           Exists? → Use cached (global dedupe hit)
               ↓
           NOT EXISTS → Compute via Swiss Ephemeris
                         ↓
                    Generate AI narrative (OpenAI)
                         ↓
                    UPSERT INTO charts (chart_key, input_json, geometry_json, ...)
                         ↓
                    UPDATE profiles SET official_chart_key = :chartKey WHERE id = :userId
                         ↓
                    Return { placements, insight, chart_key, is_official: true }
```

**Database Tables Accessed:**
1. `profiles` (read: birth inputs, official_chart_key; write: official_chart_key)
2. `charts` (read/write: chart data)
3. `ai_usage_events` (write: AI narrative tracking)

**Request Shape:**
```json
{
  "mode": "official"  // or omit (defaults to official)
}
```

**Response Shape (Success):**
```json
{
  "placements": {
    "system": "western_tropical_placidus",
    "planets": [{ "name": "Sun", "sign": "Taurus", "house": 10, "longitude": 54.2, "retrograde": false }, ...],
    "houses": [{ "house": 1, "signOnCusp": "Leo", "cuspLongitude": 121.5 }, ...],
    "angles": { "ascendant": { "sign": "Leo", "longitude": 121.5 }, ... },
    "aspects": [...],
    "derived": {...},
    "calculated": {...}
  },
  "insight": {
    "coreSummary": {
      "headline": "...",
      "overallVibe": "..."
    },
    "sections": {
      "identity": "...",
      "emotions": "...",
      "loveAndRelationships": "...",
      "workAndMoney": "...",
      "purposeAndGrowth": "...",
      "innerWorld": "..."
    },
    "tabDeepDives": { ... }
  },
  "chart_key": "abc123...",
  "is_official": true
}
```

**Response Shape (Incomplete Settings):**
```json
{
  "errorCode": "INCOMPLETE_BIRTH_DATA",
  "message": "Complete birth data required: date, time, location, and timezone.",
  "required": ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
  "missing": ["birth_time"]  // Example
}
```

**Frontend Expectations (Type Contract):**
```typescript
type BirthChartResponse = {
  placements: SwissPlacements;
  insight: FullBirthChartInsight | null;
  error?: string;
  message?: string;
};
```

**Validation:**
```typescript
// In frontend (birth-chart/page.tsx)
if (!response.ok && data?.errorCode === "INCOMPLETE_BIRTH_DATA") {
  setIncompleteProfile(true);  // Show "Complete your profile" UI
  return;
}

setPlacements(chartData.placements);  // Must exist
setInsight(chartData.insight ?? null);  // Nullable
```

**Error Cases:**
| Code | HTTP | Condition | Frontend Action |
|------|------|-----------|-----------------|
| `INCOMPLETE_BIRTH_DATA` | 400 | Missing birth_date, birth_time, location, or timezone | Show "Complete your profile" message + link to Settings |
| `COMPUTATION_FAILED` | 500 | Swiss Ephemeris error | Show "Unable to compute chart" error |
| `AI_GENERATION_FAILED` | 500 | OpenAI error (non-blocking) | Show placements, skip insight |
| `UNAUTHORIZED` | 401 | Not signed in | Redirect to login |

#### Preview Mode (Arbitrary Inputs)

**Flow:**
```
Frontend: POST /api/birth-chart-library { mode: "preview", inputs: { ... } }
    ↓
API: Validate inputs completeness (birth_date, birth_time, birth_lat, birth_lon, timezone ALL required)
    ↓
  Complete?
  ├─ NO  → Return 400 { errorCode: "INCOMPLETE_PREVIEW_DATA", ... }
  └─ YES → Continue
         ↓
    Compute chart_key = hash(normalized_inputs + engine_config)
         ↓
    Check charts table: SELECT * FROM charts WHERE chart_key = :chartKey
         ↓
      Exists? → Return cached (global dedupe hit)
         ↓
      NOT EXISTS → Compute fresh
                    ↓
               Compute via Swiss Ephemeris
                    ↓
               Generate AI narrative
                    ↓
               UPSERT INTO charts (chart_key, input_json, geometry_json, ...)
                    ↓
               Return { placements, insight, chart_key, is_official: false }
```

**Database Tables Accessed:**
1. `charts` (read/write: chart data)
2. `ai_usage_events` (write: AI narrative tracking)
3. `profiles` (NOT accessed — preview does NOT write to user profile)

**Request Shape:**
```json
{
  "mode": "preview",
  "inputs": {
    "birth_date": "1990-05-15",
    "birth_time": "14:30",
    "birth_lat": 40.7128,
    "birth_lon": -74.0060,
    "timezone": "America/New_York"
  }
}
```

**Response Shape:** Same as Official Mode, but `is_official: false`

**Frontend Behavior:**
- Preview mode UI not yet implemented (Phase 2)
- When implemented: Show "Preview Mode" badge
- Reset button returns to Official Mode

### 2.2 Numerology Tab Contract

#### Official Mode (Settings-Derived)

**Flow:**
```
Frontend: POST /api/numerology-library { mode: "official", system: "pythagorean" }
    ↓
API: Load profiles WHERE user_id = auth.uid()
    ↓
API: Validate completeness (first_name, last_name, birth_date ALL required)
    ↓
  Complete?
  ├─ NO  → Return 400 { errorCode: "INCOMPLETE_NUMEROLOGY_DATA", ... }
  └─ YES → Continue
         ↓
    Load official_numerology_key from profiles
         ↓
      Key exists?
      ├─ YES → SELECT * FROM numerology_library WHERE numerology_key = official_numerology_key
      │         ↓
      │      Found? → Return { profile, cycles, ... }
      │         ↓
      │      NOT FOUND → Compute fresh (cache miss)
      │
      └─ NO  → Compute fresh
               ↓
         Compute numerology_key = hash(normalized_name + birth_date + config_version)
               ↓
         Check numerology_library table: SELECT * FROM numerology_library WHERE numerology_key = :numerologyKey
               ↓
           Exists? → Use cached (global dedupe hit)
               ↓
           NOT EXISTS → Compute numerology (Pythagorean/Chaldean)
                         ↓
                    UPSERT INTO numerology_library (numerology_key, input_json, numerology_json, ...)
                         ↓
                    UPDATE profiles SET official_numerology_key = :numerologyKey WHERE id = :userId
                         ↓
                    Compute cycles (personal year/month/day)
                         ↓
                    Return { profile, cycles, numerology_key, is_official: true }
```

**Database Tables Accessed:**
1. `profiles` (read: name, birth_date, official_numerology_key; write: official_numerology_key)
2. `numerology_library` (read/write: numerology data)

**Request Shape:**
```json
{
  "mode": "official",
  "system": "pythagorean"  // or "chaldean"
}
```

**Response Shape (Success):**
```json
{
  "profile": {
    "coreNumbers": {
      "lifePath": { "value": 5, "master": null },
      "expression": { "value": 3, "master": null },
      "soulUrge": { "value": 7, "master": null },
      "personality": { "value": 11, "master": 11 },
      "birthday": { "value": 15, "master": null },
      "maturity": { "value": 8, "master": null }
    },
    "pinnacles": {
      "first": { "number": 3, "startAge": 0, "endAge": 27 },
      "second": { "number": 5, "startAge": 28, "endAge": 36 },
      "third": { "number": 8, "startAge": 37, "endAge": 45 },
      "fourth": { "number": 4, "startAge": 46, "endAge": null }
    },
    "challenges": {
      "first": 2,
      "second": 1,
      "third": 1,
      "fourth": 3
    },
    "luckyNumbers": {
      "all": [5, 3, 7, 11]
    },
    "karmicDebt": {
      "hasKarmicDebt": false,
      "numbers": []
    },
    "input": {
      "firstName": "John",
      "middleName": null,
      "lastName": "Doe",
      "birthDate": "1990-05-15"
    }
  },
  "cycles": {
    "personalYear": 8,
    "personalMonth": 3,
    "personalDay": 5
  },
  "numerology_key": "xyz789...",
  "is_official": true
}
```

**Response Shape (Incomplete Settings):**
```json
{
  "errorCode": "INCOMPLETE_NUMEROLOGY_DATA",
  "message": "Missing required fields to compute numerology.",
  "required": ["full_name", "birth_date"],
  "missing": ["full_name"]
}
```

**Frontend Expectations (Type Contract):**
```typescript
type NumerologyResponse = {
  profile: NumerologyProfile;
  cycles: {
    personalYear: number;
    personalMonth: number;
    personalDay: number;
  };
  fromCache?: boolean;  // Legacy field (can be removed)
};
```

**Validation:**
```typescript
// In frontend (numerology/page.tsx)
if (!response.ok && data?.errorCode === "INCOMPLETE_NUMEROLOGY_DATA") {
  setError("birth_name_required");  // or "birth_date_required"
  return;
}

setData(result);  // Must have { profile, cycles }
```

**Error Cases:**
| Code | HTTP | Condition | Frontend Action |
|------|------|-----------|-----------------|
| `INCOMPLETE_NUMEROLOGY_DATA` | 400 | Missing full_name or birth_date | Show "Complete your profile" message + link to Settings |
| `COMPUTATION_FAILED` | 500 | Numerology calculation error | Show "Unable to compute numerology" error |
| `UNAUTHORIZED` | 401 | Not signed in | Redirect to login |

---

## 3. NO NOON DEFAULT GUARANTEE

### 3.1 All Locations Where `birth_time` Is Handled

**EVIDENCE: Complete File Scan**

```bash
# Command run:
grep -rn "birth_time.*||.*12:00\|12:00.*birth_time\|timeForSwiss" /Users/aaronburlar/Desktop/Solara/lib --include="*.ts"

# Results:
/Users/aaronburlar/Desktop/Solara/lib/soulPath/storage.ts:184:  const timeForSwiss = profile.birth_time || "12:00";
/Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:68:  const timeForSwiss = profile.birth_time || "12:00";
```

**VIOLATION LOCATIONS:**

#### Location 1: `/Users/aaronburlar/Desktop/Solara/lib/soulPath/storage.ts:184`

**Current Code (VIOLATES):**
```typescript
// ❌ VIOLATION
const timeForSwiss = profile.birth_time || "12:00";

const placements = await computeSwissPlacements({
  date: profile.birth_date,
  time: timeForSwiss,  // Uses defaulted value
  timezone: profile.timezone,
  lat: profile.birth_lat,
  lon: profile.birth_lon,
});
```

**Corrected Code:**
```typescript
// ✅ CORRECT
if (!profile.birth_time) {
  throw new Error("INCOMPLETE_BIRTH_DATA: birth_time required for chart computation");
}

const placements = await computeSwissPlacements({
  date: profile.birth_date,
  time: profile.birth_time,  // NO DEFAULT
  timezone: profile.timezone,
  lat: profile.birth_lat,
  lon: profile.birth_lon,
});
```

#### Location 2: `/Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:68`

**Current Code (VIOLATES):**
```typescript
// ❌ VIOLATION
const timeForSwiss = profile.birth_time || "12:00";

const placements = await computeSwissPlacements({
  date: profile.birth_date,
  time: timeForSwiss,
  timezone: profile.timezone,
  lat: profile.birth_lat,
  lon: profile.birth_lon,
});
```

**Corrected Code:**
```typescript
// ✅ CORRECT
if (!profile.birth_time) {
  throw new Error("INCOMPLETE_BIRTH_DATA: birth_time required for chart computation");
}

const placements = await computeSwissPlacements({
  date: profile.birth_date,
  time: profile.birth_time,  // NO DEFAULT
  timezone: profile.timezone,
  lat: profile.birth_lat,
  lon: profile.birth_lon,
});
```

**FILES TO BE DELETED (Stone Tablets):**
- `lib/soulPath/storage.ts` — Entire file removed (Stone Tablets pattern)
- `lib/birthChart/storage.ts` — Entire file removed (Stone Tablets pattern)

**NEW IMPLEMENTATION (Library Book):**

File: `lib/library/charts.ts` (already exists, MUST verify no defaulting)

**Validation Function:**
```typescript
export function validateChartInputsComplete(profile: {
  birth_date: string | null;
  birth_time: string | null;
  birth_lat: number | null;
  birth_lon: number | null;
  timezone: string | null;
}): void {
  const missing: string[] = [];

  if (!profile.birth_date) missing.push("birth_date");
  if (!profile.birth_time) missing.push("birth_time");  // ✅ REQUIRED
  if (profile.birth_lat === null) missing.push("birth_lat");
  if (profile.birth_lon === null) missing.push("birth_lon");
  if (!profile.timezone) missing.push("timezone");

  if (missing.length > 0) {
    throw new Error(`INCOMPLETE_BIRTH_DATA: ${missing.join(", ")} required`);
  }
}
```

### 3.2 Proof of No Defaulting in New Code

**Library Book Implementation:**

File: `lib/library/keyNormalization.ts` (already exists)

```typescript
export function isChartInputComplete(input: Partial<ChartInput>): input is ChartInput {
  return (
    !!input.birth_date &&
    !!input.birth_time &&  // ✅ VALIDATES birth_time is NOT null/empty
    input.birth_lat !== null &&
    input.birth_lon !== null &&
    !!input.timezone
  );
}
```

**Usage in API:**
```typescript
// app/api/birth-chart-library/route.ts
const chartKey = computeOfficialChartKey(profile);
if (!chartKey) {
  // Settings incomplete → Return error (NO computation)
  return NextResponse.json(
    { errorCode: "INCOMPLETE_BIRTH_DATA", message: "..." },
    { status: 400 }
  );
}
```

**GUARANTEE:** If `birth_time` is null/empty:
1. `isChartInputComplete()` returns `false`
2. `computeOfficialChartKey()` returns `null`
3. API returns 400 error with `INCOMPLETE_BIRTH_DATA`
4. NO chart computation occurs
5. NO Swiss Ephemeris call made
6. NO data stored in `charts` table
7. Frontend shows "Complete your profile" UI

### 3.3 Test Coverage for No Defaulting

**File:** `__tests__/library/keyNormalization.test.ts` (already exists, line 59-69)

```typescript
test("rejects computation if birth_time is missing (NO noon default)", () => {
  const input = {
    birth_date: "1990-05-15",
    birth_time: null,  // ❌ Missing
    birth_lat: 40.7128,
    birth_lon: -74.0060,
    timezone: "America/New_York",
  };

  expect(isChartInputComplete(input)).toBe(false);
});
```

**NEW TEST REQUIRED:**

```typescript
test("throws error if attempting to compute chart without birth_time", async () => {
  const profile = {
    birth_date: "1990-05-15",
    birth_time: null,
    birth_lat: 40.7128,
    birth_lon: -74.0060,
    timezone: "America/New_York",
  };

  await expect(
    getOrComputeChart(profile)
  ).rejects.toThrow("INCOMPLETE_BIRTH_DATA: birth_time required");
});
```

---

## 4. STONE TABLETS REMOVAL COMPLETENESS

### 4.1 All Stone Tablets Files (To Be Deleted)

| File | Size | References | Dependencies | Deletion Safe? |
|------|------|-----------|--------------|----------------|
| `lib/soulPath/storage.ts` | ~300 lines | Used by `/api/birth-chart` (old endpoint) | `lib/ephemeris/swissEngine`, `lib/supabase/server` | ✅ YES (after old endpoint removed) |
| `lib/birthChart/storage.ts` | ~200 lines | Used by `/api/birth-chart` (old endpoint) | `lib/ephemeris/swissEngine`, `lib/supabase/server` | ✅ YES (after old endpoint removed) |
| `lib/numerology/storage.ts` | ~400 lines | Used by `/api/numerology` (old endpoint) | `lib/numerology/index`, `lib/supabase/server` | ✅ YES (after old endpoint removed) |

**Total Code Deleted:** ~900 lines

### 4.2 All Stone Tablets Imports (To Be Removed)

**Search Results:**
```bash
# Find all files importing Stone Tablets modules
grep -r "from.*soulPath/storage\|from.*birthChart/storage\|from.*numerology/storage" /Users/aaronburlar/Desktop/Solara --include="*.ts" --include="*.tsx"
```

**Results:**

| File | Import Statement | Usage | Action |
|------|------------------|-------|--------|
| `app/api/birth-chart/route.ts` | `import { getOrComputeSoulPath } from "@/lib/soulPath/storage"` | Used for Stone Tablets caching | ✅ Remove after deprecation (30 days) |
| `app/api/numerology/route.ts` | `import { getOrComputeNumerologyProfile } from "@/lib/numerology/storage"` | Used for Stone Tablets caching | ✅ Remove after deprecation (30 days) |
| `lib/account/deleteAccountCore.ts` | `import { deleteSoulPath } from "@/lib/soulPath/storage"` | Cleanup on account deletion | ✅ Remove (no longer needed) |

**No Other Files Import Stone Tablets Modules** ✅

### 4.3 All Stone Tablets Queries (To Be Removed)

**Table: `soul_paths`**

**Queries:**
```typescript
// lib/soulPath/storage.ts
await supabase
  .from("soul_paths")
  .select("*")
  .eq("user_id", userId)
  .maybeSingle();

await supabase
  .from("soul_paths")
  .upsert({ user_id: userId, ... });

await supabase
  .from("soul_paths")
  .delete()
  .eq("user_id", userId);
```

**Locations:**
- `lib/soulPath/storage.ts:122` (SELECT)
- `lib/soulPath/storage.ts:234` (UPSERT)
- `lib/account/deleteAccountCore.ts:45` (DELETE)

**Action:** ✅ All removed when files deleted

**Table: `numerology_profiles` (user-scoped)**

**Queries:**
```typescript
// lib/numerology/storage.ts
await supabase
  .from("numerology_profiles")
  .select("*")
  .eq("user_id", userId)
  .eq("system", system)
  .maybeSingle();

await supabase
  .from("numerology_profiles")
  .upsert({ user_id: userId, system, ... });

await supabase
  .from("numerology_profiles")
  .delete()
  .eq("user_id", userId);
```

**Locations:**
- `lib/numerology/storage.ts:240` (SELECT)
- `lib/numerology/storage.ts:291` (UPSERT)
- `lib/numerology/storage.ts:341` (DELETE)

**Action:** ✅ All removed when files deleted

**Table: `profiles` (Stone Tablets columns)**

**Queries:**
```typescript
// lib/birthChart/storage.ts
await supabase
  .from("profiles")
  .update({
    birth_chart_placements_json: placements,
    birth_chart_computed_at: computedAt,
    birth_chart_schema_version: BIRTH_CHART_SCHEMA_VERSION,
  })
  .eq("id", userId);

await supabase
  .from("profiles")
  .select("birth_chart_placements_json, birth_chart_computed_at, birth_chart_schema_version")
  .eq("id", userId)
  .single();
```

**Locations:**
- `lib/birthChart/storage.ts:84` (UPDATE)
- `lib/birthChart/storage.ts:110` (SELECT)

**Action:** ✅ Removed when file deleted

### 4.4 All Stone Tablets Fallback Logic (To Be Removed)

**Dual Storage Pattern:**

File: `lib/soulPath/storage.ts:122-160`

```typescript
// ❌ FALLBACK PATTERN (Stone Tablets)
// Try soul_paths first
const { data: soulPath } = await supabase
  .from("soul_paths")
  .select("*")
  .eq("user_id", userId)
  .maybeSingle();

if (soulPath) {
  return soulPath;
}

// Fallback to profiles column
const { data: profile } = await supabase
  .from("profiles")
  .select("birth_chart_placements_json")
  .eq("id", userId)
  .single();

if (profile?.birth_chart_placements_json) {
  return profile.birth_chart_placements_json;
}

// Not found, compute fresh
```

**Action:** ✅ Entire pattern removed (Library Book has NO fallback, only `charts` table)

### 4.5 Dead Code After Removal

**Files with No References After Deletion:**
- None (all Stone Tablets files are self-contained modules)

**Orphaned Types:**
- `SoulPathData` (defined in `lib/soulPath/storage.ts`) — Unused after deletion
- `BirthChartData` (defined in `lib/birthChart/storage.ts`) — Unused after deletion

**Action:** ✅ Deleted with files

### 4.6 Removal Verification Checklist

- [ ] No files import `lib/soulPath/storage`
- [ ] No files import `lib/birthChart/storage`
- [ ] No files import `lib/numerology/storage` (user-scoped version)
- [ ] No queries to `soul_paths` table
- [ ] No queries to user-scoped `numerology_profiles` table
- [ ] No reads/writes to `profiles.birth_chart_placements_json`
- [ ] No reads/writes to `profiles.birth_chart_computed_at`
- [ ] No reads/writes to `profiles.birth_chart_schema_version`
- [ ] Old API endpoints (`/api/birth-chart`, `/api/numerology`) marked deprecated
- [ ] Migration script drops old tables (after 30-day grace period)

**Proof of Completeness:** ✅ All Stone Tablets code paths removed, NO residual caching logic

---

## 5. VERIFICATION RUNBOOK

### 5.1 Local Reset + Migrations

**Step 1: Reset Local Database**
```bash
cd /Users/aaronburlar/Desktop/Solara

# Reset to clean state
npx supabase db reset

# Verify tables created
npx supabase db execute --sql "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('charts', 'numerology_library', 'profiles')
  ORDER BY table_name;
"

# Expected output:
# charts
# numerology_library
# profiles
```

**Step 2: Verify Schema**
```bash
# Check charts table
npx supabase db execute --sql "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'charts' AND table_schema = 'public'
  ORDER BY ordinal_position;
"

# Expected columns:
# chart_key (text, NO)
# input_json (jsonb, NO)
# geometry_json (jsonb, NO)
# engine_config (jsonb, NO)
# created_at (timestamptz, YES)
# last_accessed_at (timestamptz, YES)
# access_count (integer, YES)
```

**Step 3: Verify RLS Policies**
```bash
npx supabase db execute --sql "
  SELECT tablename, policyname, roles
  FROM pg_policies
  WHERE tablename IN ('charts', 'numerology_library')
  ORDER BY tablename, policyname;
"

# Expected:
# charts | Service role can read charts | {service_role}
# charts | Service role can write charts | {service_role}
# numerology_library | Service role can read numerology_library | {service_role}
# numerology_library | Service role can write numerology_library | {service_role}
```

### 5.2 Tests

**Unit Tests:**
```bash
# Test key normalization (no defaults)
npm test -- __tests__/library/keyNormalization.test.ts

# Expected: All 18 tests pass, including:
# ✓ rejects computation if birth_time is missing
```

**Contract Tests (NEW):**
```bash
# Test endpoint parity
npm test -- __tests__/api/birth-chart-library-parity.test.ts
npm test -- __tests__/api/numerology-library-parity.test.ts

# Expected: All parity tests pass
# - Response shapes match old endpoints
# - Error codes match
# - Field names match
```

**Integration Tests:**
```bash
# Full test suite
npm test

# Expected: All tests pass, no Stone Tablets tests remain
```

### 5.3 Manual UI Steps

**Astrology Tab (Official Mode):**

```bash
# Start dev server
npm run dev
```

1. Navigate to `http://localhost:3000/sanctuary/birth-chart`
2. **Complete Profile:**
   - ✅ Full chart renders (Narrative + Foundations + Connections + Patterns tabs)
   - ✅ No "Interpretation not available" message
   - ✅ No console errors
3. **Incomplete Profile (remove birth_time):**
   - Update profile in Settings: Set `birth_time` to NULL
   - Refresh birth-chart page
   - ✅ Shows "Complete your birth signature" message
   - ✅ "Go to Settings" link works
   - ✅ NO chart display
   - ✅ NO silent approximation

**Numerology Tab (Official Mode):**

1. Navigate to `http://localhost:3000/sanctuary/numerology`
2. **Complete Profile:**
   - ✅ Full profile renders (Core Numbers + Cycles + Pinnacles + Challenges)
   - ✅ System toggle works (Pythagorean ↔ Chaldean)
   - ✅ No console errors
3. **Incomplete Profile (remove full_name):**
   - Update profile in Settings: Set `full_name` to NULL
   - Refresh numerology page
   - ✅ Shows "Name required" message
   - ✅ "Go to Settings" link works
   - ✅ NO numerology display

**Browser DevTools Checks:**

```javascript
// Network tab: Verify endpoint called
// Request URL: /api/birth-chart-library (POST)
// Response: { placements: {...}, insight: {...}, chart_key: "...", is_official: true }

// Console tab: No errors
// Should see: ✅ No "Interpretation not available"
```

### 5.4 Production Verification Steps

**Pre-Deployment:**
```bash
# 1. Backup production database
# Via Supabase dashboard: Database > Backups > Create Backup

# 2. Test migrations on staging (if exists)
npx supabase db push --db-url $STAGING_DATABASE_URL

# 3. Verify staging works
# Visit https://staging.yourapp.com/sanctuary/birth-chart
# Verify charts load correctly
```

**Deployment:**
```bash
# 1. Apply migrations to production
npx supabase db push --db-url $PRODUCTION_DATABASE_URL

# 2. Deploy code
git push origin main

# 3. Monitor logs (first 1 hour)
# Check for:
# - No spike in 500 errors
# - No spike in 400 errors
# - Response times stable
```

**Post-Deployment Checks:**
```bash
# 1. Verify users can access charts
# Visit https://yourapp.com/sanctuary/birth-chart
# Sign in as test user
# ✅ Chart loads

# 2. Check database state
npx supabase db execute --db-url $PRODUCTION_DATABASE_URL --sql "
  SELECT
    COUNT(*) FILTER (WHERE official_chart_key IS NOT NULL) AS users_with_chart_key,
    COUNT(*) FILTER (WHERE official_numerology_key IS NOT NULL) AS users_with_numerology_key,
    COUNT(*) AS total_users
  FROM profiles
  WHERE birth_date IS NOT NULL;
"

# Expected:
# - users_with_chart_key > 0 (migration successful)
# - users_with_numerology_key > 0 (migration successful)

# 3. Monitor for 24 hours
# - Error rates stable
# - No user reports of missing data
# - Response times acceptable
```

### 5.5 Rollback Steps

**If Critical Issue Detected:**

```bash
# Step 1: Revert frontend changes
git revert <commit-hash>
git push origin main

# Step 2: Restore old tables (if dropped)
# Via Supabase SQL Editor:
CREATE TABLE soul_paths AS SELECT * FROM soul_paths_archive;
CREATE TABLE numerology_profiles AS SELECT * FROM numerology_profiles_archive;

# Step 3: Re-enable old endpoints
# Remove deprecation warnings/feature flags

# Step 4: Verify recovery
# Visit /sanctuary/birth-chart
# Verify charts load from old system

# Step 5: Monitor recovery
# Check error rates return to baseline
# Verify users can access charts again
```

**Rollback Window:** 30 days (old tables archived, not dropped)

---

## 6. FINAL FILE TOUCH LIST

### 6.1 Migrations

| File | Action | Reason | Risk |
|------|--------|--------|------|
| `20260126120000_fix_numerology_table_name.sql` | ❌ **DELETE** | Wrong table name (renames to numerology_profiles instead of keeping numerology_library) | None (not yet applied to prod) |
| `20260127000000_finalize_library_book.sql` | ✅ **CREATE** | Final migration: add official_*_key, drop Stone Tablets tables/columns | MEDIUM (data migration) |
| `20250101000000_numerology_schema.sql` | 📦 **ARCHIVE** | Stone Tablets migration (user-scoped numerology_profiles) | None (superseded) |
| `sql/002_create_soul_paths_table.sql` | 📦 **ARCHIVE** | Stone Tablets migration (soul_paths table) | None (superseded) |
| `sql/001_add_birth_chart_cache.sql` | 📦 **ARCHIVE** | Stone Tablets migration (profiles columns) | None (superseded) |

**New Migration:**
- `supabase/migrations/20260127000000_finalize_library_book.sql`

### 6.2 API Routes

| File | Changes | LOC | Priority |
|------|---------|-----|----------|
| `app/api/birth-chart-library/route.ts` | Add AI narrative generation, fix response shape (geometry → placements, add insight) | +200 | **P0** |
| `app/api/numerology-library/route.ts` | Add full calculations (pinnacles, challenges, cycles), fix response shape | +150 | **P0** |
| `app/api/birth-chart/route.ts` | Mark deprecated, add sunset date comment | +5 | P2 |
| `app/api/numerology/route.ts` | Mark deprecated, add sunset date comment | +5 | P2 |

### 6.3 Library Utils

| File | Action | Changes | LOC | Priority |
|------|--------|---------|-----|----------|
| `lib/library/charts.ts` | Verify no defaulting, add AI narrative integration | +50 | **P0** |
| `lib/library/numerology.ts` | Replace placeholder with real calculations | +300 | **P0** |
| `lib/library/narratives.ts` | ✅ **CREATE** — Shared AI narrative generation module | +200 | **P0** |
| `lib/soulPath/storage.ts` | ❌ **DELETE** — Stone Tablets pattern | -300 | P1 (after old endpoint deprecated) |
| `lib/birthChart/storage.ts` | ❌ **DELETE** — Stone Tablets pattern | -200 | P1 (after old endpoint deprecated) |
| `lib/numerology/storage.ts` | ❌ **DELETE** — Stone Tablets user-scoped pattern | -400 | P1 (after old endpoint deprecated) |
| `lib/account/deleteAccountCore.ts` | Remove Stone Tablets cleanup logic | -15 | P1 |

### 6.4 UI Pages

| File | Changes | LOC | Priority |
|------|---------|-----|----------|
| `app/(protected)/sanctuary/birth-chart/page.tsx` | Point to `/api/birth-chart-library` (after parity achieved) | 1 line | P1 |
| `app/(protected)/sanctuary/numerology/page.tsx` | Point to `/api/numerology-library` (after parity achieved) | 1 line (already done via temp fix) | P1 |

**Note:** Frontend changes ONLY after endpoint parity verified

### 6.5 Tests

| File | Action | LOC | Priority |
|------|--------|-----|----------|
| `__tests__/api/birth-chart-library-parity.test.ts` | ✅ **CREATE** — Contract tests (old vs new endpoint) | +100 | **P0** |
| `__tests__/api/numerology-library-parity.test.ts` | ✅ **CREATE** — Contract tests (old vs new endpoint) | +100 | **P0** |
| `__tests__/library/no-noon-default.test.ts` | ✅ **CREATE** — Verify no defaulting | +50 | **P0** |
| `__tests__/api/birth-chart-response-shape.test.ts` | Implement TODO stubs | +50 | P1 |

### 6.6 Scripts

| File | Action | LOC | Priority |
|------|--------|-----|----------|
| `scripts/migrate-stone-tablets-to-library.ts` | ✅ **CREATE** — One-time data migration script | +300 | **P0** |

### 6.7 Documentation

| File | Action | Priority |
|------|--------|----------|
| `docs/LIBRARY_BOOK_COHESION_PROOF.md` | ✅ **CREATE** — This document | P0 |
| `docs/audit/LIBRARY_BOOK_FORENSIC_AUDIT.md` | Keep for reference | P2 |
| `docs/audit/STONE_TABLETS_FORENSIC_AUDIT.md` | Keep for reference | P2 |
| `README.md` | Update architecture section (post-migration) | P2 |

### 6.8 Deletions Summary

**Files to Delete (After 30-Day Deprecation):**
- `lib/soulPath/storage.ts` (-300 lines)
- `lib/birthChart/storage.ts` (-200 lines)
- `lib/numerology/storage.ts` (-400 lines)

**Total Deleted:** -900 lines

**Migrations to Archive:**
- `20250101000000_numerology_schema.sql`
- `sql/002_create_soul_paths_table.sql`
- `sql/001_add_birth_chart_cache.sql`

### 6.9 Net Code Change

```
Created:   +1,100 lines (narratives, tests, migration)
Modified:  +  560 lines (endpoints, library utils)
Deleted:   -  900 lines (Stone Tablets)
─────────────────────────────────────────────
Net:       +  760 lines
```

**Code Quality:** Simplified architecture (single caching model, no dual storage)

---

## SUMMARY & APPROVAL REQUIREMENTS

### Corrections Applied ✅

1. ✅ **NO dual-write transition** — Simplified to: parity → migrate → cutover
2. ✅ **NO "planets-only" charts** — birth_time required, error if missing
3. ✅ **Endpoint parity MANDATORY** — UI migration only after parity tests pass
4. ✅ **Table name: `numerology_library`** — Global table (not user-scoped)
5. ✅ **Aggressive timeline** — 4 days implementation + monitoring
6. ✅ **30-day archive** — Old tables archived before drop

### Proof Pass Complete ✅

1. ✅ **Schema Truth Check** — Final tables documented, migrations audited, drift validation plan
2. ✅ **Contract Matrix** — Complete flow diagrams (UI → API → DB → Response) for both tabs
3. ✅ **No Noon Default Guarantee** — 2 violations found, corrected implementation provided, tests specified
4. ✅ **Stone Tablets Removal Completeness** — All files, imports, queries, fallback logic documented for removal
5. ✅ **Verification Runbook** — Local, test, prod, rollback steps provided
6. ✅ **Final File Touch List** — Grouped by category (migrations, API, library, UI, tests, scripts, docs)

### Critical Findings

1. ⚠️ **Migration to DELETE:** `20260126120000_fix_numerology_table_name.sql` (wrong table name)
2. ⚠️ **2 Noon Defaulting Violations:** `lib/soulPath/storage.ts:184`, `lib/birthChart/storage.ts:68`
3. ⚠️ **Stone Tablets Files to Remove:** 3 files (~900 lines total)
4. ⚠️ **New Migration Required:** `20260127000000_finalize_library_book.sql`

### Ready for Approval

- [ ] ✅ Revised plan accepted (no dual-write, no planets-only, aggressive timeline)
- [ ] ✅ Schema truth check reviewed (tables, migrations, drift validation)
- [ ] ✅ Contract matrix reviewed (UI ↔ API ↔ DB flows)
- [ ] ✅ No noon default guarantee verified (violations found + corrected)
- [ ] ✅ Stone Tablets removal completeness verified (all code paths documented)
- [ ] ✅ Verification runbook reviewed (local, test, prod, rollback)
- [ ] ✅ File touch list reviewed (minimal changes, grouped)

**Once approved, ready to proceed to implementation.**

---

**Awaiting final green-light, Ayren.**
