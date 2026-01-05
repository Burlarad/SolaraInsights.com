# DB_SCHEMA_AUDIT.md

**Generated:** 2026-01-01
**Scope:** Database schema documentation, RLS policies, indexes, and security analysis

---

## SCHEMA OVERVIEW

```
Database: Supabase PostgreSQL
Tables: 14 (estimated from migrations)
RLS Status: Enabled on all tables
Access Pattern: Server-side API routes via service role key
```

---

## TABLES BY DOMAIN

### Core User Data

#### 1. `profiles` (via Supabase Auth trigger)

**Purpose:** User profile data, cached birth chart, membership status

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | - | PK, FK to auth.users |
| `email` | TEXT | YES | - | - |
| `display_name` | TEXT | YES | - | - |
| `first_name` | TEXT | YES | - | For numerology |
| `middle_name` | TEXT | YES | - | Optional |
| `last_name` | TEXT | YES | - | For numerology |
| `birth_date` | DATE | YES | - | YYYY-MM-DD |
| `birth_time` | TIME | YES | - | HH:MM |
| `birth_place` | TEXT | YES | - | Human-readable |
| `birth_lat` | DOUBLE | YES | - | -90 to 90 |
| `birth_lng` | DOUBLE | YES | - | -180 to 180 |
| `timezone` | TEXT | YES | - | IANA timezone |
| `language` | VARCHAR(5) | YES | 'en' | Locale code |
| `membership_plan` | TEXT | YES | - | 'individual', 'family' |
| `subscription_status` | TEXT | YES | - | 'active', 'canceled', etc. |
| `stripe_customer_id` | TEXT | YES | - | Stripe cust_* |
| `stripe_subscription_id` | TEXT | YES | - | Stripe sub_* |
| `stripe_email` | TEXT | YES | - | Email used for Stripe |
| `is_comped` | BOOLEAN | NO | FALSE | Free access flag |
| `role` | TEXT | YES | 'user' | 'user', 'admin' |
| `is_onboarded` | BOOLEAN | NO | FALSE | Completed onboarding |
| `last_seen_at` | TIMESTAMPTZ | YES | - | Activity tracking |
| `birth_chart_placements_json` | JSONB | YES | - | Cached Swiss Ephemeris |
| `birth_chart_computed_at` | TIMESTAMPTZ | YES | - | Cache timestamp |
| `is_hibernated` | BOOLEAN | NO | FALSE | Account paused |
| `hibernated_at` | TIMESTAMPTZ | YES | - | - |
| `reactivated_at` | TIMESTAMPTZ | YES | - | - |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | - |

**Indexes:**
- `idx_profiles_last_seen_at` on `(last_seen_at DESC NULLS LAST)`
- `idx_profiles_is_hibernated` on `(is_hibernated) WHERE is_hibernated = TRUE`
- `idx_profiles_birth_lookup` on `(birth_date, birth_lat, birth_lng)` (from 009)

**RLS:** Standard user-owns-own-data pattern

---

### Soul Path / Birth Chart (Stone Tablet Pattern)

#### 2. `soul_paths`

**Purpose:** Canonical Soul Path data - computed once, stored forever

