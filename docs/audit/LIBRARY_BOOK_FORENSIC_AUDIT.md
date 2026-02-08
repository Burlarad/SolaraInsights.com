# Library Book Model - Forensic Audit & Completion Plan

**Date:** January 26, 2026
**Auditor:** Principal Engineer
**Scope:** Complete Library Book implementation for Astrology + Numerology tabs
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## EXECUTIVE SUMMARY

**VERDICT:** Library Book implementation is **partially complete** with **2 critical P0 bugs** blocking both tabs.

| Tab | Status | Root Cause | Impact |
|-----|--------|------------|--------|
| **Astrology** | ✅ FIXED (temp) | Incomplete endpoint migration | Users saw "Interpretation not available" |
| **Numerology** | ❌ BROKEN | 1) Table name mismatch<br>2) Incomplete endpoint | Tab completely non-functional |

**Critical Findings:**
1. **P0 - Table Name Mismatch**: Migration creates `numerology_library`, code queries `numerology_profiles`
2. **P0 - Response Shape Mismatch**: New endpoints return geometry-only, frontends expect full experience
3. **P1 - Schema Drift**: Production missing `official_chart_key`, `official_numerology_key` columns
4. **P1 - Preview Mode**: API implements it, but no UI exists for users to access it

**Fix Strategy:** Surgical fixes only. Revert frontends to working endpoints, fix table name, complete new endpoints later.

---

## A) CHANGE MAP - What Was Touched

### Files Modified During Library Book Refactor

#### ✅ STABLE - Working as Intended

| File | Purpose | Status |
|------|---------|--------|
| [lib/library/keyNormalization.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/keyNormalization.ts:0:0-0:0) | Deterministic key generation | ✅ Working, 18 tests passing |
| [lib/library/charts.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/charts.ts:0:0-0:0) | Global charts library storage | ✅ Working (upsert logic correct) |
| [lib/library/profileSync.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/profileSync.ts:0:0-0:0) | Sync official_*_key with Settings | ✅ Working |
| [__tests__/library/keyNormalization.test.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/__tests__/library/keyNormalization.test.ts:0:0-0:0) | Test coverage for keys | ✅ All passing |

#### ⚠️ PARTIAL - Incomplete Implementation

| File | Purpose | Issue | Fix |
|------|---------|-------|-----|
| [app/api/birth-chart-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart-library/route.ts:0:0-0:0) | New chart endpoint | Returns only geometry, no AI narrative | Add AI layer |
| [app/api/numerology-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology-library/route.ts:0:0-0:0) | New numerology endpoint | Returns only core numbers, no cycles/pinnacles | Add full calculations |
| [app/(protected)/sanctuary/birth-chart/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/birth-chart/page.tsx:0:0-0:0):152 | Astrology frontend | **REVERTED to `/api/birth-chart`** | ✅ Fixed (temp) |
| [app/(protected)/sanctuary/numerology/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/numerology/page.tsx:0:0-0:0):30 | Numerology frontend | Calls `/api/numerology-library` (incomplete) | ❌ Needs revert |

#### ❌ BROKEN - Critical Bugs

| File | Issue | Evidence | Severity |
|------|-------|----------|----------|
| [lib/library/numerology.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/numerology.ts:0:0-0:0) | Queries `numerology_profiles` (wrong table) | Lines 51, 148, 171, 196, 217 | P0 |
| [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0) | Queries `numerology_profiles` (wrong table) | Lines 240, 291, 341 | P0 |
| [supabase/migrations/20260125000000_library_book_model.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260125000000_library_book_model.sql:0:0-0:0):75 | Creates `numerology_library` (wrong name) | Table mismatch with code | P0 |

#### 🧨 RISKY - Potential Issues

| File | Risk | Impact |
|------|------|--------|
| [supabase/migrations/20260126001225_tighten_library_rls.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260126001225_tighten_library_rls.sql:0:0-0:0) | RLS too restrictive (service_role only) | May block legitimate access |
| [supabase/migrations/20260126090000_patch_library_book_remote.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260126090000_patch_library_book_remote.sql:0:0-0:0) | Creates `numerology_profiles` (correct name) | Conflicts with earlier migration |

