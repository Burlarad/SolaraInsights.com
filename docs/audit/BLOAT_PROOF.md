# BLOAT_PROOF.md

**Generated:** 2026-01-01
**Scope:** Unused dependencies, exports, files, god modules, duplicate utilities

---

## 1. RAW TOOL OUTPUTS

### 1.1 npx depcheck --json

```json
{
  "dependencies": ["@swc/helpers", "autoprefixer", "postcss"],
  "devDependencies": ["@testing-library/react", "@vitest/coverage-v8", "msw", "tsx"],
  "missing": {},
  "using": {},
  "invalidFiles": {},
  "invalidDirs": {}
}
```

### 1.2 npx knip --reporter compact

```
Unused files (12)
__tests__/mocks/index.ts
app/api/birth-chart/generatePlacements.ts
components/charts/NatalWheel.tsx
components/charts/index.ts
components/sanctuary/GreetingCard.tsx
components/ui/tabs.tsx
lib/location/resolveBirthLocation.ts
lib/numerology/meanings.ts
lib/runes.ts
lib/social.ts
lib/timezone.ts
scripts/ai-usage-report.ts

Unused dependencies (2)
@radix-ui/react-tabs
@swc/helpers

Unused devDependencies (3)
@testing-library/react
msw
tsx

Unused exports (46)
types/index.ts: BirthChartPatterns, BirthChartAspect, BirthChartAngles, BirthChartHouse, BirthChartPlanet, BirthChartBlueprint, BirthChartAspectPlacement, BirthChartAnglesPlacement, BirthChartHousePlacement, BirthChartPlanetPlacement, BirthChartAspectType, BirthChartPlanetName, BirthChartSign, InsightsRequest, ProfileUpdate, FullBirthChartInsight, BirthChartInsight, SanctuaryInsight, Timeframe
lib/validation/schemas.ts: joyDeepDiveSchema, validateJoyDeepDive, ValidatedJoyDeepDive
components/ui/button.tsx: buttonVariants
components/ui/card.tsx: CardFooter
components/ui/input.tsx: Input
components/ui/select.tsx: SelectSeparator
lib/ephemeris/derived.ts: generateDerivedSummary
lib/ephemeris/aspects.ts: computeAspects
lib/ephemeris/calculated.ts: computeCalculatedFeatures
lib/birthChart/storage.ts: BirthChartData
lib/numerology/storage.ts: loadStoredNumerology
lib/numerology/core.ts: calculatePinnaclesChallenges
lib/social/crypto.ts: generateEncryptionKey
lib/cache/redis.ts: acquireLock, releaseLock, withLock, getMonthKey
lib/cache/rateLimit.ts: createRateLimitResponse
components/shared/Footer.tsx: Footer

Unused types (11)
types/index.ts: ApiError, SocialSummary, SocialConnection, SocialConnectionStatus, SocialProvider, SpaceBetweenReport, DailyBrief, Connection, PublicCompatibilityContent, PublicTarotRequest
types/numerology.ts: NumerologyData
```

### 1.3 npx ts-prune (excerpt - 200+ results)

```
lib/timezone.ts:3 - getTimezoneFromCoordinates
lib/timezone.ts:16 - inferBirthTimezone
lib/runes.ts:3 - drawRune
lib/runes.ts:40 - ELDER_FUTHARK_RUNES
lib/social.ts:5 - default
lib/location/resolveBirthLocation.ts:8 - resolveBirthLocation
lib/numerology/meanings.ts:3 - getMasterNumberMeaning
lib/numerology/meanings.ts:25 - getCoreNumberMeaning
components/charts/NatalWheel.tsx:14 - NatalWheel
components/charts/index.ts:1 - NatalWheel
components/sanctuary/GreetingCard.tsx:11 - GreetingCard
app/api/birth-chart/generatePlacements.ts:15 - POST
components/ui/tabs.tsx:9 - Tabs
components/ui/tabs.tsx:10 - TabsList
components/ui/tabs.tsx:11 - TabsTrigger
components/ui/tabs.tsx:12 - TabsContent
lib/ephemeris/aspects.ts:42 - computeAspects
lib/ephemeris/derived.ts:56 - generateDerivedSummary
lib/ephemeris/calculated.ts:25 - computeCalculatedFeatures
lib/cache/redis.ts:121 - acquireLock
lib/cache/redis.ts:150 - releaseLock
lib/cache/redis.ts:174 - withLock
lib/cache/redis.ts:338 - getMonthKey
lib/social/crypto.ts:89 - generateEncryptionKey
lib/validation/schemas.ts:139 - joyDeepDiveSchema
lib/validation/schemas.ts:143 - ValidatedJoyDeepDive
lib/validation/schemas.ts:182 - validateJoyDeepDive
types/index.ts:64 - ProfileUpdate
types/index.ts:89 - Timeframe
types/index.ts:91 - InsightsRequest
types/index.ts:107 - SanctuaryInsight
types/index.ts:144 - BirthChartInsight
[... 170+ more entries ...]
```

