// Temporary stub: birth chart placements generation is disabled.
import type { BirthChartPlacements } from "@/types";

interface BirthData {
  birth_date: string;
  birth_time: string | null;
  birth_city: string;
  birth_region: string;
  birth_country: string;
  timezone: string;
}

export async function generateBirthChartPlacements(
  _birthData: BirthData
): Promise<BirthChartPlacements> {
  throw new Error("Birth chart placements generation is temporarily disabled.");
}
