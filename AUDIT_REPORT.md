# Solara Insights Full Repo Audit (Read-Only)

Audit timestamp: 2026-02-28 22:36:42 EST (2026-03-01 03:36:42 UTC)
Workspace: `/Users/aaronburlar/Desktop/Solara`
Mode: Exhaustive read-only audit (no source edits, no commits, no destructive repo commands)

## Scope + Constraints
- Source code was not modified.
- Existing repo changes were preserved as-is.
- Commands that could mutate repo state were either run in safe dry-run mode or in `/tmp` isolation.
- Network access is restricted in this environment, which blocked several external security tools.

## 0) Setup Snapshot

### Environment
- OS: `Darwin 25.3.0 (arm64)`
- Node: `v20.19.6`
- Package manager: `npm 10.8.2`
- `.nvmrc`: present (`20`)
- `.node-version`: not present
- `packageManager` field in `package.json`: not set
- Repo model: single app (single root `package.json`, no pnpm/turbo/nx/lerna workspace files)

### Git snapshot
- Branch: `main`
- Commit: `f98ad4617104932045edcac8ac77d1f3670f0b65`
- Worktree: dirty before audit (pre-existing modified/untracked files detected)

### Setup commands run
- `git status --short --branch`
- `git rev-parse --abbrev-ref HEAD`
- `git rev-parse HEAD`
- `node -v`
- `npm -v`
- `ls`, `ls -a`

## 1) Repo X-Ray Map

### Folder-by-folder map (top-level)
- `app/`: Next.js App Router pages/layouts + API routes
- `components/`: UI and domain components (`auth`, `home`, `sanctuary`, `learn`, `layout`)
- `lib/`: core business/infrastructure modules (`auth`, `library`, `numerology`, `social`, `stripe`, `supabase`, `ai`, etc.)
- `providers/`, `contexts/`, `hooks/`: client app state/composition
- `messages/`: i18n message catalogs
- `supabase/`: migrations, verification SQL, rollback snippets, local CLI config
- `sql/`: additional SQL artifacts/manual scripts
- `__tests__/`: Vitest suites
- `docs/`, `audits/`: architecture, deployment, historical audit artifacts
- `scripts/`: minimal script surface (`run-prewarm-cron.sh`)

### App entry points
- Root layout: `app/layout.tsx`
- Segment layouts:
  - `app/(public)/layout.tsx`
  - `app/(auth)/layout.tsx`
  - `app/(protected)/layout.tsx`
- Middleware: `middleware.ts`
- Pages (App Router): 25 page entries detected (auth/public/protected/sanctuary/settings)
- API routes: 45 route handlers (`app/api/**/route.ts` + `app/auth/callback/route.ts`)
- Worker/cron style routes:
  - `app/api/cron/generate-global-events/route.ts`
  - `app/api/cron/prewarm-insights/route.ts`
  - `app/api/cron/social-sync/route.ts`
- Script entry points:
  - `scripts/run-prewarm-cron.sh`

### Core domains detected
- Auth: `app/(auth)/*`, `app/api/auth/*`, `app/auth/callback/*`, `lib/auth/*`
- Profiles: `app/api/user/profile/route.ts`, `providers/SettingsProvider.tsx`, `lib/library/profileSync.ts`
- Sanctuary: `app/(protected)/sanctuary/*`
- Library: `app/(protected)/sanctuary/library/page.tsx`, `app/api/*-library/*`, `lib/library/*`
- Astrology: `app/api/public-horoscope/route.ts`, `lib/ephemeris/*`, `lib/library/charts.ts`
- Numerology: `app/api/numerology/route.ts`, `app/api/numerology-library/route.ts`, `lib/numerology/*`
- Connections: `app/api/connections/route.ts`, `app/api/connection-brief/route.ts`, `app/api/connection-space-between/route.ts`
- Social insights: `app/api/social/*`, `app/api/user/social-insights/route.ts`, `lib/social/*`
- Billing/paywall: `app/api/stripe/*`, `lib/stripe/*`, `lib/entitlements/*`, `app/(auth)/join/page.tsx`

## 2) Exhaustive Build/Test/Type/Lint Audit

