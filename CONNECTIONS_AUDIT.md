# Connections Feature Audit Report

**Date**: 2025-12-16
**Auditor**: Claude
**Status**: Phase 1 Complete - Backend implemented, UI pending

---

## Executive Summary

### Priority Issues & Resolution Status

| Priority | Issue | Status |
|----------|-------|--------|
| **P0** | No Daily Brief layer exists - only deep insight | **DONE** - `/api/connection-brief` created |
| **P0** | No Space Between "stone tablet" DB storage | **DONE** - `/api/connection-space-between` created |
| **P0** | Prompt uses "Person 1/Person 2" not names | **DONE** - All prompts use actual names |
| ~~P0~~ | ~~No consent/linking mechanism~~ | **REMOVED** - Not required per updated spec |
| **P1** | Insights cached in Redis, not saved to DB | **DONE** - Now saves to Postgres |
| **P1** | No label-safe tone adaptation | **DONE** - Safety rules added to all prompts |
| **P1** | No friend-safe vs partner-safe tone policy | **DONE** - `getToneGuidance()` implemented |
| **P2** | UI has no tabs (Today, Space Between, Notes) | Pending Phase 2 |
| ~~P2~~ | ~~No invitation flow for linked profiles~~ | **REMOVED** - Not required per updated spec |

### What Was Implemented (Phase 1)

1. **SQL Migration** - [007_connections_v2.sql](sql/007_connections_v2.sql)
   - `daily_briefs` table with RLS policies
   - `space_between_reports` table with RLS policies
   - Added `notes` column to existing `connections` table

2. **New API Endpoints**
   - [/api/connection-brief](app/api/connection-brief/route.ts) - Daily Brief (Layer A)
   - [/api/connection-space-between](app/api/connection-space-between/route.ts) - Space Between (Layer B)

3. **Fixed Prompts in Existing Endpoint** - [connection-insight/route.ts](app/api/connection-insight/route.ts)
   - Replaced "Person 1/2" with actual names (`userName`, `connectionName`)
   - Added safety rules (no label reveal, no certainty claims)
   - Added `getToneGuidance()` for relationship-type tone adaptation

4. **TypeScript Types** - [types/index.ts](types/index.ts)
   - Added `DailyBrief` interface
   - Added `SpaceBetweenReport` interface
   - Added `notes` to `Connection` interface

5. **OpenAI Model Config** - [lib/openai/client.ts](lib/openai/client.ts)
   - Added `deep` model for stone tablet generation (gpt-4o)

### Next Steps (Phase 2 - UI)

- Create connection detail page with tabs
- Update connection list to link to detail view
- Implement notes editing UI

---

## 1. Inventory

### Files & Components

