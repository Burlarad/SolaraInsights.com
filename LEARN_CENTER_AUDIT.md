# Learn Center Audit

**Date:** 2025-12-15
**Route:** `/learn` - `app/(public)/learn/page.tsx`
**Status:** Early-stage feature scaffold - UI-only, no functional backend

---

## 1. What Exists Today

### Files
| File | Purpose | Lines |
|------|---------|-------|
| [app/(public)/learn/page.tsx](app/(public)/learn/page.tsx) | Main Learn page | 97 |
| [components/learn/LearnHero.tsx](components/learn/LearnHero.tsx) | Hero section with tagline | 15 |
| [components/learn/SearchFilters.tsx](components/learn/SearchFilters.tsx) | Search bar + filter chips | 88 |
| [components/learn/LearnGuideCard.tsx](components/learn/LearnGuideCard.tsx) | Guide card (default + roadmap variants) | 90 |
| [components/learn/RoadmapRow.tsx](components/learn/RoadmapRow.tsx) | Horizontal scrolling roadmap section | 56 |

### Shared Dependencies
- `@/components/ui/card` - Card, CardContent
- `@/components/ui/input` - Input
- `@/components/shared/Chip` - Chip component
- `lucide-react` - Search, Clock, ArrowRight icons

### Current Features
- Hero section with headline and subtitle
- Search input (UI only - not functional)
- 13 filter chip tags (UI only - not functional)
- Horizontal scrolling roadmap with 4 cards
- Featured guides grid with 6 cards
- Evergreen guide section with 1 card

### What's Missing
- **No actual guide content** - cards don't link anywhere
- **No search functionality** - search input does nothing
- **No filter functionality** - filters toggle state but don't filter guides
- **No images** - `heroImage` paths reference non-existent `/images/guides/*.jpg`
- **No page-specific metadata** - uses root layout defaults
- **No loading states** - static content only

---

## 2. User Experience Audit

### Top 10 UX Improvements Needed

