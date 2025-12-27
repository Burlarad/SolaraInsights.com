# Soul Print "Tab Deep Dives" Audit

**Date:** 2025-12-14
**Purpose:** Design + implementation readiness for personalized + actualized deep dives in Soul Print tabs

---

## Executive Summary

The Soul Print feature currently displays **9 tabs** with varying levels of personalization:
- **1 tab** (Personal Narrative) uses AI-generated personalized content
- **8 tabs** display raw computed data with static generic descriptions

The placements data (`soul_path_json`) contains **all computed values needed** for deep dives:
- Part of Fortune (Joy tab)
- North/South Node + Chiron (Direction tab)
- Patterns - Grand Trines, T-Squares (Patterns tab)
- Emphasis - Stelliums, house/sign concentration (Intensity tab)
- Chart Type, Chart Ruler, Dominant Planets/Signs (Energy tab)

**Recommendation:** Add AI-generated `tabDeepDives` to the existing `soul_path_narrative_json` structure, generated on-demand and cached permanently (stone tablet).

---

## 1. Current State Analysis

### Tab Content Classification

| Tab | Source | Content Type | AI Personalized? |
|-----|--------|--------------|------------------|
| Personal Narrative | `insight.coreSummary` + `insight.sections` | AI-generated text | ✅ Yes |
| Planetary Placements | `placements.planets` | Raw data + static descriptions | ❌ No |
| Houses | `placements.houses` | Raw data + static descriptions | ❌ No |
| Aspects | `placements.aspects` | Raw data only | ❌ No |
| Patterns | `placements.calculated.patterns` | Raw data + static descriptions | ❌ No |
| Energy Shape | `placements.calculated` + `placements.derived` | Raw data + static descriptions | ❌ No |
| Intensity Zones | `placements.calculated.emphasis` | Raw data + static descriptions | ❌ No |
| Direction | `placements.planets` (Node/Chiron) + `calculated.southNode` | Raw data + static descriptions | ❌ No |
| Joy | `placements.calculated.partOfFortune` | Raw data + static descriptions | ❌ No |

### Personal Narrative JSON Structure (Current)

```typescript
// types/natalAI.ts - FullBirthChartInsight
{
  meta: {
    mode: "natal_full_profile",
    language: string
  },
  coreSummary: {
    headline: string,      // 1-2 sentences
    overallVibe: string,   // 2-4 paragraphs
    bigThree: {
      sun: string,         // 2-4 paragraphs
      moon: string,        // 2-4 paragraphs
      rising: string       // 2-4 paragraphs
    }
  },
  sections: {
    identity: string,              // 2-4 paragraphs
    emotions: string,              // 2-4 paragraphs
    loveAndRelationships: string,  // 2-4 paragraphs
    workAndMoney: string,          // 2-4 paragraphs
    purposeAndGrowth: string,      // 2-4 paragraphs
    innerWorld: string             // 2-4 paragraphs
  }
}
```

### Static UI Descriptions (Examples)

**Joy Tab** (`page.tsx:689-698`):
```tsx
<p>The Part of Fortune shows where natural joy and ease flow most readily in your life...</p>
<p>This placement suggests where you might find your stride without needing to push...</p>
<p>Cultivating this area doesn't require force...</p>
```

**Direction Tab** (`page.tsx:641-642`):
```tsx
<p>Your North Node is an invitation toward growth and unfamiliar territory...</p>
```

These are **generic educational descriptions**, not personalized to the user's specific placements.

---

## 2. Data Availability

### Computed Data in `placements` (soul_path_json)

**Source:** `lib/ephemeris/swissEngine.ts` + `calculated.ts` + `derived.ts`

