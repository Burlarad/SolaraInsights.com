# Solara Architecture Map

## 1) Repo Overview
- **Framework**: Next.js 15 (App Router) + React 18 + TypeScript, Tailwind CSS.
- **Purpose**: Premium astrology product with personalized Sanctuary (insights, birth chart, connections), profile/settings, billing, journaling, and public marketing pages.
- **Key Services**: Supabase (auth + Postgres), Stripe (subscriptions), OpenAI (insights/birth chart narratives), Swiss Ephemeris (`swisseph`), Resend (email, mostly stub), Redis (caching hooks in Insights), OpenStreetMap Nominatim + `tz-lookup` (geocoding/timezone).

## 2) Directory Map (major folders)
- `app/`: Next.js App Router pages and API routes.
  - `(auth)/`: sign-in/up, onboarding, join/checkout.
  - `(protected)/`: gated areas (Sanctuary, settings, billing).
  - `(public)/`: marketing pages (about, learn).
  - `api/`: server routes for birth chart, insights, connections, journal, stripe, profile, public horoscopes, etc.
- `components/`: UI primitives and sanctuary-specific components.
- `lib/`: services and domain logic (ephemeris, stripe, supabase, tarot, runes, location, birthChart storage).
- `providers/`: React context (e.g., `SettingsProvider` for profile state).
- `types/`: shared TypeScript types (Profile, insights payloads, etc.).
- `docs/`: architecture + activity notes (this document, AI log).

## 3) Core Flows

### Logged-in user → Sanctuary
- Layout guard: `app/(protected)/layout.tsx` checks auth/subscription before rendering tabs.
- Main landing for signed-in users: `app/(protected)/sanctuary/page.tsx` fetches `/api/insights` (per timeframe) and renders cards, journal, tarot/rune, Lucky Compass. Tabs (`components/sanctuary/SanctuaryTabs`) link to Birth Chart and Connections.
- Profile context: `providers/SettingsProvider.tsx` loads profile from Supabase and supplies `profile`, `saveProfile`, `refreshProfile` to client pages.

### Birth chart generation end-to-end
- **Profile storage**: Supabase `profiles` table. Settings UI (`app/(protected)/settings/page.tsx`) edits identity + birth data and calls `/api/user/profile` to persist.
- **Location/timezone resolution**: `lib/location/resolveBirthLocation.ts` (Nominatim fetch → lat/lon, `tz-lookup` → timezone). Called server-side in `/api/user/profile`.
- **Placements compute**: `lib/ephemeris/swissEngine.ts`
  - Converts local datetime → Julian Day.
  - Calls `swe_houses` (Placidus) and `swe_calc_ut` for planets.
  - Builds `SwissPlacements` { system, planets [{ name, sign, house }], houses [{ house, signOnCusp }], angles }.
  - Planet house determined from cusp longitudes.
- **Storage/cache helper**: `lib/birthChart/storage.ts` tries to load/store placements on the profile (note: Supabase schema in this environment lacks `birth_chart_*` columns; logging shows compute still runs).
- **API route**: `app/api/birth-chart/route.ts`
  - Authenticates via Supabase cookie.
  - Validates profile birth fields.
  - Calls `getOrComputeBirthChart` → placements.
  - Builds AI payload and calls OpenAI for narrative (model from env).
  - Returns `{ placements, insight }` (insight may be null on failures).
- **UI**: `app/(protected)/sanctuary/birth-chart/page.tsx`
  - Client fetch to `/api/birth-chart`.
  - Renders Big 3, narrative sections, and sidebar lists of planets + houses (uses placements directly from API).

### Horoscopes / Insights
- Personalized insights: `app/api/insights/route.ts` (uses profile + AI, caches per timeframe/language; includes tarot/rune/lucky numbers). UI at `app/(protected)/sanctuary/page.tsx`.
- Public horoscopes: `app/api/public-horoscope/route.ts` (by sun sign, cached).

### Connections (relationships)
- API: `app/api/connections/route.ts` (CRUD) and `app/api/connection-insight/route.ts` (AI interpretation).
- UI: `app/(protected)/sanctuary/connections/page.tsx`.

### Settings & identity
- UI: `app/(protected)/settings/page.tsx`.
- Profile API: `app/api/user/profile/route.ts` (handles geocoding, zodiac sign, birth chart recompute on changes).
- Provider: `providers/SettingsProvider.tsx` for client access.

### Payments / plans
- Stripe client: `lib/stripe/client.ts`.
- Checkout API: `app/api/stripe/checkout/route.ts` (creates sessions for Individual/Family).
- Webhook: `app/api/stripe/webhook/route.ts` (updates subscription fields on profiles).
- Join page: `app/(auth)/join/page.tsx`.

## 4) External Services Wiring (where)
- **Supabase**: `lib/supabase/server.ts` (server client via cookies), `lib/supabase/client.ts` (browser). Used across API routes and `SettingsProvider`.
- **OpenAI**: `lib/openai/client.ts` (models in env). Called by `/api/birth-chart`, `/api/insights`, `/api/connection-insight`, `/api/public-horoscope`.
- **Swiss Ephemeris**: `lib/ephemeris/swissEngine.ts`; webpack externals set in `next.config.js` to avoid bundling native module.
- **Stripe**: `lib/stripe/client.ts`, `/api/stripe/checkout`, `/api/stripe/webhook`, join page.
- **Geocoding/timezone**: `lib/location/resolveBirthLocation.ts` (Nominatim + `tz-lookup`), used in `/api/user/profile`.
- **Email (Resend)**: `lib/resend/client.ts` exists; flows not wired into UI.
- **Redis**: `lib/redis.ts` (used in insights caching).

## 5) Known Status Notes (from SOLARA_STATUS_AUDIT.md)
- ✅ Implemented: Auth/onboarding, birth chart pipeline (compute + AI), daily insights, public horoscopes, connections CRUD + insights, journal CRUD/export, profile/settings, Stripe checkout/webhook, language toggle.
- 🟡 Partial: Social login wiring to insights, tarot/rune standalone experiences.
- 🟥 Stubbed: Email flows (Resend), charity location fields, dedicated synastry visualization.
- ⚠️ Infra note: Current Supabase schema in this environment lacks `birth_chart_placements_json` / `birth_chart_computed_at`, so birth chart API computes on the fly and fails to persist; logging still shows placements for debugging.

