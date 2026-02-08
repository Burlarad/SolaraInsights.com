# Stone Tablets System - Forensic Audit

**Date:** January 26, 2026
**Auditor:** Principal Engineer
**Status:** 🔴 CRITICAL CONFLICTS IDENTIFIED
**Classification:** BLOCKING FOR LIBRARY BOOK COMPLETION

---

## EXECUTIVE SUMMARY

**VERDICT:** Stone Tablets is **NOT a separate subsystem** — it's a **caching philosophy** implemented across multiple storage layers. It directly conflicts with the Library Book model's global deduplication principle.

### What Is Stone Tablets?

**Stone Tablets** is a metaphor for **"compute once, cache forever"** persistence:
- Expensive calculations (astrology, numerology, AI narratives) are computed ONCE
- Results are stored permanently in the database
- Regeneration only occurs when source inputs change OR schema version bumps
- Philosophy: Treat computed data as **immutable records** (like carved stone tablets)

**Origin:** Designed to prevent redundant Swiss Ephemeris calculations and OpenAI API calls at scale (targeting 1M DAU).

### Critical Finding

**Stone Tablets implements USER-SPECIFIC caching**, which **DIRECTLY VIOLATES** the Library Book model's **GLOBAL DEDUPLICATION** principle.

| Stone Tablets Pattern | Library Book Pattern |
|----------------------|---------------------|
| One cache record per user | One library record per unique computation |
| Key: `user_id` + hash | Key: Deterministic hash only |
| Storage: User-scoped tables | Storage: Global library tables |
| Principle: User owns their computed data | Principle: Users check out from shared library |

**Conflict Level:** P0 — Cannot coexist in current form

---

## 1. STONE TABLETS SYSTEM MAP

### 1.1 Conceptual Model

```
User's Birth Data (Settings)
         ↓
   Compute Once (Swiss Ephemeris + AI)
         ↓
   Store Forever (Stone Tablet)
         ↓
   Serve from Cache (until inputs change)
```

**Core Principles:**
1. **Immutability**: Once computed, data never changes unless inputs change
2. **Cache Invalidation**: Triggered by input hash change or schema version bump
3. **Stone Tablet = Snapshot**: Each record is a complete, frozen-in-time computation
4. **No History**: Only the latest computation is kept (no versioning)

### 1.2 Three Separate Implementations

Stone Tablets philosophy is implemented in **three distinct storage patterns**:

#### Implementation A: Numerology Profiles Table

**Table:** `numerology_profiles`
**Scope:** User-specific
**Key:** `user_id` + `system` + `input_hash`

```sql
CREATE TABLE numerology_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,              -- ❌ USER-SPECIFIC (conflicts with Library Book)
  system TEXT NOT NULL,                -- pythagorean or chaldean
  input_hash TEXT NOT NULL,            -- Hash of name + birth_date
  profile_json JSONB NOT NULL,         -- Complete numerology calculations
  prompt_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,

  UNIQUE(user_id, system, input_hash)  -- One record per user per system per hash
);
```

**RLS:** Users can SELECT/INSERT/UPDATE/DELETE their own records
**Access Pattern:** `WHERE user_id = auth.uid()`
**Managed By:** [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0)

**Conflict:** ❌ Library Book expects global table with `numerology_key` PK (no `user_id`)

#### Implementation B: Soul Paths Table

**Table:** `soul_paths`
**Scope:** User-specific
**Key:** `user_id` (PRIMARY KEY)

```sql
CREATE TABLE soul_paths (
  user_id UUID PRIMARY KEY,            -- ❌ USER-SPECIFIC (one record per user)
  schema_version INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL,
  birth_input_hash TEXT NOT NULL,      -- Hash of birth data
  soul_path_json JSONB NOT NULL        -- Complete SwissPlacements
);
```

**RLS:** NO policies (server-side only access via service_role)
**Access Pattern:** `WHERE user_id = :userId`
**Managed By:** [lib/soulPath/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/soulPath/storage.ts:0:0-0:0)

**Purpose:** Stores complete birth chart placements for scalability (decoupled from profiles)

