const RADIUS_MIN_KM = 0.25;
const RADIUS_MAX_KM = 40;
const RADIUS_LOW_BREAKPOINT_KM = 5;
const RADIUS_MID_BREAKPOINT_KM = 15;
const SLIDER_LOW_BREAKPOINT = 0.7;
const SLIDER_MID_BREAKPOINT = 0.9;

const H3_APPROX_EDGE_LENGTH_KM_BY_RESOLUTION: Record<number, number> = {
  9: 0.200786148,
  8: 0.53141401,
  7: 1.406475763,
  6: 3.724532667,
  5: 9.85409099,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function normalize(value: number, start: number, end: number) {
  if (end === start) return 0;
  return (value - start) / (end - start);
}

export function roundRadiusKm(value: number) {
  const clamped = clamp(value, RADIUS_MIN_KM, RADIUS_MAX_KM);
  return Math.round(clamped / 0.25) * 0.25;
}

export function radiusKmToSliderValue(radiusKm: number) {
  const clamped = clamp(radiusKm, RADIUS_MIN_KM, RADIUS_MAX_KM);

  if (clamped <= RADIUS_LOW_BREAKPOINT_KM) {
    return interpolate(0, SLIDER_LOW_BREAKPOINT, normalize(clamped, RADIUS_MIN_KM, RADIUS_LOW_BREAKPOINT_KM));
  }

  if (clamped <= RADIUS_MID_BREAKPOINT_KM) {
    return interpolate(
      SLIDER_LOW_BREAKPOINT,
      SLIDER_MID_BREAKPOINT,
      normalize(clamped, RADIUS_LOW_BREAKPOINT_KM, RADIUS_MID_BREAKPOINT_KM),
    );
  }

  return interpolate(
    SLIDER_MID_BREAKPOINT,
    1,
    normalize(clamped, RADIUS_MID_BREAKPOINT_KM, RADIUS_MAX_KM),
  );
}

export function sliderValueToRadiusKm(sliderValue: number) {
  const clamped = clamp(sliderValue, 0, 1);

  if (clamped <= SLIDER_LOW_BREAKPOINT) {
    return interpolate(
      RADIUS_MIN_KM,
      RADIUS_LOW_BREAKPOINT_KM,
      normalize(clamped, 0, SLIDER_LOW_BREAKPOINT),
    );
  }

  if (clamped <= SLIDER_MID_BREAKPOINT) {
    return interpolate(
      RADIUS_LOW_BREAKPOINT_KM,
      RADIUS_MID_BREAKPOINT_KM,
      normalize(clamped, SLIDER_LOW_BREAKPOINT, SLIDER_MID_BREAKPOINT),
    );
  }

  return interpolate(
    RADIUS_MID_BREAKPOINT_KM,
    RADIUS_MAX_KM,
    normalize(clamped, SLIDER_MID_BREAKPOINT, 1),
  );
}

export function getApproxCoverageResolution(radiusKm: number) {
  for (const resolution of [9, 8, 7, 6, 5] as const) {
    const edgeLengthKm = H3_APPROX_EDGE_LENGTH_KM_BY_RESOLUTION[resolution]!;
    if (Math.ceil(radiusKm / edgeLengthKm) <= 10) {
      return resolution;
    }
  }
  return 5;
}