### Install step (safe mode)
- Lockfile present: `package-lock.json`
- Install validation run in safe mode: `npm ci --ignore-scripts --dry-run`
- Result: dry-run succeeded (no repo writes), would add/change platform packages if executed for real.

### Command results
| Command | Result | Notes |
|---|---|---|
| `./node_modules/.bin/tsc -p . --noEmit --incremental false` | **FAIL** | Type mismatch cluster in entitlement checks (`MembershipProfile` nullability/literal narrowing) |
| `npm run lint` | **PASS** | `eslint . --ext .ts,.tsx` clean |
| `npm test` | **PASS (partial scope)** | 104 passed; 242 todo/skipped tests |
| `npm run build` | **NOT RUN in repo** | Unsafe script chain: `prebuild` uses `rm -rf` |
| `next build` in `/tmp` isolated mirror | **FAIL** | Network dependency on Google Fonts (`ENOTFOUND fonts.googleapis.com`) |
| `npm run start` | **SKIPPED** | Build did not complete |

### Biggest error clusters
1. Type entitlement mismatch
   - Files: `app/api/connections/route.ts:180`, `app/api/public-tarot/route.ts:153`, `app/api/public-tarot/route.ts:390`
   - Proof: `TS2345` where nullable/string profile shape is passed to strict `MembershipProfile`.
2. Build hermeticity issue
   - File: `app/layout.tsx:2` (`next/font/google` imports `Inter`, `Crimson_Pro`, `Tangerine`)
   - Proof: `next build` failed fetching `fonts.googleapis.com`.

### Ship blockers
- Typecheck currently failing.
- No CI gates to enforce type/lint/test/build before deploy.
- Build depends on external font network fetch (non-hermetic build surface).

## 3) Dependency + Security Audit

### Commands run
- `npm audit --json` -> failed: `ENOTFOUND registry.npmjs.org`
- `npm audit --offline --json` -> succeeded: `0` vulns reported (offline DB limitations apply)
- `npx license-checker --summary` -> blocked by network / not installed locally
- `npx gitleaks detect ...` -> blocked by network / not installed locally
- `npx semgrep --config=auto` -> blocked by network / not installed locally
- Local fallback checks:
  - package-lock license summary extraction
  - regex secret scan of tracked files

### Vulnerabilities (ranked)
- High: `unknown` (online advisory DB unreachable)
- Medium: `unknown` (online advisory DB unreachable)
- Low: `unknown` (online advisory DB unreachable)
- Offline npm audit result: no advisories found in local cache snapshot.

### License summary (from `package-lock.json` metadata)
- `MIT`: 642
- `ISC`: 81
- `Apache-2.0`: 39
- `BSD-2-Clause`: 15
- `BSD-3-Clause`: 10
- `LGPL-3.0-or-later`: 10
- Missing license entries: 2

### Secret-like strings found
- Tracked files:
  - `.env.example` contains placeholders for secret-bearing vars (expected)
  - `docs/archive/2026-01-14_SOCIAL_AUDIT.md` contains service-role-like token patterns (appears redacted with ellipsis in many places, still risky in archives)
- Untracked local files:
  - `.env`, `.env.local` contain live-looking credential values (OpenAI/Stripe/Supabase/etc.). These files are gitignored but present in workspace.

### High-risk package/dependency notes
- `npm ls --depth=0` reports extraneous `@emnapi/runtime@1.8.1` in local install state.
- No online freshness/abandonment check possible due network restrictions.

## 4) Ghost Code / Artifact Hunt

### Preferred tool availability
| Tool | Status |
|---|---|
| `knip` | unavailable locally; `npx` blocked by network |
| `depcheck` | unavailable locally; `npx` blocked by network |
| `ts-prune` | unavailable locally; `npx` blocked by network |
| `madge` | unavailable locally; `npx` blocked by network |

### TODO/FIXME/HACK/XXX (production code)
- `app/(auth)/sign-in/page.tsx:202` (Reddit stub TODO)
- `lib/social/fetchers.ts:97` (TikTok profile/stats TODO)
- `lib/oauth/providers/tiktok.ts:18` (same TODO duplicated)

### Ghost files/artifacts
| Artifact | Evidence |
|---|---|
| `package-lock 2.json` | duplicate lockfile-like artifact at repo root |
| `coverage/app 2`, `coverage/lib 3` | duplicate coverage directories with suffixes |
| `app/api/birth-chart/` (empty dir) | directory exists, no route file |

