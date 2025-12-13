# Feature Progress Matrix

**Last Updated**: 2025-12-13

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ | Fully implemented and wired |
| 🟡 | Partially implemented or missing wiring |
| 🔴 | Not implemented |
| ⚠️ | Has issues/blockers |

---

## Core Features

### Home / Public Experience

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Public Horoscope | ✅ | `/` (app/(public)/page.tsx) | `/api/public-horoscope` | Redis | 24h | Yes | Yes | None |
| Zodiac Grid | ✅ | `/` | N/A | N/A | N/A | N/A | N/A | None |
| Learn Page | ✅ | `/learn` | N/A | N/A | N/A | N/A | N/A | None |
| About Page | ✅ | `/about` | N/A | N/A | N/A | N/A | N/A | None |

### Sanctuary (Protected)

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Daily Insights | ✅ | `/sanctuary` | `/api/insights` | Redis | 48h | Yes | Yes | None |
| Weekly Insights | ✅ | `/sanctuary` | `/api/insights` | Redis | 10d | Yes | Yes | None |
| Monthly Insights | ✅ | `/sanctuary` | `/api/insights` | Redis | 40d | Yes | Yes | None |
| Yearly Insights | ✅ | `/sanctuary` | `/api/insights` | Redis | 400d | Yes | Yes | None |
| Tarot Card (in insight) | ✅ | `/sanctuary` | `/api/insights` | Redis | (same) | Yes | Yes | None |
| Rune (in insight) | ✅ | `/sanctuary` | `/api/insights` | Redis | (same) | Yes | Yes | None |
| Lucky Compass | ✅ | `/sanctuary` | `/api/insights` | Redis | (same) | Yes | Yes | None |
| Journal Prompt | ✅ | `/sanctuary` | `/api/insights` | Redis | (same) | Yes | Yes | None |
| Greeting Card | ✅ | `/sanctuary` | N/A | Profile | N/A | N/A | N/A | None |

### Soul Print (Birth Chart)

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Placements Calculation | ✅ | `/sanctuary/birth-chart` | `/api/birth-chart` | soul_paths | Permanent | No | Yes | Birth data required |
| AI Narrative | ✅ | `/sanctuary/birth-chart` | `/api/birth-chart` | soul_paths | Permanent | No | Yes | Birth data required |
| Houses | ✅ | `/sanctuary/birth-chart` | `/api/birth-chart` | soul_paths | Permanent | No | Yes | Birth time required |
| Aspects | ✅ | `/sanctuary/birth-chart` | `/api/birth-chart` | soul_paths | Permanent | No | Yes | None |

### Connections

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Connection List | ✅ | `/sanctuary/connections` | `/api/connections` | connections | No | No | No | None |
| Add Connection | ✅ | `/sanctuary/connections` | `/api/connections` | connections | No | No | No | None |
| Edit Connection | ✅ | `/sanctuary/connections` | `/api/connections` | connections | No | No | No | None |
| Delete Connection | ✅ | `/sanctuary/connections` | `/api/connections` | connections | No | No | No | None |
| Connection Insight | ✅ | `/sanctuary/connections` | `/api/connection-insight` | Redis | 24h | Yes | Yes | None |

### Journal

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Save Entry | ✅ | `/sanctuary` (tab) | `/api/journal` | journal_entries | No | No | No | None |
| Load Entry | ✅ | `/sanctuary` (tab) | `/api/journal` | journal_entries | No | No | No | None |
| Delete Entry | ✅ | `/sanctuary` (tab) | `/api/journal/delete` | journal_entries | No | No | No | None |
| Export Entries | ✅ | `/sanctuary` (tab) | `/api/journal/export` | journal_entries | No | No | No | None |

### Settings & Profile

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| View Profile | ✅ | `/settings` | `/api/user/profile` | profiles | No | No | No | None |
| Update Profile | ✅ | `/settings` | `/api/user/profile` | profiles | No | No | No | None |
| Birth Data Collection | ✅ | `/settings`, `/onboarding` | `/api/user/profile` | profiles | No | No | No | None |
| Timezone Detection | ✅ | Auto-detect | N/A | profiles | No | No | No | None |
| Language Selection | ✅ | `/settings` | `/api/user/profile` | profiles | No | No | No | None |

