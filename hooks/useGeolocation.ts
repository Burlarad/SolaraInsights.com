/**
 * useGeolocation hook - convenient re-export from GeolocationContext
 *
 * Usage:
 *   import { useGeolocation } from '@/hooks/useGeolocation';
 *
 *   const { timezone, coords, consentStatus } = useGeolocation();
 */

export { useGeolocation } from "@/contexts/GeolocationContext";
export type {
  GeolocationState,
  GeolocationContextValue,
  ConsentStatus,
  LocationSource,
} from "@/contexts/GeolocationContext";
