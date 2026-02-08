-- ============================================================================
-- ADD NARRATIVE COLUMNS TO CHARTS TABLE
-- ============================================================================
-- Unifies the Library Book model: math (geometry) + narrative stored together
-- in the same charts record.
--
-- Previously: geometry in charts.geometry_json, narrative in soul_paths (Stone Tablets)
-- Now: Both live in charts table, eliminating the split
--
-- Key principle: Book = Math + Narrative, stored together by deterministic key
--
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- 1. ADD NARRATIVE COLUMNS TO CHARTS
-- ============================================================================
-- All columns nullable - charts can exist without narrative initially
-- Narrative generated on first access, then cached

ALTER TABLE public.charts
  ADD COLUMN IF NOT EXISTS narrative_json JSONB,
  ADD COLUMN IF NOT EXISTS narrative_prompt_version INTEGER,
  ADD COLUMN IF NOT EXISTS narrative_language TEXT,
  ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ;

-- ============================================================================
-- 2. COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.charts.narrative_json IS
  'AI-generated soul path narrative (FullBirthChartInsight). NULL if not yet generated. Cached once generated.';

COMMENT ON COLUMN public.charts.narrative_prompt_version IS
  'Version of the prompt used to generate narrative. Used for cache invalidation when prompts change.';

COMMENT ON COLUMN public.charts.narrative_language IS
  'Language code for narrative (e.g., "en", "es"). Allows multi-language support.';

COMMENT ON COLUMN public.charts.narrative_generated_at IS
  'Timestamp when narrative was generated. NULL if not yet generated.';

-- ============================================================================
-- 3. PARTIAL INDEX FOR MISSING NARRATIVES
-- ============================================================================
-- Enables efficient queries to find charts that need narrative generation
-- (e.g., for background processing or lazy generation)

CREATE INDEX IF NOT EXISTS idx_charts_missing_narrative
  ON public.charts(chart_key)
  WHERE narrative_json IS NULL;

-- ============================================================================
-- 4. INDEX FOR PROMPT VERSION CACHE INVALIDATION
-- ============================================================================
-- Enables efficient queries to find charts with outdated narrative versions

CREATE INDEX IF NOT EXISTS idx_charts_narrative_version
  ON public.charts(narrative_prompt_version)
  WHERE narrative_json IS NOT NULL;

-- ============================================================================
-- 5. UPDATE TABLE COMMENT
-- ============================================================================

COMMENT ON TABLE public.charts IS
  'Global library of computed birth charts with AI narratives. Deduplicated by deterministic chart_key. Book = Math (geometry_json) + Narrative (narrative_json) stored together.';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
--
-- Check narrative columns added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'charts'
-- AND column_name LIKE 'narrative%';
--
-- Check partial index exists:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'charts' AND indexname = 'idx_charts_missing_narrative';
--
-- Count charts missing narrative:
-- SELECT COUNT(*) FROM public.charts WHERE narrative_json IS NULL;
--
