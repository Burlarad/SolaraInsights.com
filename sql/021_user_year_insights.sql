-- =============================================================================
-- 021_user_year_insights.sql
-- User Year Insights Table
--
-- Stores user-specific yearly insights that combine:
-- - Global astronomical events (from global_astrology_events)
-- - User's natal chart (transits to natal positions)
-- - Personal transit aspects calculated on-demand
--
-- Stone tablet pattern: once generated for a user+year+language, immutable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: user_year_insights
-- One record per user per year per language
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_year_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User this insight belongs to
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Year this insight covers (e.g., 2025)
  year INTEGER NOT NULL,

  -- Language code (e.g., "en", "es", "fr")
  language TEXT NOT NULL DEFAULT 'en',

  -- Prompt version for cache invalidation
  prompt_version INTEGER NOT NULL DEFAULT 1,

  -- The generated narrative (markdown)
  narrative TEXT NOT NULL,

  -- Structured events used to generate the narrative
  -- JSON array of: { type, planet, sign?, date, description }
  events_json JSONB NOT NULL DEFAULT '[]',

  -- User-specific transit aspects found for this year
  -- JSON array of: { transitPlanet, natalPlanet, aspectType, dates: [...] }
  personal_transits_json JSONB NOT NULL DEFAULT '[]',

  -- Token usage for audit
  tokens_used INTEGER,
  model_used TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicates: one insight per user/year/language/version
  CONSTRAINT unique_user_year_insight UNIQUE (user_id, year, language, prompt_version)
);

-- -----------------------------------------------------------------------------
-- TABLE: user_year_transit_aspects
-- Optional: Store individual transit-to-natal aspects for detailed queries
-- Denormalized for fast lookups of "what transits affect me this month?"
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_year_transit_aspects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User this aspect belongs to
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Year for partitioning
  year INTEGER NOT NULL,

  -- Transit planet (the moving planet)
  transit_planet TEXT NOT NULL,

  -- Natal planet (the fixed birth chart position)
  natal_planet TEXT NOT NULL,

  -- Type of aspect
  aspect_type TEXT NOT NULL CHECK (aspect_type IN (
    'conjunction', 'sextile', 'square', 'trine', 'opposition'
  )),

  -- When the aspect is exact (can occur multiple times due to retrogrades)
  exact_time TIMESTAMPTZ NOT NULL,

  -- Julian day for the exact moment
  julian_day DOUBLE PRECISION NOT NULL,

  -- Orb at exactitude (should be ~0)
  orb DOUBLE PRECISION NOT NULL DEFAULT 0,

  -- Is this during a retrograde pass?
  is_retrograde_pass BOOLEAN NOT NULL DEFAULT FALSE,

  -- Pass number for multi-pass aspects (1, 2, or 3)
  pass_number INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate aspects
  CONSTRAINT unique_user_transit_aspect UNIQUE (
    user_id, year, transit_planet, natal_planet, aspect_type, exact_time
  )
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- User year insights: primary lookup
CREATE INDEX IF NOT EXISTS idx_user_year_insights_lookup
  ON user_year_insights(user_id, year, language);

-- User year insights: by year for cleanup
CREATE INDEX IF NOT EXISTS idx_user_year_insights_year
  ON user_year_insights(year);

-- Transit aspects: by user and year
CREATE INDEX IF NOT EXISTS idx_user_transit_aspects_user_year
  ON user_year_transit_aspects(user_id, year);

-- Transit aspects: temporal ordering
CREATE INDEX IF NOT EXISTS idx_user_transit_aspects_time
  ON user_year_transit_aspects(user_id, year, exact_time);

-- Transit aspects: by transit planet (for "Mercury retrograde" queries)
CREATE INDEX IF NOT EXISTS idx_user_transit_aspects_transit
  ON user_year_transit_aspects(year, transit_planet, aspect_type);

-- -----------------------------------------------------------------------------
-- RLS POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE user_year_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_year_transit_aspects ENABLE ROW LEVEL SECURITY;

-- Users can only read their own insights
CREATE POLICY user_year_insights_select ON user_year_insights
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only read their own transit aspects
CREATE POLICY user_transit_aspects_select ON user_year_transit_aspects
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for cron/API routes)
CREATE POLICY user_year_insights_service ON user_year_insights
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY user_transit_aspects_service ON user_year_transit_aspects
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE user_year_insights IS
  'Stone tablet storage for user yearly insights. One per user/year/language/version.';

COMMENT ON TABLE user_year_transit_aspects IS
  'Denormalized transit-to-natal aspects for each user. Enables "what transits affect me this month?" queries.';

COMMENT ON COLUMN user_year_insights.events_json IS
  'JSON array of global + personal events used in narrative generation. Format: [{type, planet, sign?, date, description}]';

COMMENT ON COLUMN user_year_insights.personal_transits_json IS
  'JSON array of user-specific transit aspects. Format: [{transitPlanet, natalPlanet, aspectType, dates: [...]}]';
