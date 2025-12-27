# Graveyard

> **Purpose:** Archive for deprecated code, stale documentation, and superseded implementations.
> **Last Updated:** 2025-12-26

---

## Directory Structure

```
graveyard/
├── README.md       # This file
├── audits/         # Historical audit/status documents
├── docs/           # Stale planning notes and setup guides
└── code/           # Deprecated code files (empty)
```

---

## Current Contents

### audits/ (19 files)

| Date Moved | File | Why Moved |
|------------|------|-----------|
| 2025-12-26 | `AUDIT_REPORT.md` | Superseded by newer audits |
| 2025-12-26 | `CACHING_AUDIT.md` | Historical - caching implemented |
| 2025-12-26 | `CACHING_PROGRESS_AUDIT.md` | Historical - tracking completed |
| 2025-12-26 | `CLEAN_YOUR_ROOM_AUDIT.md` | Historical - cleanup completed |
| 2025-12-26 | `CONNECTIONS_AUDIT.md` | Historical - connections refactored |
| 2025-12-26 | `CURRENT_STATE_SOCIAL_AUDIT.md` | Superseded by implementation |
| 2025-12-26 | `INSIGHTS_CACHING_PERFECTION_AUDIT.md` | Historical - caching implemented |
| 2025-12-26 | `LEARN_CENTER_AUDIT.md` | Historical - learn center implemented |
| 2025-12-26 | `LEARN_CENTER_STATUS_AUDIT.md` | Historical - status tracking |
| 2025-12-26 | `MOBILE_AUDIT.md` | Historical - mobile audit |
| 2025-12-26 | `ONBOARDING_FORENSIC_AUDIT.md` | Historical - onboarding fixed |
| 2025-12-26 | `OPENAI_COST_AUDIT.md` | Historical - cost controls implemented |
| 2025-12-26 | `PHASE-3-SUMMARY.md` | Historical - phase 3 completed |
| 2025-12-26 | `PRACTICE_REMOVAL_AUDIT.md` | Completed - practice removed |
| 2025-12-26 | `RATE_LIMIT_AUDIT.md` | Historical - rate limiting fixed |
| 2025-12-26 | `SOCIAL_SIGNIN_AUDIT.md` | Superseded by custom OAuth audit |
| 2025-12-26 | `SOCIAL_SIGNIN_CUSTOM_OAUTH_AUDIT.md` | Historical - OAuth implemented |
| 2025-12-26 | `SOUL_PRINT_DEEP_DIVE_AUDIT.md` | Historical - soul print implemented |
| 2025-12-26 | `TODAY_AUDIT.md` | Historical - one-time snapshot |

### docs/ (4 files)

| Date Moved | File | Why Moved |
|------------|------|-----------|
| 2025-12-26 | `ADMIN_CLIENT_CHECKLIST.md` | Planning doc - admin setup complete |
| 2025-12-26 | `ADMIN_CLIENT_SETUP.md` | Planning doc - admin setup complete |
| 2025-12-26 | `CLEANUP_TODO.md` | Planning doc - based on old audit |
| 2025-12-26 | `LEARN_COVER_ART_PLAN.md` | Planning doc - cover art implemented |

---

## Files Kept in Root

These operational reference docs remain in repo root:

| File | Reason |
|------|--------|
| `DEPLOYMENT_CRON.md` | Active deployment guide |
| `TOKEN_LEDGER.md` | Active OpenAI cost tracking |
| `STRIPE_ENV_AUDIT.md` | Active env var reference |
| `TIMEZONE_GEOCODING_REDIS_IMPLEMENTATION.md` | Active implementation reference |
| `FACEBOOK_APP_NOT_ACTIVE_AUDIT.md` | Recent (12/25) - active issue |
| `FACEBOOK_OAUTH_AUDIT.md` | Recent (12/25) - active issue |

---

## Retention Policy

| Category | Retention | Auto-Delete? |
|----------|-----------|--------------|
| Audit documents | 90 days | No - manual review |
| Planning docs | 90 days | No - manual review |
| Dead code | 30 days | No - verify first |

---

## Restoration

To restore a file:

```bash
git mv graveyard/audits/FILENAME.md ./FILENAME.md
git commit -m "chore: restore FILENAME from graveyard"
```

---

*End of graveyard/README.md*