**Source:** `sql/002_create_soul_paths_table.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `user_id` | UUID | NO | - | **PK**, FK to auth.users |
| `schema_version` | INTEGER | NO | - | For cache invalidation |
| `computed_at` | TIMESTAMPTZ | NO | NOW() | - |
| `birth_input_hash` | TEXT | NO | - | SHA-256 of birth data |
| `soul_path_json` | JSONB | NO | - | ~15-25 KB per user |

**Indexes:**
- Primary key on `user_id`
- `idx_soul_paths_schema_version` on `(schema_version)`
- `idx_soul_paths_user_id` on `(user_id)`

**RLS Policy:**
```sql
-- NO policies for authenticated users!
-- Access only via service role key
ALTER TABLE public.soul_paths ENABLE ROW LEVEL SECURITY;
```

**Security Note:** This is a service-role-only table. RLS is enabled with NO policies, meaning browser clients cannot query it directly.

---

### Numerology (Stone Tablet Pattern)

#### 3. `numerology_profiles`

**Purpose:** Computed numerology data - stored per system (pythagorean/chaldean)

**Source:** `supabase/migrations/20250101_numerology_schema.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK to auth.users |
| `birth_date` | DATE | NO | - | Cache key |
| `birth_first_name` | TEXT | NO | - | Cache key |
| `birth_middle_name` | TEXT | YES | - | Cache key |
| `birth_last_name` | TEXT | NO | - | Cache key |
| `system` | TEXT | NO | 'pythagorean' | System type |
| `life_path_number` | INTEGER | NO | - | 1-9 or 11,22,33 |
| `life_path_master` | INTEGER | YES | - | Original master |
| `birthday_number` | INTEGER | NO | - | Day of birth |
| `expression_number` | INTEGER | NO | - | Full name |
| `expression_master` | INTEGER | YES | - | - |
| `soul_urge_number` | INTEGER | NO | - | Vowels only |
| `soul_urge_master` | INTEGER | YES | - | - |
| `personality_number` | INTEGER | NO | - | Consonants |
| `personality_master` | INTEGER | YES | - | - |
| `maturity_number` | INTEGER | NO | - | LP + Expression |
| `maturity_master` | INTEGER | YES | - | - |
| `pinnacle_1` through `pinnacle_4` | INTEGER | NO | - | Life periods |
| `pinnacle_1_end_age` through `pinnacle_3_end_age` | INTEGER | NO | - | Age ranges |
| `challenge_1` through `challenge_4` | INTEGER | NO | - | Life challenges |
| `lucky_numbers` | INTEGER[] | NO | - | Array of 3-5 |
| `has_karmic_debt` | BOOLEAN | NO | FALSE | - |
| `karmic_debt_numbers` | INTEGER[] | YES | - | 13,14,16,19 |
| `prompt_version` | INTEGER | NO | 1 | - |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | - |

**Indexes:**
- `idx_numerology_profiles_user_system` UNIQUE on `(user_id, system)`
- `idx_numerology_profiles_user_id` on `(user_id)`

**RLS Policies:**
```sql
"numerology_profiles_select_own" FOR SELECT USING (auth.uid() = user_id)
"numerology_profiles_insert_own" FOR INSERT WITH CHECK (auth.uid() = user_id)
"numerology_profiles_update_own" FOR UPDATE USING/WITH CHECK (auth.uid() = user_id)
"numerology_profiles_delete_own" FOR DELETE USING (auth.uid() = user_id)
```

---

### Connections System

#### 4. `connections`

**Purpose:** User's connections (people they track)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `owner_user_id` | UUID | NO | - | FK to profiles |
| `name` | TEXT | NO | - | Display name |
| `relationship_type` | TEXT | YES | - | partner, friend, etc. |
| `birth_date` | DATE | YES | - | - |
| `birth_time` | TIME | YES | - | - |
| `birth_place` | TEXT | YES | - | - |
| `birth_lat` | DOUBLE | YES | - | From 014 migration |
| `birth_lng` | DOUBLE | YES | - | From 014 migration |
| `timezone` | TEXT | YES | - | - |
| `linked_profile_id` | UUID | YES | - | Linked Solara user |
| `is_space_between_unlocked` | BOOLEAN | NO | FALSE | Premium unlock |
| `notes` | TEXT | YES | - | User notes |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | - |

**Indexes:**
- `idx_connections_owner` on `(owner_user_id)`

**RLS:** User-owns-own pattern

#### 5. `daily_briefs`

**Purpose:** Immutable daily connection briefs (one per connection per day)