### Unused deps (heuristic static import scan, low confidence)
- Candidate runtime deps: `@types/suncalc`, `autoprefixer`, `postcss`, `react-dom`
- Candidate dev deps: `@types/node`, `@types/react`, `@types/react-dom`, `@types/tz-lookup`, `@vitest/coverage-v8`, `@vitest/ui`, `eslint`, `eslint-config-next`, `jsdom`, `typescript`
- Note: this heuristic under-reports config-driven/tooling usage; treat as triage list, not final truth.

### Orphan routes (0 internal references in app/lib/components/providers/hooks/contexts/scripts)
| Route | Internal refs | Likely status |
|---|---:|---|
| `/api/auth/reauth/tiktok/callback` | 0 | External OAuth callback |
| `/api/auth/reauth/x/callback` | 0 | External OAuth callback |
| `/api/cron/generate-global-events` | 0 | External cron/scheduler route |
| `/api/cron/social-sync` | 0 | External cron/scheduler route |
| `/api/health` | 0 | External health probe |
| `/api/meta/facebook/data-deletion` | 0 | External Meta webhook |
| `/api/meta/facebook/deauthorize` | 0 | External Meta webhook |
| `/api/stripe/checkout` | 0 | Stripe flow may route via server redirect path |
| `/api/stripe/webhook` | 0 | External Stripe webhook |

### Unused env vars (from `.env.example` vs `process.env.*` refs)
- Declared but not referenced in code (10):
  - `AUTH_SECRET`, `META_APP_ID`, `NEXTAUTH_URL`, `NEXT_SUPABASE_DB_URL`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `X_CLIENT_ID`, `X_CLIENT_SECRET`
- Referenced in code but missing from `.env.example` (20):
  - `DEBUG_MIDDLEWARE`, `DEV_PAYWALL_BYPASS`, `NEXT_PHASE`, `NEXT_PUBLIC_SOLARA_DEBUG`, `NEXT_PUBLIC_SOLARA_DEBUG_BUILD`, `NODE_ENV`, `OAUTH_DEBUG_LOGS`, `OPENAI_BIRTHCHART_MODEL`, `OPENAI_BUDGET_FAIL_MODE`, `OPENAI_CONNECTION_BRIEF_MODEL`, `OPENAI_DAILY_BUDGET_USD`, `OPENAI_DAILY_INSIGHTS_MODEL`, `OPENAI_DEEP_MODEL`, `OPENAI_FAST_MODEL`, `OPENAI_HOROSCOPE_MODEL`, `OPENAI_PLACEMENTS_MODEL`, `OPENAI_YEARLY_INSIGHTS_MODEL`, `RESEND_FROM_NAME`, `TOKEN_AUDIT_ENABLED`, `VALKEY_URL`

### Duplicated implementations
- SQL function duplication count (migration history):
  - `public.update_numerology_access` appears 3 times
  - `public.set_updated_at` appears 2 times
  - `public.update_social_accounts_updated_at` appears 2 times
  - `public.update_social_identities_updated_at` appears 2 times
  - `public.maintain_mutual_flag` appears 2 times
- TikTok scope TODO duplicated in two code paths:
  - `lib/social/fetchers.ts:97`
  - `lib/oauth/providers/tiktok.ts:18`

## 5) Pipeline Sanity Audit (CI/CD + deploy)

### Findings
- `.github/workflows` directory not present.
- No checked-in pipeline config (`render.yaml`, `Dockerfile`, `vercel.json`, `netlify.toml` absent at root scan).
- Deployment process appears manual via Render dashboard docs (`docs/RENDER_DEPLOYMENT.md`).

### Pipeline diagram (in words)
1. Developer runs local scripts (`lint`, `test`, `build`) manually.
2. Deployment configuration/secrets managed in Render dashboard.
3. Webhooks and OAuth callback endpoints configured manually in external providers.
4. No repository-enforced CI gate currently validates branch merges.

### Broken/pointless workflows
- None found (no workflows exist).

### Missing gates
- Required PR checks (typecheck/lint/test/build).
- Security scanning gate (audit/gitleaks/semgrep equivalents).
- Migration verification gate (schema drift checks).