### Authentication

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Sign Up | ✅ | `/sign-up` | Supabase Auth | auth.users, profiles | No | No | No | None |
| Sign In | ✅ | `/sign-in` | Supabase Auth | auth.users | No | No | No | None |
| Sign Out | ✅ | NavBar | Supabase Auth | N/A | No | No | No | None |
| Forgot Password | ✅ | `/forgot-password` | Supabase Auth | N/A | No | No | No | None |
| Reset Password | ✅ | `/reset-password` | Supabase Auth | auth.users | No | No | No | None |
| Onboarding Flow | ✅ | `/onboarding` | `/api/user/profile` | profiles | No | No | No | None |
| Welcome Page | ✅ | `/welcome` | N/A | N/A | No | No | No | None |

### Billing (Stripe)

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Checkout Session | ✅ | `/join` | `/api/stripe/checkout` | N/A | No | No | No | Stripe env vars |
| Webhook Handler | ✅ | N/A | `/api/stripe/webhook` | profiles | No | No | No | Stripe env vars |
| Subscription Status | ✅ | N/A | Webhook | profiles | No | No | No | None |
| Welcome Email | ✅ | N/A | Webhook | N/A | No | No | No | Resend env vars |
| Trial Period | ✅ | N/A | Stripe config | profiles | No | No | No | None |

### Cron Jobs

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Prewarm Insights | ✅ | N/A | `/api/cron/prewarm-insights` | Redis | 48h | Yes | Miss only | CRON_SECRET |

### Telemetry

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| AI Usage Tracking | ✅ | N/A | All AI routes | ai_usage_events | No | No | Self | None |
| Last Seen Tracking | ✅ | N/A | Protected routes | profiles.last_seen_at | No | No | No | None |

---

## Incomplete / Planned Features

### Social Connect

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Facebook OAuth | 🟡 | `/connect-social` | Supabase OAuth | N/A | No | No | No | OAuth configured but... |
| Facebook Personalization | 🟡 | N/A | N/A | social_summaries | No | No | No | Pipeline not wired to insights |
| Reddit OAuth | 🔴 | N/A | N/A | N/A | N/A | N/A | N/A | Not implemented |
| TikTok OAuth | 🔴 | N/A | N/A | N/A | N/A | N/A | N/A | Not implemented |
| Twitter/X OAuth | 🔴 | N/A | N/A | N/A | N/A | N/A | N/A | Not implemented |

### Future Features

| Feature | Status | Page | API | Storage | Cache | Locks | Telemetry | Blockers |
|---------|--------|------|-----|---------|-------|-------|-----------|----------|
| Compatibility | 🔴 | N/A | N/A | N/A | N/A | N/A | N/A | Feature not designed |
| Tarot Standalone | 🔴 | N/A | N/A | lib/tarot.ts (data) | N/A | N/A | N/A | No UI or API |
| Push Notifications | 🔴 | N/A | N/A | N/A | N/A | N/A | N/A | Not planned |
| Mobile App | 🔴 | N/A | N/A | N/A | N/A | N/A | N/A | Not planned |

---

## Technical Debt

| Item | Status | Location | Impact | Effort |
|------|--------|----------|--------|--------|
| npm vulnerability | ⚠️ | next package | High (DoS) | S (npm audit fix) |
| ESLint not configured | ⚠️ | project root | Medium (code quality) | S |
| Dev endpoint in prod | ⚠️ | `/api/dev/test-birth-chart` | Low (security) | S |
| No rate limiting | 🟡 | public endpoints | Medium (abuse) | M |
| No request validation (Zod) | 🟡 | all API routes | Low (errors) | M |

---

## Summary Statistics

| Category | Done | Partial | Missing | Total |
|----------|------|---------|---------|-------|
| Core Features | 42 | 1 | 0 | 43 |
| Social Features | 1 | 1 | 3 | 5 |
| Future Features | 0 | 0 | 4 | 4 |
| Technical Debt | 0 | 2 | 3 | 5 |
| **Total** | **43** | **4** | **10** | **57** |

**Completion Rate**: 75% (43/57 items fully done)
