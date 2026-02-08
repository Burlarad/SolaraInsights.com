# Birth Chart API Mismatch - Root Cause Analysis

**Date:** January 26, 2026
**Issue:** Astrology tab shows "Interpretation not available" after Library Book refactor
**Status:** ROOT CAUSE IDENTIFIED

---

## A) ROOT CAUSE

### The Mismatch

**Frontend expects:**
```typescript
// app/(protected)/sanctuary/birth-chart/page.tsx:110-115
type BirthChartResponse = {
  placements: any;  // SwissPlacements
  insight: FullBirthChartInsight | null;  // AI-generated narrative
  error?: string;
  message?: string;
};
```

**New endpoint `/api/birth-chart-library` returns:**
```typescript
// app/api/birth-chart-library/route.ts:87-93
{
  mode: "official",
  chart_key: "abc123...",
  inputs: {...},
  geometry: {...},    // This is the placements, but WRONG FIELD NAME
  is_official: true   // NO `insight` field!
}
```

**Old endpoint `/api/birth-chart` returns:**
```typescript
// app/api/birth-chart/route.ts:1031-1034
{
  placements: swissPlacements,  // Correct field name
  insight,                      // AI-generated narrative - PRESENT
}
```

### The Issue

When implementing the Library Book model, we created:
1. ✅ Global library storage for geometry (`charts` table)
2. ✅ Deterministic keying system
3. ❌ **MISSING: AI narrative generation layer**

The new endpoint only handles the **computational** layer (Swiss Ephemeris), not the **interpretive** layer (OpenAI).

---

## B) DATA FLOW ANALYSIS

### Current Broken Flow

```
User visits /sanctuary/birth-chart
  ↓
Frontend calls POST /api/birth-chart-library
  ↓
New endpoint returns { geometry: {...} }  ← NO `insight` field
  ↓
Frontend: setPlacements(data.placements)  ← undefined (wrong field name)
Frontend: setInsight(data.insight)        ← undefined (missing field)
  ↓
hasFullInsight = false
  ↓
Shows "Interpretation not available"
```

### Expected Flow

```
User visits /sanctuary/birth-chart
  ↓
Frontend calls POST /api/birth-chart
  ↓
Old endpoint:
  1. Computes/loads placements (SwissPlacements)
  2. Generates AI narrative (insight)
  ↓
Returns { placements: {...}, insight: {...} }
  ↓
Frontend renders narrative + foundations + connections
```

---

## C) MINIMAL FIX OPTIONS

### Option A: Revert Frontend (FASTEST - RECOMMENDED)

**Change:** Revert `app/(protected)/sanctuary/birth-chart/page.tsx` line 152

```diff
- const res = await fetch("/api/birth-chart-library", { method: "POST" });
+ const res = await fetch("/api/birth-chart", { method: "POST" });
```

**Impact:**
- ✅ Immediate fix - restores working state
- ✅ Old endpoint has full AI generation
- ✅ Zero risk - tested code path
- ⚠️ Doesn't use new library system

**Rollout:** 1 line change, test locally, deploy

---

### Option B: Complete the New Endpoint (CORRECT - REQUIRES WORK)

**Changes needed:**

1. **Add AI narrative generation to new endpoint**
   - Port OpenAI logic from old endpoint
   - Handle narrative caching
   - Match response shape to frontend expectations

2. **Files to modify:**
   - `app/api/birth-chart-library/route.ts` (+200 lines)
   - `lib/library/charts.ts` (add narrative storage)
   - Migration for narrative caching in library

3. **Estimated effort:** 4-6 hours + testing

**Why this is complex:**
- Old endpoint has 1046 lines of logic
- Includes rate limiting, caching, OpenAI calls, validation
- Needs careful extraction without breaking existing behavior

---

## D) RECOMMENDED FIX

**Implement Option A immediately**, then properly complete Option B as follow-up work.

### Immediate Fix (5 minutes)

```bash
# 1. Revert frontend to old endpoint
# Edit: app/(protected)/sanctuary/birth-chart/page.tsx
# Line 152: change /api/birth-chart-library → /api/birth-chart

# 2. Test locally
npm run dev
# Visit http://localhost:3000/sanctuary/birth-chart
# Verify interpretation appears

# 3. Deploy
git add app/(protected)/sanctuary/birth-chart/page.tsx
git commit -m "fix: revert to working birth-chart endpoint"
git push
```