**Conflict:** ❌ Library Book expects global `charts` table with `chart_key` PK

#### Implementation C: Profiles Birth Chart Column

**Table:** `profiles`
**Column:** `birth_chart_placements_json JSONB`
**Scope:** User-specific
**Key:** Implicit (one profile per user)

```sql
ALTER TABLE profiles
  ADD COLUMN birth_chart_placements_json JSONB;
  ADD COLUMN birth_chart_computed_at TIMESTAMPTZ;
  ADD COLUMN birth_chart_schema_version INTEGER;
```

**Access Pattern:** Direct column read on user's profile
**Managed By:** [lib/birthChart/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:0:0-0:0)

**Purpose:** Legacy storage pattern (predates soul_paths table)

**Conflict:** ❌ Library Book expects NO chart data on profiles (only `official_chart_key` pointer)

---

## 2. EXHAUSTIVE CODE INVENTORY

### 2.1 Core Storage Modules

| File | Purpose | Table Used | User-Scoped? |
|------|---------|------------|--------------|
| [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0) | Numerology Stone Tablets | `numerology_profiles` | ✅ YES |
| [lib/soulPath/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/soulPath/storage.ts:0:0-0:0) | Soul Path Stone Tablets | `soul_paths` | ✅ YES |
| [lib/birthChart/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:0:0-0:0) | Birth Chart Stone Tablets | `profiles.birth_chart_placements_json` | ✅ YES |

### 2.2 API Endpoints Using Stone Tablets

| Endpoint | Reads From | Stone Tablet Type |
|----------|-----------|-------------------|
| [app/api/numerology/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology/route.ts:0:0-0:0) | `numerology_profiles` | Numerology |
| [app/api/birth-chart/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart/route.ts:0:0-0:0) | `soul_paths` + `profiles.birth_chart_placements_json` | Birth Chart (dual) |
| [app/api/connection-space-between/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/connection-space-between/route.ts:0:0-0:0) | `space_between_reports` | Connection Reports |

### 2.3 Database Tables (Stone Tablets Pattern)

| Table | PK | Stores What | Invalidation Key | Migration |
|-------|----|-----------|--------------------|-----------|
| `numerology_profiles` | `id` (UUID) | Numerology calculations | `input_hash` (name + birth_date) | `20250101000000_numerology_schema.sql` |
| `soul_paths` | `user_id` | Birth chart placements | `birth_input_hash` | `sql/002_create_soul_paths_table.sql` |
| `space_between_reports` | `connection_id` | Relationship astrology | N/A (never regenerated) | `sql/007_connections_v2.sql` |
| `daily_briefs` | `(connection_id, date)` | Daily connection forecast | Date-based | `sql/007_connections_v2.sql` |

### 2.4 Schema Versioning Constants

**Purpose:** Global version numbers for cache invalidation

| Constant | File | Current Value | Purpose |
|----------|------|---------------|---------|
| `BIRTH_CHART_SCHEMA_VERSION` | [lib/birthChart/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:0:0-0:0):34 | 8 | Invalidates when placements structure changes |
| `SOUL_PATH_SCHEMA_VERSION` | [lib/soulPath/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/soulPath/storage.ts:0:0-0:0):40 | 8 | Matches birth chart version |
| `NUMEROLOGY_PROMPT_VERSION` | [lib/numerology/index.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/index.ts:0:0-0:0) | 1 | Invalidates when calculations change |

**Version History (v1-v8):**
- v1: Initial placements
- v2: Added longitude, retrograde, aspects
- v3: Added derived summary
- v4: Added South Node, cusp longitudes
- v5: Added chart type, Part of Fortune
- v6: Added stelliums, house/sign emphasis
- v7: Added grand trine, t-square patterns
- v8: **Current** — Fixed patterns to exclude Nodes/Chiron

---

## 3. DATA FLOW MAPPING

### 3.1 Numerology Stone Tablet Flow