**Source:** `sql/007_connections_v2.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `connection_id` | UUID | NO | - | FK to connections |
| `owner_user_id` | UUID | NO | - | FK to profiles |
| `local_date` | DATE | NO | - | User's local date |
| `language` | VARCHAR(5) | NO | 'en' | - |
| `prompt_version` | INTEGER | NO | - | - |
| `model_version` | VARCHAR(50) | YES | - | e.g., "gpt-4o-mini" |
| `title` | TEXT | NO | - | "Today with {Name}" |
| `shared_vibe` | TEXT | NO | - | 2-4 sentences |
| `ways_to_show_up` | TEXT[] | NO | - | Exactly 3 bullets |
| `nudge` | TEXT | YES | - | Optional nudge |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraints:**
- `daily_briefs_unique_per_day` UNIQUE on `(connection_id, local_date, language, prompt_version)`

**Indexes:**
- `idx_daily_briefs_connection_date` on `(connection_id, local_date DESC)`
- `idx_daily_briefs_owner` on `(owner_user_id)`

**RLS Policies:**
```sql
"Users can view their own daily briefs" FOR SELECT USING (auth.uid() = owner_user_id)
"Users can insert their own daily briefs" FOR INSERT WITH CHECK (auth.uid() = owner_user_id)
"Users can delete their own daily briefs" FOR DELETE USING (auth.uid() = owner_user_id)
-- NO UPDATE policy - briefs are immutable
```

#### 6. `space_between_reports`

**Purpose:** Deep "stone tablet" relationship blueprint (generated once)

**Source:** `sql/007_connections_v2.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `connection_id` | UUID | NO | - | FK to connections |
| `owner_user_id` | UUID | NO | - | FK to profiles |
| `language` | VARCHAR(5) | NO | 'en' | - |
| `prompt_version` | INTEGER | NO | - | - |
| `model_version` | VARCHAR(50) | YES | - | - |
| `includes_linked_birth_data` | BOOLEAN | NO | FALSE | - |
| `includes_linked_social_data` | BOOLEAN | NO | FALSE | - |
| `linked_profile_id` | UUID | YES | - | - |
| `relationship_essence` | TEXT | NO | - | Core dynamic |
| `emotional_blueprint` | TEXT | NO | - | Emotional rhythms |
| `communication_patterns` | TEXT | NO | - | How you talk |
| `growth_edges` | TEXT | NO | - | Where you stretch |
| `care_guide` | TEXT | NO | - | How to show up |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraints:**
- `space_between_unique_per_connection` UNIQUE on `(connection_id, language, prompt_version)`

**RLS Policies:** Same pattern as daily_briefs (no UPDATE policy - immutable)

---

### Social Insights

#### 7. `social_accounts`

**Purpose:** OAuth token vault (encrypted at rest)

**Source:** `sql/013_social_accounts_vault.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK to auth.users |
| `provider` | TEXT | NO | - | facebook, instagram, tiktok, x, reddit |
| `external_user_id` | TEXT | YES | - | Provider's user ID |
| `access_token` | TEXT | YES | - | **ENCRYPTED** |
| `refresh_token` | TEXT | YES | - | **ENCRYPTED** |
| `expires_at` | TIMESTAMPTZ | YES | - | Token expiry |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Trigger-managed |

**Constraints:**
- `social_accounts_user_provider_unique` UNIQUE on `(user_id, provider)`
- `social_accounts_provider_check` CHECK provider IN list

**Indexes:**
- `idx_social_accounts_user_provider` on `(user_id, provider)`
- `idx_social_accounts_expires_at` on `(expires_at) WHERE access_token IS NOT NULL`

**RLS Policies (CRITICAL - Service Role Only):**
```sql
"Users cannot read social_accounts" FOR SELECT USING (false)
"Users cannot insert social_accounts" FOR INSERT WITH CHECK (false)
"Users cannot update social_accounts" FOR UPDATE USING (false)
"Users cannot delete social_accounts" FOR DELETE USING (false)
```

**Security Note:** This table is completely blocked from authenticated users. Only service role can access. Tokens are encrypted at the application layer using AES-256-GCM before storage.

#### 8. `social_summaries`

**Purpose:** AI-generated summaries of social content

**Source:** `sql/011_social_insights_pipeline.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK to auth.users |
| `provider` | TEXT | NO | - | Same as social_accounts |
| `summary` | TEXT | NO | - | AI-generated |
| `prompt_version` | INT | NO | 1 | - |
| `model_version` | TEXT | YES | - | - |
| `last_collected_at` | TIMESTAMPTZ | NO | NOW() | - |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

**RLS Policies:**
```sql
"Users can view their own social summaries" FOR SELECT USING (auth.uid() = user_id)
"Users can insert their own social summaries" FOR INSERT WITH CHECK (auth.uid() = user_id)
"Users can update their own social summaries" FOR UPDATE USING (auth.uid() = user_id)
"Users can delete their own social summaries" FOR DELETE USING (auth.uid() = user_id)
-- PLUS linked profile access for Space Between:
"Users can view linked profile social summaries" FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (linked profile with space_between_unlocked)
)
```

---

### Year Insights (Transit Astrology)

#### 9. `global_astrology_events`

**Purpose:** Pre-computed global astronomical events (applies to ALL users)

