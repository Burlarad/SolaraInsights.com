# LIBRARY BOOK VERIFICATION REPORT

**Date**: 2026-01-26
**Mode**: VERIFICATION ONLY (no implementation)
**Scope**: Birth Chart + Numerology tabs

---

## A) PARITY MATRIX

| UI File | Current API | Expected Response | Actual Response | Status | Fix Required |
|---------|-------------|-------------------|-----------------|--------|--------------|
| **Birth Chart Tab** |
| `app/(protected)/sanctuary/birth-chart/page.tsx:152` | `/api/birth-chart` (POST) | `{ placements, insight }` | `{ placements, insight }` | ✅ WORKING | Migrate to new endpoint after parity |
| `app/(protected)/sanctuary/birth-chart/page.tsx` (target) | `/api/birth-chart-library` (POST) | `{ placements, insight, mode, chart_key, is_official }` | `{ geometry, mode, chart_key, is_official }` ❌ Missing: `insight` | ❌ FAIL | 1. Rename `geometry` → `placements` (route.ts:91,135)<br>2. Add `insight` field (import AI generation) |
| **Numerology Tab** |
| `app/(protected)/sanctuary/numerology/page.tsx:33` | `/api/numerology` (GET) | `{ profile: NumerologyProfile, cycles: CycleNumbers, fromCache }` | `{ profile, cycles, fromCache }` | ✅ WORKING | Migrate to new endpoint after parity |
| `app/(protected)/sanctuary/numerology/page.tsx` (target) | `/api/numerology-library` (POST) | `{ profile, cycles, mode, numerology_key, is_official }` | `{ profile, mode, numerology_key, is_official }` ❌ Missing: `cycles` | ❌ FAIL | Add `cycles` calculation + full numerology computation |

### Field-Level Breakdown

#### Birth Chart Response Shape

**Required by UI** (line 110-115, 216-217):
```typescript
{
  placements: {           // ✅ Name correct in old endpoint
    system: object,       // ❌ NEW: returns "geometry" instead
    planets: array,
    houses: array,
    angles: object,
    aspects: array,
    derived: object,
    calculated: object
  },
  insight: {              // ❌ NEW: MISSING entirely
    coreSummary: {
      headline: string,
      overallVibe: string,
      bigThree: { sun, moon, rising }
    },
    sections: {
      identity: string,
      emotions: string,
      loveAndRelationships: string,
      workAndMoney: string,
      purposeAndGrowth: string,
      innerWorld: string
    }
  }
}
```

**Actually returned by NEW endpoint** (birth-chart-library/route.ts:87-93):
```typescript
{
  geometry: {...},        // ❌ WRONG NAME (should be "placements")
  mode: "official",       // ✅ New field (OK)
  chart_key: string,      // ✅ New field (OK)
  is_official: boolean    // ✅ New field (OK)
  // ❌ MISSING: insight field entirely
}
```

#### Numerology Response Shape

**Required by UI** (types/numerology.ts:323-327):
```typescript
{
  profile: {              // ✅ Present but INCOMPLETE
    coreNumbers: {...},   // Has: simple numbers only
    pinnacles: {...},     // ❌ Missing from computation
    challenges: {...},    // ❌ Missing from computation
    luckyNumbers: {...},  // ❌ Missing from computation
    karmicDebt: {...}     // ❌ Missing from computation
  },
  cycles: {               // ❌ MISSING entirely
    personalYear: number,
    personalMonth: number,
    personalDay: number
  },
  fromCache: boolean      // Optional (can omit)
}
```

**Actually returned by NEW endpoint** (numerology-library/route.ts:56-62):
```typescript
{
  profile: {              // ⚠️ PLACEHOLDER ONLY
    lifePathNumber: number,
    expressionNumber: number,
    soulUrgeNumber: number,
    personalityNumber: number,
    birthdayNumber: number
    // ❌ Missing: karmic, pinnacles, challenges, luckyNumbers
  },
  mode: "official",       // ✅ New field (OK)
  numerology_key: string, // ✅ New field (OK)
  is_official: boolean    // ✅ New field (OK)
  // ❌ MISSING: cycles field entirely
}
```

---

## B) SCHEMA VERIFICATION QUERIES

Run these queries to verify database schema:

### 1. Check Library Tables Exist

```sql
-- Should return 2 rows: charts, numerology_library
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('charts', 'numerology_library')
ORDER BY table_name;
```

**Expected**:
```
    table_name     | column_count
-------------------+--------------
 charts            |            7
 numerology_library|            7
```

