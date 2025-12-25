# SOLARA CLEANUP TODO

**Generated:** 2025-12-24
**Based on:** AUDIT_REPORT.md

---

## Phase 0: Baseline & Safety

### Prerequisites

- [ ] Ensure clean git state: `git status` shows no uncommitted changes
- [ ] Create cleanup branch: `git checkout -b cleanup/2024-12-audit`
- [ ] Run baseline build: `npm run build`
- [ ] Document current build time for comparison

### Snapshot Commands

```bash
# Save current file counts
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l > /tmp/solara_ts_count_before.txt
wc -l $(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules) | tail -1 > /tmp/solara_lines_before.txt

# Save current package size
du -sh node_modules > /tmp/solara_node_modules_before.txt
```

### STOP SIGNS for Phase 0

- `npm run build` fails = DO NOT PROCEED
- Git has uncommitted changes = COMMIT OR STASH FIRST

---

## Phase 1: Safe Deletes

### 1.1 Delete Dead Files

- [ ] Delete `lib/social.ts`
  ```bash
  rm lib/social.ts
  npm run build  # Must pass
  ```

- [ ] Delete empty `public/images/` directory
  ```bash
  rmdir public/images/
  ```

### 1.2 Verification

- [ ] `npm run build` passes
- [ ] `rg "from \"@/lib/social\"" app lib` returns 0 results

### STOP SIGNS for Phase 1

- Build fails after any deletion = `git checkout -- <file>` to restore
- Any import errors in build output = investigate before proceeding

---

## Phase 2: Quarantine & Consolidate

### 2.1 Create Graveyard Directory

```bash
mkdir -p graveyard/audits
```

### 2.2 Move Stale Audit Files

- [ ] Review each file for relevance
- [ ] Move completed/stale audits:
  ```bash
  # Example - review each first!
  mv PRACTICE_REMOVAL_AUDIT.md graveyard/audits/
  mv TODAY_AUDIT.md graveyard/audits/
  # Add others as reviewed
  ```

### 2.3 Add TikTok Files to .gitignore (or delete if verified)

- [ ] Confirm TikTok OAuth working in production
- [ ] Either delete or add to .gitignore:
  ```bash
  # Option A: Delete
  rm -rf public/api/social/oauth/tiktok/*.txt
  rm -rf public/api/social/oauth/tiktok/callback/*.txt

  # Option B: Add to .gitignore
  echo "public/api/social/oauth/tiktok/*.txt" >> .gitignore
  ```

### 2.4 Consolidate Cache Implementations

- [ ] Review imports of `lib/cache.ts`:
  ```bash
  rg "from \"@/lib/cache\"" --type ts
  ```

- [ ] Move period key functions to `lib/cache/redis.ts` or `lib/timezone/periodKeys.ts`

- [ ] Update all imports from `@/lib/cache` to `@/lib/cache/redis` or `@/lib/cache/periodKeys`

- [ ] Delete `lib/cache.ts` after all imports updated

- [ ] Verify: `npm run build`

### 2.5 Verification

- [ ] `npm run build` passes
- [ ] All moved files tracked in `graveyard/GRAVEYARD_README.md`

### STOP SIGNS for Phase 2

- Build fails = restore from git, investigate
- Missing imports = update import paths before deleting

---

## Phase 3: Refactors

### 3.1 "Coming Soon" Button Cleanup

**Files:**
- `app/(auth)/sign-in/page.tsx`
- `app/(auth)/welcome/page.tsx`

**Action:** Remove X/Reddit buttons or use `isProviderEnabled()` to conditionally render

- [ ] Edit files to hide disabled provider buttons
- [ ] Remove error toast handlers for disabled providers
- [ ] Verify: `npm run build`
- [ ] Manual test: Sign-in page shows only enabled providers

### 3.2 Extract Settings Page Components (OPTIONAL - Large Change)

**Skip if time-constrained. Lower priority.**

