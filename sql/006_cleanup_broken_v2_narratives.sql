-- ============================================================================
-- CLEANUP: Remove broken v2 Soul Print narratives
-- ============================================================================
--
-- Problem: Some v2 narratives were stored with empty coreSummary.headline
-- and coreSummary.overallVibe fields, causing the UI to show fallback message.
--
-- This script clears ONLY broken v2 rows so they regenerate correctly.
-- ============================================================================

-- First, audit how many broken rows exist
SELECT
  COUNT(*) AS total_v2_rows,
  COUNT(*) FILTER (
    WHERE coalesce(soul_path_narrative_json->'coreSummary'->>'headline','') = ''
       OR coalesce(soul_path_narrative_json->'coreSummary'->>'overallVibe','') = ''
  ) AS broken_rows
FROM public.soul_paths
WHERE narrative_prompt_version = 2
  AND soul_path_narrative_json IS NOT NULL;

-- Preview which rows will be affected (dry run)
SELECT
  user_id,
  narrative_prompt_version,
  narrative_language,
  narrative_generated_at,
  length(coalesce(soul_path_narrative_json->'coreSummary'->>'headline','')) AS headline_len,
  length(coalesce(soul_path_narrative_json->'coreSummary'->>'overallVibe','')) AS overallVibe_len
FROM public.soul_paths
WHERE narrative_prompt_version = 2
  AND soul_path_narrative_json IS NOT NULL
  AND (
    coalesce(soul_path_narrative_json->'coreSummary'->>'headline','') = ''
    OR coalesce(soul_path_narrative_json->'coreSummary'->>'overallVibe','') = ''
  );

-- ============================================================================
-- EXECUTE: Clear broken v2 narratives (run this after reviewing the preview)
-- ============================================================================

UPDATE public.soul_paths
SET
  soul_path_narrative_json = NULL,
  narrative_generated_at = NULL,
  narrative_prompt_version = NULL,
  narrative_language = NULL,
  narrative_model = NULL
WHERE narrative_prompt_version = 2
  AND soul_path_narrative_json IS NOT NULL
  AND (
    coalesce(soul_path_narrative_json->'coreSummary'->>'headline','') = ''
    OR coalesce(soul_path_narrative_json->'coreSummary'->>'overallVibe','') = ''
  );

-- Verify cleanup
SELECT
  COUNT(*) AS remaining_v2_rows,
  COUNT(*) FILTER (
    WHERE coalesce(soul_path_narrative_json->'coreSummary'->>'headline','') = ''
       OR coalesce(soul_path_narrative_json->'coreSummary'->>'overallVibe','') = ''
  ) AS still_broken
FROM public.soul_paths
WHERE narrative_prompt_version = 2
  AND soul_path_narrative_json IS NOT NULL;