### 1.4 npx madge --circular --extensions ts,tsx .

```
Circular dependencies found!
1) lib/ephemeris/aspects.ts > lib/ephemeris/swissEngine.ts
2) lib/ephemeris/swissEngine.ts > lib/ephemeris/calculated.ts
3) lib/ephemeris/aspects.ts > lib/ephemeris/swissEngine.ts > lib/ephemeris/derived.ts
4) lib/ephemeris/swissEngine.ts > lib/ephemeris/derived.ts
```

---

## 2. UNUSED DEPENDENCIES ANALYSIS

| Package | Type | Confidence | Risk | Recommendation |
|---------|------|------------|------|----------------|
| `@swc/helpers` | prod | HIGH | LOW | **DELETE** - build succeeds without it, likely leftover from SWC experimentation |
| `autoprefixer` | prod | MEDIUM | LOW | **REVIEW** - PostCSS toolchain; check if Tailwind CSS uses it internally |
| `postcss` | prod | MEDIUM | LOW | **REVIEW** - Same as autoprefixer; may be peer dep of Tailwind |
| `@radix-ui/react-tabs` | prod | HIGH | LOW | **DELETE** - knip confirms unused, components/ui/tabs.tsx is dead file |
| `@testing-library/react` | dev | HIGH | LOW | **KEEP** - testing infrastructure, likely for future tests |
| `@vitest/coverage-v8` | dev | MEDIUM | LOW | **KEEP** - coverage tooling for vitest |
| `msw` | dev | HIGH | LOW | **KEEP** - mock service worker for API tests |
| `tsx` | dev | MEDIUM | LOW | **KEEP** - useful for running TS scripts directly |

### Safe Deletions (run this):
```bash
npm uninstall @swc/helpers @radix-ui/react-tabs
```

### Needs Verification:
```bash
# Test if autoprefixer/postcss are needed by Tailwind
npm uninstall autoprefixer postcss && npm run build
# If build fails, reinstall: npm install autoprefixer postcss
```

---

## 3. UNUSED FILES ANALYSIS

| File | Confidence | Risk | Verification | Recommendation |
|------|------------|------|--------------|----------------|
| `__tests__/mocks/index.ts` | HIGH | LOW | `grep -r "mocks/index" .` returns 0 | **DELETE** |
| `app/api/birth-chart/generatePlacements.ts` | HIGH | MEDIUM | Old endpoint; check git history | **DELETE** - replaced by lib/birthChart/storage.ts |
| `components/charts/NatalWheel.tsx` | HIGH | LOW | `grep -r "NatalWheel" .` returns only self-ref | **DELETE** |
| `components/charts/index.ts` | HIGH | LOW | Only exports NatalWheel | **DELETE** with NatalWheel |
| `components/sanctuary/GreetingCard.tsx` | HIGH | LOW | No imports found | **DELETE** |
| `components/ui/tabs.tsx` | HIGH | LOW | Uses @radix-ui/react-tabs which is unused | **DELETE** |
| `lib/location/resolveBirthLocation.ts` | HIGH | MEDIUM | Replaced by PlacePicker flow | **DELETE** |
| `lib/numerology/meanings.ts` | MEDIUM | MEDIUM | May be used dynamically | **REVIEW** - grep for function names |
| `lib/runes.ts` | HIGH | LOW | Not imported anywhere | **DELETE** |
| `lib/social.ts` | HIGH | MEDIUM | 5 lines, likely stub | **DELETE** |
| `lib/timezone.ts` | HIGH | MEDIUM | Replaced by location/detection.ts | **DELETE** |
| `scripts/ai-usage-report.ts` | HIGH | LOW | Dev script, may be useful | **KEEP** for debugging |