- [ ] Create `components/settings/ProfileForm.tsx`
- [ ] Create `components/settings/SocialConnectionsSection.tsx`
- [ ] Create `components/settings/DangerZoneSection.tsx`
- [ ] Update `app/(protected)/settings/page.tsx` to use new components
- [ ] Verify page under 400 lines
- [ ] `npm run build`
- [ ] Manual test all settings functionality

### 3.3 Extract Connections Page Components (OPTIONAL - Large Change)

**Skip if time-constrained. Lower priority.**

- [ ] Create `components/sanctuary/connections/ConnectionsList.tsx`
- [ ] Create `components/sanctuary/connections/ConnectionForm.tsx`
- [ ] Update page to use components
- [ ] Verify page under 300 lines
- [ ] `npm run build`
- [ ] Manual test connections CRUD

### STOP SIGNS for Phase 3

- Build fails = restore from git
- UI regressions = restore and investigate
- Any payment/auth flow broken = STOP IMMEDIATELY

---

## Phase 4: Optional Polish

### 4.1 Document Missing Migrations

- [ ] Add comment to `sql/` explaining why 012, 016 are missing (if intentional)
- [ ] Or create placeholder files:
  ```bash
  echo "-- Placeholder: Migration 012 was skipped/consolidated" > sql/012_placeholder.sql
  echo "-- Placeholder: Migration 016 was skipped/consolidated" > sql/016_placeholder.sql
  ```

### 4.2 Organize Audit Files

- [ ] Move remaining audit files to `docs/audits/`
- [ ] Update any internal references

### 4.3 Update Type Deprecation Comments

- [ ] Add removal timeline to deprecated types:
  ```typescript
  /**
   * @deprecated Use TabDeepDive instead. Will be removed in v2.0.
   */
  ```

### 4.4 Final Verification

```bash
# Build check
npm run build

# Lint check
npm run lint

# File count comparison
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l
# Compare to /tmp/solara_ts_count_before.txt

# Lines comparison
wc -l $(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules) | tail -1
# Compare to /tmp/solara_lines_before.txt
```

### STOP SIGNS for Phase 4

- Any test failures = investigate before merge
- Build time significantly increased = investigate

---

## Commit Strategy

### Recommended Commits

1. `chore: delete unused lib/social.ts`
2. `chore: remove empty public/images directory`
3. `chore: move stale audits to graveyard/`
4. `chore: consolidate cache implementations`
5. `feat: hide disabled social providers in auth pages`
6. `refactor: extract settings page components` (if done)
7. `refactor: extract connections page components` (if done)
8. `docs: organize audit files and add graveyard readme`

### PR Template

```markdown
## Cleanup PR - 2024-12 Audit

### Changes
- Deleted unused `lib/social.ts`
- Removed empty `public/images/` directory
- Moved stale audit files to `graveyard/`
- Consolidated cache implementations
- Hid disabled social provider buttons

### Verification
- [ ] `npm run build` passes
- [ ] Manual smoke test of auth flows
- [ ] Manual smoke test of social OAuth
- [ ] Manual smoke test of settings page

### Not Changed (Intentionally)
- Auth callback routes
- Stripe webhook/checkout
- Database migrations
- Protected layout gates
```

---

## Rollback Procedures

### If Build Fails After Deletion

```bash
git checkout -- <deleted-file>
npm run build
```

### If Feature Breaks After Refactor

```bash
git checkout -- <refactored-files>
# Or revert entire commit
git revert HEAD
```

### If Production Issues Detected

1. Immediately revert PR
2. Deploy previous version
3. Investigate in development
4. Re-apply fixes incrementally

---

## Success Metrics

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| TS/TSX file count | ~100 | ~95 | |
| Total lines of code | ~31000 | ~30000 | |
| Root markdown files | 25 | 5-10 | |
| Build time | | Same or faster | |
| Build errors | 0 | 0 | |

---

*End of CLEANUP_TODO.md*