**If FAIL**: Apply migration `20260127000001_ensure_library_book_complete.sql`

---

### 2. Verify Table Names (No Wrong-Name Drift)

```sql
-- Check if numerology_profiles exists with WRONG structure
SELECT
  table_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'numerology_profiles'
                 AND column_name = 'numerology_key') THEN 'LIBRARY_BOOK_PATTERN'
    WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'numerology_profiles'
                 AND column_name = 'user_id') THEN 'STONE_TABLETS_PATTERN'
    ELSE 'UNKNOWN'
  END as pattern_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'numerology_profiles';
```

**Expected**:
- If LIBRARY_BOOK_PATTERN → Table has WRONG NAME (should be numerology_library)
- If STONE_TABLETS_PATTERN → Old user-scoped table (scheduled for deletion)
- If no results → CORRECT (numerology_library is the only table)

**If LIBRARY_BOOK_PATTERN found**: Apply corrective migration to rename

---

### 3. Verify Profiles Has Official Keys

```sql
-- Should return 2 rows
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('official_chart_key', 'official_numerology_key')
ORDER BY column_name;
```

**Expected**:
```
       column_name       | data_type | is_nullable
-------------------------+-----------+-------------
 official_chart_key      | text      | YES
 official_numerology_key | text      | YES
```

---

### 4. Check RLS Policies (Service Role Only for Library Tables)

```sql
-- Should return policies allowing authenticated SELECT
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('charts', 'numerology_library')
ORDER BY tablename, policyname;
```

**Expected**: Policies allowing SELECT for authenticated users, INSERT/UPDATE for service_role

---

### 5. Verify Stone Tablets Tables Still Exist (Pre-Cleanup)

```sql
-- Should return 2 rows (or 1 if numerology_profiles only has user_id)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('soul_paths', 'numerology_profiles');
```

**Expected Before Cleanup**: 1-2 rows
**Expected After Cleanup**: 0 rows (or only numerology_library if it was renamed)

---

### 6. Verify No Noon Defaulting in Database

```sql
-- Check for any birth_time values exactly "12:00" (suspicious pattern)
-- This query is safe - just checking data, not code
SELECT
  COUNT(*) as noon_default_count,
  COUNT(*) FILTER (WHERE birth_time = '12:00') as exact_noon_count,
  COUNT(*) FILTER (WHERE birth_time IS NULL) as null_count
FROM profiles
WHERE birth_time IS NOT NULL OR birth_time = '12:00';
```

**Expected**: If exact_noon_count is suspiciously high (>50% of records), may indicate historical noon defaulting

---

## C) COMMANDS RUNBOOK

### Local Validation Workflow

#### 1. Verify Current State

```bash
# Check git status
git status

# Check for noon defaulting in code
grep -rn "birth_time.*||.*12:00" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=docs

# Expected: 2 results in Stone Tablets files (lib/soulPath/storage.ts, lib/birthChart/storage.ts)
# If more results → FAIL
```

#### 2. Database Migrations

```bash
# Check migration status (requires local Supabase running)
npx supabase db diff

# Apply pending migrations (if any)
npx supabase db push

# Or reset local database from migrations (clean slate)
npx supabase db reset
```

#### 3. Run Tests

```bash
# Run all tests
npm run test

# Run specific test files
npm run test __tests__/library/keyNormalization.test.ts

# Check test coverage
npm run test -- --coverage
```

#### 4. Start Dev Server

```bash
# Start local development server
npm run dev

# Server should start on http://localhost:3000
```

#### 5. Test Endpoints (Manual Validation)

**IMPORTANT**: Replace `$AUTH_TOKEN` with actual token from browser dev tools (Application → Cookies → find auth token)

**Test Birth Chart Library (Official Mode)**:
```bash
curl -X POST http://localhost:3000/api/birth-chart-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"official"}' \
  | jq '.placements, .insight, .geometry'

# Expected:
# - .placements should be null (field doesn't exist)
# - .geometry should have data (WRONG - should be "placements")
# - .insight should be null (MISSING - should have data)
```

**Test Birth Chart Library (Preview Mode)**:
```bash
curl -X POST http://localhost:3000/api/birth-chart-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preview",
    "inputs": {
      "birth_date": "1990-01-15",
      "birth_time": "14:30",
      "birth_lat": 40.7128,
      "birth_lon": -74.0060,
      "timezone": "America/New_York"
    }
  }' \
  | jq '.mode, .is_official, .geometry, .insight'

# Expected:
# - .mode = "preview"
# - .is_official = false
# - .geometry has data (should be "placements")
# - .insight is null (should have data)
```