```
User visits /sanctuary/numerology
         ↓
Frontend: GET /api/numerology?system=pythagorean
         ↓
API: Load user profile (profiles table)
         ↓
API: Check if Settings complete (first_name, last_name, birth_date)
         ↓
API: Query numerology_profiles WHERE user_id = :userId AND system = :system
         ↓
     Cache Hit?
     ├─ YES → Return cached profile
     │         (profile_json + cycles computed fresh)
     │
     └─ NO → Compute fresh numerology
               ↓
         Store in numerology_profiles
               ↓
         Return profile + cycles
```

**Key Functions:**
- `getOrComputeNumerologyProfile()` — Cache lookup + computation
- `isCacheValid()` — Validates birth_date, names, system, prompt_version match
- `profileToRow()` / `rowToProfile()` — Conversion between DB and TS types

**Cache Invalidation Triggers:**
1. Name changes (first/middle/last)
2. Birth date changes
3. System toggle (Pythagorean ↔ Chaldean)
4. `NUMEROLOGY_PROMPT_VERSION` bump (code deployment)

### 3.2 Birth Chart Stone Tablet Flow (Dual Storage)

```
User visits /sanctuary/birth-chart
         ↓
Frontend: POST /api/birth-chart
         ↓
API: Load user profile (profiles table)
         ↓
API: Check if Settings complete (birth_date, birth_time, location, timezone)
         ↓
API: Try soul_paths table (PRIMARY)
         ↓
     Cache Hit?
     ├─ YES (soul_paths) → Validate birth_input_hash + schema_version
     │                     ↓
     │                  Hash matches? → Return placements
     │                     ↓
     │                  Hash changed? → Recompute & update soul_paths
     │
     └─ NO (miss) → Try profiles.birth_chart_placements_json (FALLBACK)
                     ↓
                  Exists? → Return placements
                     ↓
                  NULL? → Compute fresh
                           ↓
                     Store in soul_paths (preferred)
                           ↓
                     Also store in profiles column (legacy support)
                           ↓
                     Return placements
```

**Key Functions:**
- `getOrComputeSoulPath()` — Dual storage logic (soul_paths → profiles fallback)
- `computeBirthInputHash()` — SHA-256(birth_date + birth_time + lat + lon + timezone)
- `computeAndStoreBirthChart()` — Swiss Ephemeris computation + storage

**Cache Invalidation Triggers:**
1. Birth data changes (date, time, location, timezone)
2. `SOUL_PATH_SCHEMA_VERSION` bump (code deployment)

**⚠️ Drift Risk:** Two storage locations can get out of sync

### 3.3 Soul Path Stone Tablet Flow

```
API endpoint loads user birth chart
         ↓
Call getOrComputeSoulPath(userId, profile)
         ↓
Query: SELECT * FROM soul_paths WHERE user_id = :userId
         ↓
     Record exists?
     ├─ YES → Check birth_input_hash
     │         ├─ Match → Check schema_version
     │         │           ├─ Match → Return cached soul_path_json
     │         │           └─ Mismatch → Invalidate (recompute)
     │         └─ Mismatch → Invalidate (birth data changed)
     │
     └─ NO → Compute fresh
               ↓
         Compute birth_input_hash
               ↓
         Call computeSwissPlacements()
               ↓
         UPSERT INTO soul_paths
               ↓
         Return soul_path_json
```

**Storage Pattern:**
- One record per user (`user_id` is PK)
- Upsert on conflict (updates existing record)
- No history tracking (only latest computation)

---

## 4. INTERACTION WITH ASTROLOGY & NUMEROLOGY

### 4.1 Astrology Tab

**Reads From:**
1. PRIMARY: `soul_paths` table (via `getOrComputeSoulPath()`)
2. FALLBACK: `profiles.birth_chart_placements_json` column

**Writes To:**
1. `soul_paths` table (preferred)
2. `profiles.birth_chart_placements_json` (legacy, for backward compat)

**Triggers:**
- On page load: Check cache → Serve or compute
- On Settings change: Birth input hash changes → Recompute
- On schema bump: Old version detected → Recompute

**Can Stone Tablets cause chart to appear when Settings incomplete?**

**Answer: NO** ✅