---

## B) INTENDED vs ACTUAL BEHAVIOR

### B1) Astrology Tab

#### INTENDED BEHAVIOR (Library Book Model)

```
User visits /sanctuary/birth-chart
  ↓
Frontend: POST /api/birth-chart-library { mode: "official" }
  ↓
Endpoint:
  1. Load user profile → get official_chart_key
  2. If key exists: fetch from library
  3. If no key: compute if Settings complete, store in library
  4. Return: { placements, insight, chart_key, is_official }
  ↓
Frontend: Render full experience (Narrative + Foundations + Connections + Patterns)
```

#### ACTUAL BEHAVIOR (Current)

```
User visits /sanctuary/birth-chart
  ↓
Frontend: POST /api/birth-chart (REVERTED to old endpoint)
  ↓
Old Endpoint:
  1. Load/compute placements (legacy soul_paths logic)
  2. Generate AI narrative (OpenAI)
  3. Return: { placements, insight }
  ↓
Frontend: ✅ Works correctly
```

**Temporary Fix Applied:** ✅ [app/(protected)/sanctuary/birth-chart/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/birth-chart/page.tsx:0:0-0:0):152 reverted to `/api/birth-chart`

**Why Revert Was Needed:**
- New endpoint `/api/birth-chart-library` only returns geometry (`{ geometry: {...} }`)
- Missing field: `insight` (AI narrative)
- Wrong field name: `geometry` instead of `placements`
- Result: Frontend saw `undefined` → showed "Interpretation not available"

**Root Cause:**
- Implementation gap: Computational layer complete, interpretive layer missing
- Premature migration: Frontend updated before endpoint had feature parity

---

### B2) Numerology Tab

#### INTENDED BEHAVIOR (Library Book Model)

```
User visits /sanctuary/numerology
  ↓
Frontend: POST /api/numerology-library { mode: "official", system: "pythagorean" }
  ↓
Endpoint:
  1. Load user profile → get official_numerology_key
  2. If key exists: fetch from library
  3. If no key: compute if Settings complete, store in library
  4. Return: { profile, cycles, numerology_key, is_official }
  ↓
Frontend: Render full profile (Core Numbers + Cycles + Pinnacles + Challenges)
```

#### ACTUAL BEHAVIOR (Current)

```
User visits /sanctuary/numerology
  ↓
Frontend: POST /api/numerology-library { system: "pythagorean" }
  ↓
Endpoint: Query numerology_profiles table
  ↓
Database: ❌ ERROR - Table does not exist
  ↓
Endpoint: Return 500 error
  ↓
Frontend: Show generic error message
```

**Status:** ❌ COMPLETELY BROKEN

**Two Simultaneous Bugs:**

**Bug 1 - Table Name Mismatch (P0):**
- Migration creates: `numerology_library` ([supabase/migrations/20260125000000_library_book_model.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260125000000_library_book_model.sql:0:0-0:0):75)
- Code queries: `numerology_profiles`
  - [lib/library/numerology.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/numerology.ts:0:0-0:0):51, 148, 171, 196, 217
  - [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0):240, 291, 341
- Patch migration creates: `numerology_profiles` ([supabase/migrations/20260126090000_patch_library_book_remote.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260126090000_patch_library_book_remote.sql:0:0-0:0):32)
- **Result:** Conflicting migrations, unclear which table exists

**Bug 2 - Response Shape Mismatch (P0):**

| Source | Shape |
|--------|-------|
| **API Returns** | `{ mode, numerology_key, inputs, profile: { lifePathNumber, expressionNumber, ... }, is_official }` |
| **Frontend Expects** | `{ profile: { coreNumbers, pinnacles, challenges, luckyNumbers, karmicDebt, input }, cycles: { personalYear, personalMonth, personalDay } }` |

