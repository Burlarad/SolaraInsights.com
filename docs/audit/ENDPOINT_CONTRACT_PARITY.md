# ENDPOINT CONTRACT PARITY — Library Book vs Stone Tablets

**Date**: 2026-01-26
**Purpose**: Document exact API contract differences between old (Stone Tablets) and new (Library Book) endpoints
**Status**: ❌ PARITY NOT ACHIEVED - Blocking UI migration

---

## Executive Summary

### ⚠️ BLOCKING ISSUES

1. **Birth Chart Library Endpoint**: Missing AI narrative layer (`insight` field)
2. **Birth Chart Library Endpoint**: Wrong field name (`geometry` should be `placements`)
3. **Numerology Library Endpoint**: Missing full calculations (`cycles`, `pinnacles`, `challenges`)

### User Impact

Frontend CANNOT migrate to new endpoints until parity achieved. Currently using old endpoints as temporary workaround:
- [birth-chart/page.tsx:152](app/(protected)/sanctuary/birth-chart/page.tsx#L152) - uses `/api/birth-chart`
- [numerology/page.tsx:30](app/(protected)/sanctuary/numerology/page.tsx#L30) - uses `/api/numerology`

---

## 1. Birth Chart Endpoint Comparison

### 1.1 Old Endpoint (Stone Tablets)

**Route**: `POST /api/birth-chart`
**Implementation**: [app/api/birth-chart/route.ts](app/api/birth-chart/route.ts)
**Storage**: `soul_paths` table (user-scoped)

**Request**:
```json
{} // Empty body - uses auth.uid() to load profile
```

**Success Response** ([route.ts:1031-1034](app/api/birth-chart/route.ts#L1031-L1034)):
```json
{
  "placements": {
    "system": {"houseSystem": "placidus", "zodiac": "tropical", "schemaVersion": 8},
    "planets": [
      {"name": "Sun", "sign": "Aries", "house": 1, "longitude": 15.4, "retrograde": false},
      // ... 9 more planets
    ],
    "houses": [
      {"house": 1, "signOnCusp": "Aries", "cuspLongitude": 0.0},
      // ... 11 more houses
    ],
    "angles": {
      "ascendant": {"sign": "Aries", "longitude": 0.0},
      "midheaven": {"sign": "Capricorn", "longitude": 270.0},
      "descendant": {"sign": "Libra", "longitude": 180.0},
      "ic": {"sign": "Cancer", "longitude": 90.0}
    },
    "aspects": [
      {"between": ["Sun", "Moon"], "type": "trine", "orb": 2.3},
      // ... more aspects
    ],
    "derived": {
      "chartRuler": "Mars",
      "dominantSigns": [{"sign": "Aries", "count": 3}],
      "dominantPlanets": [{"name": "Mars", "score": 5}],
      "elementBalance": {"fire": 4, "earth": 2, "air": 3, "water": 1},
      "modalityBalance": {"cardinal": 4, "fixed": 3, "mutable": 3},
      "topAspects": [...]
    },
    "calculated": {
      "chartType": "Bowl",
      "partOfFortune": {"sign": "Taurus", "house": 2, "longitude": 45.2},
      "southNode": {"sign": "Libra", "house": 7, "longitude": 185.7},
      "emphasis": {...},
      "patterns": [],
      "stelliums": []
    }
  },
  "insight": {
    "meta": {"mode": "natal_full_profile", "language": "en"},
    "coreSummary": {
      "headline": "The Pioneer's Path",
      "overallVibe": "2-4 paragraphs of narrative...",
      "bigThree": {
        "sun": "2-4 paragraphs...",
        "moon": "2-4 paragraphs...",
        "rising": "2-4 paragraphs..."
      }
    },
    "sections": {
      "identity": "2-4 paragraphs...",
      "emotions": "2-4 paragraphs...",
      "loveAndRelationships": "2-4 paragraphs...",
      "workAndMoney": "2-4 paragraphs...",
      "purposeAndGrowth": "2-4 paragraphs...",
      "innerWorld": "2-4 paragraphs..."
    },
    "tabDeepDives": {
      "astrology": {...},
      "numerology": {...},
      "enneagram": {...},
      // ... more tabs
    }
  }
}
```

**Error Response** (Incomplete birth data):
```json
{
  "error": "No soul path",
  "message": "Complete your birth info in Settings to view your Soul Path."
}
```

---

### 1.2 New Endpoint (Library Book)

**Route**: `POST /api/birth-chart-library`
**Implementation**: [app/api/birth-chart-library/route.ts](app/api/birth-chart-library/route.ts)
**Storage**: `charts` table (global dedupe)

**Request**:
```json
{
  "mode": "official"  // or "preview"
}

// Or for preview mode:
{
  "mode": "preview",
  "inputs": {
    "birth_date": "1990-01-15",
    "birth_time": "14:30",
    "birth_lat": 40.7128,
    "birth_lon": -74.0060,
    "timezone": "America/New_York"
  }
}
```

**Success Response** ([route.ts:87-93](app/api/birth-chart-library/route.ts#L87-L93)):
```json
{
  "mode": "official",
  "chart_key": "sha256_hash_of_inputs",
  "inputs": {
    "birth_date": "1990-01-15",
    "birth_time": "14:30",
    "birth_lat": 40.7128,
    "birth_lon": -74.0060,
    "timezone": "America/New_York"
  },
  "geometry": {  // ❌ WRONG FIELD NAME - should be "placements"
    "system": {...},
    "planets": [...],
    "houses": [...],
    "angles": {...},
    "aspects": [...],
    "derived": {...},
    "calculated": {...}
  },
  "is_official": true
  // ❌ MISSING: "insight" field entirely
}
```

**Error Response** ([route.ts:68-83](app/api/birth-chart-library/route.ts#L68-L83)):
```json
{
  "errorCode": "INCOMPLETE_BIRTH_DATA",
  "error": "INCOMPLETE_BIRTH_DATA",
  "message": "Complete your birth data in Settings to view your chart.",
  "required": ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
  "missing": ["birth_time"]
}
```

---

### 1.3 Birth Chart Contract Diff

| Field | Old Endpoint | New Endpoint | Status |
|-------|-------------|--------------|--------|
| `placements` | ✅ Present | ❌ Missing (uses `geometry` instead) | ⚠️ BREAKING |
| `geometry` | ❌ Not present | ✅ Present | ⚠️ BREAKING |
| `insight` | ✅ Present (AI narrative) | ❌ Missing | 🚨 **P0 BUG** |
| `mode` | ❌ Not present | ✅ Present ("official"/"preview") | ✅ OK (new field) |
| `chart_key` | ❌ Not present | ✅ Present | ✅ OK (new field) |
| `inputs` | ❌ Not present | ✅ Present | ✅ OK (new field) |
| `is_official` | ❌ Not present | ✅ Present | ✅ OK (new field) |
| Error shape | `{error, message}` | `{errorCode, error, message, required, missing}` | ✅ OK (better) |

### 1.4 Required Changes for Parity

**File**: [app/api/birth-chart-library/route.ts](app/api/birth-chart-library/route.ts)

**Change 1: Rename field `geometry` → `placements`**
```typescript
// BEFORE (line 91)
geometry: chart.geometry_json,

// AFTER
placements: chart.geometry_json,
```

**Change 2: Add AI narrative generation**
```typescript
// After line 93, add insight generation
import { generateBirthChartInsight } from "@/lib/ai/birthChartNarrative";

// In official mode response (after line 64):
const placements = chart.geometry_json as SwissPlacements;

// Generate or fetch cached AI narrative
const insight = await generateBirthChartInsight(
  placements,
  user.id,
  profile.language || "en"
);

// Return with insight
return NextResponse.json({
  mode: "official",
  chart_key: chart.chart_key,
  inputs: chart.input_json,
  placements: chart.geometry_json,  // ✅ Renamed field
  insight,  // ✅ Added AI narrative
  is_official: true,
});
```

**Change 3: Add caching layer for narratives**
- Option A: Store narratives in separate `chart_narratives` table (global, keyed by `chart_key` + language)
- Option B: Add `narrative_json` column to `charts` table
- Option C: Keep narratives in `soul_paths` during transition, migrate later

**Recommended**: Option A (separate table for clean separation of geometry vs narrative)

---

## 2. Numerology Endpoint Comparison

### 2.1 Old Endpoint (Stone Tablets)

**Route**: `POST /api/numerology`
**Implementation**: [app/api/numerology/route.ts](app/api/numerology/route.ts)
**Storage**: `numerology_profiles` table (user-scoped)

**Request**:
```json
{
  "system": "pythagorean"  // optional, defaults to pythagorean
}
```

**Success Response** ([route.ts:122-128](app/api/numerology/route.ts#L122-L128)):
```json
{
  "profile": {
    "lifePathNumber": 7,
    "expressionNumber": 3,
    "soulUrgeNumber": 5,
    "personalityNumber": 8,
    "birthdayNumber": 15,
    "karmic": {
      "karmicLessonNumbers": [2, 7],
      "karmicDebtNumbers": [13]
    }
  },
  "cycles": {
    "personalYear": {
      "number": 5,
      "description": "Year of change and freedom",
      "startDate": "2026-01-15",
      "endDate": "2027-01-14"
    },
    "pinnacles": [
      {"number": 3, "startAge": 0, "endAge": 32, "description": "..."},
      {"number": 6, "startAge": 33, "endAge": 41, "description": "..."},
      {"number": 9, "startAge": 42, "endAge": 50, "description": "..."},
      {"number": 5, "startAge": 51, "endAge": null, "description": "..."}
    ],
    "challenges": [
      {"number": 2, "period": "first", "description": "..."},
      {"number": 1, "period": "second", "description": "..."},
      {"number": 3, "period": "third", "description": "..."}
    ]
  },
  "fromCache": true
}
```

**Error Response**:
```json
{
  "error": "Fetch failed",
  "message": "We couldn't load your numerology profile. Please try again in a moment."
}
```

---

### 2.2 New Endpoint (Library Book)

**Route**: `POST /api/numerology-library`
**Implementation**: [app/api/numerology-library/route.ts](app/api/numerology-library/route.ts)
**Storage**: `numerology_library` table (global dedupe)

**Request**:
```json
{
  "mode": "official"  // or "preview"
}

// Or for preview mode:
{
  "mode": "preview",
  "inputs": {
    "first_name": "Jane",
    "middle_name": "Marie",
    "last_name": "Doe",
    "birth_date": "1990-01-15"
  }
}
```

**Success Response** ([route.ts:56-62](app/api/numerology-library/route.ts#L56-L62)):
```json
{
  "mode": "official",
  "numerology_key": "sha256_hash_of_inputs",
  "inputs": {
    "first_name": "Jane",
    "middle_name": "Marie",
    "last_name": "Doe",
    "birth_date": "1990-01-15"
  },
  "profile": {
    // ❌ PLACEHOLDER ONLY - Real implementation needed
    "lifePathNumber": 6,
    "expressionNumber": 1,
    "soulUrgeNumber": 5,
    "personalityNumber": 2,
    "birthdayNumber": 15
    // ❌ MISSING: karmic object
  },
  "is_official": true
  // ❌ MISSING: "cycles" field (personalYear, pinnacles, challenges)
}
```

**Error Response** ([route.ts:42-53](app/api/numerology-library/route.ts#L42-L53)):
```json
{
  "errorCode": "INCOMPLETE_NUMEROLOGY_DATA",
  "message": "Missing required fields to compute numerology.",
  "required": ["full_name", "birth_date"],
  "missing": ["full_name"]
}
```

---

### 2.3 Numerology Contract Diff

| Field | Old Endpoint | New Endpoint | Status |
|-------|-------------|--------------|--------|
| `profile` | ✅ Complete (5 core + karmic) | ⚠️ Placeholder (5 core only, missing karmic) | 🚨 **P0 BUG** |
| `cycles` | ✅ Present (personalYear, pinnacles, challenges) | ❌ Missing | 🚨 **P0 BUG** |
| `fromCache` | ✅ Present | ❌ Missing | ✅ OK (internal detail) |
| `mode` | ❌ Not present | ✅ Present | ✅ OK (new field) |
| `numerology_key` | ❌ Not present | ✅ Present | ✅ OK (new field) |
| `inputs` | ❌ Not present | ✅ Present | ✅ OK (new field) |
| `is_official` | ❌ Not present | ✅ Present | ✅ OK (new field) |
| Error shape | `{error, message}` | `{errorCode, message, required, missing}` | ✅ OK (better) |

### 2.4 Required Changes for Parity

**File**: [app/api/numerology-library/route.ts](app/api/numerology-library/route.ts)

**Change 1: Implement full numerology calculations**

Replace placeholder implementation in [lib/library/numerology.ts:83-105](lib/library/numerology.ts#L83-L105):

```typescript
// BEFORE (placeholder)
async function computeNumerologyProfile(
  input: NumerologyInput
): Promise<NumerologyProfile> {
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

// AFTER (real implementation)
import { computePythagoreanNumerology } from "@/lib/numerology/pythagorean";

async function computeNumerologyProfile(
  input: NumerologyInput
): Promise<NumerologyProfile> {
  // Use existing numerology engine from lib/numerology/
  return computePythagoreanNumerology({
    first_name: input.first_name,
    middle_name: input.middle_name,
    last_name: input.last_name,
    birth_date: input.birth_date,
  });
}
```

**Change 2: Add cycles calculation to response**

```typescript
// In official mode response (after line 39):
import { computePersonalYearCycles } from "@/lib/numerology/cycles";

const profile = numerology.numerology_json;
const cycles = computePersonalYearCycles(
  numerology.input_json.birth_date,
  profile.lifePathNumber
);

return NextResponse.json({
  mode: "official",
  numerology_key: numerology.numerology_key,
  inputs: numerology.input_json,
  profile,
  cycles,  // ✅ Added cycles calculation
  is_official: true,
});
```

**Change 3: Update NumerologyProfile type**

Update type in [lib/library/numerology.ts:23-30](lib/library/numerology.ts#L23-L30):

```typescript
// BEFORE
export type NumerologyProfile = {
  lifePathNumber: number;
  expressionNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthdayNumber: number;
};

// AFTER
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
};
```

---

## 3. Frontend Expectations

### 3.1 Birth Chart Page

**File**: [app/(protected)/sanctuary/birth-chart/page.tsx:152](app/(protected)/sanctuary/birth-chart/page.tsx#L152)

**Current Usage** (temporary revert to old endpoint):
```typescript
const response = await fetch("/api/birth-chart", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});

const data = await response.json();
// Expects: { placements: {...}, insight: {...} }

setPlacements(data.placements);
setInsight(data.insight);
```

**Target Usage** (after parity achieved):
```typescript
const response = await fetch("/api/birth-chart-library", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "official" }),
});

const data = await response.json();
// Must receive: { placements: {...}, insight: {...}, mode, chart_key, ... }

setPlacements(data.placements);  // ✅ Must be named "placements" not "geometry"
setInsight(data.insight);  // ✅ Must include AI narrative
```

---

### 3.2 Numerology Page

**File**: [app/(protected)/sanctuary/numerology/page.tsx:30](app/(protected)/sanctuary/numerology/page.tsx#L30)

**Current Usage** (temporary revert to old endpoint):
```typescript
const response = await fetch("/api/numerology", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ system: "pythagorean" }),
});

const data = await response.json();
// Expects: { profile: {...}, cycles: {...} }

setProfile(data.profile);
setCycles(data.cycles);
```

**Target Usage** (after parity achieved):
```typescript
const response = await fetch("/api/numerology-library", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "official" }),
});

const data = await response.json();
// Must receive: { profile: {...}, cycles: {...}, mode, numerology_key, ... }

setProfile(data.profile);  // ✅ Must include full profile with karmic
setCycles(data.cycles);  // ✅ Must include personalYear, pinnacles, challenges
```

---

## 4. Testing Requirements

### 4.1 Birth Chart Library Parity Tests

**File**: `__tests__/api/birth-chart-library.test.ts` (create)

```typescript
describe("POST /api/birth-chart-library", () => {
  describe("Response shape parity", () => {
    it("should return placements field (not geometry)", async () => {
      const response = await fetch("/api/birth-chart-library", {
        method: "POST",
        body: JSON.stringify({ mode: "official" }),
      });
      const data = await response.json();

      expect(data).toHaveProperty("placements");
      expect(data).not.toHaveProperty("geometry");
    });

    it("should return insight field with AI narrative", async () => {
      const response = await fetch("/api/birth-chart-library", {
        method: "POST",
        body: JSON.stringify({ mode: "official" }),
      });
      const data = await response.json();

      expect(data).toHaveProperty("insight");
      expect(data.insight).toHaveProperty("meta");
      expect(data.insight).toHaveProperty("coreSummary");
      expect(data.insight).toHaveProperty("sections");
    });

    it("should match old endpoint response shape", async () => {
      const oldResponse = await fetch("/api/birth-chart", {
        method: "POST",
      });
      const newResponse = await fetch("/api/birth-chart-library", {
        method: "POST",
        body: JSON.stringify({ mode: "official" }),
      });

      const oldData = await oldResponse.json();
      const newData = await newResponse.json();

      // Check critical fields match
      expect(newData.placements).toMatchObject(oldData.placements);
      expect(newData.insight.meta.mode).toBe(oldData.insight.meta.mode);
    });
  });
});
```

### 4.2 Numerology Library Parity Tests

**File**: `__tests__/api/numerology-library.test.ts` (create)

```typescript
describe("POST /api/numerology-library", () => {
  describe("Response shape parity", () => {
    it("should return complete profile with karmic", async () => {
      const response = await fetch("/api/numerology-library", {
        method: "POST",
        body: JSON.stringify({ mode: "official" }),
      });
      const data = await response.json();

      expect(data.profile).toHaveProperty("lifePathNumber");
      expect(data.profile).toHaveProperty("karmic");
      expect(data.profile.karmic).toHaveProperty("karmicLessonNumbers");
      expect(data.profile.karmic).toHaveProperty("karmicDebtNumbers");
    });

    it("should return cycles field", async () => {
      const response = await fetch("/api/numerology-library", {
        method: "POST",
        body: JSON.stringify({ mode: "official" }),
      });
      const data = await response.json();

      expect(data).toHaveProperty("cycles");
      expect(data.cycles).toHaveProperty("personalYear");
      expect(data.cycles).toHaveProperty("pinnacles");
      expect(data.cycles).toHaveProperty("challenges");
    });

    it("should match old endpoint response shape", async () => {
      const oldResponse = await fetch("/api/numerology", {
        method: "POST",
        body: JSON.stringify({ system: "pythagorean" }),
      });
      const newResponse = await fetch("/api/numerology-library", {
        method: "POST",
        body: JSON.stringify({ mode: "official" }),
      });

      const oldData = await oldResponse.json();
      const newData = await newResponse.json();

      // Check critical fields match
      expect(newData.profile).toMatchObject(oldData.profile);
      expect(newData.cycles).toMatchObject(oldData.cycles);
    });
  });
});
```

---

## 5. Implementation Checklist

### Birth Chart Library

- [ ] Rename `geometry` field to `placements` in response
- [ ] Add AI narrative generation layer
- [ ] Decide on narrative storage strategy (separate table vs inline)
- [ ] Implement narrative caching
- [ ] Add narrative versioning (for regeneration on prompt changes)
- [ ] Write parity tests
- [ ] Verify old endpoint response shape matches exactly
- [ ] Run integration tests

### Numerology Library

- [ ] Replace placeholder numerology calculations with real implementation
- [ ] Add karmic calculations to profile
- [ ] Add cycles calculation (personalYear, pinnacles, challenges)
- [ ] Update NumerologyProfile type
- [ ] Write parity tests
- [ ] Verify old endpoint response shape matches exactly
- [ ] Run integration tests

### UI Migration (AFTER parity achieved)

- [ ] Update birth-chart page to use `/api/birth-chart-library`
- [ ] Update numerology page to use `/api/numerology-library`
- [ ] Test both Official and Preview modes
- [ ] Add error handling for new error shapes
- [ ] Deploy with monitoring

### Deprecation (30 days after UI migration)

- [ ] Add deprecation warnings to old endpoints
- [ ] Monitor old endpoint usage (should be 0%)
- [ ] Delete old endpoint files
- [ ] Delete Stone Tablets implementation files
- [ ] Drop Stone Tablets tables

---

## 6. Timeline

### Day 1 (Today)
- ✅ Document contract differences (this file)
- ⏳ Fix birth chart field name (`geometry` → `placements`)
- ⏳ Implement numerology calculations
- ⏳ Add cycles to numerology response

### Day 2
- Add AI narrative generation to birth chart library
- Write parity tests
- Verify exact response shape matching

### Day 3
- Final testing and verification
- UI migration preparation
- Documentation updates

### Day 4
- UI migration
- Deploy with monitoring
- Begin 30-day deprecation period

---

**END OF PARITY DOCUMENT**