## 6) Supabase Audit (Schema, migrations, RLS, triggers)

### Inventory
- `supabase/migrations/*.sql`: 48 files
- `_placeholders` remote placeholders: 20 files
- `supabase/verification/*.sql`: 2 files
- `supabase/functions/*`: none present

### Migration order + drift signals
- Local migration snapshot (`local_migrations.txt`) only lists:
  - `20241215_public_compatibility.sql`
  - `20241221_social_insights_toggle.sql`
  - `20250101_numerology_schema.sql`
- Repo migration set extends to `20260228000000_free_tier_entitlements.sql`.
- Presence of both `remote_schema` and `remote_commit` style migrations plus placeholders indicates heavy reconciliation history and potential drift risk.

### RLS / SECURITY DEFINER / search_path checks
- Multiple `SECURITY DEFINER` functions exist.
- Some include explicit `SET search_path` (good pattern; e.g., in `20260106140000_reconcile_public_schema_from_prod.sql`, `20260114160000_enhance_ai_usage_tracking.sql`).
- Some recent functions do **not** set `search_path` (risk):
  - `20260216142511_recreate_numerology_library.sql:126-136`
  - `20260125000000_library_book_model.sql:202-224`
  - `20260217000000_fix_numerology_library_schema.sql:207-216`
  - `20260114170000_ai_usage_cost_micros.sql:488-551`

### Table usage alignment (create table vs app `.from(...)`)
- Created but not referenced by app queries (selected): `ai_invocations`, `analytics_events`, `birth_charts`, `birth_data_versions`, `gratitude_stats`, `journal_entries`, `soul_paths`, `subscriptions`, `user_year_*`, etc.
- Referenced by app but not directly created in current create-table scan: `astrology_library` (renamed from `charts` by migration).

### DB/RLS risk list (ranked)
1. Migration drift + placeholder reliance (`High`)
2. SECURITY DEFINER without explicit search_path in recent functions (`High`)
3. Repeated function/policy churn across migrations (`Med`)
4. Table naming transition complexity (`charts` -> `astrology_library`) (`Med`)
5. Large legacy surface appears unused from app query paths (`Med`)

### Migration health score
- **4.5 / 10**
- Rationale: broad migration coverage and some explicit RLS hardening exist, but drift indicators, placeholder history, duplicated definitions, and security-definer inconsistencies materially reduce confidence.

### Immediate remediation suggestions (no changes applied)
- Create a canonical schema baseline migration after reconciliation.
- Add automated migration verification in CI (`db diff` + policy checks).
- Normalize all SECURITY DEFINER functions to explicit locked `search_path`.
- Prune/archive obsolete tables/policies only after proven no runtime references.

## 7) Cohesion + Alignment Audit

### Cohesion scorecard (0-10)
| Dimension | Score | Evidence |
|---|---:|---|
| Naming consistency | 6 | Ongoing rename churn (`official_chart_key` -> `official_astrology_key`, `charts` -> `astrology_library`) |
| Folder structure coherence | 8 | Clear domain folders under `app/` + `lib/` |
| Business logic placement | 5 | Very large API/page files hold mixed concerns (`app/api/insights/route.ts`, sanctuary pages) |
| DB access consistency | 7 | Standardized Supabase client factories used broadly |
| Validation consistency | 4 | Central `validateRequest` used in only a few routes |
| Error handling consistency | 4 | Central error helper mostly used only by insights route |
| i18n consistency | 5 | `zh.json` key deficit, `zh-TW` extras |
| **Overall cohesion** | **5.6** | Functional but fragmented at boundaries and contracts |

### Circular deps + cross-domain tangles
- Circular import check: `eslint --rule 'import/no-cycle:error' app lib` returned clean (no cycle errors).
- Cross-domain tangles observed in large composite files coupling UI, API contracts, and domain logic.

### Top 10 alignment breaks (ranked)
1. Type contract mismatch in entitlement checks (`app/api/connections/route.ts`, `app/api/public-tarot/route.ts`)
2. Non-hermetic build dependency on Google Fonts (`app/layout.tsx`)
3. No CI workflow/gates (`.github/workflows` absent)
4. Env contract drift (`.env.example` vs runtime refs)
5. Validation strategy split across routes
6. Error payload shape inconsistency across APIs
7. Migration drift and placeholder-heavy DB history
8. SECURITY DEFINER/search_path inconsistency
9. i18n catalog drift (`zh`/`zh-TW`)
10. Artifact noise in repo (`package-lock 2.json`, duplicate coverage dirs)

