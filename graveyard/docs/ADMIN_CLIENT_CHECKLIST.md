# 🚀 Admin Supabase Client - Final Setup Checklist

## Current Status: ✅ Code Implemented | ⚠️ Environment Variable Needed

---

## What's Already Done ✅

1. ✅ **Admin client code added** to `lib/supabase/server.ts`
2. ✅ **Function exported**: `createAdminSupabaseClient()`
3. ✅ **Security warnings** in code comments
4. ✅ **Build compiles** successfully with no TypeScript errors
5. ✅ **Already in use** in:
   - `lib/soulPath/storage.ts` (Soul Path caching)
   - `app/api/stripe/webhook/route.ts` (Stripe webhooks)

---

## What You Need to Do 🎯

### 1. Add Service Role Key to `.env.local`

**Action Required:**

```bash
# Edit .env.local and add this line:
echo "SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key-here" >> .env.local
```

**Where to find the key:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your Solara project
3. Settings → API
4. Copy the **Service Role Key** (labeled "service_role secret")
   - ⚠️ NOT the "anon public" key
   - ⚠️ This key bypasses RLS - keep it secret!

**Your `.env.local` should look like this:**

```bash
# Add your environment variables here
REDIS_URL=rediss://red-d44nfr75r7bs73b1jjg0:EdFnxze2g0nyR1NiYKGAvv5Jcsv18hGq@oregon-keyvalue.render.com:6379

# Supabase Admin (Service Role) - REQUIRED for caching and admin operations
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-full-key-here
```

---

### 2. Add Service Role Key to Render (Production)

**For production deployment on Render:**

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your Solara web service
3. Environment → Add Secret
4. Key: `SUPABASE_SERVICE_ROLE_KEY`
5. Value: Paste the same service role key
6. Save Changes

---

### 3. Verify It Works (Optional but Recommended)

**Quick Test:**

```bash
# Start dev server
npm run dev

# Create a test file (temporary)
cat > app/api/test-admin/route.ts << 'EOF'
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const admin = createAdminSupabaseClient();

    // Test query
    const { data, error } = await admin
      .from("soul_paths")
      .select("user_id")
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Admin client working!",
      rowCount: data?.length || 0
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
EOF

# Test it
curl http://localhost:3000/api/test-admin

# Expected response:
# {"success":true,"message":"Admin client working!","rowCount":0}

# Clean up
rm app/api/test-admin/route.ts
```

---

## Security Checklist ✅

Before deploying to production, verify:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local` (for local dev)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Render environment (for production)
- [ ] The key is the **service role key**, not the anon key
- [ ] `.env.local` is in `.gitignore` (never commit secrets!)
- [ ] Admin client is only imported in server-side files (no `"use client"` files)
- [ ] Build compiles: `npm run build`

---

## How the Admin Client is Used

### Current Usage (Production-Ready)

1. **Soul Path Caching** (`lib/soulPath/storage.ts`)
   ```typescript
   const supabase = createAdminSupabaseClient();
   await supabase.from("soul_paths").select("...").eq("user_id", userId);
   ```
   - **Why admin?** The `soul_paths` table has no user-facing RLS policies
   - **Purpose:** Store/retrieve AI-generated birth chart interpretations

2. **Stripe Webhooks** (`app/api/stripe/webhook/route.ts`)
   ```typescript
   const supabase = createAdminSupabaseClient();
   await supabase.from("profiles").update({ subscription_status: "active" });
   ```
   - **Why admin?** Webhooks run server-side with no user session
   - **Purpose:** Update subscription data from Stripe events

### Future Usage (From Performance Patches)

3. **Birth Chart API** (`app/api/birth-chart/route.ts`)
   - Will use admin client to cache AI interpretations
   - Reduces OpenAI costs by 90%
   - See: `ADMIN_CLIENT_SETUP.md` for details

---

## Troubleshooting

### Error: "Missing SUPABASE_SERVICE_ROLE_KEY"

**Solution:** Add the environment variable to `.env.local` (see step 1 above)

### Error: "Invalid API key"

**Cause:** Using the anon key instead of service role key

**Solution:**
1. Go to Supabase Dashboard → Settings → API
2. Copy the **Service Role Key** (bottom section)
3. Update `.env.local`

### Error: "Build fails with import errors"

**Cause:** Trying to import admin client in a client component

**Solution:** Only import in server-side files:
- ✅ API routes (`app/api/*/route.ts`)
- ✅ Server Components (no `"use client"`)
- ✅ Server Actions (`"use server"`)
- ❌ Client Components (`"use client"`)

---

## Next Steps

After adding the service role key:

1. **Test locally:**
   ```bash
   npm run dev
   # Visit http://localhost:3000/sanctuary/birth-chart
   # Should work without errors
   ```

2. **Deploy to production:**
   ```bash
   git add .
   git commit -m "Add admin client for RLS bypass operations"
   git push
   ```

3. **Monitor logs:**
   - Check Render logs for any errors related to Supabase
   - Should see successful soul_paths queries
   - Should see successful Stripe webhook processing

---

## Reference

- **Documentation:** See [ADMIN_CLIENT_SETUP.md](./ADMIN_CLIENT_SETUP.md) for detailed setup
- **Code:** See [lib/supabase/server.ts](./lib/supabase/server.ts) for implementation
- **Supabase Docs:** https://supabase.com/docs/guides/api#the-service_role-key

---

**Status:** ⚠️ **Action Required** - Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`

**Priority:** 🔴 **High** - Required for Soul Path caching and Stripe webhooks to work

**Estimated Time:** 2 minutes

---

Last updated: December 2025