| Feature | Location | Available? | Deep Dive Ready? |
|---------|----------|------------|------------------|
| Part of Fortune | `calculated.partOfFortune` | ✅ | ✅ sign, house, longitude |
| North Node | `planets[]` (name="North Node") | ✅ | ✅ sign, house, longitude |
| South Node | `calculated.southNode` | ✅ | ✅ sign, house, longitude |
| Chiron | `planets[]` (name="Chiron") | ✅ | ✅ sign, house, longitude |
| Chart Type | `calculated.chartType` | ✅ | ✅ "day" or "night" |
| Chart Ruler | `derived.chartRuler` | ✅ | ✅ planet name |
| Dominant Signs | `derived.dominantSigns` | ✅ | ✅ top 3 with scores |
| Dominant Planets | `derived.dominantPlanets` | ✅ | ✅ top 3 with scores |
| Element Balance | `derived.elementBalance` | ✅ | ✅ fire/earth/air/water counts |
| Modality Balance | `derived.modalityBalance` | ✅ | ✅ cardinal/fixed/mutable counts |
| Top Aspects | `derived.topAspects` | ✅ | ✅ 10 tightest by orb |
| Sign Emphasis | `calculated.emphasis.signEmphasis` | ✅ | ✅ sorted by planet count |
| House Emphasis | `calculated.emphasis.houseEmphasis` | ✅ | ✅ sorted by planet count |
| Stelliums | `calculated.emphasis.stelliums` | ✅ | ✅ 3+ planets in sign/house |
| Grand Trines | `calculated.patterns[]` | ✅ | ✅ type + planets |
| T-Squares | `calculated.patterns[]` | ✅ | ✅ type + planets |

### Missing Data (None Critical)

All data needed for deep dives is **already computed and stored**. No additional ephemeris calculations required.

---

## 3. Storage & Caching

### Current Storage Structure

**Table:** `soul_paths`

| Column | Purpose |
|--------|---------|
| `user_id` | Primary key (FK to auth.users) |
| `soul_path_json` | Swiss placements (~15-25KB JSONB) |
| `schema_version` | Placements schema version (currently 8) |
| `birth_input_hash` | SHA-256 of birth data |
| `computed_at` | Timestamp of placements computation |
| `soul_path_narrative_json` | AI narrative (~8-15KB JSONB) |
| `narrative_prompt_version` | Prompt version (currently 2) |
| `narrative_language` | Language code |
| `narrative_model` | OpenAI model used |
| `narrative_generated_at` | Timestamp of AI generation |

### Versioning Strategy

**Current:**
- `schema_version` = 8 (placements structure)
- `narrative_prompt_version` = 2 (AI prompt)

**For Deep Dives:**
- Bump `narrative_prompt_version` to 3 when adding deep dives
- Old narratives will auto-regenerate on next visit (cache miss)
- No database schema changes needed (JSONB is flexible)

### Extending the JSON Schema

The `soul_path_narrative_json` column stores `FullBirthChartInsight`. We can safely add optional `tabDeepDives` property:

```typescript
type FullBirthChartInsight = {
  meta: { ... },
  coreSummary: { ... },
  sections: { ... },
  // NEW - Optional for backwards compatibility
  tabDeepDives?: {
    joy?: TabDeepDive,
    direction?: TabDeepDive,
    patterns?: TabDeepDive,
    intensity?: TabDeepDive,
    energy?: TabDeepDive,
  }
}
```

**Safety:** Optional properties + null-safe UI checks prevent crashes for users without deep dives.

---

## 4. UI Expectations

### Current UI Pattern (Joy Tab Example)

```tsx
{activeSection === "joy" && placements?.calculated?.partOfFortune && (
  <SolaraCard>
    <h2>Part of Fortune</h2>
    <p className="text-sm text-accent-ink/60">
      {/* Static intro */}
    </p>
    <p className="text-base">
      {placements.calculated.partOfFortune.sign}
      {placements.calculated.partOfFortune.house && ` — ${...}th house`}
    </p>
    <div className="space-y-3">
      {/* Static generic paragraphs */}
    </div>
  </SolaraCard>
)}
```

### Proposed Deep Dive UI Pattern

