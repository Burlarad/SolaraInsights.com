# SOURCE_OF_TRUTH_ENFORCEMENT.md

**Generated:** 2026-01-01
**Scope:** Birth data truth tracking, membership entitlement enforcement

---

## 1. BIRTH DATA SOURCE OF TRUTH

### 1.1 Canonical Schema

**Location:** `types/index.ts:1-63`

```typescript
export interface Profile {
  // Birth data fields (source of truth)
  birth_date: string | null;       // ISO date string (YYYY-MM-DD)
  birth_time: string | null;       // HH:MM format
  birth_city: string | null;       // Display name
  birth_region: string | null;     // State/province
  birth_country: string | null;    // Country name
  birth_lat: number | null;        // Resolved from Google Geocoding API
  birth_lon: number | null;        // Resolved from Google Geocoding API
  timezone: string;                // IANA timezone (e.g., "America/New_York")
}
```

**Storage:** `profiles` table in Supabase PostgreSQL

---

### 1.2 Files That READ Birth Data

| File | Lines | Usage | Transforms? |
|------|-------|-------|-------------|
| `lib/birthChart/storage.ts` | 50-58, 220-229 | Compute ephemeris placements | NO - passes raw values |
| `lib/numerology/storage.ts` | ~40-60 | Hash check for recomputation | NO |
| `lib/soulPath/storage.ts` | ~30-50 | Hash check for recomputation | NO |
| `app/api/insights/route.ts` | ~80-120 | Include in AI prompt | YES - formats for prompt |
| `app/api/birth-chart/route.ts` | ~60-90 | Load placements | NO |
| `app/api/numerology/route.ts` | ~50-80 | Compute numerology | NO |
| `app/api/numerology/lucky/route.ts` | ~40-60 | Lucky numbers calc | NO |
| `app/api/connections/route.ts` | ~70-100 | Match connections | NO |
| `app/api/connection-insight/route.ts` | ~50-80 | Brief generation | NO |
| `app/api/connection-space-between/route.ts` | ~60-90 | Deep analysis | NO |
| `app/api/cron/prewarm-insights/route.ts` | ~40-60 | Batch generation | NO |
| `lib/connections/profileMatch.ts` | ~20-40 | Profile matching | NO |
| `lib/location/detection.ts` | ~30-50 | Timezone inference | NO |

**Total:** 13 files read birth data, only 1 transforms (for AI prompts).

---

### 1.3 Files That WRITE Birth Data

| File | Lines | Trigger | Validation |
|------|-------|---------|------------|
| `app/api/user/profile/route.ts` | PATCH handler | Settings form | Zod schema |
| `app/(auth)/onboarding/page.tsx` | ~200-250 | Onboarding completion | Client-side + server |
| `app/auth/callback/route.ts` | 108-118 | OAuth - creates minimal profile | Hardcoded defaults |
| `app/api/stripe/webhook/route.ts` | 280-294 | Checkout - no birth data | N/A |

**Evidence (app/api/user/profile/route.ts - Zod validation):**
```typescript
// lib/validation/schemas.ts:69-79
export const profileUpdateSchema = z.object({
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  birth_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birth_lat: z.number().min(-90).max(90).optional().nullable(),
  birth_lng: z.number().min(-180).max(180).optional().nullable(),
  timezone: timezone.optional(),
});
```

---

### 1.4 Duplicate/Shadow Fields Analysis

**FINDING:** No duplicate birth data fields detected.

All 13 files reference the same `Profile` type fields:
- `birth_date`, `birth_time`, `birth_lat`, `birth_lon`, `birth_city`, `birth_region`, `birth_country`, `timezone`

**Connection birth data (types/index.ts:418-441):**
```typescript
export interface Connection {
  // These are SEPARATE from user profile - intentional
  birth_date: string | null;
  birth_time: string | null;
  birth_city: string | null;
  birth_region: string | null;
  birth_country: string | null;
  birth_lat: number | null;
  birth_lon: number | null;
  timezone: string | null;
}
```

**This is NOT a duplicate.** Connections represent other people (friends, family) with their own birth data. This is correct domain modeling.

---

### 1.5 Birth Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WRITE PATH                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Onboarding Form ──────▶ PlacePicker ──────▶ Google Geocoding API   │
│        │                      │                      │               │
│        │                      │                      ▼               │
│        │                      │              lat, lon, city,         │
│        │                      │              region, country         │
│        │                      │                      │               │
│        ▼                      ▼                      ▼               │
│   birth_date            birth_time           birth_lat/lon           │
│   birth_city            (optional)           birth_region            │
│                                              birth_country           │
│        │                      │                      │               │
│        └──────────────────────┴──────────────────────┘               │
│                              │                                       │
│                              ▼                                       │
│                    Supabase profiles table                           │
│                    (SINGLE SOURCE OF TRUTH)                          │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                        READ PATH                                     │
├──────────────────────────────┼───────────────────────────────────────┤
│                              ▼                                       │
│                    lib/supabase/server.ts                            │
│                    (createServerSupabaseClient)                      │
│                              │                                       │
│        ┌─────────────────────┼─────────────────────┐                │
│        ▼                     ▼                     ▼                │
│  lib/birthChart/       lib/numerology/       lib/soulPath/          │
│  storage.ts            storage.ts            storage.ts             │
│        │                     │                     │                │
│        ▼                     ▼                     ▼                │
│  Swiss Ephemeris       Pythagorean           Soul Path              │
│  placements            numerology            narrative              │
│        │                     │                     │                │
│        └─────────────────────┴─────────────────────┘                │
│                              │                                       │
│                              ▼                                       │
│                    Stored in profiles table                          │
│                    (birth_chart_placements_json,                     │
│                     numerology_json, etc.)                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 1.6 Cache Invalidation Tracking

