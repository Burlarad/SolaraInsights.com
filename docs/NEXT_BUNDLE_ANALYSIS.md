# NEXT_BUNDLE_ANALYSIS.md

**Generated:** 2026-01-01
**Scope:** Next.js bundle size analysis with optimization recommendations

---

## BUILD SUMMARY

```
Next.js 15.5.9 (App Router)
Build Status: ✅ SUCCESS
Total Routes: 79 (47 dynamic, 32 static)
Build Time: ~15 seconds
```

---

## BUNDLE SIZE BREAKDOWN

### First Load JS Shared by All Routes

| Chunk | Size | Notes |
|-------|------|-------|
| `chunks/1255-*.js` | **45.8 kB** | Main shared chunk |
| `chunks/4bd1b696-*.js` | **54.2 kB** | Framework + React |
| Other shared chunks | 1.93 kB | Small utilities |
| **Total Shared** | **102 kB** | Baseline for all routes |

### Page Routes (Sorted by First Load JS)

#### LARGE ROUTES (>180 kB First Load) - Optimization Priority

| Route | Page Size | First Load JS | Risk Level |
|-------|-----------|---------------|------------|
| `/sanctuary` | 12.8 kB | **215 kB** | HIGH |
| `/sanctuary/connections` | 9.6 kB | **207 kB** | HIGH |
| `/settings` | 12.9 kB | **202 kB** | HIGH |
| `/sign-in` | 4.96 kB | **201 kB** | HIGH |
| `/reset-password` | 5.35 kB | **186 kB** | MEDIUM |
| `/sign-up` | 4.53 kB | **185 kB** | MEDIUM |
| `/onboarding` | 7.52 kB | **185 kB** | MEDIUM |
| `/welcome` | 5.84 kB | **184 kB** | MEDIUM |
| `/set-password` | 4.08 kB | **181 kB** | MEDIUM |

#### MEDIUM ROUTES (130-180 kB First Load)

| Route | Page Size | First Load JS |
|-------|-----------|---------------|
| `/join` | 5.08 kB | 171 kB |
| `/sanctuary/birth-chart` | 8.53 kB | 141 kB |
| `/` (home) | 14.7 kB | 139 kB |
| `/sanctuary/numerology` | 5.98 kB | 134 kB |
| `/learn` | 5.15 kB | 133 kB |
| `/forgot-password` | 3.6 kB | 131 kB |
| `/learn/[slug]` | 2.03 kB | 130 kB |

#### SMALL ROUTES (<130 kB First Load) - Well Optimized

| Route | Page Size | First Load JS |
|-------|-----------|---------------|
| `/deletion-status` | 1.79 kB | 126 kB |
| `/data-deletion` | 702 B | 114 kB |
| `/about` | 695 B | 111 kB |
| `/privacy` | 695 B | 111 kB |
| `/terms` | 695 B | 111 kB |
| `/auth/post-callback` | 2.05 kB | 104 kB |
| `/_not-found` | 997 B | 103 kB |
| All API routes | 250 B | 102 kB |

---

## TOP OFFENDERS ANALYSIS

### 1. `/sanctuary` - 215 kB First Load

**Evidence:** Build output shows 12.8 kB page size + 102 kB shared = 114.8 kB, meaning ~100 kB of page-specific chunks.

**Likely Causes:**
- Heavy date manipulation (date-fns or similar)
- Chart visualization libraries
- Animation libraries (Framer Motion)
- Rich text formatting for insights
- Complex state management

**File Location:** `app/(protected)/sanctuary/page.tsx`

### 2. `/sanctuary/connections` - 207 kB First Load

**Evidence:** 9.6 kB page size, large First Load indicates shared dependencies with `/sanctuary`.

**Likely Causes:**
- Connection list rendering with virtualization
- Modal dialogs for connection details
- Form components for adding connections
- Space Between preview components

**File Location:** `app/(protected)/sanctuary/connections/page.tsx`

### 3. `/settings` - 202 kB First Load

**Evidence:** 12.9 kB page size (largest non-sanctuary page).

**Likely Causes:**
- Multiple settings sections (account, privacy, social, notifications)
- OAuth connection UI components
- Billing/subscription management UI
- Toggle switches and form inputs

**File Location:** `app/(protected)/settings/page.tsx`

### 4. Auth Pages (sign-in, sign-up, etc.) - 180-200 kB

**Evidence:** All auth pages show similar First Load sizes.

**Likely Causes:**
- OAuth provider buttons (Google, Facebook, TikTok, X)
- Form validation libraries
- Password strength indicators
- Animation on auth forms

---

## OPTIMIZATION RECOMMENDATIONS

### Priority 1: Dynamic Import Heavy Components (BLOCKER)

**Current State:** Large components loaded synchronously on page load.

**Recommendation:** Use `next/dynamic` with `{ ssr: false }` for:

```typescript
// app/(protected)/sanctuary/page.tsx
import dynamic from 'next/dynamic';

// Before
import { InsightCard } from '@/components/sanctuary/InsightCard';
import { JournalEditor } from '@/components/sanctuary/JournalEditor';

// After
const InsightCard = dynamic(
  () => import('@/components/sanctuary/InsightCard'),
  { loading: () => <InsightCardSkeleton /> }
);

const JournalEditor = dynamic(
  () => import('@/components/sanctuary/JournalEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
);
```

**Estimated Impact:** -40-60 kB on /sanctuary routes

