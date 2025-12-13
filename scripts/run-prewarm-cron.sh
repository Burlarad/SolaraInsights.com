#!/usr/bin/env bash
# Solara Prewarm Cron Helper
# Calls the prewarm-insights endpoint with proper authentication

set -euo pipefail

# Configuration
APP_URL="${APP_URL:-https://solarainsights.com}"
ENDPOINT="/api/cron/prewarm-insights"

# Validate CRON_SECRET is set
if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "Error: CRON_SECRET environment variable is not set" >&2
  exit 1
fi

# Make the request
curl -fsS \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${APP_URL}${ENDPOINT}"
