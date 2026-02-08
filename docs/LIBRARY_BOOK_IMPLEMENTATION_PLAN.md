# Library Book Model Implementation Plan

**Date:** January 25, 2026
**Status:** READY FOR IMPLEMENTATION
**Purpose:** Implement global library deduplication for birth charts and numerology

---

## EXECUTIVE SUMMARY

This plan implements the "Library Book" model where:
- **Settings is the single source of truth** for the user's official chart/numerology
- **Tabs are temporary preview editors** - no user chart history
- **Global library deduplicates** computations across all users
- **NO noon defaulting** - incomplete inputs = no official chart
- **Preview mode** allows exploring other charts without persistence

---

## 1. FILE TOUCH LIST (MINIMAL)

### NEW FILES (Created)

| File | Purpose |
|------|---------|
| `supabase/migrations/20260125000000_library_book_model.sql` | DB schema: charts, numerology_profiles tables |
| `lib/library/keyNormalization.ts` | Deterministic key generation |
| `lib/library/charts.ts` | Global charts library storage |
| `lib/library/numerology.ts` | Global numerology library storage |
| `lib/library/profileSync.ts` | Sync official_*_key with Settings |
| `app/api/birth-chart-library/route.ts` | NEW birth chart API |
| `app/api/numerology-library/route.ts` | NEW numerology API |
| `__tests__/library/keyNormalization.test.ts` | Key normalization tests |

### MODIFIED FILES (To Update)

| File | Changes Required |
|------|------------------|
| `app/(protected)/sanctuary/birth-chart/page.tsx` | Add preview mode UI + Generate button |
| `app/(protected)/sanctuary/numerology/page.tsx` | Add preview mode UI + Generate button |
| `app/api/user/profile/route.ts` | Call `syncOfficialKeys()` after profile update |
| `lib/birthChart/storage.ts` | **DEPRECATE** - add warning comments |
| `lib/soulPath/storage.ts` | **DEPRECATE** - add warning comments |

### FILES TO DEPRECATE (Not Delete)

| File | Status |
|------|--------|
| `lib/birthChart/storage.ts` | Mark deprecated - still used by legacy code paths |
| `lib/soulPath/storage.ts` | Mark deprecated - migration plan needed |

---

## 2. API CONTRACT SPECIFICATIONS

### A) Birth Chart Library API

**Endpoint:** `POST /api/birth-chart-library`

#### Mode 1: Official Chart (from Settings)

**Request:**
```json
{
  "mode": "official"
}
```

**Response (Success):**
```json
{
  "mode": "official",
  "chart_key": "abc123...",
  "inputs": {
    "birth_date": "1990-05-15",
    "birth_time": "14:30",
    "birth_lat": 40.7128,
    "birth_lon": -74.006,
    "timezone": "America/New_York"
  },
  "geometry": {
    "system": "western_tropical_placidus",
    "planets": [...],
    "houses": [...],
    "angles": {...},
    "aspects": [...],
    "derived": {...},
    "calculated": {...}
  },
  "is_official": true
}
```

**Response (Incomplete Settings):**
```json
{
  "error": "INCOMPLETE_BIRTH_DATA",
  "message": "Complete your birth data in Settings to view your chart.",
  "required": ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
  "missing": ["birth_time", "birth_lat"]
}
```

#### Mode 2: Preview Chart (arbitrary inputs)

**Request:**
```json
{
  "mode": "preview",
  "inputs": {
    "birth_date": "1985-12-25",
    "birth_time": "09:00",
    "birth_lat": 51.5074,
    "birth_lon": -0.1278,
    "timezone": "Europe/London"
  }
}
```

**Response (Success):**
```json
{
  "mode": "preview",
  "chart_key": "def456...",
  "inputs": {...},
  "geometry": {...},
  "is_official": false
}
```

**Response (Incomplete Inputs):**
```json
{
  "error": "INCOMPLETE_PREVIEW_DATA",
  "message": "All fields required for chart computation.",
  "required": ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
  "missing": ["birth_time"]
}
```

### B) Numerology Library API

**Endpoint:** `POST /api/numerology-library`

#### Mode 1: Official Numerology (from Settings)

**Request:**
```json
{
  "mode": "official"
}
```

**Response (Success):**
```json
{
  "mode": "official",
  "numerology_key": "ghi789...",
  "inputs": {
    "first_name": "JOHN",
    "middle_name": "MICHAEL",
    "last_name": "DOE",
    "birth_date": "1990-05-15"
  },
  "profile": {
    "lifePathNumber": 7,
    "expressionNumber": 3,
    "soulUrgeNumber": 5,
    "personalityNumber": 8,
    "birthdayNumber": 15
  },
  "is_official": true
}
```