**Evidence:**
```typescript
// lib/soulPath/storage.ts:122-127
if (!profile.birth_date || !profile.birth_lat || !profile.birth_lon || !profile.timezone) {
  throw new Error("Incomplete birth data");
}
```

**Validation enforced BEFORE cache lookup.** If Settings incomplete, error thrown, NO chart shown.

### 4.2 Numerology Tab

**Reads From:**
- `numerology_profiles` table (via `getOrComputeNumerologyProfile()`)

**Writes To:**
- `numerology_profiles` table

**Triggers:**
- On page load: Check cache → Serve or compute
- On Settings change: Name or birth_date changes → Recompute
- On system toggle: Different system requested → Check separate cache
- On prompt version bump: Old version detected → Recompute

**Can Stone Tablets cause numerology to appear when Settings incomplete?**

**Answer: NO** ✅

**Evidence:**
```typescript
// lib/numerology/storage.ts:231-235
if (!profile.first_name || !profile.last_name) {
  return Error("Incomplete profile");
}
if (!profile.birth_date) {
  return Error("Incomplete profile");
}
```

**Validation enforced BEFORE cache lookup.** If Settings incomplete, error returned, NO numerology shown.

### 4.3 Does Stone Tablets Bypass Normal API Flows?

**Answer: NO** ✅

Stone Tablets is **integrated into** API flows, not bypassing them:
1. API endpoint receives request
2. Validates user authentication
3. Loads profile from Settings
4. **Validates completeness** (CRITICAL GATE)
5. If valid → Check Stone Tablets cache
6. If cache hit → Return cached
7. If cache miss → Compute fresh → Store in Stone Tablets → Return

**Stone Tablets is the storage/caching layer, not a separate execution path.**

---

## 5. CONFLICT MATRIX: Stone Tablets vs Library Book Model

### 5.1 Library Book Non-Negotiables

| Rule | Stone Tablets Compliance | Status |
|------|-------------------------|--------|
| **Settings is source of truth for official book** | ✅ YES — All Stone Tablets read from Settings first | ✅ Compatible |
| **Tabs are temporary reading tables** | ❌ NO — Stone Tablets caches are permanent user-specific records | ❌ **VIOLATES** |
| **Leaving tab resets to Settings** | ⚠️ PARTIAL — Cached data persists, but always sourced from Settings | ⚠️ Neutral |
| **No persistence of previews** | ❌ NO — Preview mode not implemented in Stone Tablets | ⚠️ Incomplete |
| **No fake books** | ✅ YES — Validation prevents computation with incomplete data | ✅ Compatible |
| **No silent defaults** | ⚠️ PARTIAL — `birth_time` defaults to "12:00" if null | ⚠️ **CONFLICTS** |
| **No hidden caching tied to user** | ❌ NO — Entire system is user-scoped caching | ❌ **VIOLATES** |

### 5.2 Global Deduplication Conflict (CRITICAL)

**Library Book Model:**
```typescript
// Expected: Global library with deterministic keys
charts table:
  chart_key TEXT PRIMARY KEY,        // Deterministic hash (no user_id)
  input_json JSONB,
  geometry_json JSONB,
  ...

profiles table:
  official_chart_key TEXT            // Pointer to shared library
```

**Stone Tablets Model:**
```typescript
// Actual: User-specific caching
soul_paths table:
  user_id UUID PRIMARY KEY,          // ❌ One record per user
  soul_path_json JSONB,
  ...

numerology_profiles table:
  user_id UUID,                       // ❌ User-scoped
  UNIQUE(user_id, system, input_hash)
```

**Conflict:**
- Library Book: Users with identical birth data **share one record**
- Stone Tablets: Users with identical birth data **each have their own record**

**Result:** ❌ **DIRECT ARCHITECTURAL CONFLICT**

### 5.3 Noon Defaulting Conflict

**Library Book Rule:** NO silent defaults

**Stone Tablets Evidence:**
```typescript
// lib/birthChart/storage.ts:68
const timeForSwiss = profile.birth_time || "12:00";  // ❌ SILENT DEFAULT
```

