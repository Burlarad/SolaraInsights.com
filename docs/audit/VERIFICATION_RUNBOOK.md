# VERIFICATION RUNBOOK — Library Book Implementation

**Date**: 2026-01-26
**Purpose**: Step-by-step commands to verify Library Book implementation locally and in production
**Status**: READY TO EXECUTE

---

## Prerequisites

```bash
# Ensure you're in the project root
cd /Users/aaronburlar/Desktop/Solara

# Ensure dependencies installed
npm install

# Ensure Supabase CLI installed
npx supabase --version

# Set environment variables
export DATABASE_URL="your_connection_string"  # From .env.local
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_anon_key"
```

---

## Phase 1: Code Verification (Local)

### 1.1 Verify No Wrong Migrations Exist

```bash
# List all numerology-related migrations
ls -la supabase/migrations/*numerology*.sql

# Expected output: Should NOT include 20260126120000_fix_numerology_table_name.sql (deleted)
# Should include: 20260125000000_library_book_model.sql
```

**✅ Pass Criteria**: No `*fix_numerology_table_name*` files exist

---

### 1.2 Verify Code Uses Correct Table Names

```bash
# Search for queries to numerology_library (CORRECT global table)
grep -rn "numerology_library" \
  --include="*.ts" \
  --include="*.tsx" \
  lib/library/

# Expected: Should find queries in lib/library/numerology.ts

# Search for queries to numerology_profiles in Library Book code (WRONG)
grep -rn "numerology_profiles" \
  --include="*.ts" \
  --include="*.tsx" \
  lib/library/

# Expected: Should return 0 results
```

**✅ Pass Criteria**:
- `lib/library/numerology.ts` queries `numerology_library` (global)
- NO Library Book code queries `numerology_profiles` (user-scoped)

---

### 1.3 Verify No Noon Defaulting in Library Book Code

```bash
# Search for noon defaulting patterns in Library Book code
grep -rn "birth_time.*||.*12:00" \
  --include="*.ts" \
  lib/library/

# Expected: 0 results

# Search in new API endpoints
grep -rn "birth_time.*||.*12:00" \
  --include="*.ts" \
  app/api/birth-chart-library/ \
  app/api/numerology-library/

# Expected: 0 results
```

**✅ Pass Criteria**: NO noon defaulting in Library Book or new endpoints

---

### 1.4 Run Type Checking

```bash
# Run TypeScript compiler check
npx tsc --noEmit

# Expected: No errors (or only pre-existing errors unrelated to Library Book)
```

**✅ Pass Criteria**: No new TypeScript errors introduced

---

### 1.5 Run Library Unit Tests

```bash
# Run key normalization tests
npm run test __tests__/library/keyNormalization.test.ts

# Expected: All 18 tests pass
```

**✅ Pass Criteria**: All validation tests pass

---

## Phase 2: Database Schema Verification

### 2.1 Verify Library Book Tables Exist

```bash
# Connect to database and check tables
psql "$DATABASE_URL" -c "
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('charts', 'numerology_library')
ORDER BY table_name;
"
```

**Expected Output**:
```
    table_name     | column_count
-------------------+--------------
 charts            |            7
 numerology_library|            7
```

**✅ Pass Criteria**: Both tables exist with correct column counts

**If Database Not Running**:
```bash
# Start local Supabase (if using local development)
npx supabase start

# Or skip to Phase 3 (application-level verification)
```

---

### 2.2 Verify Charts Table Schema

```bash
psql "$DATABASE_URL" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'charts'
ORDER BY ordinal_position;
"
```

**Expected Output**:
```
   column_name    |       data_type        | is_nullable
------------------+------------------------+-------------
 chart_key        | text                   | NO
 input_json       | jsonb                  | NO
 geometry_json    | jsonb                  | NO
 engine_config    | jsonb                  | NO
 created_at       | timestamp with time zone| NO
 last_accessed_at | timestamp with time zone| NO
 access_count     | integer                | NO
```

**✅ Pass Criteria**:
- `chart_key` is TEXT PRIMARY KEY
- All required columns present
- NO user_id column (global dedupe)

---

### 2.3 Verify Numerology Library Table Schema

```bash
psql "$DATABASE_URL" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'numerology_library'
ORDER BY ordinal_position;
"
```

