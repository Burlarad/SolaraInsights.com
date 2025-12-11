## Entry 2025-12-11 — Codex Repo Onboarding

- Action type: READ-ONLY + DOC WRITING
- Files heavily inspected:
  - `package.json`, `next.config.js`, `tsconfig.json`
  - `SOLARA_STATUS_AUDIT.md`
  - `app/api/birth-chart/route.ts`, `lib/ephemeris/swissEngine.ts`, `app/(protected)/sanctuary/birth-chart/page.tsx`
  - `app/(protected)/sanctuary/page.tsx`, `app/(protected)/sanctuary/connections/page.tsx`
  - `app/(protected)/settings/page.tsx`, `providers/SettingsProvider.tsx`, `app/api/user/profile/route.ts`, `lib/location/resolveBirthLocation.ts`
  - Stripe/OpenAI wiring references (`app/api/stripe/*`, `lib/stripe/client.ts`)
- Docs updated/created:
  - `docs/SOLARA_ARCHITECTURE_MAP.md` (architecture overview, flows, external services)
  - `docs/SOLARA_AI_ACTIVITY_LOG.md` (this entry)
- No production code modified.

