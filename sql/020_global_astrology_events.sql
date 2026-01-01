-- =============================================================================
-- 020_global_astrology_events.sql
-- Global Astrology Events Table for Year Tab
--
-- Stores pre-computed global astronomical events that apply to ALL users:
-- - Season ingresses (Sun entering Aries/Cancer/Libra/Capricorn)
-- - Planet sign ingresses (any planet changing zodiac sign)
-- - Retrograde stations (planet going retrograde or direct)
--
-- These events are computed once per year via cron and cached globally.
-- User-specific interpretations layer on top of these events.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: global_astrology_events
-- Stone tablet pattern: immutable records, unique constraint prevents duplicates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS global_astrology_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Year this event belongs to (e.g., 2025)
  year INTEGER NOT NULL,

  -- Event type classification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'season_ingress',    -- Sun entering cardinal sign (equinox/solstice)
    'sign_ingress',      -- Any planet entering a new sign
    'station_retrograde', -- Planet stationing retrograde
    'station_direct'     -- Planet stationing direct
  )),

  -- Planet involved (Sun, Moon, Mercury, etc.)
  planet TEXT NOT NULL,

  -- For ingresses: the sign being entered
  -- For stations: NULL
  sign TEXT,

  -- Exact moment of the event (UTC)
  event_time TIMESTAMPTZ NOT NULL,

  -- Julian Day for the event (useful for ephemeris calculations)
  julian_day DOUBLE PRECISION NOT NULL,

  -- Longitude at event moment (degrees 0-360)
  longitude DOUBLE PRECISION NOT NULL,

  -- For season ingresses: which season (spring_equinox, summer_solstice, etc.)
  season_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate events
  CONSTRAINT unique_global_event UNIQUE (year, event_type, planet, event_time)
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Primary lookup: all events for a year
CREATE INDEX IF NOT EXISTS idx_global_events_year
  ON global_astrology_events(year);

-- Filter by event type within a year
CREATE INDEX IF NOT EXISTS idx_global_events_year_type
  ON global_astrology_events(year, event_type);

-- Filter by planet within a year
CREATE INDEX IF NOT EXISTS idx_global_events_year_planet
  ON global_astrology_events(year, planet);

-- Temporal ordering within a year
CREATE INDEX IF NOT EXISTS idx_global_events_year_time
  ON global_astrology_events(year, event_time);

-- Season ingresses specifically (4 per year, frequently queried)
CREATE INDEX IF NOT EXISTS idx_global_events_seasons
  ON global_astrology_events(year, event_type, planet)
  WHERE event_type = 'season_ingress' AND planet = 'Sun';

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE global_astrology_events IS
  'Pre-computed global astronomical events for year-based insights. Stone tablet pattern - records are immutable once created.';

COMMENT ON COLUMN global_astrology_events.event_type IS
  'Type of astronomical event: season_ingress (equinox/solstice), sign_ingress (planet enters sign), station_retrograde, station_direct';

COMMENT ON COLUMN global_astrology_events.julian_day IS
  'Julian Day number for ephemeris calculations. Stored for precision and debugging.';

COMMENT ON COLUMN global_astrology_events.season_name IS
  'For season ingresses only: spring_equinox, summer_solstice, fall_equinox, winter_solstice';