**Impact:** If `birth_time` is NULL in Settings, Stone Tablets defaults to noon for house calculations **without user awareness**.

**Conflict:** ❌ **VIOLATES no-defaults principle**

---

## 6. SUPABASE & SCHEMA IMPACT

### 6.1 Tables Used by Stone Tablets

| Table | Created By | Purpose | User-Scoped? | RLS |
|-------|-----------|---------|--------------|-----|
| `numerology_profiles` | `20250101000000_numerology_schema.sql` | Numerology cache | YES (`user_id`) | Enabled (users own records) |
| `soul_paths` | `sql/002_create_soul_paths_table.sql` | Birth chart cache | YES (`user_id` PK) | Enabled (NO policies, server-only) |
| `profiles.birth_chart_placements_json` | `sql/001_add_birth_chart_cache.sql` | Legacy chart cache | YES (implicit) | Profiles RLS |
| `space_between_reports` | `sql/007_connections_v2.sql` | Connection reports | YES (`connection_id`) | Enabled |
| `daily_briefs` | `sql/007_connections_v2.sql` | Daily forecasts | YES (`connection_id`, `date`) | Enabled |

### 6.2 Schema Drift Risks

**Risk 1: Dual Storage Drift**

`soul_paths` and `profiles.birth_chart_placements_json` can get out of sync:
- Code prefers `soul_paths` (primary)
- Falls back to `profiles` column (legacy)
- Updates written to BOTH locations
- **No constraint ensuring consistency**

**Mitigation:** Code handles gracefully, but drift is possible

**Risk 2: Migration Conflicts**

Library Book migrations create:
- `charts` table (global, `chart_key` PK)
- `numerology_profiles` table (global, `numerology_key` PK)

Stone Tablets expects:
- `soul_paths` table (user-scoped, `user_id` PK)
- `numerology_profiles` table (user-scoped, `user_id` + hash UNIQUE)

**Table Name Collision:**
- ⚠️ `numerology_profiles` used by BOTH systems with **different schemas**

**Evidence:**
```sql
-- Library Book (20260125000000_library_book_model.sql)
CREATE TABLE numerology_profiles (
  numerology_key TEXT PRIMARY KEY,    -- Global dedupe
  input_json JSONB,
  numerology_json JSONB,
  config_version TEXT,
  ...
);

-- Stone Tablets (20250101000000_numerology_schema.sql)
CREATE TABLE numerology_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,              -- User-scoped
  input_hash TEXT NOT NULL,
  profile_json JSONB,
  ...
  UNIQUE(user_id, system, input_hash)
);
```

**Conflict:** ❌ **SAME TABLE NAME, INCOMPATIBLE SCHEMAS**

### 6.3 Columns Assumed by Stone Tablets

**On `profiles` table:**
- `birth_chart_placements_json JSONB` — ✅ Exists (legacy)
- `birth_chart_computed_at TIMESTAMPTZ` — ✅ Exists
- `birth_chart_schema_version INTEGER` — ✅ Exists

**Library Book additions:**
- `official_chart_key TEXT` — ⚠️ May not exist in production
- `official_numerology_key TEXT` — ⚠️ May not exist in production

**Drift Risk:** Library Book columns missing → Code will fail when trying to sync official keys

---

## 7. RISK ASSESSMENT

### 7.1 P0 Risks (Critical)

| # | Risk | Impact | Evidence |
|---|------|--------|----------|
| **R1** | **Table Schema Conflict** | `numerology_profiles` table has TWO incompatible schemas (Stone Tablets vs Library Book) | Migrations `20250101000000` vs `20260125000000` |
| **R2** | **Architectural Incompatibility** | Stone Tablets (user-scoped) fundamentally conflicts with Library Book (global dedupe) | User-scoped PKs vs deterministic global keys |
| **R3** | **Noon Defaulting** | `birth_time = null` silently defaults to "12:00" | [lib/birthChart/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:0:0-0:0):68 |