**Expected Output**:
```
   column_name    |       data_type        | is_nullable
------------------+------------------------+-------------
 numerology_key   | text                   | NO
 input_json       | jsonb                  | NO
 numerology_json  | jsonb                  | NO
 config_version   | integer                | NO
 created_at       | timestamp with time zone| NO
 last_accessed_at | timestamp with time zone| NO
 access_count     | integer                | NO
```

**✅ Pass Criteria**:
- `numerology_key` is TEXT PRIMARY KEY
- All required columns present
- NO user_id column (global dedupe)

---

### 2.4 Verify Profiles Has Official Keys

```bash
psql "$DATABASE_URL" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('official_chart_key', 'official_numerology_key')
ORDER BY column_name;
"
```

**Expected Output**:
```
       column_name       | data_type | is_nullable
-------------------------+-----------+-------------
 official_chart_key      | text      | YES
 official_numerology_key | text      | YES
```

**✅ Pass Criteria**: Both pointer columns exist and are nullable

---

### 2.5 Check for Stone Tablets Tables (Pre-Removal)

```bash
psql "$DATABASE_URL" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('soul_paths', 'numerology_profiles');
"
```

**Expected Output (Before Removal)**:
```
    table_name
---------------------
 soul_paths
 numerology_profiles
```

**Expected Output (After Removal)**:
```
    table_name
---------------------
(0 rows)
-- Or only numerology_library if it was never user-scoped
```

**ℹ️ Note**: Stone Tablets tables will remain until 30-day transition complete

---

### 2.6 Distinguish User-Scoped vs Global Numerology Table

```bash
# Check if numerology_profiles has user_id (Stone Tablets) or numerology_key (Library Book)
psql "$DATABASE_URL" -c "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'numerology_profiles'
  AND column_name IN ('user_id', 'numerology_key');
"
```

**Possible Outputs**:

**Case A** (User-scoped Stone Tablets exists):
```
 column_name
-------------
 user_id
```
→ This is the OLD user-scoped table (scheduled for deletion)

**Case B** (Wrongly-named global library):
```
 column_name
----------------
 numerology_key
```
→ This is Library Book with WRONG name (needs rename to `numerology_library`)