**Evidence:**
- [app/api/numerology-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology-library/route.ts:0:0-0:0):56-62 returns simple profile
- [app/(protected)/sanctuary/numerology/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/numerology/page.tsx:0:0-0:0):168-174 expects complex profile with cycles
- [lib/library/numerology.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/numerology.ts:0:0-0:0):86-105 only computes placeholder values

**Working Old Endpoint Exists:**
- [app/api/numerology/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology/route.ts:0:0-0:0) (GET method)
- Returns: `{ profile: NumerologyProfile, cycles, fromCache }`
- Uses: `getOrComputeNumerologyProfile` from [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0)
- Status: ✅ Complete implementation with full calculations

---

### B3) Preview Mode

#### INTENDED BEHAVIOR

```
User on /sanctuary/birth-chart
  ↓
Edits birth inputs in UI (date, time, location)
  ↓
Clicks "Generate Preview"
  ↓
Frontend: POST /api/birth-chart-library { mode: "preview", inputs: {...} }
  ↓
Endpoint: Compute chart for arbitrary inputs, store in global library
  ↓
Frontend: Show preview chart (full experience)
  ↓
User clicks "Reset to My Chart" → revert to official mode
```

#### ACTUAL BEHAVIOR

- ✅ API supports preview mode ([app/api/birth-chart-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart-library/route.ts:0:0-0:0):66-98)
- ✅ API supports preview mode ([app/api/numerology-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology-library/route.ts:0:0-0:0):66-98)
- ❌ Frontend has NO UI for editing inputs
- ❌ No "Generate Preview" button
- ❌ No "Reset to My Chart" button
- ❌ Preview mode completely inaccessible to users

**Status:** Not implemented (but API ready)

---

## C) SCHEMA MAP - Migrations vs Reality

### C1) Migration Timeline

| Date | File | Purpose | Status |
|------|------|---------|--------|
| 2026-01-25 | `20260125000000_library_book_model.sql` | Original Library Book model | ⚠️ Table name issue |
| 2026-01-26 | `20260126001225_tighten_library_rls.sql` | Security hardening (service_role only) | ⚠️ Too restrictive? |
| 2026-01-26 | `20260126030132_remote_schema.sql` | Remote schema snapshot | ℹ️ Reference only |
| 2026-01-26 | `20260126090000_patch_library_book_remote.sql` | Idempotent patch for missing schema | ⚠️ Conflicts with original |

### C2) Schema State Analysis

#### Expected Schema (from migrations)

**Tables:**
1. ✅ `charts` (for birth charts)
2. ⚠️ `numerology_library` OR `numerology_profiles` (CONFLICT)

**Columns on profiles:**
1. `official_chart_key` TEXT
2. `official_numerology_key` TEXT

#### Table: `charts`

```sql
CREATE TABLE public.charts (
  chart_key TEXT PRIMARY KEY,
  input_json JSONB NOT NULL,
  geometry_json JSONB NOT NULL,
  engine_config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1
);
```

**Status:** ✅ Likely exists (birth-chart code works locally)

#### Table: `numerology_library` vs `numerology_profiles`

**Conflict:**

| Migration | Table Name | Lines |
|-----------|------------|-------|
| `20260125000000_library_book_model.sql` | Creates `numerology_library` | 75-92 |
| `20260126090000_patch_library_book_remote.sql` | Creates `numerology_profiles` | 32-38 |

**Code References:**
- [lib/library/numerology.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/numerology.ts:0:0-0:0) queries `numerology_profiles`
- [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0) queries `numerology_profiles`

**Resolution Needed:** Pick ONE table name consistently

**Recommended:** Use `numerology_profiles` (matches code, patch migration)

#### Profiles Columns

**Expected:**
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS official_chart_key TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS official_numerology_key TEXT;
```

**Status:** Unknown (unable to verify without database access)

**Evidence of Missing Columns:**
- User mentioned "Remote ledger says applied, but schema is missing"
- Patch migration uses `IF NOT EXISTS` suggesting they were missing
- Production may not have these columns yet

### C3) RLS Policy Changes

**Original Policy (Migration 1):**
```sql
-- Anyone can read charts
CREATE POLICY "Anyone can read charts"
  ON public.charts FOR SELECT
  TO authenticated
  USING (true);