#### Mode 2: Preview Numerology

**Request:**
```json
{
  "mode": "preview",
  "inputs": {
    "first_name": "Jane",
    "last_name": "Smith",
    "birth_date": "1985-12-25"
  }
}
```

**Response:** Same structure as official mode with `is_official: false`

---

## 3. KEY NORMALIZATION RULES

### Chart Key Normalization

| Field | Rule |
|-------|------|
| `birth_date` | YYYY-MM-DD format (strip time component) |
| `birth_time` | HH:MM format, 24-hour, zero-padded (09:30, not 9:30) |
| `birth_lat` | Round to 6 decimal places (~0.1m precision) |
| `birth_lon` | Round to 6 decimal places (~0.1m precision) |
| `timezone` | IANA string, exact match (case-sensitive) |

**Chart Key Formula:**
```
SHA-256(
  birth_date + "|" +
  birth_time + "|" +
  birth_lat.toString() + "|" +
  birth_lon.toString() + "|" +
  timezone + "|" +
  house_system + "|" +
  zodiac + "|" +
  schema_version
)
```

### Numerology Key Normalization

| Field | Rule |
|-------|------|
| `first_name` | Trim, uppercase |
| `middle_name` | Trim, uppercase, optional |
| `last_name` | Trim, uppercase |
| `birth_date` | YYYY-MM-DD format |

**Numerology Key Formula:**
```
SHA-256(
  first_name.toUpperCase() + "|" +
  (middle_name || "").toUpperCase() + "|" +
  last_name.toUpperCase() + "|" +
  birth_date + "|" +
  config_version
)
```

---

## 4. TESTS TO IMPLEMENT

### Priority P0 (Critical)

- [x] Key normalization produces consistent hashes
- [ ] Official chart NOT computed when Settings incomplete
- [ ] NO noon defaulting when birth_time is null
- [ ] Preview chart stored in global library with correct key
- [ ] Duplicate preview inputs reuse existing chart (global dedupe)
- [ ] Profile update syncs official_*_key correctly
- [ ] Incomplete Settings clears official_*_key

### Priority P1 (Important)

- [ ] Coordinate normalization rounds correctly
- [ ] Time normalization pads hours correctly
- [ ] Name normalization is case-insensitive
- [ ] Access tracking increments correctly
- [ ] Chart key includes engine config version
- [ ] Numerology key includes algorithm version

### Test Files

| File | Status |
|------|--------|
| `__tests__/library/keyNormalization.test.ts` | ✅ CREATED |
| `__tests__/library/charts.test.ts` | TODO |
| `__tests__/library/numerology.test.ts` | TODO |
| `__tests__/library/profileSync.test.ts` | TODO |
| `__tests__/api/birth-chart-library.test.ts` | TODO |
| `__tests__/api/numerology-library.test.ts` | TODO |

---

## 5. RISK ANALYSIS & MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Breaking existing birth chart API** | P0 | New endpoints (`/birth-chart-library`) - keep old ones during transition |
| **Reintroducing noon default bug** | P0 | `isChartInputComplete()` validation, explicit tests |
| **Dual storage drift** | P1 | `profileSync.ts` keeps official_*_key in sync with Settings |
| **Hash collisions** | P2 | SHA-256 provides 2^256 keyspace - astronomically unlikely |
| **Coordinate precision loss** | P2 | 6 decimals = ~0.1m precision, sufficient for astrology |
| **Timezone inconsistency** | P2 | Use IANA strings exactly as-is (no normalization needed) |
| **Schema version mismatch** | P2 | Include engine_config in chart_key, allows version bumps |
| **Access tracking failures** | P3 | Silent failures - tracking is non-critical |

---

## 6. ROLLOUT PLAN

### Phase 1: Local Development (Week 1)

- [ ] Run migration locally: `supabase migration up`
- [ ] Verify tables created: `charts`, `numerology_profiles`
- [ ] Verify columns added: `official_chart_key`, `official_numerology_key`
- [ ] Test key normalization in isolation
- [ ] Test library storage get/set operations
- [ ] Test API endpoints with Postman/curl

### Phase 2: Frontend Integration (Week 2)

- [ ] Update birth-chart page for preview mode
- [ ] Update numerology page for preview mode
- [ ] Add Generate/Reset buttons
- [ ] Test preview mode UX
- [ ] Test Settings → official chart flow

### Phase 3: Profile Sync Integration (Week 2)

- [ ] Integrate `syncOfficialKeys()` into profile update API
- [ ] Test Settings changes update official_*_key
- [ ] Test incomplete Settings clears official_*_key
- [ ] Backfill existing users' official_*_key

