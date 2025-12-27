# Mobile View & Scaling Audit

**Date:** 2025-12-15
**Priority:** iPhone Safari > iPhone Chrome > Android Chrome
**Test Viewports:** 320w–428w (iPhone), 360w–412w (Android), 768w (Tablet)

---

## Executive Summary

The Solara app uses Tailwind CSS with a mobile-first approach, but several critical mobile issues exist. The most significant is the **lack of a mobile navigation menu** - the NavBar shows all links horizontally, causing overflow on narrow screens. Additional issues include touch target sizes, typography scaling, and some layout problems in specific components.

---

## Critical Bugs (P0)

### 1. NavBar Has No Mobile Hamburger Menu
**File:** [components/layout/NavBar.tsx](components/layout/NavBar.tsx)
**Severity:** CRITICAL
**Issue:** All navigation links are displayed horizontally with `flex items-center gap-3`. On mobile (320-428w), this causes horizontal overflow. When authenticated, the navbar shows 7 items: HOME, ABOUT, LEARN, SANCTUARY, SETTINGS, SIGN OUT, and language picker.

**Current Code (line 123):**
```tsx
<div className="flex items-center gap-3">
  {visibleNavLinks.map((link) => (...))}
</div>
```

**Impact:**
- Horizontal scroll on all mobile viewports
- Navigation items may be cut off or inaccessible
- Language dropdown may extend beyond screen

**Fix:** Add mobile hamburger menu with slide-out drawer or bottom sheet pattern.

---

### 2. GreetingCard Flex Layout Breaks on Mobile
**File:** [components/sanctuary/GreetingCard.tsx](components/sanctuary/GreetingCard.tsx)
**Severity:** HIGH
**Issue:** Uses `flex items-center justify-between` without responsive stacking. On narrow screens, the greeting text and "Exact birth time saved" badge compete for horizontal space.

**Current Code (line 19):**
```tsx
<CardContent className="p-8 flex items-center justify-between">
```

**Impact:**
- Text may wrap awkwardly
- Badge may overlap or squeeze greeting
- Poor visual hierarchy on mobile

**Fix:** Add `flex-col md:flex-row` and adjust spacing.

---

### 3. Sanctuary Insights - Emotional Cadence Layout
**File:** [app/(protected)/sanctuary/page.tsx](app/(protected)/sanctuary/page.tsx)
**Severity:** HIGH
**Issue:** The Dawn/Midday/Dusk section uses `flex items-center gap-4` with dividers. On narrow screens (320w), this becomes cramped and the vertical dividers may cause layout issues.

**Lines 250-265:**
```tsx
<div className="flex items-center gap-4 py-4">
  <div className="flex-1 text-center">...</div>
  <div className="h-12 w-px bg-border-subtle" />
  ...
</div>
```

**Impact:**
- Text truncation in narrow viewports
- Dividers take up valuable horizontal space

**Fix:** Stack vertically on mobile with `flex-col md:flex-row` and hide/adjust dividers.

---

## High Priority Bugs (P1)

### 4. Lucky Compass Numbers - Small Touch Targets
**File:** [app/(protected)/sanctuary/page.tsx](app/(protected)/sanctuary/page.tsx)
**Severity:** MEDIUM-HIGH
**Issue:** Number pills use `flex-1` without minimum width. On narrow screens, they may become too small for comfortable touch.

**Line 377-385:**
```tsx
<div className="flex gap-3">
  {insight.luckyCompass.numbers.map((num, i) => (
    <div key={i} className="flex-1 pill bg-accent-muted text-center py-3">
```

**Impact:** Touch targets below 44px minimum
**Fix:** Add `min-w-[60px]` or use grid with fixed columns.

---

### 5. SanctuaryTabs - Horizontal Overflow Potential
**File:** [components/sanctuary/SanctuaryTabs.tsx](components/sanctuary/SanctuaryTabs.tsx)
**Severity:** MEDIUM-HIGH
**Issue:** Uses `inline-flex gap-2` with 4 tabs. On 320w screens, "Connections" and "Library" may cause overflow.

**Line 18:**
```tsx
<div className="inline-flex gap-2 p-1 bg-white/50 rounded-full">
```

**Impact:** Horizontal scroll or overflow on narrow screens
**Fix:** Either use `flex-wrap` or provide a mobile dropdown like Soul Path section tabs do.

---

### 6. Settings Page - Dense Mobile Forms
**File:** [app/(protected)/settings/page.tsx](app/(protected)/settings/page.tsx)
**Severity:** MEDIUM-HIGH
**Issue:** Multiple sections with `grid md:grid-cols-2 gap-4` that stack on mobile, but:
- `p-8` padding on cards is excessive for mobile
- Social connection cards have horizontal layout that may be cramped