```tsx
{activeSection === "joy" && placements?.calculated?.partOfFortune && (
  <SolaraCard>
    <h2>Part of Fortune</h2>

    {/* Raw placement data (keep) */}
    <p className="text-base">
      {placements.calculated.partOfFortune.sign}
      {placements.calculated.partOfFortune.house && ` — ${...}th house`}
    </p>

    {/* NEW: AI Deep Dive (if available) */}
    {insight?.tabDeepDives?.joy ? (
      <div className="space-y-6 mt-6">
        {/* Meaning - 2 paragraphs */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">What This Means For You</h3>
          {insight.tabDeepDives.joy.meaning.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-accent-ink/80">{p}</p>
          ))}
        </div>

        {/* Aligned - 3 bullets */}
        <div>
          <h3 className="text-sm font-medium">When You're Aligned</h3>
          <ul className="list-disc pl-4 space-y-1">
            {insight.tabDeepDives.joy.aligned.map((item, i) => (
              <li key={i} className="text-sm text-accent-ink/70">{item}</li>
            ))}
          </ul>
        </div>

        {/* Off Course - 3 bullets */}
        <div>
          <h3 className="text-sm font-medium">When You're Off Course</h3>
          <ul className="list-disc pl-4 space-y-1">
            {insight.tabDeepDives.joy.offCourse.map((item, i) => (
              <li key={i} className="text-sm text-accent-ink/70">{item}</li>
            ))}
          </ul>
        </div>

        {/* Decision Rule - 1 sentence */}
        <div className="bg-accent-soft/30 rounded-lg p-4">
          <p className="text-sm font-medium text-accent-ink">
            {insight.tabDeepDives.joy.decisionRule}
          </p>
        </div>

        {/* Practice - 1 weekly ritual */}
        <div className="border-t border-accent-soft pt-4">
          <h3 className="text-sm font-medium">Weekly Practice</h3>
          <p className="text-sm text-accent-ink/80">
            {insight.tabDeepDives.joy.practice}
          </p>
        </div>
      </div>
    ) : (
      {/* Fallback to static description (keep for backwards compat) */}
    )}
  </SolaraCard>
)}
```

### Null-Safety Requirements

```typescript
// In hasFullInsight check (page.tsx:70-79)
const hasFullInsight =
  insight !== null &&
  typeof insight.coreSummary?.headline === "string" &&
  // ... existing checks ...

// Deep dive check (separate, optional)
const hasJoyDeepDive =
  insight?.tabDeepDives?.joy?.meaning &&
  insight.tabDeepDives.joy.aligned?.length >= 3 &&
  insight.tabDeepDives.joy.offCourse?.length >= 3;
```

---

## 5. Validation Plan

### Current Zod Schema

```typescript
// lib/validation/schemas.ts
export const fullBirthChartInsightSchema = z.object({
  meta: z.object({
    mode: z.literal("natal_full_profile"),
    language: z.string().min(2),
  }),
  coreSummary: z.object({
    headline: z.string().min(10),
    overallVibe: z.string().min(50),
    bigThree: z.object({
      sun: z.string().min(50),
      moon: z.string().min(50),
      rising: z.string().min(50),
    }),
  }),
  sections: z.object({
    identity: z.string().min(100),
    emotions: z.string().min(100),
    loveAndRelationships: z.string().min(100),
    workAndMoney: z.string().min(100),
    purposeAndGrowth: z.string().min(100),
    innerWorld: z.string().min(100),
  }),
});
```

### Proposed Extended Schema

```typescript
// Tab Deep Dive structure
const tabDeepDiveSchema = z.object({
  meaning: z.string().min(200),           // 2 paragraphs minimum
  aligned: z.array(z.string().min(20)).length(3),    // exactly 3 bullets
  offCourse: z.array(z.string().min(20)).length(3),  // exactly 3 bullets
  decisionRule: z.string().min(30).max(200),         // 1 sentence
  practice: z.string().min(50).max(500),             // 1 weekly ritual
});

// Extended schema with optional deep dives
export const fullBirthChartInsightSchemaV3 = fullBirthChartInsightSchema.extend({
  tabDeepDives: z.object({
    joy: tabDeepDiveSchema.optional(),
    direction: tabDeepDiveSchema.optional(),
    patterns: tabDeepDiveSchema.optional(),
    intensity: tabDeepDiveSchema.optional(),
    energy: tabDeepDiveSchema.optional(),
  }).optional(),
});
```

### Validation Strategy

1. **Core fields (required):** Must pass before storing
2. **Deep dives (optional):** Validate each independently
3. **Partial deep dives allowed:** Can have Joy but not Direction
4. **Never store invalid deep dive:** If Joy validation fails, omit Joy but keep others

---

## 6. Implementation Plan

### Phase 1: Joy Deep Dive (Priority)

**Why Joy First:**
- Most requested by users
- Part of Fortune is a single point (simpler prompt)
- High emotional value ("where do I find ease and flow?")
- Good test case for the pattern

**Scope:**
1. Add `tabDeepDiveSchema` to Zod schemas
2. Extend `FullBirthChartInsight` type with optional `tabDeepDives`
3. Update `/api/birth-chart` prompt to generate Joy deep dive
4. Add Joy deep dive UI to birth-chart page
5. Bump `PROMPT_VERSION` to 3
6. Test with new user + existing user (backfill)