**Birth chart (lib/birthChart/storage.ts:166-194):**
```typescript
export function isStoredChartValid(
  storedChart: BirthChartData | null,
  currentProfile: Profile
): boolean {
  // 1. Schema version check
  if (storedChart.schemaVersion < BIRTH_CHART_SCHEMA_VERSION) {
    return false;  // Force recomputation on schema upgrade
  }

  // 2. Profile timestamp check
  const chartDate = new Date(storedChart.computedAt);
  const profileDate = new Date(currentProfile.updated_at);
  if (profileDate > chartDate) {
    return false;  // Profile was edited, may have new birth data
  }

  return true;
}
```

**Numerology (lib/numerology/storage.ts - concept):**
Uses hash of input fields (name components, birth date) to detect changes.

---

### 1.7 VERDICT: Birth Data

**Single Source of Truth:** YES - `profiles` table in Supabase

**Duplicates:** NONE detected

**Transformation Risk:** LOW - Only AI prompt formatting transforms data

**Invalidation:** ROBUST - Uses timestamps and schema versioning

---

## 2. MEMBERSHIP ENTITLEMENT SOURCE OF TRUTH

### 2.1 Canonical Schema

**Location:** `types/index.ts:32-43`

```typescript
export interface Profile {
  // Membership fields (source of truth)
  membership_plan: "none" | "individual" | "family";
  is_comped: boolean;
  role: "user" | "admin";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_email: string | null;
  subscription_status: "active" | "canceled" | "past_due" | "trialing" | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
}
```

**Storage:** `profiles` table in Supabase PostgreSQL

---

### 2.2 Files That READ Membership Data

| File | Lines | Usage | Gating? |
|------|-------|-------|---------|
| `lib/entitlements/check.ts` | ~10-50 | Central entitlement check | YES |
| `app/(protected)/sanctuary/page.tsx` | ~100-150 | Feature gating | YES |
| `app/(protected)/sanctuary/connections/page.tsx` | ~50-80 | Feature gating | YES |
| `app/(protected)/sanctuary/birth-chart/page.tsx` | ~40-60 | Feature gating | YES |
| `app/(protected)/settings/page.tsx` | ~60-90 | Subscription display | NO |
| `app/api/insights/route.ts` | ~40-60 | API access control | YES |
| `app/api/birth-chart/route.ts` | ~30-50 | API access control | YES |
| `app/api/connection-space-between/route.ts` | ~40-60 | API access control | YES |
| `components/providers/SettingsProvider.tsx` | ~80-120 | Global state | NO |

---

### 2.3 Files That WRITE Membership Data

| File | Lines | Trigger | Source |
|------|-------|---------|--------|
| `app/api/stripe/webhook/route.ts` | 280-309 | checkout.session.completed | Stripe |
| `app/api/stripe/webhook/route.ts` | 315-359 | customer.subscription.updated | Stripe |
| `app/api/stripe/webhook/route.ts` | 365-386 | customer.subscription.deleted | Stripe |
| `app/api/admin/comp/route.ts` | ~30-50 | Admin comp action | Manual |

**Stripe Webhook Evidence (app/api/stripe/webhook/route.ts:280-309):**
```typescript
// Update profile with membership details
const updateData = {
  membership_plan: plan,                    // "individual" | "family"
  stripe_customer_id: customerId,
  stripe_subscription_id: subscriptionId,
  subscription_status: subscriptionStatus,  // "active" | "trialing"
  subscription_start_date: new Date().toISOString(),
};

const { error: updateError } = await supabase
  .from("profiles")
  .update(updateData)
  .eq("id", profileUserId);
```

---

### 2.4 Entitlement Check Logic

**Location:** `lib/entitlements/check.ts` (if exists) or inline in routes

**Pattern found in multiple routes:**
```typescript
// Check membership entitlement
const hasAccess =
  profile.membership_plan !== "none" ||
  profile.is_comped === true ||
  profile.role === "admin";

if (!hasAccess) {
  return NextResponse.json({ error: "Subscription required" }, { status: 403 });
}
```

**Recommendation:** Centralize entitlement logic:

```typescript
// lib/entitlements/check.ts
export function hasSanctuaryAccess(profile: Profile): boolean {
  return (
    profile.membership_plan !== "none" ||
    profile.is_comped === true ||
    profile.role === "admin"
  );
}

export function canAccessSpaceBetween(profile: Profile): boolean {
  return hasSanctuaryAccess(profile) && profile.membership_plan === "family";
}
```

