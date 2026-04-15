const DEFAULT_COMMUTE_SPEED_KMH = 30;
const AVERAGE_DISTANCE_FACTOR = 0.67;

export function estimateAverageCommuteMinutes(radiusKm: number) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    return null;
  }

  const averageTravelKm = radiusKm * AVERAGE_DISTANCE_FACTOR;
  const minutes = (averageTravelKm / DEFAULT_COMMUTE_SPEED_KMH) * 60;
  return Math.max(1, Math.round(minutes));
}