| File Path | Purpose |
|-----------|---------|
| [page.tsx](app/(protected)/sanctuary/connections/page.tsx) | Main Connections UI page |
| [route.ts](app/api/connections/route.ts) | CRUD API (GET/POST/DELETE) |
| [route.ts](app/api/connection-insight/route.ts) | AI insight generation API |
| [types/index.ts:389-409](types/index.ts#L389-L409) | `Connection` and `ConnectionInsight` interfaces |
| [schemas.ts:62-66](lib/validation/schemas.ts#L62-L66) | `connectionInsightSchema` validation |
| [schemas.ts:88-96](lib/validation/schemas.ts#L88-L96) | `connectionSchema` validation |
| [voice.ts](lib/ai/voice.ts) | `AYREN_MODE_SHORT` voice system |
| [cache.ts](lib/cache.ts) | Redis caching layer with `getDayKey()` |
| [005_add_indexes.sql](sql/005_add_indexes.sql) | `idx_connections_owner` index |

### Database Tables (Supabase)

| Table | Exists | Purpose |
|-------|--------|---------|
| `connections` | Yes | Stores user connections with birth data |
| `profiles` | Yes | User profiles (used for owner's birth data) |
| `daily_briefs` | **NO** | Should store immutable daily connection briefs |
| `space_between_reports` | **NO** | Should store "stone tablet" deep reports |
| `connection_links` | **NO** | Should store invite/accept/consent |

---

## 2. Current UX Flow

### Adding a Connection
1. User navigates to `/sanctuary/connections`
2. Fills out form: name, relationship type, optional birth data
3. POST `/api/connections` creates record in `connections` table
4. Connection appears in list

### Viewing a Connection
1. User clicks "View insight" button on connection card
2. POST `/api/connection-insight` with `connectionId`
3. System checks Redis cache (key includes day + timezone)
4. If cache miss: generates insight via OpenAI, caches for 24h
5. Returns 4-section insight (Overview, Emotional Dynamics, Communication, Care Suggestions)
6. Insight displays inline on card

### What's Missing from UX
- **No "Today" tab** with light daily brief
- **No "Space Between" tab** with deep relationship blueprint
- **No "Notes" tab** for user notes
- **No link status indicator** showing linked vs unlinked
- **No invitation flow** to invite connection to join
- **No consent UI** for accepting/rejecting link requests

---

## 3. Data Model Audit

### Current `Connection` Interface

```typescript
// types/index.ts:389-402
interface Connection {
  id: string;
  owner_user_id: string;
  linked_profile_id: string | null;  // Exists but unused
  name: string;
  relationship_type: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_city: string | null;
  birth_region: string | null;
  birth_country: string | null;
  created_at: string;
  updated_at: string;
}
```

### Current `ConnectionInsight` Interface

```typescript
// types/index.ts:404-409
interface ConnectionInsight {
  overview: string;
  emotionalDynamics: string;
  communication: string;
  careSuggestions: string;
}
```

### Missing Entities

#### A. `DailyBrief` Table (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES profiles(id),

  -- Cache key components
  local_date DATE NOT NULL,           -- User's local date (timezone-aware)
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  prompt_version INTEGER NOT NULL,
  model_version VARCHAR(50),

  -- Content (immutable once generated)
  title TEXT NOT NULL,                 -- "Today with {Name}"
  shared_vibe TEXT NOT NULL,           -- 2-4 sentences
  ways_to_show_up TEXT[] NOT NULL,     -- Exactly 3 bullets
  nudge TEXT,                          -- Optional small nudge

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one brief per connection per day per language per prompt version
  UNIQUE (connection_id, local_date, language, prompt_version)
);

CREATE INDEX idx_daily_briefs_connection_date
ON daily_briefs(connection_id, local_date DESC);
```

#### B. `SpaceBetweenReport` Table (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.space_between_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES profiles(id),

  -- Cache key components
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  prompt_version INTEGER NOT NULL,
  model_version VARCHAR(50),

  -- Content (stone tablet - never changes)
  relationship_essence TEXT NOT NULL,     -- Core dynamic
  emotional_blueprint TEXT NOT NULL,      -- How you feel together
  communication_patterns TEXT NOT NULL,   -- How you talk
  growth_edges TEXT NOT NULL,             -- Where you stretch each other
  care_guide TEXT NOT NULL,               -- How to show up

  -- Consent-aware flags
  includes_linked_birth_data BOOLEAN NOT NULL DEFAULT FALSE,
  includes_linked_social_data BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one report per connection per language per prompt version
  UNIQUE (connection_id, language, prompt_version)
);

CREATE INDEX idx_space_between_connection
ON space_between_reports(connection_id);
```

#### C. `ConnectionLink` Table (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.connection_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The connection this link relates to
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,

  -- Who is inviting (the connection owner)
  inviter_user_id UUID NOT NULL REFERENCES profiles(id),

  -- Who is being invited (the other person)
  invitee_email VARCHAR(255),           -- For email-based invites
  invitee_user_id UUID REFERENCES profiles(id),  -- Set when they accept

  -- Link status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, accepted, declined, revoked

  -- Consent scope (what they agree to share)
  consent_scope JSONB DEFAULT '{}',
  -- Example: { "birth_data": true, "social_insights": false }

  -- Invite metadata
  invite_token VARCHAR(64) UNIQUE,      -- For invite URL
  invite_sent_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,

  -- Response metadata
  responded_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connection_links_invitee
ON connection_links(invitee_user_id) WHERE invitee_user_id IS NOT NULL;

CREATE INDEX idx_connection_links_token
ON connection_links(invite_token) WHERE invite_token IS NOT NULL;
```

---

## 4. API Audit

### Current: `/api/connection-insight` (POST)

**Issues Found:**

| Issue | Line | Severity |
|-------|------|----------|
| Uses "Person 1" / "Person 2" in prompt | 278-296 | **P0** |
| Not stored in DB, only Redis cache | 352 | **P1** |
| No consent check for linked profiles | 153-170 | **P0** |
| No relationship-type tone adaptation | 262-274 | **P1** |
| No label mismatch protection | - | **P1** |
| Returns deep insight, not daily brief | - | **P0** |

**Prompt Excerpt (PROBLEMATIC):**

```typescript
// app/api/connection-insight/route.ts:276-296
const userPrompt = `Generate a relational insight for the connection between these two people.

Person 1 (the owner):  // <-- WRONG: Should use name or "you"
- Birth date: ${profile.birth_date}
...

Person 2 (the connection):  // <-- WRONG: Should use their name
- Name: ${connection.name}
...
```

### Required API Changes

#### A. Split into Two Endpoints

1. **`/api/connection-brief`** (NEW) - Daily Brief
   - Light, general, "weather report" feel
   - Stores to `daily_briefs` table (immutable for that day)
   - Cache key: `connectionId + localDate + language + promptVersion`

2. **`/api/connection-space-between`** (NEW) - Space Between
   - Deep relationship blueprint ("stone tablet")
   - Stores to `space_between_reports` table (generated once, never regenerated)
   - Cache key: `connectionId + language + promptVersion`
   - Must check consent scope for linked profiles

#### B. Name Substitution Rule

All prompts must:
- Use "you" for the owner
- Use `{connection.name}` for the other person
- Never output "Person 1" or "Person 2"

---

## 5. Prompt Audit

### Current Prompt Issues

```typescript
// CURRENT (WRONG):
"Person 1 (the owner):"
"Person 2 (the connection):"
"concrete ways Person 1 can support Person 2"
```

### Required Daily Brief Prompt

```typescript
export const DAILY_BRIEF_PROMPT = `You are Ayren, generating a brief daily connection summary.

CONTEXT:
This is a ${relationshipType} connection between you and ${connectionName}.

OUTPUT FORMAT (STRICT):
Return JSON:
{
  "title": "Today with ${connectionName}",
  "sharedVibe": "2-4 sentences describing the shared energy today. Use 'you and ${connectionName}' phrasing. General, non-invasive, like a weather report for the connection.",
  "waysToShowUp": [
    "Action-verb bullet 1 (e.g., 'Listen for what isn't being said')",
    "Action-verb bullet 2",
    "Action-verb bullet 3"
  ],
  "nudge": "Optional single line micro-nudge, or null if not needed"
}

SAFETY RULES:
- Never claim to know the other person's private thoughts or feelings
- Never be creepy, coercive, or manipulative
- Keep it general and uplifting
- Use "may," "might," "could" not "will" or "is"
`;
```

### Required Space Between Prompt

```typescript
export const SPACE_BETWEEN_PROMPT = `You are Ayren, generating a relationship blueprint.

CONTEXT:
This is a ${relationshipType} connection between you and ${connectionName}.
${consentScope.birth_data ? `${connectionName}'s birth data is available.` : `${connectionName} has not shared their birth data.`}

RELATIONSHIP TYPE TONE ADAPTATION:
${getToneGuidance(relationshipType)}

OUTPUT FORMAT:
Return JSON with 5 sections, each 2-3 paragraphs.

SAFETY RULES:
- Never reveal what each person labeled the other as
- Never expose label mismatches
- Never claim certainty about the other person's private thoughts
- Never give manipulation or coercion advice
- Use "you and ${connectionName}" phrasing throughout
`;

function getToneGuidance(type: string): string {
  switch (type.toLowerCase()) {
    case 'partner':
      return 'Romantic, intimate tone is appropriate. May reference physical/emotional intimacy.';
    case 'friend':
    case 'colleague':
      return 'Warm, platonic tone. Never romance-coded. Focus on mutual respect and support.';
    case 'parent':
    case 'child':
    case 'sibling':
      return 'Family-appropriate tone. Focus on unconditional bonds and growth.';
    default:
      return 'Warm, neutral tone. Default to friend-safe content.';
  }
}
```

---

## 6. UI Audit

### Current UI Structure

```
/sanctuary/connections
├── Header: "Connections" + subtitle
├── Left (2/3): Connection list
│   └── Connection Card
│       ├── Name + relationship type + birth date
│       ├── "View insight" button
│       ├── Delete button
│       └── Inline insight display (when selected)
└── Right (1/3): Add connection form
```

### Required UI Structure

```
/sanctuary/connections
├── Header: "Connections" + subtitle
├── Left (2/3): Connection list
│   └── Connection Card (redesigned)
│       ├── Avatar/initial + Name
│       ├── Relationship type badge
│       ├── Link status indicator (Linked | Unlinked | Pending)
│       └── "Open" button (goes to detail view)
└── Right (1/3): Add connection form

/sanctuary/connections/[id] (NEW - detail page)
├── Back link to /sanctuary/connections
├── Header: Connection name + relationship type
├── Link status + "Invite to link" button
├── Tab navigation:
│   ├── Today (Daily Brief)
│   │   ├── Title: "Today with {Name}"
│   │   ├── Shared vibe paragraph
│   │   ├── "Ways to show up" (3 bullets)
│   │   └── Optional nudge
│   ├── Space Between (Deep report)
│   │   ├── First-open: "Generate your relationship blueprint" CTA
│   │   ├── Subsequent: Display saved stone tablet
│   │   └── Sections: Essence, Emotional Blueprint, Communication, Growth, Care
│   └── Notes (User notes)
│       ├── Free-form text area
│       └── Save button
└── Delete connection (with confirmation)
```

---

## 7. Gaps & Bugs

### Critical Gaps (P0)

| Gap | Impact | Fix Required |
|-----|--------|--------------|
| No Daily Brief exists | Core feature missing | Create `/api/connection-brief` + `daily_briefs` table |
| No Space Between exists | Core feature missing | Create `/api/connection-space-between` + `space_between_reports` table |
| Prompt uses Person 1/2 | Violates spec | Rewrite prompt with name substitution |
| No consent mechanism | Privacy violation risk | Create `connection_links` table + consent flow |
| Insights not saved to DB | Data loss on Redis flush | Store to Postgres, use Redis as cache layer |

### High Priority Gaps (P1)

| Gap | Impact | Fix Required |
|-----|--------|--------------|
| No tone adaptation by relationship type | Inappropriate content risk | Add `getToneGuidance()` to prompts |
| No label mismatch protection | Could expose sensitive info | Add safety rules to prompts |
| `linked_profile_id` exists but unused | Dead code | Wire up with consent flow |
| No friend-safe vs partner-safe distinction | Romance-coded content for friends | Add tone policy to prompts |

### Medium Priority Gaps (P2)

| Gap | Impact | Fix Required |
|-----|--------|--------------|
| No tabbed detail view | UX incomplete | Create `/sanctuary/connections/[id]` page |
| No invitation flow | Can't link profiles | Create invite API + UI |
| No notes feature | User can't save notes | Add `notes` field to `connections` table |

### Potential Bugs

| Issue | Location | Risk |
|-------|----------|------|
| No timezone validation | `getDayKey()` call | Could fail on invalid timezone |
| Birth data shown even if consent not granted | Linked profile loading | Privacy leak |
| No check if connection belongs to user in insight | `/api/connection-insight` | Actually fine - line 131 checks |

---

## 8. Implementation Plan

### Phase 1: Data Model (Do First)

**Step 1.1: Create new tables**
- File: `sql/007_connections_v2.sql`
- Create: `daily_briefs`, `space_between_reports`, `connection_links`
- Add RLS policies for all tables
- Add `notes` column to `connections` table

**Step 1.2: Update TypeScript types**
- File: `types/index.ts`
- Add: `DailyBrief`, `SpaceBetweenReport`, `ConnectionLink` interfaces
- Update: `Connection` interface to include `notes`

### Phase 2: API Layer

**Step 2.1: Create Daily Brief API**
- File: `app/api/connection-brief/route.ts`
- Behavior:
  1. Check if brief exists in `daily_briefs` for today
  2. If yes: return from DB
  3. If no: generate via OpenAI, save to DB, return
- Cache key: `connectionId + localDate(timezone) + language + promptVersion`

**Step 2.2: Create Space Between API**
- File: `app/api/connection-space-between/route.ts`
- Behavior:
  1. Check if report exists in `space_between_reports`
  2. If yes: return from DB (stone tablet)
  3. If no: generate via OpenAI, save to DB, return
- Must check consent scope before including linked profile data

**Step 2.3: Create Connection Link APIs**
- File: `app/api/connection-link/route.ts`
- Endpoints:
  - POST `/api/connection-link/invite` - Send invite
  - POST `/api/connection-link/accept` - Accept invite
  - POST `/api/connection-link/decline` - Decline invite
  - DELETE `/api/connection-link` - Revoke link

**Step 2.4: Deprecate old endpoint**
- File: `app/api/connection-insight/route.ts`
- Add deprecation warning in response
- Redirect to new endpoints

### Phase 3: Prompts

**Step 3.1: Create new prompt files**
- File: `lib/ai/prompts/connectionBrief.ts`
- File: `lib/ai/prompts/spaceBetween.ts`
- Include all safety rules, name substitution, tone adaptation

**Step 3.2: Add tone guidance utility**
- File: `lib/ai/prompts/toneGuidance.ts`
- `getToneGuidance(relationshipType)` function

### Phase 4: UI

**Step 4.1: Create connection detail page**
- File: `app/(protected)/sanctuary/connections/[id]/page.tsx`
- Tabbed interface: Today, Space Between, Notes

**Step 4.2: Update connection list**
- File: `app/(protected)/sanctuary/connections/page.tsx`
- Add link status indicator
- Change "View insight" to "Open" (navigates to detail)

**Step 4.3: Create invite UI**
- Component: `components/connections/InviteModal.tsx`
- Allow sending invite via email or in-app

### Phase 5: Verification

**Step 5.1: Build verification**
```bash
npm run build
npm run lint
```

**Step 5.2: Manual testing checklist**
- [ ] Add new connection
- [ ] View Daily Brief (first generation)
- [ ] View Daily Brief (cached load)
- [ ] View Space Between (first generation)
- [ ] View Space Between (stone tablet load)
- [ ] Add notes to connection
- [ ] Send invite link
- [ ] Accept invite as other user
- [ ] Verify consent-scoped data in Space Between
- [ ] Delete connection (cascades briefs/reports)

**Step 5.3: Privacy audit**
- [ ] Unlinked connection shows only general guidance
- [ ] Linked connection with consent shows birth data
- [ ] Label mismatch is never revealed
- [ ] No "Person 1/Person 2" in any output

---

## Quick Wins (Can Do Immediately)

1. **Fix "Person 1/Person 2" in prompt** - 5 min
   - Edit `app/api/connection-insight/route.ts:276-296`
   - Replace with `you` and `${connection.name}`

2. **Add safety rules to existing prompt** - 10 min
   - Add "never reveal labels" and "never claim certainty" rules

3. **Add tone adaptation** - 15 min
   - Add `getToneGuidance()` function
   - Include in system prompt based on `relationship_type`

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| New DB tables | Low | Additive change, no existing data affected |
| New API endpoints | Low | Existing endpoint still works during migration |
| Prompt rewrites | Medium | Test thoroughly before deploy |
| UI restructure | Medium | Feature flag the new detail page |
| Deprecating old endpoint | High | Keep working for 30 days with deprecation notice |

---

## Summary

The Connections feature currently implements a single "deep insight" that regenerates daily. The spec requires two distinct layers:

1. **Daily Brief** (light, saved to DB per day)
2. **Space Between** (deep, saved once as "stone tablet")

Plus consent/linking infrastructure that doesn't exist.

**Recommended approach**: Implement in phases, starting with data model, then APIs, then UI. Keep the existing endpoint working during transition.