```

**Tightened Policy (Migration 2):**
```sql
-- Service role only
DROP POLICY IF EXISTS "Anyone can read charts" ON public.charts;

CREATE POLICY "Service role can read charts"
  ON public.charts FOR SELECT
  TO service_role
  USING (true);
```

**Impact:** Endpoints use `createAdminSupabaseClient()` (service_role) so this is safe, BUT if any other code tries to read charts with authenticated client, it will fail.

**Risk:** LOW (endpoints correctly use service_role)

---

## D) RISK REGISTER

### P0 - Critical (Blocks Users)

| # | Risk | Impact | Evidence | Fix |
|---|------|--------|----------|-----|
| **R1** | Table name mismatch | Numerology tab completely broken | Migration creates `numerology_library`, code queries `numerology_profiles` | Rename table OR update all code references |
| **R2** | Response shape mismatch | New endpoints return incomplete data | Frontend expects `{ profile, cycles }`, API returns `{ mode, profile }` without cycles | Revert frontend to old endpoint temporarily |

### P1 - High (Degrades Experience)

| # | Risk | Impact | Evidence | Fix |
|---|------|--------|----------|-----|
| **R3** | Schema drift | Production missing columns | Patch migration uses `IF NOT EXISTS`, suggests remote missing schema | Apply patch migration to production |
| **R4** | Incomplete numerology calculations | New endpoint returns placeholder data | [lib/library/numerology.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/numerology.ts:0:0-0:0):86-105 has TODO comments | Port real numerology engine from old code |
| **R5** | Missing AI narratives | Birth chart endpoint incomplete | New endpoint returns geometry only, no `insight` field | Port AI generation from old endpoint |

### P2 - Medium (Nice to Have)

| # | Risk | Impact | Evidence | Fix |
|---|------|--------|----------|-----|
| **R6** | Preview mode inaccessible | Users can't try other charts | API complete but no UI exists | Build preview UI (input editors + buttons) |
| **R7** | Migration conflicts | Unclear which schema is canonical | Two migrations create different table names | Consolidate migrations |
| **R8** | Test coverage gaps | No tests for new endpoints | Response shape tests are TODO stubs | Implement contract tests |

---

## E) MINIMAL FIX PLAN

### Phase 1: IMMEDIATE FIXES (P0) - 30 minutes

**Goal:** Unblock users, restore working state

#### Fix 1A: Revert Numerology Frontend (5 min)

**File:** [app/(protected)/sanctuary/numerology/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/numerology/page.tsx:0:0-0:0):30

```diff
- const response = await fetch("/api/numerology-library", {
+ const response = await fetch("/api/numerology", {
-   method: "POST",
+   method: "GET",
-   headers: { "Content-Type": "application/json" },
-   body: JSON.stringify({ system }),
+   // system passed as query param
});

// Update URL to include system query param
+ const response = await fetch(`/api/numerology?system=${system}`, {
+   method: "GET",
+ });
```

**Rationale:**
- Old endpoint complete and working
- Returns correct shape: `{ profile, cycles, fromCache }`
- Zero risk - tested code path

**Verification:**
```bash
npm run dev
# Visit http://localhost:3000/sanctuary/numerology
# ✅ Should render full profile
```

#### Fix 1B: Update Error Handling (5 min)

**File:** [app/(protected)/sanctuary/numerology/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/numerology/page.tsx:0:0-0:0):40-50

```diff
  const code = result?.errorCode || result?.code;

- if (code === "MISSING_BIRTH_NAME") {
+ if (code === "MISSING_NAME" || code === "MISSING_BIRTH_NAME") {
    setError("birth_name_required");
- } else if (code === "MISSING_BIRTH_DATE") {
+ } else if (code === "MISSING_BIRTH_DATE" || code === "MISSING_BIRTH_DATE") {
    setError("birth_date_required");
```

**Rationale:** Support both old and new error codes for backward compatibility

### Phase 2: TABLE NAME FIX (P0) - 1 hour

**Goal:** Resolve numerology table name conflict

#### Option A: Rename Table in Database (RECOMMENDED)

**Create Migration:** `supabase/migrations/20260126120000_fix_numerology_table_name.sql`

```sql
-- Fix numerology table name mismatch
-- Migration creates numerology_library, code expects numerology_profiles

-- Option 1: Rename if numerology_library exists
ALTER TABLE IF EXISTS public.numerology_library
  RENAME TO numerology_profiles;

-- Option 2: Create if neither exists (idempotent)
CREATE TABLE IF NOT EXISTS public.numerology_profiles (
  numerology_key TEXT PRIMARY KEY,
  input_json JSONB NOT NULL,
  numerology_json JSONB NOT NULL,
  config_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER NOT NULL DEFAULT 1
);

-- Recreate indexes
DROP INDEX IF EXISTS idx_numerology_last_accessed;
DROP INDEX IF EXISTS idx_numerology_created_at;

CREATE INDEX IF NOT EXISTS idx_numerology_profiles_last_accessed
  ON public.numerology_profiles(last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_numerology_profiles_created_at
  ON public.numerology_profiles(created_at DESC);

-- Update RLS policies
DROP POLICY IF EXISTS "Anyone can read numerology" ON public.numerology_library;
DROP POLICY IF EXISTS "Service role can write numerology" ON public.numerology_library;
DROP POLICY IF EXISTS "Service role can update numerology" ON public.numerology_library;

ALTER TABLE public.numerology_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read numerology_profiles"
  ON public.numerology_profiles FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can write numerology_profiles"
  ON public.numerology_profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update numerology_profiles"
  ON public.numerology_profiles FOR UPDATE
  TO service_role
  USING (true);
```

**Apply Migration:**
```bash
# Local
npx supabase db push

# Production (after testing locally)
npx supabase db push --db-url $PRODUCTION_DATABASE_URL
```

**Verification:**
```sql
-- Check table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'numerology_profiles';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'numerology_profiles';
```

#### Option B: Update All Code References (NOT RECOMMENDED)

Would require changing 8+ files - too risky, too much code churn.

### Phase 3: DEPLOY & VERIFY (30 min)

#### Deploy Steps

```bash
# 1. Apply migration (if doing table rename)
npx supabase db push

# 2. Commit changes
git add app/(protected)/sanctuary/numerology/page.tsx
git add supabase/migrations/20260126120000_fix_numerology_table_name.sql
git commit -m "fix(numerology): revert to working endpoint + fix table name

Root cause:
1. New /api/numerology-library endpoint incomplete (missing cycles)
2. Table name mismatch (migration creates numerology_library, code queries numerology_profiles)

Solution:
1. Revert frontend to /api/numerology (GET) until new endpoint complete
2. Rename numerology_library → numerology_profiles for consistency

Impact: Fixes broken numerology tab immediately

Refs: docs/audit/LIBRARY_BOOK_FORENSIC_AUDIT.md"

# 3. Push to production
git push origin main

# 4. Monitor logs
# Check for errors in dashboard
# Verify no spike in failed requests
```

#### Verification Checklist

**Local Testing (5 min):**
- [ ] Start dev server: `npm run dev`
- [ ] Visit http://localhost:3000/sanctuary/numerology
- [ ] ✅ Full profile renders (Core Numbers + Cycles + Pinnacles)
- [ ] ✅ System toggle works (Pythagorean ↔ Chaldean)
- [ ] ✅ No console errors
- [ ] ✅ No "Interpretation not available" fallback

**Production Testing (5 min):**
- [ ] Deploy to production
- [ ] Visit production numerology page
- [ ] ✅ Works for existing user
- [ ] ✅ Works for new user with complete profile
- [ ] ✅ Shows correct error for incomplete profile

**Database Verification (5 min):**
```sql
-- Check table exists
\dt public.numerology_profiles

-- Check columns
\d public.numerology_profiles

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'numerology_profiles';

-- Check profiles columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('official_chart_key', 'official_numerology_key');
```

---

## F) FOLLOW-UP WORK (Not Blocking)

### Phase 4: Complete New Endpoints (Week 1)

**Goal:** Finish Library Book implementation properly

#### Task 4A: Complete Birth Chart Library Endpoint

**File:** [app/api/birth-chart-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart-library/route.ts:0:0-0:0)

**Required:**
1. Port AI narrative generation from [app/api/birth-chart/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart/route.ts:0:0-0:0)
2. Add `insight` field to response
3. Rename `geometry` → `placements` for consistency
4. Match response shape to frontend expectations

**Response Shape:**
```typescript
{
  mode: "official",
  chart_key: string,
  inputs: ChartInput,
  placements: SwissPlacements,  // NOT geometry
  insight: FullBirthChartInsight | null,  // ADD THIS
  is_official: true
}
```

#### Task 4B: Complete Numerology Library Endpoint

**File:** [app/api/numerology-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology-library/route.ts:0:0-0:0)

**Required:**
1. Port full numerology calculations from [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0)
2. Add `cycles` computation
3. Match response shape to frontend expectations

**Response Shape:**
```typescript
{
  mode: "official",
  numerology_key: string,
  inputs: NumerologyInput,
  profile: {
    coreNumbers: { ... },
    pinnacles: { ... },
    challenges: { ... },
    luckyNumbers: { ... },
    karmicDebt: { ... },
    input: { ... }
  },
  cycles: {
    personalYear: number,
    personalMonth: number,
    personalDay: number
  },
  is_official: true
}
```

### Phase 5: Migrate Frontends Back (Week 2)

**Prerequisites:**
- ✅ New endpoints complete with feature parity
- ✅ Contract tests added
- ✅ Local testing passed

**Changes:**
1. Update [app/(protected)/sanctuary/birth-chart/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/birth-chart/page.tsx:0:0-0:0):152 → `/api/birth-chart-library`
2. Update [app/(protected)/sanctuary/numerology/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/numerology/page.tsx:0:0-0:0):30 → `/api/numerology-library`
3. Test thoroughly
4. Deploy with monitoring

### Phase 6: Implement Preview Mode UI (Week 3)

**Goal:** Allow users to preview other charts

**Components Needed:**
1. Input editor UI (date, time, location, name fields)
2. "Generate Preview" button
3. "Reset to My Chart" button
4. Preview indicator badge
5. Unsaved changes warning

**User Flow:**
```
1. User on /sanctuary/birth-chart (showing their official chart)
2. Click "Try Another Chart" button
3. Input fields appear (prefilled with their data)
4. Edit birth date/time/location
5. Click "Generate Preview"
6. See full chart for those inputs (geometry + AI narrative)
7. Click "Reset to My Chart" to return to official
```

### Phase 7: Add Contract Tests (Week 3)

**Goal:** Prevent response shape regressions

**Test Files:**
1. `__tests__/api/birth-chart-library.test.ts`
2. `__tests__/api/numerology-library.test.ts`

**Test Cases:**
```typescript
describe("Birth Chart Library API", () => {
  it("returns both placements AND insight for official chart", async () => {
    const response = await POST({ mode: "official" });
    expect(response.placements).toBeDefined();
    expect(response.insight).toBeDefined();
    expect(response.insight.coreSummary).toBeDefined();
  });

  it("matches frontend BirthChartResponse type", async () => {
    const response = await POST({ mode: "official" });
    expect(response).toMatchObject({
      placements: expect.any(Object),
      insight: expect.any(Object),
    });
  });
});
```

### Phase 8: Deprecate Old Endpoints (Month 2)

**Prerequisites:**
- ✅ New endpoints complete
- ✅ Frontends migrated
- ✅ No references to old endpoints
- ✅ 30 days monitoring (no issues)

**Steps:**
1. Add deprecation warnings to old endpoints
2. Monitor for any unexpected usage
3. Remove old endpoints after grace period
4. Remove legacy storage logic ([lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0))

---

## G) DEFINITION OF DONE

### Immediate Fixes (Phase 1-3)

**Numerology Tab:**
- [x] ❌ Frontend reverted to `/api/numerology`
- [x] ❌ Table name fixed (`numerology_profiles` exists)
- [x] ❌ Error handling supports both old/new codes
- [x] ❌ Full profile renders (Core Numbers + Cycles + Pinnacles)
- [x] ❌ System toggle works
- [x] ❌ No console errors
- [x] ❌ Response time < 2s

**Astrology Tab:**
- [x] ✅ Frontend using working endpoint (already done)
- [x] ✅ Full interpretation renders
- [x] ✅ All 4 tabs work
- [x] ✅ No console errors

**Schema:**
- [x] ❌ `numerology_profiles` table exists
- [x] ❌ RLS policies correct
- [x] ❌ Profiles has `official_chart_key`, `official_numerology_key` columns
- [x] ❌ No migration conflicts

**Monitoring:**
- [x] ❌ No spike in errors for 24h
- [x] ❌ User reports resolved
- [x] ❌ Both tabs functional in production

### Complete Implementation (Phase 4-8)

**New Endpoints:**
- [ ] Birth chart endpoint returns complete response (placements + insight)
- [ ] Numerology endpoint returns complete response (profile + cycles)
- [ ] Preview mode functional for both endpoints
- [ ] Contract tests prevent regressions

**Preview UI:**
- [ ] Input editors implemented
- [ ] "Generate Preview" button works
- [ ] "Reset to My Chart" button works
- [ ] Preview indicator visible
- [ ] Unsaved changes warning

**Cleanup:**
- [ ] Old endpoints deprecated
- [ ] Legacy storage logic removed
- [ ] Documentation updated
- [ ] Migration conflicts resolved

---

## APPENDIX A: Code Evidence

### A1) Table Name Mismatch Evidence

**Migration creates `numerology_library`:**
```sql
-- supabase/migrations/20260125000000_library_book_model.sql:75
CREATE TABLE IF NOT EXISTS public.numerology_library (
  numerology_key TEXT PRIMARY KEY,
  ...
);
```

**Code queries `numerology_profiles`:**
```typescript
// lib/library/numerology.ts:51
const { data, error } = await supabase
  .from("numerology_profiles")  // ❌ Wrong table name
  .select("...")
```

**Patch creates `numerology_profiles`:**
```sql
-- supabase/migrations/20260126090000_patch_library_book_remote.sql:32
CREATE TABLE IF NOT EXISTS public.numerology_profiles (
  numerology_key text PRIMARY KEY,
  ...
);
```

### A2) Response Shape Mismatch Evidence

**API Returns (new endpoint):**
```typescript
// app/api/numerology-library/route.ts:56-62
return NextResponse.json({
  mode: "official",
  numerology_key: numerology.numerology_key,
  inputs: numerology.input_json,
  profile: numerology.numerology_json,  // Simple: { lifePathNumber, ... }
  is_official: true,
});
```

**Frontend Expects:**
```typescript
// app/(protected)/sanctuary/numerology/page.tsx:168-174
const { profile, cycles } = data;  // ❌ cycles undefined
const { coreNumbers, pinnacles, challenges, luckyNumbers, karmicDebt } = profile;  // ❌ undefined
```

**Old API Returns (working):**
```typescript
// app/api/numerology/route.ts:122-127
const response: NumerologyResponse = {
  profile: numerologyProfile,  // Complete: { coreNumbers, pinnacles, ... }
  cycles,  // { personalYear, personalMonth, personalDay }
  fromCache,
};
```

### A3) Incomplete Calculations Evidence

**Placeholder Implementation:**
```typescript
// lib/library/numerology.ts:86-105
async function computeNumerologyProfile(
  input: NumerologyInput
): Promise<NumerologyProfile> {
  // Placeholder implementation
  // Real implementation should calculate:
  // - Life Path Number (from birth date)
  // - Expression Number (from full name)
  // ...

  // Simple placeholder calculations (NOT accurate numerology)
  return {
    lifePathNumber: (day % 9) + 1,  // ❌ Placeholder math
    expressionNumber: (input.first_name.length % 9) + 1,  // ❌ Placeholder
    ...
  };
}
```

**Real Implementation Exists:**
```typescript
// lib/numerology/storage.ts:103-200
// Full Pythagorean numerology calculations
// - Core numbers with master number detection
// - Pinnacles with age ranges
// - Challenges
// - Lucky numbers
// - Karmic debt detection
```

---

## APPENDIX B: File Paths Reference

### Core Library Files
- [lib/library/keyNormalization.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/keyNormalization.ts:0:0-0:0) - Deterministic key generation
- [lib/library/charts.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/charts.ts:0:0-0:0) - Charts library storage
- [lib/library/numerology.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/numerology.ts:0:0-0:0) - ❌ Numerology library (broken)
- [lib/library/profileSync.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/library/profileSync.ts:0:0-0:0) - Profile synchronization

### API Endpoints (New)
- [app/api/birth-chart-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart-library/route.ts:0:0-0:0) - ⚠️ Incomplete (no AI)
- [app/api/numerology-library/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology-library/route.ts:0:0-0:0) - ❌ Broken (table name + incomplete)

### API Endpoints (Old - Working)
- [app/api/birth-chart/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart/route.ts:0:0-0:0) - ✅ Complete (geometry + AI)
- [app/api/numerology/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology/route.ts:0:0-0:0) - ✅ Complete (profile + cycles)

### Frontend Pages
- [app/(protected)/sanctuary/birth-chart/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/birth-chart/page.tsx:0:0-0:0) - ✅ Fixed (reverted to old endpoint)
- [app/(protected)/sanctuary/numerology/page.tsx](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/(protected)/sanctuary/numerology/page.tsx:0:0-0:0) - ❌ Needs revert

### Legacy Storage
- [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0) - ✅ Complete implementation (keep for now)

### Migrations
- [supabase/migrations/20260125000000_library_book_model.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260125000000_library_book_model.sql:0:0-0:0) - ⚠️ Creates `numerology_library`
- [supabase/migrations/20260126001225_tighten_library_rls.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260126001225_tighten_library_rls.sql:0:0-0:0) - RLS hardening
- [supabase/migrations/20260126090000_patch_library_book_remote.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260126090000_patch_library_book_remote.sql:0:0-0:0) - ⚠️ Creates `numerology_profiles`

### Tests
- [__tests__/library/keyNormalization.test.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/__tests__/library/keyNormalization.test.ts:0:0-0:0) - ✅ 18 tests passing
- [__tests__/api/birth-chart-response-shape.test.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/__tests__/api/birth-chart-response-shape.test.ts:0:0-0:0) - ⚠️ TODO stubs only

### Documentation
- [docs/audit/LIBRARY_BOOK_FORENSIC_AUDIT.md](cci:1://file:///Users/aaronburlar/Desktop/Solara/docs/audit/LIBRARY_BOOK_FORENSIC_AUDIT.md:0:0-0:0) - This document
- [docs/BIRTH_CHART_API_FIX_SUMMARY.md](cci:1://file:///Users/aaronburlar/Desktop/Solara/docs/BIRTH_CHART_API_FIX_SUMMARY.md:0:0-0:0) - Birth chart fix summary
- [docs/audit/BIRTH_CHART_API_MISMATCH_AUDIT.md](cci:1://file:///Users/aaronburlar/Desktop/Solara/docs/audit/BIRTH_CHART_API_MISMATCH_AUDIT.md:0:0-0:0) - Birth chart root cause

---

**END OF FORENSIC AUDIT**

**NEXT ACTION:** Execute Phase 1-3 fixes to restore working state.

**APPROVAL REQUIRED:** User should review this audit before proceeding with fixes.