**Test Birth Chart Library (Reject Missing birth_time)**:
```bash
curl -X POST http://localhost:3000/api/birth-chart-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preview",
    "inputs": {
      "birth_date": "1990-01-15",
      "birth_lat": 40.7128,
      "birth_lon": -74.0060,
      "timezone": "America/New_York"
    }
  }' \
  | jq '.errorCode, .missing'

# Expected:
# - HTTP 400
# - .errorCode = "INCOMPLETE_PREVIEW_DATA"
# - .missing includes "birth_time"
```

**Test Numerology Library (Official Mode)**:
```bash
curl -X POST http://localhost:3000/api/numerology-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"official"}' \
  | jq '.profile, .cycles'

# Expected:
# - .profile has data (but INCOMPLETE - placeholder only)
# - .cycles is null (MISSING)
```

**Test Old Endpoints (Verify Still Working)**:
```bash
# Old birth chart endpoint
curl -X POST http://localhost:3000/api/birth-chart \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.placements, .insight' | head -20

# Expected: Both fields present

# Old numerology endpoint
curl -X GET "http://localhost:3000/api/numerology?system=pythagorean" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  | jq '.profile, .cycles' | head -20

# Expected: Both fields present
```

#### 6. Verify UI Behavior

```bash
# Open browser to local dev server
open http://localhost:3000/sanctuary/birth-chart

# Manual checks:
# 1. Does page load without errors?
# 2. If Settings complete: Does chart auto-load?
# 3. If Settings incomplete: Does it show "missing fields" UI?
# 4. Check console for errors

# Repeat for numerology
open http://localhost:3000/sanctuary/numerology
```

---

## D) RISK REGISTER

| Risk | File/Location | Why Risky | Mitigation |
|------|---------------|-----------|------------|
| **P0: Split-Brain Active** | UI calls `/api/birth-chart` (line 152) while new `/api/birth-chart-library` exists | Users on old endpoint, new endpoint not being used/tested in prod | Temporary revert intentional. MUST achieve parity before UI migration. Monitor: old endpoint usage should be 100% until parity. |
| **P0: Field Name Mismatch** | `app/api/birth-chart-library/route.ts:91,135` returns `geometry` not `placements` | UI expects `placements`, will crash if migrated | **FIX**: Change `geometry` → `placements` (2 lines) |
| **P0: Missing AI Narrative** | `app/api/birth-chart-library/route.ts` (entire file) | UI expects `insight` field, crashes without it (line 132-141 validates structure) | **FIX**: Import AI generation from `lib/ai/birthChartNarrative.ts`, add `insight` field to response |
| **P0: Missing Cycles** | `app/api/numerology-library/route.ts:56-62` | UI expects `cycles` field (types/numerology.ts:325) | **FIX**: Compute cycles from birth_date + current date, add to response |
| **P0: Placeholder Numerology** | `lib/library/numerology.ts:83-105` | Placeholder computation (modulo math), not real Pythagorean numerology | **FIX**: Import existing numerology engine from `lib/numerology/pythagorean.ts` or similar |
| **P1: Noon Defaulting Exists** | `lib/soulPath/storage.ts:184` and `lib/birthChart/storage.ts:68` | Violates hard rule: NO noon defaulting | Violations in Stone Tablets files (scheduled deletion). New Library Book code clean. VERIFY: No new violations added. |
| **P1: Wrong Table Name Risk** | Patch migration `20260126090000_patch_library_book_remote.sql` may have created `numerology_profiles` with `numerology_key` PK | Code expects `numerology_library`, schema drift | **VERIFY**: Run schema query #2. If wrong name found, apply corrective migration. |
| **P2: No Preview Mode UI** | Frontend files (birth-chart/page.tsx, numerology/page.tsx) | No preview mode toggle/inputs in UI yet | Implementation required after endpoint parity. NOT blocking initial deployment (can deploy official-only mode first). |
| **P2: Settings Incomplete Handling** | UI shows generic error (line 147, 185-188) | Should show elegant "missing fields" state, not error message | UI refinement. NOT blocking (existing behavior acceptable for now). |
| **P3: Old Endpoints Not Deprecated** | `app/api/birth-chart/route.ts` and `app/api/numerology/route.ts` | Still active, no deprecation warnings | After UI migration verified working, add console warnings. Delete after 30 days. |

---

## E) FIX LIST

### BLOCKING FIXES (MUST COMPLETE BEFORE UI MIGRATION)

#### Fix 1: Rename Field in Birth Chart Library Response

