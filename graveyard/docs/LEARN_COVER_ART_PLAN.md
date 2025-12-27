# Learn Center Cover Art Plan

**Date**: 2025-12-15
**Status**: Audit + Plan (not implemented)
**Goal**: Add premium cover visuals to Learn guide cards and pages — done right the first time.

---

## 1) Current State

### What Exists Now

| Component | Visual Treatment | Notes |
|-----------|------------------|-------|
| `LearnGuideCard` (default) | 160px gradient hero band + emoji icon | `bg-gradient-to-br from-accent-muted to-accent-lavender` |
| `LearnGuideCard` (roadmap) | No visual — text-only card | Smallest footprint |
| `LearnGuideCard` (compact) | No visual — text-only card | Used for compact layouts |
| `[slug]/page.tsx` | No cover — text header only | Metadata + chips + title |

### Current Visual System

```tsx
// LearnGuideCard.tsx lines 111-137
<div className="relative h-40 bg-gradient-to-br from-accent-muted to-accent-lavender">
  <span className="text-4xl opacity-40">
    {category === "Astrology Basics" && "✦"}
    {category === "Tarot Basics" && "🃏"}
    {category === "Compatibility" && "💫"}
    ...
  </span>
</div>
```

**What's Good:**
- Consistent gradient creates visual rhythm across cards
- Emoji placeholders differentiate categories at a glance
- Text is readable against the light gradient
- Layout is stable (no CLS issues)

**What's Missing:**
- No actual cover art — gradient + emoji is clearly a placeholder
- No per-guide visual identity
- Guide pages have no hero image (text-only header feels bare)
- Roadmap cards are text-only (lost opportunity for visual appeal)

### Existing Assets (Reusable)

| Path | Contents | Usable For |
|------|----------|------------|
| `public/tarot/rws/*.webp` | 78 RWS tarot cards | `tarot-101` cover |
| `public/runes/*.png` | 24 Elder Futhark runes | Future runes guide |
| `public/images/` | Empty | Available for Learn covers |

---

## 2) Recommended Approach

### **Option 2: Category-Based Covers + Per-Slug Overrides**

After evaluating all three options:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **1. Per-slug images** | Unique visuals per guide | 18+ images needed; high maintenance; risk of missing files | Overkill for MVP |
| **2. Category covers + overrides** | Guaranteed coverage; scalable; allows incremental upgrades | Less unique per guide | **Recommended** |
| **3. SVG/code-generated** | Zero asset management; deterministic | May not match Solara's warm aesthetic; less premium feel | Too technical-looking |

### Why Option 2 Wins

1. **Never broken**: Every guide has a category, so every guide gets a cover
2. **Scalable**: Add new guides without new art
3. **Upgradeable**: Override specific slugs when we have better art
4. **Efficient**: Only 8 category images needed (vs 18+ per-slug)
5. **Premium feel**: Real photography/illustration beats generated patterns

### Implementation Model

```typescript
// lib/learn/content.ts
export interface LearnItem {
  slug: string;
  title: string;
  // ... existing fields

  // NEW: Optional cover override (falls back to category cover)
  coverImage?: string;  // e.g., "/learn/covers/tarot-101.webp"
  coverAlt?: string;    // Accessibility alt text
}

// Category fallback mapping (in a utility)
const CATEGORY_COVERS: Record<LearnCategory, string> = {
  "Astrology Basics": "/learn/covers/category-astrology.webp",
  "Astrology Intermediate": "/learn/covers/category-astrology.webp",
  "Tarot Basics": "/learn/covers/category-tarot.webp",
  "Compatibility": "/learn/covers/category-compatibility.webp",
  "Sanctuary": "/learn/covers/category-sanctuary.webp",
  "Settings": "/learn/covers/category-settings.webp",
  "Connections": "/learn/covers/category-connections.webp",
  "Journal": "/learn/covers/category-journal.webp",
};
```

---

## 3) "No Broken Covers" Enforcement Plan

### Strategy: Build-Time Validation + Runtime Fallback

#### A. Build-Time Check (Primary)

Create `scripts/validate-learn-covers.ts`:

```typescript
// scripts/validate-learn-covers.ts
import fs from 'fs';
import path from 'path';
import { LEARN_ITEMS, LearnCategory } from '../lib/learn/content';

const CATEGORY_COVERS: Record<LearnCategory, string> = { /* ... */ };
const PUBLIC_DIR = path.join(process.cwd(), 'public');

function validateCovers() {
  const errors: string[] = [];

  // Check all category covers exist
  for (const [category, coverPath] of Object.entries(CATEGORY_COVERS)) {
    const fullPath = path.join(PUBLIC_DIR, coverPath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing category cover: ${coverPath} (for ${category})`);
    }
  }

  // Check all per-slug overrides exist
  for (const item of LEARN_ITEMS) {
    if (item.coverImage) {
      const fullPath = path.join(PUBLIC_DIR, item.coverImage);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Missing cover override: ${item.coverImage} (for ${item.slug})`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Cover validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('All Learn covers validated.');
}

validateCovers();
```

Add to `package.json`:
```json
{
  "scripts": {
    "validate:covers": "tsx scripts/validate-learn-covers.ts",
    "prebuild": "npm run validate:covers"
  }
}
```

#### B. Runtime Fallback (Safety Net)

```typescript
// lib/learn/covers.ts
export function getLearnCover(item: LearnItem): { src: string; alt: string } {
  // Per-slug override takes priority
  if (item.coverImage) {
    return {
      src: item.coverImage,
      alt: item.coverAlt || `Cover for ${item.title}`,
    };
  }

  // Category fallback (guaranteed to exist after build validation)
  return {
    src: CATEGORY_COVERS[item.category],
    alt: `${item.category} guide cover`,
  };
}
```

#### C. next/image Error Handling

```tsx
<Image
  src={cover.src}
  alt={cover.alt}
  fill
  className="object-cover"
  onError={(e) => {
    // Fallback to gradient if image fails at runtime
    e.currentTarget.style.display = 'none';
  }}
/>
{/* Gradient fallback always present behind image */}
<div className="absolute inset-0 bg-gradient-to-br from-accent-muted to-accent-lavender -z-10" />
```

---

## 4) Design Spec

### Card Cover (LearnGuideCard default variant)

| Property | Value | Rationale |
|----------|-------|-----------|
| Aspect ratio | 16:10 (160px height at card width) | Current h-40; balanced, not too tall |
| Image fit | `object-cover` | Fill space, crop edges |
| Overlay gradient | `bg-gradient-to-t from-black/40 via-transparent to-transparent` | Ensure bottom text badges readable |
| Star glyph | `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 text-5xl` | Subtle brand motif |
| Corner radius | `rounded-t-lg` (matches Card) | Consistent with card shape |

### Tailwind Classes

```tsx
// Cover container
<div className="relative h-40 overflow-hidden rounded-t-lg">
  {/* Image */}
  <Image
    src={cover.src}
    alt={cover.alt}
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
    className="object-cover"
    priority={isPriority}
  />

  {/* Gradient overlay for text readability */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

  {/* Subtle star motif */}
  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/10 text-6xl pointer-events-none select-none">
    ✦
  </span>

  {/* Existing badges (time, level, coming soon) */}
  <div className="absolute top-4 left-4 flex items-center gap-3">
    {/* ... */}
  </div>
</div>
```

### Guide Page Hero (optional enhancement)

| Property | Value |
|----------|-------|
| Height | `h-48 md:h-64` |
| Width | Full bleed or `max-w-3xl` (match content) |
| Overlay | Stronger gradient for title readability |
| Position | Above title, after back link |

### Mobile Rules (iPhone 320w)

- Cover height stays `h-40` (no responsive reduction)
- Image uses `sizes="100vw"` on mobile for proper srcset
- Text badges use `text-xs` with sufficient contrast
- No horizontal overflow from cover container

### Image Specifications

| Property | Requirement |
|----------|-------------|
| Format | WebP preferred, PNG fallback |
| Resolution | 800x500px minimum (2x for retina) |
| File size | < 100KB per image |
| Color profile | sRGB |
| Naming | `category-{name}.webp` or `{slug}.webp` |

---

## 5) Implementation Steps

### Phase 1: Infrastructure (do first)

1. **Create directory structure**
   ```
   public/learn/covers/
   ├── category-astrology.webp
   ├── category-tarot.webp
   ├── category-compatibility.webp
   ├── category-sanctuary.webp
   ├── category-settings.webp
   ├── category-connections.webp
   └── category-journal.webp
   ```

2. **Add validation script**
   - Create `scripts/validate-learn-covers.ts`
   - Add `validate:covers` to package.json scripts
   - Add to `prebuild` script

3. **Create cover utility**
   - Add `lib/learn/covers.ts` with `getLearnCover()` function
   - Export `CATEGORY_COVERS` mapping

### Phase 2: Data Model

4. **Extend LearnItem interface**
   ```typescript
   // lib/learn/content.ts
   export interface LearnItem {
     // ... existing
     coverImage?: string;
     coverAlt?: string;
   }
   ```

5. **Add override for tarot-101** (we have assets)
   ```typescript
   {
     slug: "tarot-101",
     // ...
     coverImage: "/tarot/rws/the-star.webp",
     coverAlt: "The Star tarot card from Rider-Waite-Smith deck",
   }
   ```

### Phase 3: Component Updates

6. **Update LearnGuideCard (default variant)**
   - Import `Image` from `next/image`
   - Import `getLearnCover` from covers utility
   - Replace gradient div with Image + overlay
   - Add `sizes` prop for responsive images
   - Keep star glyph as decorative overlay

7. **Update LearnGuideCard (roadmap variant)** — optional
   - Add small cover thumbnail (48x48) or keep text-only
   - Decision: text-only is fine for horizontal scroll

8. **Update [slug]/page.tsx** — optional enhancement
   - Add hero cover above title
   - Use larger height (`h-48 md:h-64`)
   - Stronger overlay for title readability

### Phase 4: Assets

9. **Source/create category cover images**
   - Option A: Use stock photography (Unsplash, etc.)
   - Option B: Commission illustrations
   - Option C: Use existing tarot/rune assets creatively
   - Must match Solara warm, mystical aesthetic

10. **Optimize and place images**
    - Convert to WebP
    - Resize to 800x500px
    - Run through image optimizer
    - Place in `public/learn/covers/`

---

## 6) Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing category cover image | Low | High (broken UI) | Build-time validation script fails build |
| Image too large (slow load) | Medium | Medium | Set max file size in validation; use `next/image` |
| Cover doesn't fit card aspect | Medium | Low | Use `object-cover`; test each image |
| Text unreadable on cover | Medium | High | Always include gradient overlay |
| Mobile layout shift | Low | Medium | Use fixed `h-40`; `next/image` handles sizing |
| Per-slug override points to missing file | Low | High | Validation script checks all overrides |

---

## 7) Verification Checklist

### Desktop (1440w)

- [ ] All 7 live guide cards show cover image (not just gradient)
- [ ] Category covers display correctly
- [ ] tarot-101 shows The Star card override
- [ ] Text badges (time, level) readable against cover
- [ ] Hover state works (shadow, arrow animation)
- [ ] No layout shift when images load

### Mobile (iPhone 320w)

- [ ] Cards stack in single column
- [ ] Cover images display at correct aspect ratio
- [ ] No horizontal page scroll
- [ ] Text badges readable (sufficient contrast)
- [ ] Tap targets ≥ 44px maintained
- [ ] Page loads quickly (< 3s on 3G)

### Build Verification

- [ ] `npm run validate:covers` passes
- [ ] `npm run build` succeeds
- [ ] No console warnings about missing images
- [ ] All 18 slug pages render without error

### Accessibility

- [ ] All images have meaningful alt text
- [ ] Star glyph is `aria-hidden="true"`
- [ ] Color contrast passes WCAG AA for badge text

---

## 8) Bonus: Reusable Assets

### Tarot Cards (immediate use)

| Card | Path | Suggested Use |
|------|------|---------------|
| The Star | `/tarot/rws/the-star.webp` | `tarot-101` cover (hope, guidance) |
| The Sun | `/tarot/rws/the-sun.webp` | Alternative astrology cover |
| The Moon | `/tarot/rws/the-moon.webp` | Alternative intuition-themed cover |
| The Lovers | `/tarot/rws/the-lovers.webp` | `compatibility-101` cover option |
| The High Priestess | `/tarot/rws/the-high-priestess.webp` | Mystery/intuition theme |

### Runes (future use)

| Rune | Path | Meaning |
|------|------|---------|
| Sowilo | `/runes/sowilo.png` | Sun, success |
| Kenaz | `/runes/kenaz.png` | Knowledge, illumination |
| Ansuz | `/runes/ansuz.png` | Communication, wisdom |

---

## Summary

**Recommended approach**: Category-based covers with per-slug overrides

**Why**: Guarantees coverage, scales with content, allows incremental improvement

**Key deliverables**:
1. 8 category cover images in `public/learn/covers/`
2. Validation script in `scripts/`
3. Cover utility in `lib/learn/covers.ts`
4. Updated `LearnGuideCard` component
5. Optional: Guide page hero

**Timeline estimate**: Implementation is straightforward once assets exist. Asset creation/sourcing is the main variable.