**Source:** `sql/020_global_astrology_events.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `year` | INTEGER | NO | - | e.g., 2025 |
| `event_type` | TEXT | NO | - | season_ingress, sign_ingress, station_* |
| `planet` | TEXT | NO | - | Sun, Mercury, etc. |
| `sign` | TEXT | YES | - | For ingresses |
| `event_time` | TIMESTAMPTZ | NO | - | Exact UTC moment |
| `julian_day` | DOUBLE | NO | - | For ephemeris |
| `longitude` | DOUBLE | NO | - | 0-360 degrees |
| `season_name` | TEXT | YES | - | For season ingresses |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraints:**
- `unique_global_event` UNIQUE on `(year, event_type, planet, event_time)`

**Indexes:**
- `idx_global_events_year` on `(year)`
- `idx_global_events_year_type` on `(year, event_type)`
- `idx_global_events_year_planet` on `(year, planet)`
- `idx_global_events_year_time` on `(year, event_time)`
- `idx_global_events_seasons` on `(year, event_type, planet) WHERE season_ingress AND Sun`

**RLS:** Public read (global data)

#### 10. `user_year_insights`

**Purpose:** User-specific yearly insights (stone tablet pattern)

**Source:** `sql/021_user_year_insights.sql`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | FK to auth.users |
| `year` | INTEGER | NO | - | - |
| `language` | TEXT | NO | 'en' | - |
| `prompt_version` | INTEGER | NO | 1 | - |
| `narrative` | TEXT | NO | - | Markdown |
| `events_json` | JSONB | NO | '[]' | - |
| `personal_transits_json` | JSONB | NO | '[]' | - |
| `tokens_used` | INTEGER | YES | - | Audit |
| `model_used` | TEXT | YES | - | - |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

**Constraints:**
- `unique_user_year_insight` UNIQUE on `(user_id, year, language, prompt_version)`

**RLS Policies:**
```sql
"user_year_insights_select" FOR SELECT USING (auth.uid() = user_id)
"user_year_insights_service" FOR ALL USING (role = 'service_role')
```

#### 11. `user_year_transit_aspects`

**Purpose:** Denormalized transit-to-natal aspects for fast queries

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | - | - |
| `year` | INTEGER | NO | - | - |
| `transit_planet` | TEXT | NO | - | Moving planet |
| `natal_planet` | TEXT | NO | - | Birth position |
| `aspect_type` | TEXT | NO | - | conjunction, sextile, etc. |
| `exact_time` | TIMESTAMPTZ | NO | - | - |
| `julian_day` | DOUBLE | NO | - | - |
| `orb` | DOUBLE | NO | 0 | - |
| `is_retrograde_pass` | BOOLEAN | NO | FALSE | - |
| `pass_number` | INTEGER | NO | 1 | 1, 2, or 3 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | - |

**Indexes:**
- `idx_user_transit_aspects_user_year` on `(user_id, year)`
- `idx_user_transit_aspects_time` on `(user_id, year, exact_time)`
- `idx_user_transit_aspects_transit` on `(year, transit_planet, aspect_type)`

---

### Supporting Tables

#### 12. `journal_entries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK |
| `entry_date` | DATE | - |
| `content` | TEXT | Max 10000 chars |
| `created_at` | TIMESTAMPTZ | - |
| `updated_at` | TIMESTAMPTZ | - |

**Indexes:**
- `idx_journal_entries_user_date` on `(user_id, entry_date DESC)`

#### 13. `ai_usage_events` (Telemetry)

**Purpose:** Cost tracking and analytics

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `route` | TEXT | API route name |
| `tokens_input` | INTEGER | - |
| `tokens_output` | INTEGER | - |
| `model` | TEXT | - |
| `cost_usd` | DECIMAL | - |
| `user_id` | UUID | Optional |
| `created_at` | TIMESTAMPTZ | - |

**Indexes:**
- `idx_ai_usage_events_route_created` on `(route, created_at DESC)`

---

