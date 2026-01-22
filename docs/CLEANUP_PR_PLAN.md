# Audit Cleanup PR Plan

**Date:** 2026-01-15
**Purpose:** Consolidate audit sprawl into single canonical doc

---

## A. Audit Doc Sprawl Inventory

### Root Directory (to archive/delete)

| File | Date | Status | Action |
|------|------|--------|--------|
| `AUDIT_REPORT.md` | Jan 14 | Superseded | Archive |
| `COMPREHENSIVE_AUDIT.md` | Jan 14 | Superseded | Archive |
| `SOCIAL_AUDIT.md` | Jan 14 | Superseded | Archive |
| `SOCIAL_SYSTEMS_AUDIT.md` | Jan 15 | Superseded | Archive |
| `TESTING.md` | Dec 29 | Valid (not audit) | Keep |

### docs/ Folder (to archive/dedupe)

| File | Date | Status | Action |
|------|------|--------|--------|
| `docs/AUDIT_REPORT.md` | Jan 1 | Superseded | Archive |
| `docs/ARCHITECTURE_MAP.md` | Jan 1 | Duplicate of audit/ | Delete |
| `docs/DATA_FLOW_FLOWS.md` | Jan 1 | Duplicate of audit/ | Delete |
| `docs/CLEANUP_CHECKLIST.md` | Jan 1 | Duplicate of audit/ | Delete |
| `docs/TESTING_STRATEGY.md` | Jan 1 | Duplicate of audit/ | Delete |

### docs/audit/ Folder

| File | Status | Action |
|------|--------|--------|
| `docs/audit/AUDIT_REPORT.md` | Keep | Primary audit report |
| `docs/audit/ARCHITECTURE_MAP.md` | Keep | Reference |
| `docs/audit/DATA_FLOW_FLOWS.md` | Keep | Reference |
| `docs/audit/TESTING_STRATEGY.md` | Keep | Reference |
| `docs/audit/CLEANUP_CHECKLIST.md` | Keep | Reference |
| `docs/audit/BLOAT_PROOF.md` | Keep | Reference |
| `docs/audit/PERFORMANCE_PROFILE.md` | Keep | Reference |
| `docs/audit/SOURCE_OF_TRUTH_ENFORCEMENT.md` | Keep | Reference |
| `docs/audit/SECURITY_PROOF_APPENDIX.md` | Keep | Reference |

### audits/ Folder

| File | Status | Action |
|------|--------|--------|
| `audits/AUDIT_RUNBOOK.md` | Keep | Runbook reference |

---

## B. Commands to Execute

### Step 1: Archive root-level audit docs

```bash
cd /Users/aaronburlar/Desktop/Solara

# Move to archive with date prefix
mv AUDIT_REPORT.md docs/archive/2026-01-14_AUDIT_REPORT.md
mv COMPREHENSIVE_AUDIT.md docs/archive/2026-01-14_COMPREHENSIVE_AUDIT.md
mv SOCIAL_AUDIT.md docs/archive/2026-01-14_SOCIAL_AUDIT.md
mv SOCIAL_SYSTEMS_AUDIT.md docs/archive/2026-01-15_SOCIAL_SYSTEMS_AUDIT.md
```

### Step 2: Remove duplicates in docs/

```bash
# These are duplicates of docs/audit/ versions
rm docs/AUDIT_REPORT.md
rm docs/ARCHITECTURE_MAP.md
rm docs/DATA_FLOW_FLOWS.md
rm docs/CLEANUP_CHECKLIST.md
rm docs/TESTING_STRATEGY.md
```

### Step 3: Verify build still works

```bash
npm run build
npm run lint
```

### Step 4: Commit

```bash
git add -A
git commit -m "chore: consolidate audit docs into canonical structure

- Archive 4 root-level audit docs to docs/archive/
- Remove 5 duplicate docs (copies exist in docs/audit/)
- Add docs/AUDIT_SOCIAL_SYSTEMS_CANONICAL.md as single source of truth
- Add docs/CLEANUP_PR_PLAN.md for future reference

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## C. Code Artifact Cleanup (Future PR)

### Dead Routes (X/Twitter)

| File | Status | Recommendation |
|------|--------|----------------|
| `app/api/auth/login/x/route.ts` | Disabled | Keep (feature-flagged) |
| `app/api/auth/login/x/callback/route.ts` | Disabled | Keep (feature-flagged) |
| `app/api/auth/reauth/x/callback/route.ts` | Disabled | Keep (feature-flagged) |
| `lib/oauth/providers/x.ts` | Disabled | Keep (feature-flagged) |

**Recommendation:** Keep X routes - they're properly feature-flagged and ready for when X Basic tier is affordable.

### Unused Helpers (Reddit)

| File | Status | Recommendation |
|------|--------|----------------|
| `lib/oauth/providers/reddit.ts` | Unused | Keep (UI stub exists) |

**Recommendation:** Keep Reddit adapter - UI shows "Coming soon" which implies intent to enable.

### Summary

No code deletions recommended. All disabled code is:
- Properly feature-flagged
- Complete and ready to enable
- Low maintenance burden

---

## D. Audit Policy (Prevent Future Bloat)

Add to `docs/README.md` or `CONTRIBUTING.md`:

```markdown
## Audit Document Policy

### Canonical Locations
- **Social Systems:** `docs/AUDIT_SOCIAL_SYSTEMS_CANONICAL.md`
- **General Audit:** `docs/audit/AUDIT_REPORT.md`
- **Security:** `docs/SECURITY_THREAT_MODEL.md`
- **RLS/Grants:** `docs/RLS_GRANTS_AUDIT_REPORT.md`

### Rules
1. **One canonical doc per topic** - don't create new audit files
2. **Update in place** - modify existing docs, don't create new versions
3. **Archive old docs** - move superseded docs to `docs/archive/` with date prefix
4. **No root-level audits** - all audit docs live in `docs/` or `docs/audit/`

### Before Creating New Audit Doc
1. Check if topic is covered by existing canonical doc
2. If yes, update that doc instead
3. If no, create in `docs/` with clear naming
```

---

## E. Verification Checklist

After cleanup PR:

- [ ] No audit docs in repo root (except TESTING.md which is not an audit)
- [ ] `docs/AUDIT_SOCIAL_SYSTEMS_CANONICAL.md` exists
- [ ] `docs/archive/` contains dated old audits
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] No duplicate docs between `docs/` and `docs/audit/`

---

**End of Cleanup PR Plan**