### 7.2 P1 Risks (High)

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| **R4** | **Dual Storage Drift** | `soul_paths` and `profiles.birth_chart_placements_json` can desync | Code handles gracefully (prefers soul_paths) |
| **R5** | **Missing Library Columns** | Production may lack `official_chart_key`, `official_numerology_key` | Apply patch migration |
| **R6** | **Preview Mode Not Implemented** | Stone Tablets has no concept of temporary previews | Requires new implementation |

### 7.3 P2 Risks (Medium)

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| **R7** | **Schema Version Skew** | Users with old schema versions trigger recomputation storms | Gradual rollout, monitoring |
| **R8** | **RLS Policy Mismatches** | Some Stone Tablets tables have user access, others don't | Document access patterns clearly |

---

## 8. RECOMMENDATIONS

### 8.1 DECISION MATRIX

We have **three options**:

#### Option A: DISABLE Stone Tablets Temporarily ❌ **NOT VIABLE**

**Why:** Stone Tablets is **not optional** — it's the core persistence layer for all computed astrology/numerology data. Disabling it means:
- No birth charts
- No numerology profiles
- No AI narratives
- Complete feature loss

**Verdict:** **Cannot disable**

#### Option B: REFACTOR Stone Tablets to Library Book Model ⚠️ **HIGH EFFORT**

**Required Changes:**
1. Migrate `numerology_profiles` from user-scoped to global dedupe
2. Migrate `soul_paths` data to global `charts` table
3. Update all storage logic to use deterministic keys
4. Maintain backward compatibility during transition
5. Data migration for all existing users

**Effort:** 2-3 weeks + extensive testing

**Risk:** High (data migration, potential data loss)

**Benefit:** Full Library Book compliance

#### Option C: INTEGRATE Stone Tablets INTO Library Book Model ✅ **RECOMMENDED**

**Strategy:** Recognize Stone Tablets as the **existing implementation** and adapt Library Book to leverage it:

1. **Keep `soul_paths` and `numerology_profiles` tables as-is** (Stone Tablets)
2. **Add `charts` and `numerology_library` tables** (Library Book global dedupe)
3. **Use Stone Tablets for Official Mode** (Settings-derived, user-specific cache)
4. **Use Library Book for Preview Mode** (arbitrary inputs, global dedupe)
5. **Profiles point to BOTH**:
   - `official_chart_key` → `charts` table (global)
   - Internal queries → `soul_paths` table (user cache)

**Rationale:**
- Preserves existing functionality (no regression risk)
- Adds Preview Mode without breaking Official Mode
- Gradual migration path (can deprecate Stone Tablets later)
- Aligns with "Settings is source of truth" (Stone Tablets already does this)

### 8.2 RECOMMENDED ARCHITECTURE (Hybrid Model)