### Follow-up Work (Next Sprint)

Create proper migration plan:
1. Extract AI generation logic into reusable module
2. Add narrative storage to library system
3. Implement complete new endpoint with AI
4. Migrate frontend to new endpoint
5. Deprecate old endpoint

---

## E) WHY THIS HAPPENED

### Implementation Gap

When implementing Library Book model, we focused on:
- ✅ Computational layer (Swiss Ephemeris)
- ✅ Global deduplication (charts table)
- ✅ Settings as source of truth
- ❌ **Forgot interpretive layer** (OpenAI narratives)

The new endpoints are **incomplete** - they're "geometry only" endpoints, not full-featured birth chart endpoints.

### Frontend Update Timing

Frontend was updated to call new endpoint before new endpoint was complete:
- Commit 1: Created new library endpoints (geometry only)
- Commit 2: Updated frontend to call new endpoints
- **Missing Commit:** Add AI narrative generation to new endpoints

---

## F) VERIFICATION PLAN

### After Applying Fix

```bash
# 1. Start dev server
npm run dev

# 2. Open browser DevTools Network tab

# 3. Visit http://localhost:3000/sanctuary/birth-chart

# 4. Verify request/response
Request: POST /api/birth-chart
Response: {
  placements: { system: "western_tropical_placidus", planets: [...], ... },
  insight: { coreSummary: {...}, sections: {...}, tabDeepDives: {...} }
}

# 5. Verify UI
✅ "Personal Narrative" tab shows interpretation
✅ "Foundations" tab shows planets + houses
✅ "Connections" tab shows aspects
✅ "Patterns & Path" tab shows chart patterns

# 6. Check console logs
✅ No errors
✅ "Returning X houses to client" message
✅ No "Interpretation not available" fallback
```

---

## G) TRIPWIRES TO PREVENT REGRESSION

### Test Coverage (TODO)

```typescript
// __tests__/api/birth-chart-library.test.ts
describe("Birth Chart Library API", () => {
  it("returns both placements AND insight for official chart", async () => {
    const response = await POST({ mode: "official" });
    expect(response.placements).toBeDefined();
    expect(response.insight).toBeDefined();  // CRITICAL
    expect(response.insight.coreSummary).toBeDefined();
  });

  it("matches frontend expected response shape", async () => {
    const response = await POST({ mode: "official" });
    // Must match BirthChartResponse type
    expect(response).toMatchObject({
      placements: expect.any(Object),
      insight: expect.any(Object),
    });
  });
});
```

### Type Safety

```typescript
// Enforce contract at compile time
type BirthChartApiResponse = {
  placements: SwissPlacements;
  insight: FullBirthChartInsight | null;
};

// In endpoint:
return NextResponse.json({
  placements,
  insight,
} satisfies BirthChartApiResponse);  // TypeScript error if mismatch
```

---

## H) LONG-TERM SOLUTION

### Proper Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Unified Birth Chart API (v2)                    │
│                                                         │
│  POST /api/birth-chart-complete                         │
│                                                         │
│  1. Load/Compute Geometry (Library)                     │
│  2. Generate/Load Narrative (AI Layer)                  │
│  3. Return Complete Response                            │
│                                                         │
│  Response:                                              │
│  {                                                      │
│    placements: SwissPlacements,                         │
│    insight: FullBirthChartInsight,                      │
│    chart_key: "abc123...",                              │
│    is_official: true                                    │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
```

---

## I) DECISION

**IMPLEMENT OPTION A NOW**

Rationale:
- Users are blocked (P0 issue)
- Fix is 1 line, zero risk
- Old endpoint is tested and working
- Proper migration can happen later with full testing

**Action Items:**
1. Revert frontend to `/api/birth-chart` ← DO THIS NOW
2. Test locally
3. Deploy
4. Create ticket: "Implement AI layer in birth-chart-library endpoint"

---

**CONCLUSION**

The new Library Book endpoints are **geometry-only** and missing the AI interpretation layer. Frontend was updated prematurely. Immediate fix: revert to old endpoint. Long-term: complete the new endpoint with full AI integration.

**Status:** Ready for immediate fix (5 minutes)
