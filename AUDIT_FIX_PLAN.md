# Solara Insights Audit Fix Plan

Plan date: 2026-02-28
Source: `AUDIT_REPORT.md` findings `FR-01` .. `FR-20`
Mode: Recommendations only (no code changes applied in this audit)

## Priority Overview

### P0 (Ship-blocking)
- `FR-01` Typecheck entitlement contract mismatch
- `FR-02` Non-hermetic build (Google font fetch dependency)
- `FR-03` Missing CI gates
- `FR-13` Supabase migration drift risk
- `FR-14` SECURITY DEFINER/search_path hardening

### P1 (Stability + correctness)
- `FR-08` Env contract drift
- `FR-09` i18n catalog drift
- `FR-10` Validation inconsistency
- `FR-11` Error response inconsistency
- `FR-19` Large skipped/todo test surface
- `FR-16` DB naming churn (`charts` vs `astrology_library`)

### P2 (Hygiene + maintainability)
- `FR-04` Destructive prebuild cleanup
- `FR-05` Missing security toolchain in CI
- `FR-12` Monolithic file decomposition
- `FR-15` Duplicate SQL function definitions
- `FR-17` External route invocation registry
- `FR-18` Artifact cleanup
- `FR-20` Extraneous package cleanup
- `FR-06`/`FR-07` Secret hygiene + archive redaction workflow

## Recommended Next 7 Commits

1. **Fix entitlement typing + restore `tsc` green**
- Addresses: `FR-01`
- Actions:
  - Normalize profile query typing for membership fields.
  - Add guard/adapter for nullable profile reads before `isPremium`.
  - Ensure literal unions (`membership_plan`, `role`, `subscription_status`) are narrowed safely.
- Validation:
  - `./node_modules/.bin/tsc -p . --noEmit --incremental false`
  - `npm run lint`

2. **Make build hermetic (fonts)**
- Addresses: `FR-02`
- Actions:
  - Remove runtime dependency on downloading Google fonts during build.
  - Move to local/self-hosted font strategy.
- Validation:
  - `next build` in restricted/offline-like environment should succeed.

3. **Add CI workflow with required gates**
- Addresses: `FR-03`, `FR-19`
- Actions:
  - Add workflow for `typecheck`, `lint`, `test`, `build`.
  - Enforce required checks for merges.
  - Fail if skipped/todo test count grows above baseline.
- Validation:
  - Green CI run on main branch and PR.

4. **Stabilize env contract and startup checks**
- Addresses: `FR-08`
- Actions:
  - Update `.env.example` with all runtime-required vars.
  - Remove stale entries not used anymore.
  - Add startup assertion/report for missing critical vars.
- Validation:
  - Env parity script (example vs `process.env.*`) returns clean.

5. **Standardize API validation + error envelopes**
- Addresses: `FR-10`, `FR-11`
- Actions:
  - Adopt shared request validation utility across API routes.
  - Adopt single error payload schema helper across API routes.
- Validation:
  - Route-level tests confirm consistent 4xx/5xx payload shape.

6. **Supabase migration hardening pass**
- Addresses: `FR-13`, `FR-14`, `FR-15`, `FR-16`
- Actions:
  - Add canonical baseline + drift policy.
  - Patch/replace SECURITY DEFINER functions to explicit `SET search_path`.
  - Consolidate duplicate function definitions.
  - Add migration verification SQL checks to CI.
- Validation:
  - Migration verification scripts pass.
  - Security-definer lint check passes.

7. **Repo hygiene + operational guardrails**
- Addresses: `FR-04`, `FR-05`, `FR-17`, `FR-18`, `FR-20`, plus secret hygiene (`FR-06`, `FR-07`)
- Actions:
  - Replace destructive prebuild behavior with safer cache handling.
  - Add CI security jobs (`audit`, secret scan, SAST) with pinned tool versions.
  - Document external endpoint owners/schedulers and health checks.
  - Remove duplicate artifact files/dirs and enforce ignore rules.
  - Clean extraneous install state.
  - Establish secret rotation + archived-doc redaction policy.
- Validation:
  - Clean `git status` after fresh run.
  - Security and hygiene jobs green.

## Detailed Remediation Matrix

| Finding | Remediation | Owner Suggestion | Effort |
|---|---|---|---|
| FR-01 | Strongly type membership profile adapter and enforce null checks | API/Backend | S |
| FR-02 | Localize fonts and remove remote build-time fetches | Frontend/Platform | M |
| FR-03 | Add GitHub Actions with required branch protections | Platform | M |
| FR-04 | Remove destructive `prebuild` side effects from default dev workflow | Platform | S |
| FR-05 | Pin and run security/analysis tools in CI with network | Platform/Security | M |
| FR-06 | Rotate local secrets and enforce secret manager usage policy | Security/Ops | M |
| FR-07 | Review and redact archived docs for secret-like patterns | Security/Docs | S |
| FR-08 | Sync `.env.example` and runtime env references | Backend/Platform | S |
| FR-09 | Add i18n parity checker against `en.json` | Frontend/i18n | S |
| FR-10 | Expand shared request schema validation across routes | API/Backend | M |
| FR-11 | Standardize error response helper usage | API/Backend | M |
| FR-12 | Split monolithic pages/routes into feature modules | Frontend + API | L |
| FR-13 | Establish migration baseline + drift detection process | Backend/DB | L |
| FR-14 | Add explicit search_path to all SECURITY DEFINER functions | Backend/DB | M |
| FR-15 | Consolidate duplicate SQL function definitions | Backend/DB | M |
| FR-16 | Finalize canonical table naming and compatibility checks | Backend/DB | M |
| FR-17 | Maintain external endpoint registry + monitors | Platform/Ops | S |
| FR-18 | Remove stale artifacts and enforce ignore hygiene | Repo Maintainers | S |
| FR-19 | Convert critical skipped tests into required regression tests | QA/Backend | M |
| FR-20 | Clean install state and enforce lockfile parity in CI | Platform | S |

## Acceptance Criteria (Done Definition)
- `tsc`, `lint`, `test`, `build` are green in CI.
- CI workflow is mandatory for merges.
- Env template exactly matches runtime-required variables.
- i18n key parity check is green for all locales.
- Security-definer lint check is green for migrations.
- External routes have explicit runbook + owner + monitor.
- No duplicate artifact files in repo root/coverage.

## Sequencing Notes
- Do not attempt broad refactors before `P0` is complete.
- Keep DB migration hardening atomic and fully verified before app-level feature work.
- Handle secret rotation/redaction immediately if any archived tokens are confirmed real.
