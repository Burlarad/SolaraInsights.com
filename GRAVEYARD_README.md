# GRAVEYARD README

> **Purpose:** Archive for deprecated code, stale documentation, and superseded implementations.
> **Created:** 2025-12-24
> **Based on:** AUDIT_REPORT.md

---

## Directory Structure

```
graveyard/
├── README.md              # This file (moved to graveyard root after creation)
├── audits/                # Stale audit/planning documents
├── code/                  # Deprecated code files
└── migrations/            # Superseded migration references
```

---

## What Gets Moved Here

### 1. Stale Audit Documents

| File | Moved From | Reason | Retention |
|------|------------|--------|-----------|
| `PRACTICE_REMOVAL_AUDIT.md` | `/` | Practice feature fully removed | 90 days |
| `TODAY_AUDIT.md` | `/` | One-time audit, actions completed | 90 days |
| `NEXT_ACTIONS.md` | `/` | References deleted `/connect-social` | 90 days |
| `FEATURE_PROGRESS_MATRIX.md` | `/` | Outdated feature tracking | 90 days |
| `REPO_AUDIT.md` | `/` | Superseded by newer audits | 90 days |
| `SOLARA_STATUS_AUDIT.md` | `/` | Contains stale references | 90 days |
| `REPO_WIDE_AUDIT.md` | `/` | Superseded by CLEAN_YOUR_ROOM_AUDIT | 90 days |

### 2. Dead Code Files

| File | Moved From | Reason | Retention |
|------|------------|--------|-----------|
| `social.ts` | `lib/` | Zero imports, functions never called | 30 days |

### 3. Superseded Migrations (Reference Only)

| File | Status | Notes |
|------|--------|-------|
| `sql/011_social_insights_pipeline.sql` | KEEP | Still valid, but `social_connections` sections are dead |
| `sql/012_social_oauth_tokens.sql` | REVIEW | May be fully superseded by `social_accounts` |

---

## Retention Policy

| Category | Retention Period | Auto-Delete? |
|----------|------------------|--------------|
| Audit documents | 90 days | No - manual review required |
| Dead code | 30 days | No - verify no breakage first |
| Migration references | Indefinite | No - keep for schema history |

### Deletion Criteria

Before permanently deleting from graveyard:

1. **Audit documents:** Confirm no open action items reference the file
2. **Dead code:** Confirm 30 days have passed with zero import errors
3. **Migrations:** Never delete - keep for database archaeology

---

## How to Move Files

### Move Audit File
```bash
mkdir -p graveyard/audits
mv PRACTICE_REMOVAL_AUDIT.md graveyard/audits/
git add graveyard/audits/PRACTICE_REMOVAL_AUDIT.md
git rm PRACTICE_REMOVAL_AUDIT.md
git commit -m "chore: move stale audit to graveyard"
```

### Move Dead Code
```bash
mkdir -p graveyard/code
mv lib/social.ts graveyard/code/
git add graveyard/code/social.ts
git rm lib/social.ts
git commit -m "chore: move unused lib/social.ts to graveyard"
```

---

## Current Graveyard Contents

> **Note:** Graveyard directory does not exist yet. This README documents the plan.

| Date Moved | File | Original Location | Scheduled Deletion |
|------------|------|-------------------|-------------------|
| (pending) | — | — | — |

---

## Why Graveyard Instead of Delete?

1. **Safety net:** Easy restoration if something breaks
2. **Archaeology:** Future devs can understand what was tried
3. **Audit trail:** Git history preserved with context
4. **Confidence:** Delete permanently only after verification period

---

## Final Deletion Process

After retention period expires:

```bash
# Review what's ready for deletion
ls -la graveyard/audits/
ls -la graveyard/code/

# Permanently delete (after verification)
rm -rf graveyard/audits/PRACTICE_REMOVAL_AUDIT.md
git add -A
git commit -m "chore: permanently delete expired graveyard files"
```

---

## Related Documents

- [AUDIT_REPORT.md](./AUDIT_REPORT.md) - Full audit findings
- [CLEANUP_TODO.md](./CLEANUP_TODO.md) - Phased cleanup checklist
- [CLEAN_YOUR_ROOM_AUDIT.md](./CLEAN_YOUR_ROOM_AUDIT.md) - Previous cleanup audit

---

*End of GRAVEYARD_README.md*