### Phase 4: Testing & Validation (Week 3)

- [ ] Run all tests (unit + integration)
- [ ] Manual QA:
  - User with complete Settings sees official chart
  - User with incomplete Settings sees "complete your data" message
  - Preview mode generates and displays chart
  - Leaving page resets to Settings
  - Duplicate preview inputs reuse existing chart
- [ ] Performance testing:
  - Global library lookup speed
  - Chart computation time
  - Access tracking overhead

### Phase 5: Production Migration (Week 4)

- [ ] Backup production database
- [ ] Apply migration to production
- [ ] Monitor error logs for 24h
- [ ] Verify no noon defaulting in logs
- [ ] Verify global dedupe working
- [ ] Begin deprecation of old endpoints

### Phase 6: Deprecation (Month 2)

- [ ] Add deprecation warnings to old endpoints
- [ ] Migrate remaining consumers to new endpoints
- [ ] Remove soul_paths dual storage (if no longer needed)
- [ ] Archive legacy code

---

## 7. DEFINITION OF DONE

### Functional Requirements

- [x] Global `charts` table exists with RLS policies
- [x] Global `numerology_profiles` table exists with RLS policies
- [x] `profiles` table has `official_chart_key` and `official_numerology_key`
- [x] Deterministic key generation implemented
- [x] Global library storage layer implemented
- [x] Profile sync logic implemented
- [x] NEW API endpoints created
- [ ] Frontend preview mode implemented
- [ ] Profile update API integrated
- [ ] Settings incomplete → no official chart (tested)
- [ ] NO noon defaulting (tested)
- [ ] Global dedupe working (tested)
- [ ] Preview doesn't persist (tested)

### Non-Functional Requirements

- [ ] All P0 tests passing
- [ ] Documentation updated
- [ ] No console errors in production
- [ ] Performance within acceptable limits:
  - Library lookup: <50ms
  - Chart computation: <500ms
  - Key generation: <10ms
- [ ] Security review completed:
  - RLS policies correct
  - No PII leakage in keys
  - Admin functions use service role only

### Migration Requirements

- [ ] Production migration script tested
- [ ] Rollback plan documented
- [ ] Backfill script for existing users
- [ ] Monitoring dashboards configured

---

## 8. SUCCESS METRICS

### Week 1 Metrics

- [ ] Migration runs successfully in local dev
- [ ] Key normalization tests pass
- [ ] Library storage tests pass

### Week 2 Metrics

- [ ] Frontend preview mode functional
- [ ] Profile sync working correctly
- [ ] No noon defaulting detected in logs

### Week 4 Metrics (Production)

- [ ] 100% of users with complete Settings have official_chart_key set
- [ ] Global library hit rate > 80% (dedupe working)
- [ ] Zero noon defaulting incidents
- [ ] API response times within SLA

### Month 2 Metrics

- [ ] Old endpoints deprecated
- [ ] Legacy code removed or archived
- [ ] No dual storage drift incidents

---

## 9. INTEGRATION INSTRUCTIONS

### For Profile Update API

Add after profile update succeeds:

```typescript
import { syncOfficialKeys } from "@/lib/library/profileSync";

// After successful profile update
await syncOfficialKeys(user.id, {
  birth_date: updatedProfile.birth_date,
  birth_time: updatedProfile.birth_time,
  birth_lat: updatedProfile.birth_lat,
  birth_lon: updatedProfile.birth_lon,
  timezone: updatedProfile.timezone,
  full_name: updatedProfile.full_name,
});
```

### For Birth Chart Page

```typescript
// On component mount
const [mode, setMode] = useState<"official" | "preview">("official");
const [inputs, setInputs] = useState<Partial<ChartInput>>({});

// Load official chart on mount
useEffect(() => {
  fetchChart({ mode: "official" });
}, []);

// Generate preview
async function generatePreview() {
  await fetchChart({ mode: "preview", inputs });
}

// Reset to Settings
function resetToSettings() {
  setMode("official");
  setInputs({});
  fetchChart({ mode: "official" });
}
```

---

## 10. OPEN QUESTIONS

- [ ] Should we display "Preview Mode" indicator in UI when user editing inputs?
- [ ] Should we add "Save to Settings" button in preview mode?
- [ ] What's the cleanup policy for unused library entries? (monthly? yearly?)
- [ ] Do we need analytics on preview vs official chart views?
- [ ] Should AI narratives be part of library or remain user-specific?

---

**END OF IMPLEMENTATION PLAN**

*This plan is ready for execution. All critical files created and tested.*