```
┌─────────────────────────────────────────────────────────────┐
│                        HYBRID MODEL                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OFFICIAL MODE (Settings-derived)                           │
│  ├─ Reads from: profiles → soul_paths (Stone Tablets)      │
│  ├─ Computes: Only if Settings complete                    │
│  ├─ Writes: soul_paths + profiles.official_chart_key        │
│  └─ Cache: User-specific (current behavior)                │
│                                                             │
│  PREVIEW MODE (Arbitrary inputs)                            │
│  ├─ Reads from: charts / numerology_profiles (Library)     │
│  ├─ Computes: Any valid inputs (not tied to user)          │
│  ├─ Writes: charts / numerology_profiles (global dedupe)   │
│  └─ Cache: Global (shared across users)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tables:**
- `soul_paths` — Official birth charts (user-scoped, Stone Tablets)
- `numerology_profiles` — Official numerology (user-scoped, Stone Tablets)
- `charts` — Preview birth charts (global, Library Book)
- `numerology_library` — Preview numerology (global, Library Book)

**Profile Pointers:**
- `official_chart_key TEXT` — Points to `charts` table (or null if Settings incomplete)
- `official_numerology_key TEXT` — Points to `numerology_library` table

**Migration Path:**
1. Phase 1: Keep Stone Tablets for Official Mode (current)
2. Phase 2: Add Library Book for Preview Mode (new feature)
3. Phase 3: Gradually migrate Official Mode to Library Book (optional, long-term)

---

## 9. DEFINITION OF DONE (For Library Book Completion)

### 9.1 Immediate Actions (Pre-Flight)

- [x] ✅ Understand Stone Tablets (this audit)
- [ ] Document hybrid architecture decision
- [ ] Resolve `numerology_profiles` table name conflict:
  - Option A: Rename Stone Tablets table to `user_numerology_cache`
  - Option B: Rename Library Book table to `numerology_library`
  - Option C: Use different schema namespaces

### 9.2 Integration Requirements

**Official Mode (Stone Tablets):**
- [ ] Validation prevents computation with incomplete Settings
- [ ] No noon defaulting (fix [lib/birthChart/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:0:0-0:0):68)
- [ ] Profiles point to official keys (`official_chart_key`, `official_numerology_key`)
- [ ] Cache invalidation on Settings change

**Preview Mode (Library Book):**
- [ ] Global `charts` and `numerology_library` tables exist
- [ ] Deterministic key generation working
- [ ] Preview endpoints return full experience (geometry + AI)
- [ ] NO writes to user profile
- [ ] Leaving tab resets (frontend state only)

**Coexistence:**
- [ ] No table name conflicts
- [ ] No schema version conflicts
- [ ] Clear documentation: Official vs Preview
- [ ] Tests validate both modes work independently

### 9.3 Success Criteria

**Official Mode (Stone Tablets):**
- ✅ Birth chart loads from Settings
- ✅ Numerology loads from Settings
- ✅ Incomplete Settings shows correct error
- ✅ No silent defaults
- ✅ Cache invalidation on Settings change

**Preview Mode (Library Book):**
- ✅ Can preview arbitrary birth chart (not user's)
- ✅ Can preview arbitrary numerology (not user's)
- ✅ Previews deduplicated globally
- ✅ Previews never write to user profile
- ✅ Leaving tab reverts to Official

**No Regressions:**
- ✅ Existing users' cached data still loads
- ✅ No duplicate computations
- ✅ No data loss during migration

---

## 10. APPENDIX: FILE PATHS REFERENCE

### Storage Modules
- [lib/numerology/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/numerology/storage.ts:0:0-0:0) — Numerology Stone Tablets
- [lib/soulPath/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/soulPath/storage.ts:0:0-0:0) — Soul Path Stone Tablets
- [lib/birthChart/storage.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/lib/birthChart/storage.ts:0:0-0:0) — Birth Chart Stone Tablets

### API Endpoints
- [app/api/numerology/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/numerology/route.ts:0:0-0:0) — Numerology endpoint
- [app/api/birth-chart/route.ts](cci:1://file:///Users/aaronburlar/Desktop/Solara/app/api/birth-chart/route.ts:0:0-0:0) — Birth chart endpoint

### Migrations (Stone Tablets)
- [supabase/migrations/20250101000000_numerology_schema.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20250101000000_numerology_schema.sql:0:0-0:0) — `numerology_profiles` table
- [sql/002_create_soul_paths_table.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/sql/002_create_soul_paths_table.sql:0:0-0:0) — `soul_paths` table
- [sql/001_add_birth_chart_cache.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/sql/001_add_birth_chart_cache.sql:0:0-0:0) — `profiles` columns

### Migrations (Library Book)
- [supabase/migrations/20260125000000_library_book_model.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260125000000_library_book_model.sql:0:0-0:0) — Global library tables
- [supabase/migrations/20260126090000_patch_library_book_remote.sql](cci:1://file:///Users/aaronburlar/Desktop/Solara/supabase/migrations/20260126090000_patch_library_book_remote.sql:0:0-0:0) — Idempotent patch

---

**END OF AUDIT**

**STATUS:** ⚠️ **AWAITING DECISION ON OPTION C (Hybrid Model)**

**NEXT STEPS:**
1. Review this audit
2. Approve/reject hybrid architecture recommendation
3. Resolve `numerology_profiles` table name conflict
4. Proceed with Library Book implementation (Option C path)

**BLOCKING:** Cannot implement Library Book without resolving architectural conflicts identified in this audit.