## 8) Progress Toward Completion (Reality Check)

### Feature completion matrix
| Feature Area | Status | Evidence |
|---|---|---|
| Auth (email + OAuth flows) | ✅ shipped | auth routes/pages + callback flows present |
| Profile/settings management | ✅ shipped | `app/api/user/profile/route.ts`, `settings/page.tsx` |
| Sanctuary insights core | 🟡 partial | Insights route exists, but type/build/pipeline quality gaps remain |
| Astrology library books | ✅ shipped | `birth-chart-library` route + `lib/library/charts.ts` |
| Numerology library books | ✅ shipped | `numerology-library` route + `lib/library/numerology.ts` |
| Connections + briefs + space-between | 🟡 partial | endpoints present; entitlement/type issues and large-file coupling |
| Social insights | 🟡 partial | provider framework exists, Instagram/Reddit marked coming soon |
| Billing/paywall | 🟡 partial | Stripe routes present; gating recently modified, CI absent |
| i18n coverage parity | 🔴 missing/broken | `zh.json` missing 135 keys |
| CI/CD automation | 🔴 missing/broken | no workflow definitions |
| Legacy/unused surfaces | 🧟 exists but unused | multiple external-only/zero-ref routes + old DB surfaces |

### Top blockers
- Typecheck failures in membership entitlement calls.
- Missing CI quality gate.
- Build fragility due network font fetch.
- DB migration drift confidence gap.

### Top time-wasters
- Recurrent migration reconciliation churn (`remote_schema`, placeholders, duplicated function definitions).
- Large monolithic files slowing focused changes/reviews.
- Env variable contract mismatch causing setup/debug friction.

### Recommended next 7 commits roadmap (recommendations only)
1. Fix `MembershipProfile` type contract and restore clean `tsc`.
2. Make build hermetic (self-host or local fallback fonts) and remove external font hard dependency.
3. Add CI workflow with required checks: typecheck, lint, test, build.
4. Standardize API request validation (shared helper across private routes).
5. Standardize API error envelope via central helper.
6. Add migration integrity job (drift check + security definer/search_path lint).
7. Clean artifact noise + env contract docs (`.env.example` parity, duplicate lock/coverage cleanup).

## 9) Finding Register (Strict Format)