## RLS POLICY SUMMARY

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `profiles` | Own | Own | Own | Own | Standard |
| `soul_paths` | **NONE** | **NONE** | **NONE** | **NONE** | Service role only |
| `numerology_profiles` | Own | Own | Own | Own | Standard |
| `connections` | Own | Own | Own | Own | Standard |
| `daily_briefs` | Own | Own | ❌ | Own | Immutable |
| `space_between_reports` | Own | Own | ❌ | Own | Immutable |
| `social_accounts` | **FALSE** | **FALSE** | **FALSE** | **FALSE** | Service role only |
| `social_summaries` | Own + Linked | Own | Own | Own | Space Between access |
| `global_astrology_events` | Public | Service | Service | Service | Global data |
| `user_year_insights` | Own | Service | Service | Service | Service writes |
| `user_year_transit_aspects` | Own | Service | Service | Service | Service writes |

---

## SECURITY ANALYSIS

### CRITICAL: Service Role Only Tables

These tables are completely blocked from browser access:

1. **`soul_paths`** - Contains complete astrological data
   - Risk if exposed: User birth data leakage
   - Mitigation: RLS with NO policies

2. **`social_accounts`** - Contains OAuth tokens
   - Risk if exposed: Token theft, account hijacking
   - Mitigation: RLS blocks all access, tokens encrypted with AES-256-GCM

### HIGH: Sensitive Data in Profiles

The `profiles` table contains:
- Birth date/time/location (PII)
- Stripe customer/subscription IDs
- Email address

**Current Protection:**
- RLS restricts access to own profile
- Service role needed for cross-user queries

**Recommendation:** Consider column-level security for Stripe IDs.

### MEDIUM: Linked Profile Access

Space Between feature allows users to view each other's data when linked:
- `social_summaries` has cross-profile access policy
- Controlled by `is_space_between_unlocked` flag

**Current Protection:** Explicit unlock required per connection.

---

## INDEX AUDIT

### Well-Indexed Tables

| Table | Index Count | Primary Use Case |
|-------|-------------|------------------|
| `global_astrology_events` | 5 | Year lookups, type filters |
| `user_year_transit_aspects` | 3 | Temporal queries |
| `daily_briefs` | 2 | Connection + date lookup |

### Potentially Missing Indexes

| Table | Query Pattern | Suggested Index |
|-------|---------------|-----------------|
| `profiles` | Stripe customer lookup | `idx_profiles_stripe_customer_id` |
| `connections` | Linked profile lookup | `idx_connections_linked_profile_id` |
| `journal_entries` | Search by content | Consider full-text search index |

---

## MIGRATION HISTORY

| File | Purpose | Risk Level |
|------|---------|------------|
| 001 | Birth chart cache columns | LOW |
| 002 | Soul paths table | MEDIUM |
| 003 | Backfill soul paths | LOW |
| 004 | Soul path narrative caching | LOW |
| 005 | Performance indexes | LOW |
| 006 | Cleanup broken narratives | LOW |
| 007 | Connections V2 (briefs + space between) | MEDIUM |
| 008 | Mutual unlock for connections | LOW |
| 009 | Profile birth lookup index | LOW |
| 010 | Space between toggle | LOW |
| 011 | Social summaries table | MEDIUM |
| 013 | Social accounts vault | **HIGH** |
| 014 | Connections birth coords | LOW |
| 015 | Drop social_connections (cleanup) | LOW |
| 017 | Hibernate account | LOW |
| 018 | Meta data deletion compliance | LOW |
| 019 | Stripe email column | LOW |
| 020 | Global astrology events | LOW |
| 021 | User year insights | LOW |
| numerology | Numerology profiles | MEDIUM |

---

## RECOMMENDATIONS

### BLOCKER: None identified

### HIGH Priority

1. **Add Stripe customer index**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
   ON profiles(stripe_customer_id)
   WHERE stripe_customer_id IS NOT NULL;
   ```

2. **Add linked profile index**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_connections_linked_profile_id
   ON connections(linked_profile_id)
   WHERE linked_profile_id IS NOT NULL;
   ```

### MEDIUM Priority

1. **Consider audit logging** for sensitive operations:
   - Profile updates
   - Social token storage
   - Subscription changes

2. **Add EXPLAIN analysis** for slow queries (requires production monitoring)

3. **Document RLS bypass** scenarios for admin operations

---

## VERIFICATION QUERIES

Run these in Supabase SQL Editor to verify security:

```sql
-- Check all tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check all RLS policies
SELECT tablename, policyname, permissive, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify service-role-only tables have no user policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('soul_paths', 'social_accounts')
AND 'authenticated' = ANY(roles);
-- Should return 0 rows
```
