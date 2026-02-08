-- Migration: Add structured metadata columns to social_summaries
-- Purpose: Move metadata out of HTML comments into proper DB columns for type safety
-- Also adds expires_at for future TTL support

-- Add new columns
ALTER TABLE public.social_summaries
ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS summary_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.social_summaries.metadata_json IS 'Structured social context metadata (StructuredSocialContext JSON). Replaces HTML comment embedding.';
COMMENT ON COLUMN public.social_summaries.summary_text IS 'Human-readable summary text without embedded metadata. Kept for backward compatibility with existing rows.';
COMMENT ON COLUMN public.social_summaries.expires_at IS 'Optional TTL for summary. NULL means no expiration.';

-- Create index for TTL cleanup queries (if implemented)
CREATE INDEX IF NOT EXISTS idx_social_summaries_expires_at ON public.social_summaries(expires_at)
WHERE expires_at IS NOT NULL;

-- Backfill: Extract metadata from existing HTML comments
-- This handles the <!-- SOCIAL_INSIGHTS_METADATA\n{...}\n--> format
DO $$
DECLARE
  r RECORD;
  metadata_match TEXT;
  parsed_json JSONB;
  clean_summary TEXT;
BEGIN
  FOR r IN
    SELECT id, summary
    FROM public.social_summaries
    WHERE metadata_json IS NULL
      AND summary LIKE '%<!-- SOCIAL_INSIGHTS_METADATA%'
  LOOP
    BEGIN
      -- Extract the JSON from the HTML comment
      metadata_match := (
        SELECT (regexp_matches(r.summary, '<!-- SOCIAL_INSIGHTS_METADATA\n(.*?)\n-->', 's'))[1]
      );

      IF metadata_match IS NOT NULL THEN
        -- Parse the JSON
        parsed_json := metadata_match::JSONB;

        -- Remove the HTML comment from summary to get clean text
        clean_summary := regexp_replace(
          r.summary,
          '\n*<!-- SOCIAL_INSIGHTS_METADATA[\s\S]*?-->',
          '',
          'g'
        );

        -- Update the row with extracted metadata
        UPDATE public.social_summaries
        SET
          metadata_json = parsed_json,
          summary_text = NULLIF(TRIM(clean_summary), '')
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log and continue on parsing errors
      RAISE NOTICE 'Failed to parse metadata for summary id %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- For rows without HTML comments, copy summary to summary_text
UPDATE public.social_summaries
SET summary_text = summary
WHERE metadata_json IS NULL
  AND summary_text IS NULL
  AND summary NOT LIKE '%<!-- SOCIAL_INSIGHTS_METADATA%';