**Test to Add:**
```typescript
it('loads InsightCard lazily', async () => {
  const { container } = render(<SanctuaryPage />);
  expect(container.querySelector('.insight-skeleton')).toBeInTheDocument();
  await waitFor(() => {
    expect(container.querySelector('.insight-card')).toBeInTheDocument();
  });
});
```

### Priority 2: Code Split Date Libraries (HIGH)

**Current State:** date-fns or similar loaded on all pages.

**Recommendation:** Use tree-shaking imports:

```typescript
// Before
import { format, parseISO, differenceInDays } from 'date-fns';

// After - only import what you need
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
```

**Estimated Impact:** -15-25 kB

### Priority 3: Lazy Load OAuth Providers (HIGH)

**File:** `app/(auth)/sign-in/page.tsx:45-90`

**Recommendation:**
```typescript
const OAuthButtons = dynamic(
  () => import('@/components/auth/OAuthButtons'),
  { loading: () => <OAuthButtonsSkeleton /> }
);
```

**Estimated Impact:** -10-15 kB on auth pages

### Priority 4: Split Settings Sections (MEDIUM)

**File:** `app/(protected)/settings/page.tsx`

**Recommendation:** Tab-based lazy loading:
```typescript
const AccountSettings = dynamic(() => import('./AccountSettings'));
const PrivacySettings = dynamic(() => import('./PrivacySettings'));
const SocialSettings = dynamic(() => import('./SocialSettings'));
const BillingSettings = dynamic(() => import('./BillingSettings'));

// Only load the active tab
{activeTab === 'account' && <AccountSettings />}
{activeTab === 'privacy' && <PrivacySettings />}
```

**Estimated Impact:** -30-40 kB on /settings

### Priority 5: Analyze Chart Libraries (MEDIUM)

**Investigation Needed:**
```bash
# Run to find chart dependencies
npx source-map-explorer '.next/static/chunks/*.js' --json > bundle-analysis.json
```

If using a charting library (Chart.js, Recharts, etc.), consider:
1. Lazy loading chart components
2. Using a lighter alternative (e.g., Sparkline for small charts)
3. Server-side rendering static charts as images

---

## ROUTE TYPE DISTRIBUTION

```
Static Routes (○):     32 routes (41%)
  - Pre-rendered at build time
  - Zero server cost at runtime
  - Examples: /, /about, /learn, /sign-in

SSG Routes (●):         1 route (1%)
  - Pre-rendered with generateStaticParams
  - /learn/[slug] - 10 articles

Dynamic Routes (ƒ):    46 routes (58%)
  - Server-rendered on demand
  - Includes all API routes and protected pages
  - Examples: /sanctuary, /settings, /api/*
```

---

## PERFORMANCE BUDGET RECOMMENDATIONS

| Metric | Current | Target | Action |
|--------|---------|--------|--------|
| Shared JS | 102 kB | <100 kB | Tree-shake unused React features |
| Largest Page (First Load) | 215 kB | <180 kB | Dynamic imports on /sanctuary |
| Auth Pages | 185-201 kB | <150 kB | Lazy OAuth buttons |
| Settings Page | 202 kB | <160 kB | Tab-based code splitting |
| API Routes | 250 B | 250 B | ✅ Already minimal |

---

## NEXT STEPS

### Immediate Actions (Sprint 1)

1. **Add dynamic imports to /sanctuary**
   - File: `app/(protected)/sanctuary/page.tsx`
   - Target: Reduce First Load by 40 kB

2. **Split settings tabs**
   - File: `app/(protected)/settings/page.tsx`
   - Target: Reduce First Load by 30 kB

3. **Lazy load OAuth buttons**
   - File: `components/auth/OAuthButtons.tsx`
   - Target: Reduce auth pages by 15 kB

### Future Actions (Sprint 2)

1. Run `@next/bundle-analyzer` for visual analysis
2. Identify and eliminate unused dependencies
3. Consider route groups for better chunk splitting
4. Implement Suspense boundaries for streaming

---

## MONITORING

Add performance tracking:

```typescript
// next.config.js
module.exports = {
  experimental: {
    webpackBuildWorker: true,
  },
  // Log bundle size on each build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
          analyzerMode: 'disabled',
          generateStatsFile: true,
          statsFilename: 'bundle-stats.json',
        })
      );
    }
    return config;
  },
};
```

---

## LINT WARNINGS FROM BUILD

The build produced 6 ESLint warnings that should be addressed:

| File | Line | Warning | Fix |
|------|------|---------|-----|
| `app/(auth)/onboarding/page.tsx` | 113 | Missing `saveProfile` dependency in useEffect | Add to dependency array or memoize |
| `app/(protected)/sanctuary/birth-chart/page.tsx` | 231 | Missing `fetchBirthChart` dependency | Add to dependency array or memoize |
| `app/(protected)/sanctuary/connections/page.tsx` | 158 | Missing `generateBriefForConnection` dependency | Add to dependency array or memoize |
| `app/(protected)/sanctuary/page.tsx` | 247 | Missing `loadJournalEntry` dependency | Add to dependency array or memoize |
| `app/(protected)/sanctuary/page.tsx` | 315 | Missing `loadInsight` dependency | Add to dependency array or memoize |
| `app/(protected)/sanctuary/page.tsx` | 543 | Using `<img>` instead of `next/image` | Replace with `<Image />` component |

These should be fixed to prevent unnecessary re-renders and improve performance.
