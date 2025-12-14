# Practice Field Removal Audit

**Date:** 2025-12-14
**Status:** COMPLETED
**Goal:** Remove "weekly practice" from Soul Path deep dives (doesn't fit stone-tablet vibe)

## Locations Found

### 1. Types (`types/natalAI.ts`)
- **Line 116:** `practice: string; // 1 weekly ritual`
- Part of `TabDeepDive` type definition

### 2. Zod Validation (`lib/validation/schemas.ts`)
- **Lines 100-102:**
  ```typescript
  practice: z.string()
    .min(30, "practice must be at least 30 characters")
    .max(500, "practice must be at most 500 characters"),
  ```
- Part of `tabDeepDiveSchema`

### 3. Generation Prompts (`app/api/birth-chart/route.ts`)
- **Line 275:** `"practice": "One specific weekly ritual (30 min or less) for this area."`
- **Line 290:** `- Each tab MUST have all 5 fields: meaning, aligned, offCourse, decisionRule, practice`

### 4. UI Rendering (`app/(protected)/sanctuary/birth-chart/page.tsx`)
- **Lines 68-71:** DeepDiveCard component renders practice section:
  ```tsx
  {/* Practice */}
  <div className="border-t border-accent-soft pt-4">
    <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Weekly Practice</h3>
    <p className="text-sm text-accent-ink/80 leading-relaxed">{deepDive.practice}</p>
  </div>
  ```

### 5. Database Storage
- Stored in `soul_paths.soul_path_narrative_json.tabDeepDives.{tab}.practice`
- Existing cached deep dives may contain `practice` field

## Unrelated Occurrences (NOT changing)
- `app/(public)/learn/page.tsx:19` - Tarot practice educational content
- `components/learn/RoadmapRow.tsx:27` - "embodied tarot practice" text

## Changes Required

1. **Types:** Remove `practice` from `TabDeepDive` type
2. **Validation:** Remove `practice` from Zod schema (make backward compatible)
3. **Prompts:** Remove practice from JSON output shape (4 fields instead of 5)
4. **UI:** Remove practice section from DeepDiveCard

## Backward Compatibility
- Existing stored deep dives with `practice` will be ignored (TypeScript won't access it)
- No migration needed - extra fields in JSON are harmless
- Zod schema uses `.passthrough()` to allow extra fields in validation
- Optional SQL cleanup can strip practice key later if desired

## Changes Made

### Files Changed
1. **types/natalAI.ts** - Removed `practice` field from `TabDeepDive` type
2. **lib/validation/schemas.ts** - Removed `practice` from schema, added `.passthrough()` for backward compat
3. **app/api/birth-chart/route.ts** - Removed practice from JSON output shape and critical rules (4 fields instead of 5)
4. **app/(protected)/sanctuary/birth-chart/page.tsx** - Removed Practice section from `DeepDiveCard` component

### Build Output
```
✓ Compiled successfully in 2.4s
✓ Generating static pages (32/32)
```

## Optional SQL Cleanup

If you want to remove the `practice` key from existing stored deep dives (not required, but cleans up storage):

```sql
-- Preview: Count deep dives with practice key
SELECT COUNT(*) as affected_rows
FROM soul_paths
WHERE soul_path_narrative_json->'tabDeepDives' IS NOT NULL;

-- Optional cleanup: Remove practice key from all tab deep dives
UPDATE soul_paths
SET soul_path_narrative_json = jsonb_set(
  soul_path_narrative_json,
  '{tabDeepDives}',
  (
    SELECT jsonb_object_agg(
      key,
      value - 'practice'
    )
    FROM jsonb_each(soul_path_narrative_json->'tabDeepDives')
  )
)
WHERE soul_path_narrative_json->'tabDeepDives' IS NOT NULL
  AND soul_path_narrative_json->'tabDeepDives' != 'null'::jsonb;
```

**Note:** This cleanup is optional. The app will work correctly with or without running it.
