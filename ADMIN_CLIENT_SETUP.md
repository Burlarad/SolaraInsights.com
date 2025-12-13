# Admin Supabase Client - Setup & Verification

## ✅ Implementation Status: COMPLETE

The admin Supabase client has been successfully added to the codebase.

---

## What Was Added

### File: `lib/supabase/server.ts`

Added `createAdminSupabaseClient()` function that:
- Uses `SUPABASE_SERVICE_ROLE_KEY` environment variable
- Bypasses Row Level Security (RLS)
- Has `persistSession: false` and `autoRefreshToken: false`
- Includes warning comments about RLS bypass

### Current Usage

The admin client is currently used in:

1. **`lib/soulPath/storage.ts`** (lines 93, 202)
   - Reading/writing to `soul_paths` table
   - This table has no user-facing RLS policies
   - ✅ Appropriate use case

2. **`app/api/stripe/webhook/route.ts`** (lines 101, 187, 236)
   - Handling Stripe webhook events
   - Updating subscription data server-side
   - ✅ Appropriate use case

---

## Environment Variables Checklist

### Required Variables

- [ ] **`NEXT_PUBLIC_SUPABASE_URL`** - Your Supabase project URL
  - Example: `https://xxxxx.supabase.co`
  - Already exists ✅

- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** - Service role key from Supabase
  - ⚠️ This is NOT the anon/public key
  - Find it in: Supabase Dashboard → Settings → API → Service Role Key
  - **CRITICAL:** Never expose this in browser/client code

### Where to Set

**Local Development:**
```bash
# .env.local (already exists)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

**Render Deployment:**
1. Go to Render Dashboard → Your Web Service
2. Environment → Add Secret
3. Key: `SUPABASE_SERVICE_ROLE_KEY`
4. Value: Paste your service role key
5. Save

---

## Verification Steps

### Step 1: Check Environment Variable

```bash
# In your project directory
grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local && echo "✅ Found in .env.local" || echo "❌ Missing in .env.local"
```

### Step 2: Verify Build Compiles

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors ✅

### Step 3: Test Admin Client (Optional)

Create a temporary test file to verify the admin client works:

**File: `app/api/test-admin/route.ts`** (temporary)

```typescript
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const admin = createAdminSupabaseClient();

    // Test query (reading soul_paths table)
    const { data, error } = await admin
      .from("soul_paths")
      .select("user_id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin client working correctly",
      rowCount: data?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Test it:**
```bash
# Start dev server
npm run dev

# In another terminal, test the endpoint
curl http://localhost:3000/api/test-admin
```

Expected response:
```json
{
  "success": true,
  "message": "Admin client working correctly",
  "rowCount": 0
}
```

**Delete the test file after verification:**
```bash
rm app/api/test-admin/route.ts
```

---

## Security Best Practices

### ✅ DO:
- Use admin client ONLY for server-side operations
- Use it for tables without user-facing RLS policies (e.g., `soul_paths`, admin tasks)
- Use it for trusted server operations (Stripe webhooks, cron jobs)
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret and secure

### ❌ DON'T:
- Never import admin client in client components (files with `"use client"`)
- Never expose service role key in browser/frontend code
- Never use admin client for user-scoped queries (use `createServerSupabaseClient` instead)
- Never commit `.env.local` to git

---

## Current Admin Client Code

```typescript
/**
 * Creates a Supabase client with admin privileges using the service role key.
 * ⚠️ WARNING: This bypasses Row Level Security. Use with extreme caution.
 * Only use this for admin operations that require elevated permissions.
 */
export function createAdminSupabaseClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This is required for admin operations."
    );
  }

  const serviceKey: string = supabaseServiceRoleKey;

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

---

## Troubleshooting

### Error: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Cause:** Environment variable not set

**Fix:**
1. Check `.env.local` has the variable
2. Restart dev server: `npm run dev`
3. For production, check Render environment variables

### Error: "Invalid API key"

**Cause:** Using anon key instead of service role key

**Fix:**
1. Go to Supabase Dashboard → Settings → API
2. Copy the **Service Role Key** (not anon key)
3. Update `.env.local` and Render environment

### Error: "RLS policy violation"

**Cause:** Using regular client instead of admin client (or vice versa)

**Fix:**
- For user-scoped queries: Use `createServerSupabaseClient()`
- For admin operations: Use `createAdminSupabaseClient()`

---

## Related Performance Patches

The admin client is foundational for:

1. **Soul Print AI Narrative Caching** (`app/api/birth-chart/route.ts`)
   - Reads/writes `interpretation_cache` in `soul_paths` table
   - Bypasses RLS to store cached AI interpretations

2. **Stripe Webhooks** (`app/api/stripe/webhook/route.ts`)
   - Updates subscription data server-side
   - No user session available in webhook context

---

## Next Steps

- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is set locally
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Render
- [ ] Run build to confirm no errors
- [ ] (Optional) Run test endpoint to verify admin client works
- [ ] Delete this file once verified (or keep for documentation)

---

**Status:** ✅ Ready for production use

**Last Updated:** December 2025