**Impact:** Excessive whitespace consumption, touch targets may be compromised
**Fix:** Reduce padding on mobile `p-4 md:p-8`, review social card layouts.

---

### 7. Input Height - iOS Safari Zoom Issue
**File:** [components/ui/input.tsx](components/ui/input.tsx)
**Severity:** MEDIUM
**Issue:** Input uses `text-sm` (14px). iOS Safari zooms in on input focus when font-size is below 16px.

**Line 14:**
```tsx
"flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm..."
```

**Impact:** Automatic zoom on iOS Safari when tapping inputs
**Fix:** Change to `text-base` (16px) to prevent zoom on iOS.

---

## Medium Priority Bugs (P2)

### 8. Homepage TogglePills - Potential Wrap Issues
**File:** [components/shared/TogglePills.tsx](components/shared/TogglePills.tsx)
**Severity:** MEDIUM
**Issue:** Uses `inline-flex gap-2` without `flex-wrap`. If many options or long labels exist, overflow may occur.

**Impact:** Minor - current options (Today/Week/Month) likely fit
**Fix:** Add `flex-wrap` for safety.

---

### 9. ZodiacGrid Modal - Close Button Size
**File:** [components/home/ZodiacGrid.tsx](components/home/ZodiacGrid.tsx)
**Severity:** MEDIUM
**Issue:** Close button is just `×` character with no explicit sizing.

**Line 117-123:**
```tsx
<button
  onClick={closeModal}
  className="text-accent-ink/60 hover:text-accent-ink text-2xl leading-none"
  aria-label="Close"
>
  ×
</button>
```

**Impact:** Touch target may be too small (< 44px)
**Fix:** Add explicit width/height `w-11 h-11` or use a proper icon with padding.

---

### 10. Learn Page RoadmapRow - Horizontal Scroll UX
**File:** [components/learn/RoadmapRow.tsx](components/learn/RoadmapRow.tsx)
**Severity:** LOW-MEDIUM
**Issue:** Uses `overflow-x-auto` but lacks scroll indicators or snap points.

**Line 38:**
```tsx
<div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
```

**Impact:** Users may not realize content scrolls horizontally
**Fix:** Add `snap-x snap-mandatory` and consider scroll indicators.

---

### 11. Soul Path Section Pills - Wide for Mobile
**File:** [app/(protected)/sanctuary/birth-chart/page.tsx](app/(protected)/sanctuary/birth-chart/page.tsx)
**Severity:** MEDIUM
**Issue:** Mobile uses a `<select>` dropdown which is good, but the desktop pills at line 252-268 use `overflow-x-auto` without visible scroll indicators.

**Impact:** Hidden horizontal scroll on tablet/small desktop
**Fix:** Add scroll indicators or visible overflow cue.

---

## Low Priority Bugs (P3)

### 12. Typography - No Responsive Sizing
**Severity:** LOW
**Issue:** Headings don't scale between mobile and desktop. Most use fixed sizes like `text-2xl`, `text-3xl`, `text-4xl` without responsive variants.

**Examples:**
- Settings page: `text-4xl font-bold` for h1
- Soul Path: `text-2xl md:text-3xl` only in one place

**Impact:** Typography may feel slightly large on mobile or small on desktop
**Fix:** Add responsive typography scale `text-2xl md:text-3xl lg:text-4xl`.

---

### 13. Footer - Bottom Spacing on Mobile
**File:** [components/layout/Footer.tsx](components/layout/Footer.tsx)
**Severity:** LOW
**Issue:** Footer uses `mt-24` which is excessive on mobile screens.

**Fix:** Change to `mt-12 md:mt-24`.

---

### 14. Card Padding Inconsistency
**Severity:** LOW
**Issue:** Different cards use different padding patterns:
- `CardContent` uses `p-6`
- `SolaraCard` uses `p-5 sm:p-6`
- Settings card uses `p-8`

**Impact:** Inconsistent feel across components
**Fix:** Standardize on a mobile-first padding system.

---

## Root Cause Patterns

### Pattern 1: Missing Mobile-First Navigation
The entire app lacks a mobile navigation pattern. This is the single biggest issue.

### Pattern 2: Horizontal Flex Without Responsive Stacking
Multiple components use `flex items-center justify-between` or `inline-flex gap-X` without considering narrow viewports.

**Affected Components:**
- NavBar
- GreetingCard
- SanctuaryTabs
- TogglePills
- Emotional Cadence section

### Pattern 3: iOS Safari Input Zoom
Using `text-sm` (14px) on inputs triggers automatic zoom on iOS Safari.

### Pattern 4: Touch Target Sizes
Several interactive elements don't meet the 44px minimum touch target guideline:
- Modal close buttons
- Small pills/badges
- Language dropdown items

### Pattern 5: No Responsive Typography Scale
Typography is mostly static - headings don't scale between breakpoints.