**File**: `app/api/birth-chart-library/route.ts`
**Lines**: 91, 135
**Change**:
```typescript
// BEFORE:
geometry: chart.geometry_json,

// AFTER:
placements: chart.geometry_json,
```

**Impact**: 2 lines changed
**Risk**: LOW (simple rename)

---

#### Fix 2: Add AI Narrative to Birth Chart Library Response

**File**: `app/api/birth-chart-library/route.ts`
**Lines**: Add after line 64 (official mode) and after line 128 (preview mode)

**Change**:
```typescript
// Add import at top of file
import { /* AI generation function from existing code */ } from "@/lib/ai/birthChartNarrative";

// In official mode (after line 64):
const chart = await getOfficialChart(user.id, profile);

if (!chart) {
  // ... existing error handling
}

// ADD THIS:
const placements = chart.geometry_json;
const insight = await generateBirthChartInsight(
  placements,
  user.id,
  profile.language || "en"
);

// Return official chart (modify line 87-93):
return NextResponse.json({
  mode: "official",
  chart_key: chart.chart_key,
  inputs: chart.input_json,
  placements: chart.geometry_json,  // ✅ Renamed
  insight,                           // ✅ Added
  is_official: true,
});

// Repeat for preview mode (after line 128)
```

**Impact**: ~20 lines added
**Risk**: MEDIUM (depends on existing AI generation being importable and working)
**Dependencies**: Verify `lib/ai/birthChartNarrative.ts` exists and exports correct function

---

#### Fix 3: Add Cycles Calculation to Numerology Library Response

**File**: `app/api/numerology-library/route.ts`
**Lines**: Add after line 39 (official mode) and after line 90 (preview mode)

**Change**:
```typescript
// Add import at top
import { /* cycles calculation function */ } from "@/lib/numerology/cycles";

// In official mode (after line 39):
const numerology = await getOfficialNumerology(user.id, profile);

if (!numerology) {
  // ... existing error handling
}

// ADD THIS:
const profile = numerology.numerology_json;
const cycles = computeCycles(
  numerology.input_json.birth_date,
  new Date().toISOString()  // current date
);

// Return official numerology (modify line 56-62):
return NextResponse.json({
  mode: "official",
  numerology_key: numerology.numerology_key,
  inputs: numerology.input_json,
  profile,
  cycles,  // ✅ Added
  is_official: true,
});

// Repeat for preview mode (after line 90)
```

**Impact**: ~15 lines added
**Risk**: MEDIUM (depends on cycles function existing)
**Dependencies**: Verify cycles calculation function exists

---

#### Fix 4: Replace Placeholder Numerology Computation

**File**: `lib/library/numerology.ts`
**Lines**: 83-105 (replace entire `computeNumerologyProfile` function)

**Change**:
```typescript
// BEFORE (lines 83-105):
async function computeNumerologyProfile(
  input: NumerologyInput
): Promise<NumerologyProfile> {
  // Placeholder implementation
  const birthDate = new Date(input.birth_date);
  const day = birthDate.getDate();

  return {
    lifePathNumber: (day % 9) + 1,
    expressionNumber: (input.first_name.length % 9) + 1,
    soulUrgeNumber: (input.last_name.length % 9) + 1,
    personalityNumber: ((input.middle_name?.length || 0) % 9) + 1,
    birthdayNumber: day,
  };
}

// AFTER:
import { computePythagoreanProfile } from "@/lib/numerology/pythagorean";

async function computeNumerologyProfile(
  input: NumerologyInput
): Promise<NumerologyProfile> {
  // Use real Pythagorean numerology engine
  return computePythagoreanProfile({
    birthDate: input.birth_date,
    birthFirstName: input.first_name,
    birthMiddleName: input.middle_name,
    birthLastName: input.last_name,
    system: "pythagorean"
  });
}
```

**Impact**: Replace 23 lines with ~10 lines
**Risk**: MEDIUM (depends on existing numerology engine)
**Dependencies**: Verify `lib/numerology/pythagorean.ts` (or equivalent) exists

---

#### Fix 5: Update NumerologyProfile Type to Include Full Structure

**File**: `lib/library/numerology.ts`
**Lines**: 23-30 (replace type definition)