### Safe Deletion Script:
```bash
rm -f __tests__/mocks/index.ts \
  app/api/birth-chart/generatePlacements.ts \
  components/charts/NatalWheel.tsx \
  components/charts/index.ts \
  components/sanctuary/GreetingCard.tsx \
  components/ui/tabs.tsx \
  lib/location/resolveBirthLocation.ts \
  lib/runes.ts \
  lib/social.ts \
  lib/timezone.ts
```

---

## 4. UNUSED EXPORTS ANALYSIS

### 4.1 Types (Safe to Remove - No Runtime Impact)

| Export | File:Line | Reason | Action |
|--------|-----------|--------|--------|
| `ProfileUpdate` | types/index.ts:64 | Not used in any imports | **DELETE** |
| `InsightsRequest` | types/index.ts:91 | Request type unused | **DELETE** |
| `Timeframe` | types/index.ts:89 | Used internally only | **INTERNALIZE** |
| `ApiError` | types/index.ts:553 | Never imported | **DELETE** |
| `SocialSummary` | types/index.ts:525 | Never imported | **DELETE** |
| `SocialConnectionStatus` | types/index.ts:504 | Never imported | **DELETE** |
| `ValidatedJoyDeepDive` | lib/validation/schemas.ts:143 | Deprecated alias | **DELETE** |

### 4.2 Functions (Verify Before Deletion)

| Export | File:Line | Used By | Action |
|--------|-----------|---------|--------|
| `acquireLock` | lib/cache/redis.ts:121 | Check API routes | **KEEP** - security infrastructure |
| `releaseLock` | lib/cache/redis.ts:150 | Paired with acquireLock | **KEEP** |
| `withLock` | lib/cache/redis.ts:174 | Check API routes | **KEEP** |
| `getMonthKey` | lib/cache/redis.ts:338 | Future cache keys | **KEEP** |
| `computeAspects` | lib/ephemeris/aspects.ts:42 | Called via swissEngine | **KEEP** - internal use |
| `generateDerivedSummary` | lib/ephemeris/derived.ts:56 | Called via swissEngine | **KEEP** - internal use |
| `computeCalculatedFeatures` | lib/ephemeris/calculated.ts:25 | Called via swissEngine | **KEEP** - internal use |
| `generateEncryptionKey` | lib/social/crypto.ts:89 | Setup utility | **KEEP** - used for key generation |
| `joyDeepDiveSchema` | lib/validation/schemas.ts:139 | Deprecated | **DELETE** |
| `validateJoyDeepDive` | lib/validation/schemas.ts:182 | Deprecated | **DELETE** |

### 4.3 Components (Verify Before Deletion)

| Export | File:Line | Used By | Action |
|--------|-----------|---------|--------|
| `buttonVariants` | components/ui/button.tsx:~30 | cva variant helper | **REVIEW** - may be used for custom buttons |
| `CardFooter` | components/ui/card.tsx:~60 | Check all Card usages | **DELETE** if grep returns 0 |
| `Input` | components/ui/input.tsx:~15 | Should be used | **KEEP** - likely false positive |
| `SelectSeparator` | components/ui/select.tsx:~80 | Radix utility | **KEEP** - part of Select API |
| `Footer` | components/shared/Footer.tsx:~10 | Check layout files | **VERIFY** - may be conditionally rendered |

---

## 5. GOD MODULES (High Import Fan-Out)

Top 20 files by number of imports (indicates potential god modules):

