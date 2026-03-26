import { Radius, Spacing } from "@/theme/theme";

export const MIN_BOTTOM_CHROME_ESTIMATE = 80;
export const TAB_BAR_ESTIMATE = 64;

export const ANIMATION_DURATION_BACKGROUND = 220;
export const ANIMATION_DURATION_EXPANDED_PROGRESS = 180;
export const ANIMATION_DURATION_ENTER = 140;
export const ANIMATION_DURATION_EXIT = 90;

export const GESTURE_ACTIVE_OFFSET_Y: [number, number] = [-4, 4];
export const GESTURE_FAIL_OFFSET_X: [number, number] = [-18, 18];
export const VELOCITY_THRESHOLD = 500;
export const REVEAL_TRANSLATE_OFFSET = 8;

export const DEFAULT_STEPS = [0.16, 0.4, 0.65, 0.95] as const;
export const HANDLE_HEIGHT = 36;
export const HANDLE_PILL_WIDTH = 36;
export const HANDLE_PILL_HEIGHT = 4;
export const SHEET_CORNER_RADIUS = Radius.card + Spacing.xs;

export const SHEET_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: true as const,
};