---

## Mobile Scaling System Proposal

### 1. Container Wrapper Component
Create a `PageContainer` component that handles consistent padding:

```tsx
// components/layout/PageContainer.tsx
export function PageContainer({
  children,
  className,
  narrow = false
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div className={cn(
      "w-full mx-auto px-4 sm:px-6",
      narrow ? "max-w-3xl" : "max-w-7xl",
      className
    )}>
      {children}
    </div>
  );
}
```

### 2. Mobile Navigation Component
Create a slide-out drawer for mobile navigation:

```tsx
// components/layout/MobileNav.tsx
export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger button - visible on mobile only */}
      <button
        className="md:hidden p-2"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Slide-out drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          {/* Drawer */}
          <nav className="absolute top-0 right-0 h-full w-64 bg-white shadow-xl p-6">
            {/* Nav links */}
          </nav>
        </div>
      )}
    </>
  );
}
```

### 3. Responsive Typography Tokens
Add to `tailwind.config.ts`:

```ts
theme: {
  extend: {
    fontSize: {
      // Mobile-first responsive headings
      'heading-1': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
      'heading-1-md': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
      'heading-1-lg': ['3rem', { lineHeight: '1' }], // 48px
    }
  }
}
```

### 4. Touch Target Utility
Add utility classes for minimum touch targets:

```css
/* globals.css */
@layer utilities {
  .touch-target {
    @apply min-h-[44px] min-w-[44px];
  }

  .touch-target-sm {
    @apply min-h-[36px] min-w-[36px];
  }
}
```

---

## Phased Fix Plan

### Phase 1: Critical Navigation (Immediate)
**Estimated Effort:** 2-3 hours

1. Create `MobileNav` component with hamburger + drawer
2. Update `NavBar` to hide links on mobile, show hamburger
3. Test on iPhone Safari, Chrome

**Files to modify:**
- `components/layout/NavBar.tsx`
- Create `components/layout/MobileNav.tsx`

---

### Phase 2: Layout Fixes (Week 1)
**Estimated Effort:** 3-4 hours

1. Fix GreetingCard responsive stacking
2. Fix Emotional Cadence section
3. Fix SanctuaryTabs (add mobile dropdown like Soul Path)
4. Add responsive padding to Settings page

**Files to modify:**
- `components/sanctuary/GreetingCard.tsx`
- `app/(protected)/sanctuary/page.tsx`
- `components/sanctuary/SanctuaryTabs.tsx`
- `app/(protected)/settings/page.tsx`

---

### Phase 3: Touch & Input Fixes (Week 1-2)
**Estimated Effort:** 2-3 hours

1. Change Input component to `text-base` (prevent iOS zoom)
2. Add touch target sizing to modal close buttons
3. Add min-width to Lucky Compass numbers
4. Review all interactive element sizes

**Files to modify:**
- `components/ui/input.tsx`
- `components/home/ZodiacGrid.tsx`
- `app/(protected)/sanctuary/page.tsx`

---

### Phase 4: Polish & Consistency (Week 2)
**Estimated Effort:** 2-3 hours

1. Standardize card padding with responsive variants
2. Add responsive typography scale
3. Review and fix Footer spacing
4. Add scroll indicators where needed

**Files to modify:**
- `components/ui/card.tsx`
- `app/globals.css`
- `components/layout/Footer.tsx`
- `components/learn/RoadmapRow.tsx`

---

## Testing Checklist

### iPhone Safari (Priority 1)
- [ ] Navigation works at 320w
- [ ] Forms don't trigger zoom on focus
- [ ] All touch targets are 44px minimum
- [ ] Modal dialogs scroll properly
- [ ] Horizontal scroll is intentional only

### iPhone Chrome (Priority 2)
- [ ] Same as Safari checklist
- [ ] Check for any Chrome-specific rendering issues

### Android Chrome (Priority 3)
- [ ] Same core checklist
- [ ] Test at 360w and 412w viewports

### Tablet (768w)
- [ ] Layouts transition smoothly from mobile to desktop
- [ ] No awkward in-between states

---

## Quick Win Fixes (< 30 min each)

1. **Input font size:** Change `text-sm` to `text-base` in `input.tsx`
2. **Footer margin:** Change `mt-24` to `mt-12 md:mt-24`
3. **Modal close button:** Add `w-11 h-11 flex items-center justify-center` to close buttons
4. **TogglePills:** Add `flex-wrap` for safety

---

## Conclusion

The Solara app has a solid foundation with Tailwind CSS and mobile-first patterns, but the **missing mobile navigation is a critical blocker** for any meaningful mobile experience. The phased approach above prioritizes this fix first, followed by layout issues, touch targets, and polish.

Total estimated effort: **10-15 hours** across 2 weeks for comprehensive mobile optimization.