**Estimated Effort:** 4-6 hours

**Token Cost:** ~500-800 additional output tokens per generation

### Phase 2: Direction + Patterns

**Scope:**
- Direction: North Node, South Node, Chiron (3 points, related)
- Patterns: Grand Trines, T-Squares (may be empty for some users)

**Estimated Effort:** 4-6 hours

### Phase 3: Intensity + Energy

**Scope:**
- Intensity: Stelliums, house/sign emphasis
- Energy: Chart type, chart ruler, dominant planets/signs

**Estimated Effort:** 4-6 hours

### Backfill Strategy

**Option A: Lazy Generation (Recommended)**
- Generate deep dive on next Soul Path visit if missing
- User sees loading briefly, then deep dive appears
- No batch job needed

**Option B: Background Backfill**
- Run cron to pre-generate for active users
- More complex, higher cost
- Not recommended for initial rollout

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing cached narratives | UI crashes | Make `tabDeepDives` optional; use null-safe checks |
| Token cost increase | ~500-800 extra per generation | Start with Joy only; monitor costs |
| AI output validation failures | Empty deep dives | Validate each tab independently; fallback to static |
| Prompt complexity | Inconsistent output | Keep deep dive prompt separate from core narrative |
| Schema version confusion | Cache invalidation issues | Bump `narrative_prompt_version` only (not `schema_version`) |

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `types/natalAI.ts` | Add `TabDeepDive` type + extend `FullBirthChartInsight` |
| `lib/validation/schemas.ts` | Add `tabDeepDiveSchema` + extend Zod schema |
| `app/api/birth-chart/route.ts` | Extend prompt for deep dives; bump `PROMPT_VERSION` |
| `app/(protected)/sanctuary/birth-chart/page.tsx` | Add deep dive UI for each tab |
| `lib/ai/voice.ts` | May need deep dive voice variant (optional) |

---

## 9. Proposed Deep Dive JSON Structure

```json
{
  "tabDeepDives": {
    "joy": {
      "meaning": "Your Part of Fortune in Sagittarius in the 9th house suggests that your deepest sense of ease and flow comes through exploration, learning, and expanding your worldview...\n\nThis placement indicates that when you're engaged in meaningful pursuit of knowledge or adventure, life tends to unfold with surprising grace...",
      "aligned": [
        "You feel energized by learning something new or exploring unfamiliar territory",
        "Opportunities seem to appear when you're teaching or sharing wisdom",
        "Travel, philosophy, or higher education brings unexpected rewards"
      ],
      "offCourse": [
        "You feel stuck when confined to routine or narrow thinking",
        "Cynicism or intellectual rigidity blocks your natural optimism",
        "Avoiding risk or playing it safe leaves you feeling drained"
      ],
      "decisionRule": "When facing a choice, lean toward the option that expands your understanding or takes you somewhere new.",
      "practice": "Once a week, spend 30 minutes learning something completely outside your usual interests—a documentary, a podcast, or a conversation with someone from a different background."
    }
  }
}
```

---

## 10. Next Steps

1. **Review this audit** with stakeholders
2. **Approve Phase 1 scope** (Joy deep dive only)
3. **Implement Phase 1** following the plan above
4. **Test** with a few users before wider rollout
5. **Monitor** token costs and generation success rate
6. **Proceed to Phase 2** if Phase 1 is successful

---

## Appendix: Evidence References

| Evidence | Location |
|----------|----------|
| Tab definitions | `page.tsx:8-29` |
| Joy tab static content | `page.tsx:677-701` |
| Personal Narrative rendering | `page.tsx:213-280` |
| `hasFullInsight` check | `page.tsx:68-79` |
| SwissPlacements type | `lib/ephemeris/swissEngine.ts:49-57` |
| CalculatedSummary type | `lib/ephemeris/calculated.ts:47-53` |
| DerivedSummary type | `lib/ephemeris/derived.ts:20-36` |
| Part of Fortune calculation | `lib/ephemeris/calculated.ts:180-224` |
| Soul Path storage | `lib/soulPath/storage.ts` |
| Current Zod schema | `lib/validation/schemas.ts:87-109` |
| `FullBirthChartInsight` type | `types/natalAI.ts:76-98` |
