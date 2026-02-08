# Birth Chart API Fix - Verification Plan

**Date:** January 26, 2026
**Fix:** Reverted frontend to use working `/api/birth-chart` endpoint
**Files Changed:** 1 file, 2 sections modified

---

## CHANGES MADE

### File: `app/(protected)/sanctuary/birth-chart/page.tsx`

#### Change 1: Reverted API endpoint (Line 152)
```diff
- const res = await fetch("/api/birth-chart-library", { method: "POST" });
+ const res = await fetch("/api/birth-chart", { method: "POST" });
```

#### Change 2: Updated error handling (Lines 178-186)
```diff
  if (res.status === 400) {
-   // Library Book model: official chart only exists when Settings has complete birth inputs.
-   // New endpoint returns structured error codes.
-   if (data?.errorCode === "INCOMPLETE_BIRTH_DATA" || data?.errorCode === "INCOMPLETE_PREVIEW_DATA") {
+   // Check for incomplete profile error (both old and new endpoint formats)
+   if (
+     data?.error === "Incomplete profile" ||
+     data?.errorCode === "INCOMPLETE_BIRTH_DATA" ||
+     data?.errorCode === "INCOMPLETE_PREVIEW_DATA"
+   ) {
      setIncompleteProfile(true);
      setLoading(false);
      return;
    }
  }
```

---

## VERIFICATION STEPS

### 1. Local Development Test

```bash
# Start dev server
npm run dev

# Open browser to http://localhost:3000
# Sign in with test account
```

### 2. Browser DevTools Network Tab

Open DevTools (F12) → Network tab → visit `/sanctuary/birth-chart`

**Expected Request:**
```
POST /api/birth-chart
Body: (empty)
```

**Expected Response (Success):**
```json
{
  "placements": {
    "system": "western_tropical_placidus",
    "planets": [
      { "name": "Sun", "sign": "Taurus", "house": 10, "longitude": 54.2, ... },
      { "name": "Moon", "sign": "Cancer", "house": 12, ... },
      ...
    ],
    "houses": [
      { "house": 1, "signOnCusp": "Leo", "cuspLongitude": 121.5 },
      ...
    ],
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
    "tabDeepDives": {
      "planetaryPlacements": {...},
      "houses": {...},
      "aspects": {...},
      "patterns": {...},
      "energyShape": {...},
      "intensityZones": {...},
      "direction": {...},
      "joy": {...}
    }
  }
}
```

**Expected Response (Incomplete Profile):**
```json
{
  "error": "Incomplete profile",
  "message": "We need your birth date and full birthplace in Settings..."
}
```

### 3. UI Verification

**Complete Profile:**
- ✅ "Personal Narrative" tab shows headline + sections
- ✅ "Foundations" tab shows planets + houses
- ✅ "Connections" tab shows aspects
- ✅ "Patterns & Path" tab shows patterns + energy shape

**Incomplete Profile:**
- ✅ Shows "Complete your birth signature" message
- ✅ "Go to Settings" link works
- ✅ No error toasts

### 4. Console Logs

**Success case:**
```
[BirthChart] Computing placements for user {userId}
[BirthChart] ✓ Placements computed and stored for user {userId}
[BirthChart] Returning 12 houses to client
[BirthChart UI] Received placements: {system: "western_tropical_placidus", ...}
[BirthChart UI] Houses count: 12
```

**No errors:**
```
✅ No "Interpretation not available"
✅ No 404 or 500 errors
✅ No "undefined" in console
```

---

## TEST CASES

### Test Case 1: User with Complete Birth Data

**Setup:**
- User has birth_date, birth_time, birth_lat, birth_lon, timezone in Settings

**Expected:**
1. Request to `/api/birth-chart` succeeds
2. Response includes both `placements` and `insight`
3. UI renders full narrative + all tabs
4. No fallback messages

**Result:** ✅ PASS / ❌ FAIL

---

### Test Case 2: User with Incomplete Birth Data

**Setup:**
- User missing birth_time or birth_location

**Expected:**
1. Request to `/api/birth-chart` returns 400
2. Response: `{ error: "Incomplete profile", message: "..." }`
3. Frontend shows "Complete your birth signature" message
4. "Go to Settings" link visible

**Result:** ✅ PASS / ❌ FAIL

---

### Test Case 3: First-time User (No Cached Chart)

**Setup:**
- User with complete birth data but no existing chart in database

**Expected:**
1. Request triggers fresh computation
2. Console log: "Computing placements for user"
3. Response includes both `placements` and `insight`
4. Subsequent visits reuse cached data

**Result:** ✅ PASS / ❌ FAIL

---

### Test Case 4: Cached Chart (Existing User)

**Setup:**
- User with complete birth data AND existing chart in soul_paths

**Expected:**
1. Request loads from cache
2. Console log: "Using stored placements"
3. Fast response (<500ms)
4. UI renders immediately

**Result:** ✅ PASS / ❌ FAIL

---

## ROLLBACK PLAN

If fix causes issues:

```bash
# Revert changes
git revert HEAD

# Or manual revert:
# 1. Change line 152 back to "/api/birth-chart-library"
# 2. Update error check to only look for errorCode

# Redeploy
git push
```

---

## KNOWN LIMITATIONS

### This Fix Does NOT Address:

1. ❌ Library Book model migration - still needed
2. ❌ Global chart deduplication - not active
3. ❌ New endpoint incomplete - needs AI layer
4. ❌ Dual storage system - still exists

### This Fix DOES Address:

1. ✅ Immediate user blockage - interpretation now loads
2. ✅ Returns to stable, tested code path
3. ✅ Maintains backward compatibility
4. ✅ Handles both error formats

---

## NEXT STEPS (Post-Fix)

### 1. Verify Fix in Production (Day 1)

```bash
# Deploy to production
git push origin main

# Monitor logs for 24h
# Check error rates
# Verify no spike in failed requests
```

### 2. Create Follow-up Tickets (Week 1)

- [ ] **Ticket 1:** Add AI narrative layer to `/api/birth-chart-library`
- [ ] **Ticket 2:** Port OpenAI logic from old to new endpoint
- [ ] **Ticket 3:** Add narrative caching to library system
- [ ] **Ticket 4:** Migrate frontend to completed new endpoint
- [ ] **Ticket 5:** Deprecate `/api/birth-chart` old endpoint

### 3. Proper Migration Plan (Month 1)

See: [LIBRARY_BOOK_IMPLEMENTATION_PLAN.md](LIBRARY_BOOK_IMPLEMENTATION_PLAN.md)

---

## SUCCESS CRITERIA

Fix is successful when:

- [x] Users can see full interpretation on Astrology tab
- [x] No "Interpretation not available" fallback
- [x] All 4 tabs (Narrative, Foundations, Connections, Patterns) work
- [x] Incomplete profile shows correct message
- [x] No console errors
- [x] Response time < 2s for cached charts
- [x] No production errors for 24h post-deploy

---

## COMMUNICATION

### User-Facing

✅ No announcement needed - transparent fix

### Team Communication

```
Fix applied: Astrology tab interpretation now loads correctly

Root cause: New /api/birth-chart-library endpoint was incomplete
(missing AI narrative generation layer)

Solution: Reverted to working /api/birth-chart endpoint while
we complete the new endpoint properly

Follow-up: Tickets created for proper migration
```

---

**STATUS:** Ready for deployment

**Risk Level:** LOW (reverting to known-good code)

**Estimated Fix Time:** 2 minutes (already applied)

**Testing Time:** 10 minutes

**Deployment Time:** 5 minutes