**Case C** (Both exist - conflict):
```
 column_name
----------------
 user_id
 numerology_key
```
→ IMPOSSIBLE (can't have both columns in same table) - schema corruption!

**✅ Pass Criteria**: Only Case A is acceptable pre-removal. After removal, table should not exist.

---

## Phase 3: Application-Level Verification (No Database Required)

### 3.1 Test Birth Chart Library Endpoint (Local Server)

```bash
# Start local development server
npm run dev &

# Wait for server to start (a few seconds)
sleep 5

# Test official mode with authenticated request
# (Replace $AUTH_TOKEN with valid token from browser dev tools)
curl -X POST http://localhost:3000/api/birth-chart-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"official"}' \
  | jq '.'
```

**Expected Response (Success)**:
```json
{
  "mode": "official",
  "chart_key": "sha256_hash...",
  "inputs": {...},
  "geometry": {...},  // ⚠️ Should be "placements" after fix
  "is_official": true
}
```

**Expected Response (Incomplete Data)**:
```json
{
  "errorCode": "INCOMPLETE_BIRTH_DATA",
  "error": "INCOMPLETE_BIRTH_DATA",
  "message": "Complete your birth data in Settings to view your chart.",
  "required": ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
  "missing": ["birth_time"]
}
```

**✅ Pass Criteria**:
- Returns chart if Settings complete
- Returns 400 error if Settings incomplete
- NO chart returned when birth_time missing

---

### 3.2 Test Numerology Library Endpoint (Local Server)

```bash
# Test official mode
curl -X POST http://localhost:3000/api/numerology-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"official"}' \
  | jq '.'
```

**Expected Response (Success)**:
```json
{
  "mode": "official",
  "numerology_key": "sha256_hash...",
  "inputs": {...},
  "profile": {
    "lifePathNumber": 7,
    "expressionNumber": 3,
    ...
  },
  "is_official": true
  // ⚠️ Missing "cycles" field (needs to be added)
}
```

**Expected Response (Incomplete Data)**:
```json
{
  "errorCode": "INCOMPLETE_NUMEROLOGY_DATA",
  "message": "Missing required fields to compute numerology.",
  "required": ["full_name", "birth_date"],
  "missing": ["full_name"]
}
```

**✅ Pass Criteria**:
- Returns profile if Settings complete
- Returns 400 error if Settings incomplete

---

### 3.3 Test Preview Mode (Birth Chart)

```bash
# Test preview with complete data
curl -X POST http://localhost:3000/api/birth-chart-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preview",
    "inputs": {
      "birth_date": "1990-01-15",
      "birth_time": "14:30",
      "birth_lat": 40.7128,
      "birth_lon": -74.0060,
      "timezone": "America/New_York"
    }
  }' \
  | jq '.'
```

**Expected Response**:
```json
{
  "mode": "preview",
  "chart_key": "sha256_hash...",
  "inputs": {...},
  "geometry": {...},
  "is_official": false
}
```

**✅ Pass Criteria**: Returns preview chart with is_official: false

---

### 3.4 Test Preview Mode Rejects Missing birth_time

```bash
# Test preview with missing birth_time (should reject)
curl -X POST http://localhost:3000/api/birth-chart-library \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "preview",
    "inputs": {
      "birth_date": "1990-01-15",
      "birth_lat": 40.7128,
      "birth_lon": -74.0060,
      "timezone": "America/New_York"
    }
  }' \
  | jq '.'
```

**Expected Response**:
```json
{
  "errorCode": "INCOMPLETE_PREVIEW_DATA",
  "error": "INCOMPLETE_PREVIEW_DATA",
  "message": "All fields required for chart computation.",
  "required": ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
  "missing": ["birth_time"]
}
```

**✅ Pass Criteria**: Returns 400 error, NO chart generated

---

## Phase 4: Integration Tests

### 4.1 Run Existing Tests

```bash
# Run all tests
npm run test

# Expected: All tests pass (or only pre-existing failures)
```

**✅ Pass Criteria**: No new test failures introduced

---

### 4.2 Run Endpoint-Specific Tests (If Exist)

```bash
# Test birth chart library endpoint
npm run test __tests__/api/birth-chart-library.test.ts

# Test numerology library endpoint
npm run test __tests__/api/numerology-library.test.ts
```

**ℹ️ Note**: These test files may not exist yet (need to be created)

---

## Phase 5: Production Verification (After Deployment)

### 5.1 Verify Migration Applied

```bash
# Connect to production database (use read-only role if available)
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT version, name, applied_at
FROM supabase_migrations.schema_migrations
WHERE version = '20260125000000'
ORDER BY applied_at DESC
LIMIT 1;
"
```

**Expected Output**:
```
    version     |               name               |       applied_at
----------------+----------------------------------+-------------------------
 20260125000000 | library_book_model               | 2026-01-25 12:00:00+00
```

**✅ Pass Criteria**: Migration shows as applied

---

### 5.2 Check Production Table Counts

```bash
# Check if library tables have data
psql "$PRODUCTION_DATABASE_URL" -c "
SELECT 'charts' as table_name, COUNT(*) as row_count FROM public.charts
UNION ALL
SELECT 'numerology_library', COUNT(*) FROM public.numerology_library;
"
```

**Expected Output** (After some usage):
```
    table_name     | row_count
-------------------+-----------
 charts            |        42
 numerology_library|        15
```

**ℹ️ Note**: Row counts will be 0 initially, then grow over time

---

### 5.3 Test Production Endpoints

```bash
# Test production birth chart library endpoint
curl -X POST https://your-production-domain.com/api/birth-chart-library \
  -H "Authorization: Bearer $PROD_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"official"}' \
  | jq '.'
```

**✅ Pass Criteria**: Returns chart or appropriate error (no 500 errors)

---

## Phase 6: Monitoring and Validation

### 6.1 Monitor Error Rates

```bash
# Check application logs for errors
# (Command varies by hosting platform - Vercel, Railway, etc.)

# Look for specific errors:
# - "INCOMPLETE_BIRTH_DATA" (expected - user has incomplete Settings)
# - "PROFILE_LOAD_FAILED" (unexpected - DB issue)
# - "INTERNAL_ERROR" (unexpected - code bug)
```

**✅ Pass Criteria**: Only expected errors (incomplete data), no internal errors

---

### 6.2 Monitor Old Endpoint Usage

```bash
# Check logs for old endpoint usage
# (Should trend toward 0% after UI migration)

# Example: grep application logs
grep "/api/birth-chart\"" logs.txt | wc -l
grep "/api/numerology\"" logs.txt | wc -l

# Expected: Decreasing over time, reaching 0 after 30 days
```

**✅ Pass Criteria**: Old endpoint usage trends to 0%

---

## Phase 7: Post-Migration Verification (After 30 Days)

### 7.1 Verify Stone Tablets Removed

```bash
# Check Stone Tablets files deleted
ls -la lib/soulPath/storage.ts 2>&1
ls -la lib/birthChart/storage.ts 2>&1
ls -la lib/numerology/storage.ts 2>&1

# Expected: "No such file or directory"
```

**✅ Pass Criteria**: All Stone Tablets files deleted

---

### 7.2 Verify Stone Tablets Tables Dropped

```bash
psql "$DATABASE_URL" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('soul_paths', 'numerology_profiles');
"
```

**Expected Output**:
```
 table_name
------------
(0 rows)
```

**✅ Pass Criteria**: No Stone Tablets tables remain

---

### 7.3 Verify No Noon Defaulting Patterns

```bash
# Search entire codebase for noon defaulting
grep -rn "birth_time.*||.*12:00" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=docs

# Expected: 0 results
```

**✅ Pass Criteria**: NO noon defaulting patterns in code

---

## Troubleshooting

### Issue: Cannot Connect to Database

**Symptom**: `psql: could not connect to server`

**Solution**:
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# If empty, set from .env.local
export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d '=' -f2-)

