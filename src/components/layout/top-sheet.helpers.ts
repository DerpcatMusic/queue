import { BrandSpacing } from "@/constants/brand";

export const SHEET_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: true as const,
};

export const DEFAULT_STEPS = [0.16, 0.4, 0.65, 0.95] as const;
export const HANDLE_HEIGHT = BrandSpacing.xl + BrandSpacing.md;
export const HANDLE_PILL_WIDTH = 36;
export const HANDLE_PILL_HEIGHT = 4;
export const MIN_BOTTOM_CHROME_ESTIMATE = 80;