| # | Issue | Severity | Where | Why It Matters | Fix |
|---|-------|----------|-------|----------------|-----|
| 1 | **Cards are not clickable** - No navigation to guide content | P0 | [LearnGuideCard.tsx:51-88](components/learn/LearnGuideCard.tsx#L51-L88) | Users expect cards to be links; clicking does nothing | Wrap in `Link` or add `href` prop |
| 2 | **Search does nothing** - Input captures text but no search logic | P1 | [SearchFilters.tsx:51-57](components/learn/SearchFilters.tsx#L51-L57) | Creates false expectation; wastes user effort | Add search functionality or remove until ready |
| 3 | **Filters do nothing** - Chips toggle but guides don't filter | P1 | [SearchFilters.tsx:33-37](components/learn/SearchFilters.tsx#L33-L37) | Broken promise of interactivity | Wire up filtering or disable chips |
| 4 | **No "next step" CTA** - Page lacks clear call-to-action | P1 | Page-level | Users arrive and have no obvious action | Add CTA to join or explore first guide |
| 5 | **Misleading guide count** - Shows "11 guides" but only 7 displayed | P2 | [page.tsx:68](app/(public)/learn/page.tsx#L68) | Hardcoded count doesn't match visible content | Calculate from actual data |
| 6 | **Missing hero images** - All cards show placeholder emoji | P2 | [LearnGuideCard.tsx:64](components/learn/LearnGuideCard.tsx#L64) | Looks unfinished; low credibility | Add actual images or design intentional placeholders |
| 7 | **"Clear filters" always visible** - Even when no filters active | P2 | [SearchFilters.tsx:77-81](components/learn/SearchFilters.tsx#L77-L81) | Confusing affordance | Hide when `activeFilters.length === 0` |
| 8 | **No empty state** - If all filters applied, what shows? | P2 | Page-level | No feedback for zero results | Add empty state component |
| 9 | **"Open guide" is not a link** - Just a styled div with cursor | P2 | [LearnGuideCard.tsx:74-77](components/learn/LearnGuideCard.tsx#L74-L77) | Accessibility and expectation issue | Make it an actual link |
| 10 | **Roadmap order unclear** - Are guides sequential or standalone? | P2 | [RoadmapRow.tsx](components/learn/RoadmapRow.tsx) | Users don't know if order matters | Add numbering or "Start here" indicator |

---

## 3. Mobile Scaling Audit (iPhone 320w)

### Critical Mobile Issues

| # | Issue | Severity | Where | Impact | Fix |
|---|-------|----------|-------|--------|-----|
| 1 | **SearchFilters card padding too large** | P1 | [SearchFilters.tsx:45](components/learn/SearchFilters.tsx#L45) | `p-8` = 32px padding; cramped on 320w | Change to `p-4 md:p-8` |
| 2 | **Guide count text causes wrap** | P1 | [SearchFilters.tsx:59-61](components/learn/SearchFilters.tsx#L59-L61) | "11 guides in steady orbit" + search = overflow | Move below search on mobile or hide on small screens |
| 3 | **Hero text-5xl too large** | P1 | [LearnHero.tsx:4](components/learn/LearnHero.tsx#L4) | `text-5xl` = 48px; too large for 320w | Use `text-3xl md:text-5xl` |
| 4 | **Filter chips overflow without scroll indicator** | P2 | [SearchFilters.tsx:65-76](components/learn/SearchFilters.tsx#L65-L76) | 13 chips wrap and push content down significantly | Add horizontal scroll with fade hint |
| 5 | **Roadmap cards min-w-[280px]** | P2 | [LearnGuideCard.tsx:27](components/learn/LearnGuideCard.tsx#L27) | 280px is fine but leaves only 40px margin on 320w | Reduce to `min-w-[260px]` |
| 6 | **Page horizontal padding px-6** | P2 | [page.tsx:65](app/(public)/learn/page.tsx#L65) | 24px * 2 = 48px; reduces content width to 272px on 320w | Use `px-4 md:px-6` |
| 7 | **`scrollbar-thin` class undefined** | P2 | [RoadmapRow.tsx:40](components/learn/RoadmapRow.tsx#L40) | No tailwind-scrollbar plugin installed; class ignored | Install plugin or remove class |
| 8 | **Card content padding inconsistent** | P2 | [LearnGuideCard.tsx:68](components/learn/LearnGuideCard.tsx#L68) | `p-6` inside already-padded container | Audit padding hierarchy |

### Mobile Layout Recommendations

```tsx
// page.tsx - Responsive padding
<div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8 md:space-y-12">

// LearnHero.tsx - Responsive typography
<h1 className="text-3xl md:text-5xl font-bold mb-4">

// SearchFilters.tsx - Stack on mobile
<div className="flex flex-col md:flex-row md:items-center gap-4">
```

---

## 4. Information Architecture & Content Structure

### Current Taxonomy

```
Learn Center
├── Learning Roadmap (horizontal scroll)
│   ├── Soul Path Basics (Foundations)
│   ├── The Twelve Houses (Astrology)
│   ├── Elements & Temperament (Foundations)
│   └── Reading Tarot Intuitively (Tarot)
├── Featured Guides (grid)
│   ├── Understanding Your North Node (Astrology)
│   ├── The Art of Daily Draws (Tarot)
│   ├── Life Path Numbers Decoded (Numerology)
│   ├── Transits & Timing (Astrology)
│   ├── Shadow Work & The Moon (Rituals)
│   └── Synastry Simplified (Relationships)
└── Evergreen Guide
    └── Soul Path Basics (Foundations)
```

### Issues with Current Structure
1. **Duplicate content** - "Soul Path Basics" appears in both Roadmap and Evergreen
2. **No category navigation** - Users can't browse by topic
3. **Flat hierarchy** - No sub-categories or levels
4. **Filter tags don't match categories** - ASTROLOGY vs "Astrology" tag inconsistency

### Suggested Learn Taxonomy

```
Learn Center
├── Getting Started (beginner path)
│   ├── Soul Path Basics
│   ├── The Twelve Houses
│   └── Elements & Temperament
├── Astrology
│   ├── Foundations
│   │   ├── The Twelve Houses
│   │   └── Elements & Temperament
│   ├── Advanced
│   │   ├── Understanding Your North Node
│   │   ├── Transits & Timing
│   │   └── Synastry Simplified
├── Tarot
│   ├── Foundations
│   │   └── Reading Tarot Intuitively
│   ├── Daily Practice
│   │   └── The Art of Daily Draws
├── Numerology
│   └── Life Path Numbers Decoded
├── Rituals & Practices
│   └── Shadow Work & The Moon
└── Glossary (future)
```

### Navigation Structure Recommendation

1. **Category tabs** above search (Astrology | Tarot | Numerology | Rituals)
2. **Difficulty badges** on cards (Beginner | Intermediate | Advanced)
3. **Reading order indicator** for sequential content
4. **"Continue learning"** section for returning users

---

## 5. Accessibility Audit

### Critical A11y Issues

| # | Issue | Severity | Where | WCAG | Fix |
|---|-------|----------|-------|------|-----|
| 1 | **No main landmark** | P1 | [page.tsx:64-95](app/(public)/learn/page.tsx#L64-L95) | 1.3.1 | Wrap in `<main>` or add `role="main"` |
| 2 | **Interactive Chip without role** | P1 | [Chip.tsx:12-25](components/shared/Chip.tsx#L12-L25) | 4.1.2 | Chip is button but no `aria-pressed` for toggles |
| 3 | **Missing aria-label on search** | P1 | [SearchFilters.tsx:51-57](components/learn/SearchFilters.tsx#L51-L57) | 1.3.1 | Add `aria-label="Search guides"` |
| 4 | **Cards not keyboard navigable** | P1 | [LearnGuideCard.tsx](components/learn/LearnGuideCard.tsx) | 2.1.1 | Cards need to be focusable links |
| 5 | **Heading hierarchy skipped** | P2 | Page structure | 1.3.1 | h1 → h3 (skips h2); add h2 for sections |
| 6 | **Color contrast on muted text** | P2 | Multiple | 1.4.3 | `text-accent-ink/60` may fail 4.5:1 ratio |
| 7 | **No skip link** | P2 | Layout | 2.4.1 | Add "Skip to main content" link |
| 8 | **Icon-only elements without label** | P2 | Clock icons | 1.1.1 | Add `aria-hidden="true"` to decorative icons |

### Keyboard Navigation Gaps
- Filter chips: ✅ Focusable (buttons)
- Search input: ✅ Focusable
- Guide cards: ❌ Not focusable (divs, not links)
- "Open guide" CTA: ❌ Not focusable (div with cursor)
- Roadmap scroll: ❌ No keyboard scroll support

### Recommended Fixes

```tsx
// LearnGuideCard.tsx - Make card clickable link
import Link from "next/link";

export function LearnGuideCard({ slug, ...props }) {
  return (
    <Link href={`/learn/${slug}`}>
      <Card className="..." role="article" aria-labelledby={`guide-${slug}`}>
        <h3 id={`guide-${slug}`}>{title}</h3>
        ...
      </Card>
    </Link>
  );
}

// Chip.tsx - Add aria-pressed for filter state
<button
  onClick={onClick}
  aria-pressed={active}
  className={...}
>
```

---

## 6. Performance Audit

### Current Performance Profile
- **Static page** - No data fetching, fast initial load
- **Client components** - SearchFilters uses `"use client"` for state
- **No images loaded** - All images are missing (placeholder emoji shown)
- **No heavy dependencies** - Only lucide-react icons

### Performance Issues

| # | Issue | Severity | Where | Impact | Fix |
|---|-------|----------|-------|--------|-----|
| 1 | **Missing next/image usage** | P2 | [LearnGuideCard.tsx:54-65](components/learn/LearnGuideCard.tsx#L54-L65) | No image optimization when images exist | Use `<Image>` from next/image |
| 2 | **SearchFilters is client-only** | P2 | [SearchFilters.tsx:1](components/learn/SearchFilters.tsx#L1) | Entire component ships JS even if search is decorative | Consider server component with islands |
| 3 | **All guides in single bundle** | P3 | [page.tsx:6-61](app/(public)/learn/page.tsx#L6-L61) | Hardcoded data in component file | Move to separate data file or CMS |

### Layout Shift Risk
- Hero image placeholders: LOW (fixed height containers)
- Filter chips: LOW (fixed content)
- Card grid: LOW (CSS grid handles layout)

### Optimization Opportunities
1. **Preload first-view images** when real images added
2. **Code-split guide detail pages** (when implemented)
3. **Static generation** - Page is already static, good candidate for ISR

---

## 7. SEO Audit

### Current SEO State

| Element | Status | Value |
|---------|--------|-------|
| Page title | ❌ Missing | Falls back to root: "Solara Insights — Calm guidance from the light" |
| Meta description | ❌ Missing | Falls back to root description |
| Open Graph | ❌ Missing | No OG tags |
| Canonical URL | ❌ Missing | No canonical set |
| Structured data | ❌ Missing | No JSON-LD |
| H1 | ✅ Present | "Curate your own study orbit." |
| Internal links | ❌ None | Cards don't link to content |
| Alt text | ⚠️ N/A | No images implemented yet |

### Recommended Metadata

```tsx
// app/(public)/learn/page.tsx
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn | Solara Insights",
  description: "Explore guides on astrology, tarot, numerology, and rituals. Build your cosmic knowledge one page at a time.",
  openGraph: {
    title: "Learn Center | Solara Insights",
    description: "Explore guides on astrology, tarot, numerology, and rituals.",
    url: "https://solara.app/learn",
    siteName: "Solara Insights",
    type: "website",
  },
  alternates: {
    canonical: "https://solara.app/learn",
  },
};
```

### SEO Improvements Needed

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Missing page-specific title | P1 | Add metadata export |
| 2 | Missing meta description | P1 | Add metadata export |
| 3 | No internal links | P1 | Make cards link to guide pages |
| 4 | H1 is poetic, not descriptive | P2 | Consider "Learn Astrology, Tarot & More" |
| 5 | No structured data | P2 | Add `ItemList` schema for guides |
| 6 | Guide content not indexable | P1 | Create actual guide pages |

---

## 8. Code Cohesion + Dead/Unused Code

### Safe to Delete Now
None - all code is actively imported and used.

### Unused Props/Features

| Item | Where | Issue |
|------|-------|-------|
| `heroImage` prop always passed but images don't exist | [page.tsx:14,23,32,41,50,59,91](app/(public)/learn/page.tsx) | Dead paths |
| `searchQuery` state never used for filtering | [SearchFilters.tsx:30](components/learn/SearchFilters.tsx#L30) | UI-only state |
| `activeFilters` state never used for filtering | [SearchFilters.tsx:31](components/learn/SearchFilters.tsx#L31) | UI-only state |
| `clearFilters` function incomplete | [SearchFilters.tsx:39-42](components/learn/SearchFilters.tsx#L39-L42) | Clears state but no effect |

### Refactor Soon

| Item | Where | Why | Effort |
|------|-------|-----|--------|
| **Extract FEATURED_GUIDES to data file** | [page.tsx:6-61](app/(public)/learn/page.tsx#L6-L61) | 55 lines of data in component | S |
| **Extract ROADMAP_GUIDES to data file** | [RoadmapRow.tsx:3-32](components/learn/RoadmapRow.tsx#L3-L32) | Duplicate "Soul Path Basics" entry | S |
| **Extract FILTER_TAGS to constants** | [SearchFilters.tsx:9-23](components/learn/SearchFilters.tsx#L9-L23) | Should derive from guide data | S |
| **Create shared GuideData type** | Multiple files | No type safety on guide objects | M |
| **Consolidate card variants** | [LearnGuideCard.tsx:25-49](components/learn/LearnGuideCard.tsx#L25-L49) | Two completely different renders | M |

### Inconsistencies with Design System

| Item | Learn Center | Rest of App | Fix |
|------|--------------|-------------|-----|
| Spacing tokens | `space-y-12`, `gap-6` | Varies | Audit against design system |
| Card padding | `p-6`, `p-8` mixed | `p-6` standard | Standardize to `p-6` |
| Section labels | `micro-label` | Consistent | ✅ Good |
| Color opacity | `/60`, `/70` mixed | Varies | Document opacity scale |

---

## 9. Bugs & Risk Register

### Confirmed Bugs

| # | Bug | Severity | Where | Risk |
|---|-----|----------|-------|------|
| 1 | **Images 404** - All heroImage paths fail | P1 | [page.tsx](app/(public)/learn/page.tsx) | Broken experience |
| 2 | **scrollbar-thin class does nothing** | P2 | [RoadmapRow.tsx:40](components/learn/RoadmapRow.tsx#L40) | No scrollbar styling |
| 3 | **Guide count hardcoded** | P2 | [page.tsx:68](app/(public)/learn/page.tsx#L68) | Mismatch with actual content |

### Technical Debt

| # | Debt | Severity | Where | Payoff |
|---|------|----------|-------|--------|
| 1 | No guide content system | P1 | Architecture | Blocks all Learn functionality |
| 2 | No search implementation | P1 | [SearchFilters.tsx](components/learn/SearchFilters.tsx) | False promise to users |
| 3 | No routing to individual guides | P1 | [LearnGuideCard.tsx](components/learn/LearnGuideCard.tsx) | Dead-end experience |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Users leave due to non-functional UI | HIGH | HIGH | Add "Coming soon" indicator or hide non-functional features |
| SEO penalty for thin content | MEDIUM | MEDIUM | Add metadata, create real guide pages |
| Mobile users frustrated | MEDIUM | MEDIUM | Apply mobile fixes in this audit |

---

## 10. Future Development Backlog

| Feature | Description | Dependency | Complexity |
|---------|-------------|------------|------------|
| **Guide content pages** | Create `/learn/[slug]` pages with actual content | Content creation | L |
| **Search functionality** | Implement client-side or server-side search | Guide data structure | M |
| **Tag filtering** | Wire up filter chips to actually filter guides | Search infrastructure | S |
| **Progress tracking** | "Save your place" / "Mark as read" | User authentication | M |
| **Recommended next guide** | Suggest next guide based on reading history | Progress tracking | M |
| **Glossary** | Searchable astrology/tarot terms | Content creation | M |
| **Quiz/assessment** | "What should I learn first?" quiz | None | M |
| **Video content** | Embed video lessons | Video hosting | L |
| **Comments/discussion** | Community discussion on guides | User authentication | L |
| **Bookmark guides** | Save guides to personal list | User authentication | S |
| **Reading time calculator** | Calculate from actual content | Guide content | S |
| **Dark mode support** | Ensure Learn works in dark mode | Dark mode infrastructure | S |
| **Internationalization** | Translate guides | i18n infrastructure | L |

---

## 11. Prioritized Fix Plan

### P0 - Critical (Fix This Week)

| # | Issue | File | Smallest Safe Fix |
|---|-------|------|-------------------|
| 1 | Cards not clickable | [LearnGuideCard.tsx](components/learn/LearnGuideCard.tsx) | Add `slug` prop, wrap in `Link` pointing to `/learn/[slug]` |
| 2 | Missing page metadata | [page.tsx](app/(public)/learn/page.tsx) | Add `metadata` export with title/description |
| 3 | Non-functional search/filters misleading | [SearchFilters.tsx](components/learn/SearchFilters.tsx) | Add "Coming soon" badge or disable inputs |

### P1 - High (Fix This Sprint)

| # | Issue | File | Fix |
|---|-------|------|-----|
| 4 | Hero text too large on mobile | [LearnHero.tsx](components/learn/LearnHero.tsx) | `text-3xl md:text-5xl` |
| 5 | SearchFilters padding too large | [SearchFilters.tsx](components/learn/SearchFilters.tsx) | `p-4 md:p-8` |
| 6 | Guide count stacks with search on mobile | [SearchFilters.tsx](components/learn/SearchFilters.tsx) | Move below on mobile |
| 7 | Missing a11y on chips | [Chip.tsx](components/shared/Chip.tsx) | Add `aria-pressed` |
| 8 | Missing aria-label on search | [SearchFilters.tsx](components/learn/SearchFilters.tsx) | Add label |
| 9 | Heading hierarchy broken | [page.tsx](app/(public)/learn/page.tsx) | Add h2 for "Featured Guides" etc. |

### P2 - Medium (Fix Next Sprint)

| # | Issue | File | Fix |
|---|-------|------|-----|
| 10 | heroImage paths broken | [page.tsx](app/(public)/learn/page.tsx) | Create placeholder images or remove prop |
| 11 | scrollbar-thin does nothing | [RoadmapRow.tsx](components/learn/RoadmapRow.tsx) | Remove class or install tailwind-scrollbar |
| 12 | Extract guide data to separate file | [page.tsx](app/(public)/learn/page.tsx) | Create `lib/learn/guides.ts` |
| 13 | Clear filters always visible | [SearchFilters.tsx](components/learn/SearchFilters.tsx) | Conditionally render |
| 14 | Page padding too large on mobile | [page.tsx](app/(public)/learn/page.tsx) | `px-4 md:px-6` |
| 15 | Duplicate Soul Path Basics | [page.tsx](app/(public)/learn/page.tsx) / [RoadmapRow.tsx](components/learn/RoadmapRow.tsx) | Remove from one location |

### Longer-Term Refactors

| Item | Complexity | Payoff |
|------|------------|--------|
| Build actual guide content system (MDX or CMS) | L | Unlocks entire Learn feature |
| Implement search with Fuse.js or Algolia | M | Real search functionality |
| Add guide progress tracking | M | User engagement |
| Create Learn taxonomy navigation | M | Better content discovery |

---

## 12. Verification Checklist

### Device Testing
- [ ] iPhone SE (320w) - horizontal scroll, touch targets, readability
- [ ] iPhone 14 (390w) - layout, spacing, typography
- [ ] iPhone 14 Pro Max (428w) - layout consistency
- [ ] Android small (360w) - Chrome, ensure parity with iOS
- [ ] Android large (412w) - Chrome, tablet-like behavior
- [ ] Desktop (1280w+) - full grid layout

### Accessibility Testing
- [ ] Keyboard navigation through all interactive elements
- [ ] Screen reader announcement of card content
- [ ] Focus indicators visible on all focusable elements
- [ ] Color contrast passes 4.5:1 on text

### Functional Testing
- [ ] Search input accepts text (UI response)
- [ ] Filter chips toggle on/off visually
- [ ] Clear filters resets all chips
- [ ] Roadmap scrolls horizontally with edge fade visible
- [ ] Cards show hover state
- [ ] Page loads without JS errors

### Build/Lint
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] No TypeScript errors
- [ ] No console warnings about missing images

---

## Summary

The Learn Center is currently a **UI scaffold** - it looks functional but provides no actual learning content or navigation. The highest priority fixes are:

1. **Make cards clickable** (currently dead ends)
2. **Add page metadata** (SEO)
3. **Clarify non-functional features** (search/filters)
4. **Mobile typography/spacing fixes**
5. **Accessibility improvements**

Before investing in polish, consider whether to:
- **Ship the scaffold** with "Coming soon" indicators
- **Hide Learn from nav** until content exists
- **Build minimal guide content first** then polish UI

The codebase is clean and well-structured - the main gap is functionality, not code quality.
