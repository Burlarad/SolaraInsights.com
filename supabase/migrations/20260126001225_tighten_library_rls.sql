

-- Tighten global library RLS: service-role only reads/writes
-- Removes authenticated read access so users cannot enumerate global "books".

-- === Charts ===
DROP POLICY IF EXISTS "Anyone can read charts" ON public.charts;

CREATE POLICY "Service role can read charts"
  ON public.charts FOR SELECT
  TO service_role
  USING (true);

-- === Numerology Library ===
DROP POLICY IF EXISTS "Anyone can read numerology" ON public.numerology_library;

CREATE POLICY "Service role can read numerology"
  ON public.numerology_library FOR SELECT
  TO service_role
  USING (true);