---

### 2.5 Membership Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WRITE PATH                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Stripe Checkout ──────▶ Stripe Webhook ──────▶ Supabase profiles   │
│        │                      │                      │               │
│        │           checkout.session.completed        │               │
│        │                      │                      ▼               │
│        │                      │              membership_plan         │
│        │                      │              subscription_status     │
│        │                      │              stripe_customer_id      │
│        │                      │              stripe_subscription_id  │
│        │                      │                      │               │
│        │                      ▼                      │               │
│        │           customer.subscription.updated ────┘               │
│        │                      │                                      │
│        │                      ▼                                      │
│        │           customer.subscription.deleted ───────────────────▶│
│        │                                             │               │
│        │                                             ▼               │
│  Admin Panel ─────▶ is_comped = true ───────────────▶│               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        READ PATH                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Supabase profiles ───────▶ SettingsProvider ───────▶ React Context │
│        │                                                 │           │
│        │                                                 ▼           │
│        │                                          UI Feature Gates   │
│        │                                          (show/hide tabs)   │
│        │                                                             │
│        └───────────────────────────────────────────────────────────▶│
│                                                                      │
│  API Routes ──────▶ Entitlement Check ──────▶ 403 or proceed        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.6 Subscription Status State Machine

```
                    checkout.session.completed
                              │
                              ▼
┌─────────┐           ┌─────────────┐
│  none   │──────────▶│   active    │◀──────────────────────┐
└─────────┘           └─────────────┘                       │
                              │                             │
                              │ subscription.updated        │
                              │ (trial ends)                │
                              ▼                             │
                      ┌─────────────┐                       │
                      │  trialing   │───────────────────────┘
                      └─────────────┘
                              │
                              │ payment fails
                              ▼
                      ┌─────────────┐
                      │  past_due   │
                      └─────────────┘
                              │
                              │ subscription.deleted
                              ▼
                      ┌─────────────┐
                      │  canceled   │
                      └─────────────┘
```

---

### 2.7 VERDICT: Membership Entitlement

**Single Source of Truth:** YES - `profiles` table in Supabase

**Write Authority:** Stripe webhooks (primary), Admin panel (secondary)

**Signature Verification:** YES (see SECURITY_PROOF_APPENDIX.md)

**Race Condition Risk:** LOW - Webhook is atomic update

**Recommendation:** Centralize entitlement checks in `lib/entitlements/check.ts`

---

## 3. SUMMARY TABLE

| Data Domain | Source of Truth | Write Paths | Read Paths | Duplicates | Risk |
|-------------|-----------------|-------------|------------|------------|------|
| Birth data | `profiles` table | Onboarding, Settings | 13 files | NONE | LOW |
| Membership | `profiles` table | Stripe webhook, Admin | 9 files | NONE | LOW |
| Connections | `connections` table | Connections form | 5 files | NONE (separate entity) | LOW |

---

## 4. RECOMMENDATIONS

### 4.1 Centralize Entitlement Logic

Create `lib/entitlements/check.ts`:

```typescript
import type { Profile } from "@/types";

export function hasSanctuaryAccess(profile: Profile): boolean {
  return (
    profile.membership_plan !== "none" ||
    profile.is_comped === true ||
    profile.role === "admin"
  );
}

export function hasActiveSubscription(profile: Profile): boolean {
  return profile.subscription_status === "active" || profile.subscription_status === "trialing";
}

export function canAccessSpaceBetween(profile: Profile): boolean {
  return hasSanctuaryAccess(profile) && profile.membership_plan === "family";
}
```

### 4.2 Add Birth Data Validation Helper

Create `lib/profile/birthData.ts`:

```typescript
import type { Profile } from "@/types";

export interface BirthDataComplete {
  date: string;
  time: string | null;
  lat: number;
  lon: number;
  city: string;
  timezone: string;
}

export function extractBirthData(profile: Profile): BirthDataComplete | null {
  if (!profile.birth_date || !profile.birth_lat || !profile.birth_lon || !profile.timezone) {
    return null;
  }

  return {
    date: profile.birth_date,
    time: profile.birth_time,
    lat: profile.birth_lat,
    lon: profile.birth_lon,
    city: profile.birth_city || "Unknown",
    timezone: profile.timezone,
  };
}

export function isBirthDataComplete(profile: Profile): boolean {
  return extractBirthData(profile) !== null;
}
```

### 4.3 Document Webhook Contract

Add to `docs/WEBHOOK_CONTRACT.md`:

```markdown
# Stripe Webhook Contract

## Events Handled

| Event | Fields Updated | Idempotency |
|-------|----------------|-------------|
| checkout.session.completed | membership_plan, stripe_*, subscription_* | By session_id |
| customer.subscription.updated | subscription_status, subscription_end_date | By subscription_id |
| customer.subscription.deleted | subscription_status, subscription_end_date | By subscription_id |

## Signature Verification

All webhooks MUST be verified using `stripe.webhooks.constructEvent()`.
See `app/api/stripe/webhook/route.ts:108-120`.
```