**Change**:
```typescript
// BEFORE:
export type NumerologyProfile = {
  lifePathNumber: number;
  expressionNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthdayNumber: number;
};

// AFTER:
import type { NumerologyProfile as FullNumerologyProfile } from "@/types/numerology";

export type NumerologyProfile = FullNumerologyProfile;

// Or inline the full type:
export type NumerologyProfile = {
  lifePathNumber: number;
  expressionNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthdayNumber: number;
  karmic: {
    karmicLessonNumbers: number[];
    karmicDebtNumbers: number[];
  };
  pinnacles: {
    first: { number: number; startAge: number; endAge: number };
    second: { number: number; startAge: number; endAge: number };
    third: { number: number; startAge: number; endAge: number };
    fourth: { number: number; startAge: number; endAge: null };
  };
  challenges: {
    first: number;
    second: number;
    third: number;
    fourth: number;
  };
  luckyNumbers: number[];
};
```

**Impact**: Type definition change
**Risk**: LOW (type-level only)

---

### NON-BLOCKING FIXES (POST-PARITY)

#### Fix 6: Add Preview Mode UI

**Files**:
- `app/(protected)/sanctuary/birth-chart/page.tsx`
- `app/(protected)/sanctuary/numerology/page.tsx`

**Change**: Add mode toggle, input editors, geofinder integration
**Impact**: ~200 lines per file
**Risk**: MEDIUM (UX complexity)
**Timeline**: After endpoint parity achieved

---

#### Fix 7: Migrate UI to New Endpoints

**Files**:
- `app/(protected)/sanctuary/birth-chart/page.tsx:152`
- `app/(protected)/sanctuary/numerology/page.tsx:33`

**Change**:
```typescript
// Birth Chart
// BEFORE:
const res = await fetch("/api/birth-chart", { method: "POST" });

// AFTER:
const res = await fetch("/api/birth-chart-library", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "official" })
});

// Numerology
// BEFORE:
const response = await fetch(`/api/numerology?system=${system}`, { method: "GET" });

// AFTER:
const response = await fetch("/api/numerology-library", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "official" })
});
```

**Impact**: 2 lines per file
**Risk**: MEDIUM (only after parity verified in production)
**Timeline**: Day 4 (after endpoint parity deployed and tested)

---

#### Fix 8: Delete Wrong Migration (If Not Applied)

**File**: `supabase/migrations/20260126090000_patch_library_book_remote.sql`
**Action**: Delete file if migration was never applied
**Impact**: 1 file deleted
**Risk**: LOW
**Verification**: Check schema query #2 first

---

## VERIFICATION CHECKLIST

### ✅ PASS Criteria

- [ ] Schema query #1 returns 2 tables with 7 columns each
- [ ] Schema query #2 returns NO results (or STONE_TABLETS_PATTERN only)
- [ ] Schema query #3 returns 2 columns (official_chart_key, official_numerology_key)
- [ ] Code grep for noon defaulting returns ONLY 2 results (Stone Tablets files)
- [ ] Birth chart library endpoint returns `{ placements, insight, ... }` (not `geometry`)
- [ ] Numerology library endpoint returns `{ profile, cycles, ... }`
- [ ] All tests pass: `npm run test` exits 0
- [ ] Manual endpoint tests return expected shapes
- [ ] UI loads without errors (using old endpoints)

### ❌ FAIL Criteria (Blocking)

- Schema query #2 shows LIBRARY_BOOK_PATTERN → Wrong table name exists
- Code grep for noon defaulting returns >2 results → New violation added
- Birth chart library returns `geometry` field → Field name not fixed
- Birth chart library missing `insight` field → AI narrative not added
- Numerology library missing `cycles` field → Cycles not added
- Tests fail
- UI crashes on load

---

## SUMMARY

**Current State**:
- UI using OLD endpoints (intentional temporary revert)
- NEW endpoints exist but have parity gaps (missing fields, wrong names)
- Database schema UNKNOWN (need to run verification queries)
- Stone Tablets code still present (scheduled for deletion)

**Blocking Issues** (MUST fix before UI migration):
1. Birth chart: field name `geometry` → `placements` (2 line fix)
2. Birth chart: missing `insight` field (~20 line fix)
3. Numerology: missing `cycles` field (~15 line fix)
4. Numerology: placeholder computation → real engine (~10 line fix)

**Non-Blocking Issues** (post-parity):
5. No preview mode UI yet
6. No deprecation warnings on old endpoints
7. Settings incomplete handling could be more elegant

**Estimated Effort**:
- Fixes 1-4: 2-4 hours (if dependencies exist)
- Schema verification: 15 minutes
- Testing: 1 hour
- Total: 4-6 hours to achieve parity

**Next Steps**:
1. Run schema verification queries (Section B)
2. Apply fixes 1-4 (Section E)
3. Run endpoint tests (Section C.5)
4. If all pass → Ready for UI migration

**END OF VERIFICATION REPORT**