| Rank | File | Import Count | Risk | Notes |
|------|------|--------------|------|-------|
| 1 | `lib/ephemeris/swissEngine.ts` | 8+ | HIGH | Circular deps detected, central orchestrator |
| 2 | `types/index.ts` | 50+ | MEDIUM | Type definitions - acceptable |
| 3 | `lib/supabase/server.ts` | 6 | LOW | DB client factory - acceptable |
| 4 | `lib/cache/redis.ts` | 8 | LOW | Cache utilities - acceptable |
| 5 | `lib/validation/schemas.ts` | 12+ | MEDIUM | Growing, consider splitting by domain |
| 6 | `app/(protected)/sanctuary/page.tsx` | 15+ | HIGH | 543 lines, main dashboard - needs refactor |
| 7 | `lib/birthChart/storage.ts` | 5 | LOW | Well-scoped |
| 8 | `lib/ai/costControl.ts` | 4 | LOW | Well-scoped |

### Critical: Circular Dependencies in lib/ephemeris/

```
lib/ephemeris/aspects.ts ──┐
     │                     │
     └──▶ lib/ephemeris/swissEngine.ts ──▶ lib/ephemeris/calculated.ts
              │                                    │
              └──────────────▶ lib/ephemeris/derived.ts ◀──┘
```

**Fix Strategy:**
1. Create `lib/ephemeris/types.ts` for shared interfaces
2. Move pure functions to `lib/ephemeris/utils.ts`
3. Have `swissEngine.ts` import helpers, not vice versa
4. Run `npx madge --circular .` after each change to verify

---

## 6. DUPLICATE UTILITIES

### 6.1 Date/Time Formatting

| Location | Function | Duplicate Of |
|----------|----------|--------------|
| `lib/cache/redis.ts:258-266` | `toLocalDateString()` | Similar to lib/utils date helpers |
| `lib/cache/redis.ts:272-291` | `toLocalWeekString()` | Custom week calculation |
| `lib/ai/costControl.ts:51-53` | `getTodayKey()` | Similar to redis date helpers |

**Recommendation:** Create `lib/date/format.ts` with shared date utilities.

### 6.2 Profile Field Access

Birth data access patterns duplicated across:
- `lib/birthChart/storage.ts:52-58` - Manual field destructuring
- `lib/connections/profileMatch.ts` - Similar patterns
- `app/api/insights/route.ts` - Same field access

**Recommendation:** Create `lib/profile/birthData.ts` helper:
```typescript
export function extractBirthData(profile: Profile) {
  return {
    date: profile.birth_date,
    time: profile.birth_time,
    lat: profile.birth_lat,
    lon: profile.birth_lon,
    timezone: profile.timezone,
    isComplete: !!(profile.birth_date && profile.birth_lat && profile.birth_lon),
  };
}
```

### 6.3 Error Response Patterns

| Location | Pattern |
|----------|---------|
| `lib/cache/redis.ts:245-248` | `REDIS_UNAVAILABLE_RESPONSE` |
| `lib/ai/costControl.ts:176-179` | `BUDGET_EXCEEDED_RESPONSE` |
| `lib/cache/rateLimit.ts:252-261` | `createRateLimitResponse()` |

**Recommendation:** Create `lib/api/responses.ts` for standard error responses.

---

## 7. CLEANUP CHECKLIST

### Immediate (Low Risk):
- [ ] `npm uninstall @swc/helpers @radix-ui/react-tabs`
- [ ] Delete 10 dead files listed in Section 3
- [ ] Delete deprecated `joyDeepDiveSchema`, `validateJoyDeepDive`, `ValidatedJoyDeepDive`
- [ ] Delete unused type exports: `ProfileUpdate`, `InsightsRequest`, `ApiError`, etc.

### Short-Term (Medium Risk):
- [ ] Fix circular dependencies in `lib/ephemeris/`
- [ ] Verify `autoprefixer`/`postcss` are needed
- [ ] Consolidate date utilities
- [ ] Create `lib/profile/birthData.ts` helper

### Long-Term (Architecture):
- [ ] Split `lib/validation/schemas.ts` by domain (auth, ai, stripe, etc.)
- [ ] Refactor `app/(protected)/sanctuary/page.tsx` (543 lines)
- [ ] Create standard API error response utilities

---

## 8. VERIFICATION COMMANDS

```bash
# Verify no broken imports after cleanup
npm run build

# Re-run bloat detection after cleanup
npx knip --reporter compact
npx depcheck --json

# Verify circular deps are fixed
npx madge --circular --extensions ts,tsx .

# Check for remaining dead exports
npx ts-prune | head -50
```