# Or skip database verification and rely on Phase 3 (application-level tests)
```

---

### Issue: Migrations Not Applied

**Symptom**: Tables don't exist in database

**Solution**:
```bash
# Apply migrations
npx supabase db push

# Or apply specific migration
npx supabase migration up 20260125000000
```

---

### Issue: Wrong Table Name Created

**Symptom**: `numerology_profiles` has `numerology_key` column (wrongly named Library Book table)

**Solution**:
```bash
# Create corrective migration
cat > supabase/migrations/20260127000000_rename_numerology_table.sql << 'EOF'
-- Rename wrongly-named table
ALTER TABLE IF EXISTS public.numerology_profiles
  RENAME TO numerology_library;

-- Rename indexes
ALTER INDEX IF EXISTS numerology_profiles_pkey
  RENAME TO numerology_library_pkey;
EOF

# Apply migration
npx supabase db push
```

---

### Issue: Tests Failing

**Symptom**: Unit tests fail after code changes

**Solution**:
```bash
# Run tests in verbose mode to see errors
npm run test -- --verbose

# Check specific test file
npm run test __tests__/library/keyNormalization.test.ts

# Fix test expectations or code as needed
```

---

## Summary Checklist

### Pre-Deployment

- [ ] No wrong migrations exist (20260126120000 deleted)
- [ ] Code uses correct table names (`numerology_library`, not `numerology_profiles`)
- [ ] No noon defaulting in Library Book code
- [ ] TypeScript compiles without errors
- [ ] Unit tests pass (18/18 validation tests)

### Post-Deployment (Local/Staging)

- [ ] Library tables exist (`charts`, `numerology_library`)
- [ ] Tables have correct schema (no `user_id` column)
- [ ] Profiles has pointer columns (`official_chart_key`, `official_numerology_key`)
- [ ] Endpoints return charts for complete data
- [ ] Endpoints return 400 errors for incomplete data
- [ ] Preview mode works correctly
- [ ] No charts generated with missing `birth_time`

### Post-Deployment (Production)

- [ ] Migration applied successfully
- [ ] Library tables populated with data
- [ ] Endpoints working (no 500 errors)
- [ ] Error rates normal (only expected errors)
- [ ] Old endpoint usage trending to 0%

### Post-Removal (After 30 Days)

- [ ] Stone Tablets files deleted
- [ ] Stone Tablets tables dropped
- [ ] Legacy profile columns dropped
- [ ] No noon defaulting patterns in code
- [ ] No imports of deleted files
- [ ] All tests passing

---

**END OF VERIFICATION RUNBOOK**
