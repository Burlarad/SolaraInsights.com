#!/bin/bash

# Birth Chart API Fix Verification Script
# Verifies that the fix is working correctly

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Birth Chart API Fix - Verification Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if changes were applied
echo "[1/5] Verifying changes applied..."

if grep -q '"/api/birth-chart"' app/\(protected\)/sanctuary/birth-chart/page.tsx; then
  echo "✅ Frontend calls correct endpoint: /api/birth-chart"
else
  echo "❌ ERROR: Frontend still calls wrong endpoint"
  exit 1
fi

if grep -q 'data?.error === "Incomplete profile"' app/\(protected\)/sanctuary/birth-chart/page.tsx; then
  echo "✅ Error handling updated for old endpoint format"
else
  echo "❌ ERROR: Error handling not updated"
  exit 1
fi

echo ""
echo "[2/5] Checking old endpoint exists..."

if [ -f app/api/birth-chart/route.ts ]; then
  echo "✅ Old endpoint file exists"
else
  echo "❌ ERROR: Old endpoint file missing"
  exit 1
fi

echo ""
echo "[3/5] Verifying endpoint returns correct shape..."

# Check that old endpoint returns { placements, insight }
if grep -q 'placements: swissPlacements' app/api/birth-chart/route.ts; then
  echo "✅ Old endpoint returns 'placements' field"
else
  echo "❌ ERROR: Old endpoint missing 'placements' field"
  exit 1
fi

if grep -q 'insight,' app/api/birth-chart/route.ts; then
  echo "✅ Old endpoint returns 'insight' field"
else
  echo "❌ ERROR: Old endpoint missing 'insight' field"
  exit 1
fi

echo ""
echo "[4/5] Checking test files..."

if [ -f __tests__/api/birth-chart-response-shape.test.ts ]; then
  echo "✅ Response shape test file created"
else
  echo "⚠️  WARNING: Response shape test file not found (optional)"
fi

echo ""
echo "[5/5] Checking documentation..."

if [ -f docs/audit/BIRTH_CHART_API_MISMATCH_AUDIT.md ]; then
  echo "✅ Root cause documentation exists"
else
  echo "⚠️  WARNING: Documentation file not found (optional)"
fi

if [ -f docs/BIRTH_CHART_API_FIX_SUMMARY.md ]; then
  echo "✅ Fix summary documentation exists"
else
  echo "⚠️  WARNING: Fix summary not found (optional)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VERIFICATION COMPLETE - All checks passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Visit: http://localhost:3000/sanctuary/birth-chart"
echo "3. Open DevTools Network tab"
echo "4. Verify request goes to /api/birth-chart"
echo "5. Verify response has 'placements' and 'insight' fields"
echo "6. Verify UI shows interpretation (not 'not available' message)"
echo ""
echo "If all checks pass, deploy with:"
echo "  git add ."
echo "  git commit -m \"fix(astrology): revert to working birth-chart endpoint\""
echo "  git push"
echo ""
