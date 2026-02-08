/**
 * AI Metrics: Minimal observability for validator violations and signal strength
 *
 * Uses in-memory counters that can be scraped by monitoring systems.
 * Does NOT log sensitive data.
 */

// In-memory counters (reset on server restart - suitable for serverless)
// For persistent metrics, integrate with your monitoring system (Datadog, etc.)

type ViolationType = "violation" | "remediation_success" | "remediation_failed" | "remediation_error";
type SignalStrengthBucket = "0-0.25" | "0.25-0.5" | "0.5-0.75" | "0.75-1.0";

interface MetricsStore {
  validatorViolations: Record<string, Record<ViolationType, number>>;
  signalStrengthDistribution: Record<SignalStrengthBucket, number>;
}

const metrics: MetricsStore = {
  validatorViolations: {},
  signalStrengthDistribution: {
    "0-0.25": 0,
    "0.25-0.5": 0,
    "0.5-0.75": 0,
    "0.75-1.0": 0,
  },
};

/**
 * Increment validator violation counter
 */
export function incrementValidatorViolation(route: string, type: ViolationType): void {
  if (!metrics.validatorViolations[route]) {
    metrics.validatorViolations[route] = {
      violation: 0,
      remediation_success: 0,
      remediation_failed: 0,
      remediation_error: 0,
    };
  }
  metrics.validatorViolations[route][type]++;

  // Log for monitoring (safe - no sensitive data)
  console.log(`[Metrics] validator_${type} route=${route} count=${metrics.validatorViolations[route][type]}`);
}

/**
 * Record signal strength observation
 */
export function recordSignalStrength(signalStrength: number): void {
  const bucket = getSignalStrengthBucket(signalStrength);
  metrics.signalStrengthDistribution[bucket]++;
}

/**
 * Get the bucket for a signal strength value
 */
function getSignalStrengthBucket(value: number): SignalStrengthBucket {
  if (value < 0.25) return "0-0.25";
  if (value < 0.5) return "0.25-0.5";
  if (value < 0.75) return "0.5-0.75";
  return "0.75-1.0";
}

/**
 * Get current metrics snapshot (for health endpoints or monitoring)
 */
export function getMetricsSnapshot(): MetricsStore {
  return { ...metrics };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  metrics.validatorViolations = {};
  metrics.signalStrengthDistribution = {
    "0-0.25": 0,
    "0.25-0.5": 0,
    "0.5-0.75": 0,
    "0.75-1.0": 0,
  };
}