| ID | Location | Evidence | Impact | Recommendation | Confidence |
|---|---|---|---|---|---|
| FR-01 | `app/api/connections/route.ts:180`; `app/api/public-tarot/route.ts:43`; `app/api/public-tarot/route.ts:153`; `app/api/public-tarot/route.ts:390`; `lib/entitlements/canAccessFeature.ts:43` | `tsc` emits `TS2345` when nullable/string profile object is passed into strict `MembershipProfile` | High | Align profile selection/typing with `Profile` literals and nullable guards before calling `isPremium` | High |
| FR-02 | `app/layout.tsx:2-26` | Isolated `next build` failed with `ENOTFOUND fonts.googleapis.com` for `Inter`, `Crimson Pro`, `Tangerine` | High | Replace remote Google font fetch dependency with self-hosted/local strategy to keep builds deterministic | High |
| FR-03 | `.github/workflows` (missing); `docs/RENDER_DEPLOYMENT.md` | No repo CI workflows found; deploy appears manual via dashboard process | High | Add branch-gated CI workflow and required checks before deploy | High |
| FR-04 | `package.json` (`prebuild`) | `prebuild` runs `rm -rf .next/cache node_modules/.cache` | Med | Replace destructive prebuild cleanup with safer controlled cache strategy and isolate cleanup in CI-only context | High |
| FR-05 | Security tool commands (`npm audit`, `npx license-checker/gitleaks/semgrep/knip/depcheck/ts-prune/madge`) | Multiple `ENOTFOUND registry.npmjs.org`; tools unavailable locally | Med | Add pinned security/analysis tooling in CI environment with network access and fail thresholds | High |
| FR-06 | `.env`, `.env.local` | Live-looking secrets present locally (OpenAI/Stripe/Supabase/etc.) | High | Rotate any exposed secrets, use external secret manager, keep local secrets ephemeral and access-controlled | High |
| FR-07 | `docs/archive/2026-01-14_SOCIAL_AUDIT.md` and related archived docs | Regex scan found service-role-style key fragments/patterns in docs | Med | Redact historical docs and purge sensitive history if any full secrets were ever committed | Med |
| FR-08 | `.env.example` + runtime refs across `app/`, `lib/`, `middleware.ts` | 10 declared vars unused; 20 referenced vars missing from `.env.example` | Med | Treat env vars as versioned contract; sync template with runtime and add startup validation | High |
| FR-09 | `messages/zh.json`; `messages/zh-TW.json` | Key parity script: `zh` missing 135 keys; `zh-TW` has 11 extras | Med | Add i18n parity check in CI and normalize catalogs against `en.json` | High |
| FR-10 | `app/api/**` | `validateRequest(...)` used only in 3 public routes | Med | Apply shared request validation pattern to private/protected API routes | High |
| FR-11 | `lib/api/errorResponse.ts`; `app/api/insights/route.ts`; most other routes | Central error helper used primarily in insights route; others ad-hoc `NextResponse.json({error...})` | Med | Standardize API error schema and helper across all routes | High |
| FR-12 | `app/(protected)/sanctuary/library/page.tsx` (2129 lines); `app/(protected)/settings/page.tsx` (1759); `app/(protected)/sanctuary/connections/page.tsx` (1293); `app/api/insights/route.ts` (770) | `wc -l` indicates high concentration/complexity in single files | Med | Decompose by feature boundaries and isolate side effects/business logic | High |
| FR-13 | `local_migrations.txt`; `remote_migrations.txt`; `supabase/migrations/_placeholders/*`; `supabase/migrations/20260126030132_remote_schema.sql` | Local migration list very short vs 48 migration files + 20 placeholders | High | Re-baseline schema, formalize migration ordering and drift checks, reduce placeholder reliance | High |
| FR-14 | `supabase/migrations/20260216142511_recreate_numerology_library.sql:126-136`; `20260125000000_library_book_model.sql:202-224`; `20260217000000_fix_numerology_library_schema.sql:207-216`; `20260114170000_ai_usage_cost_micros.sql:488-551` | SECURITY DEFINER functions without explicit `SET search_path` in several recent migrations | High | Enforce explicit `search_path` for all SECURITY DEFINER functions and lint for this pattern | High |
| FR-15 | Multiple migration files (`create function` duplicates) | `public.update_numerology_access` appears 3x; several others repeated | Med | Consolidate duplicate function definitions with idempotent canonical migration strategy | High |
| FR-16 | `supabase/migrations/20260125000000_library_book_model.sql`; `20260209000000_unified_library_system.sql`; `20260126030132_remote_schema.sql`; `lib/library/charts.ts` | Rename/drop/recreate churn around `charts` vs `astrology_library` | Med | Freeze canonical naming, verify backward compatibility via explicit migration assertions/tests | Med |
| FR-17 | External route surfaces: `/api/cron/*`, `/api/health`, `/api/stripe/webhook`, OAuth/meta callbacks | Internal-ref scan shows zero callers for multiple endpoints | Med | Maintain explicit external invocation registry + monitors for all externally-triggered routes | Med |
| FR-18 | `package-lock 2.json`; `coverage/app 2`; `coverage/lib 3`; `app/api/birth-chart/` | Artifact scans found duplicate/noisy files and empty API folder | Low | Remove stale artifacts and enforce `.gitignore`/cleanup discipline | High |
| FR-19 | Test output (`vitest`) | 104 passed, 242 todo/skipped across 10 skipped test files | Med | Convert highest-risk skipped suites into active gating tests | High |
| FR-20 | `npm ls --depth=0` | `@emnapi/runtime@1.8.1` flagged as extraneous | Low | Perform clean install/prune in controlled environment and verify lockfile/install parity | High |

## Appendix: Command Status Summary
- Requested read-only diagnostics were executed where safe.
- Build executed in isolated `/tmp` mirror to avoid repo mutation.
- Network-blocked commands were captured with exact failure evidence and documented.
