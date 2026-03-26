// TopSheet layout constants

// Bottom chrome estimates
export const MIN_BOTTOM_CHROME_ESTIMATE = 80;
export const TAB_BAR_ESTIMATE = 64;

// Animation durations (ms)
export const ANIMATION_DURATION_BACKGROUND = 220;
export const ANIMATION_DURATION_EXPANDED_PROGRESS = 180;

// Gesture configuration
export const GESTURE_ACTIVE_OFFSET_Y: [number, number] = [-4, 4];
export const GESTURE_FAIL_OFFSET_X: [number, number] = [-18, 18];
export const VELOCITY_THRESHOLD = 500;

// Reveal animation
export const REVEAL_TRANSLATE_OFFSET = 8;

// Sheet spring physics
export const SHEET_SPRING = {
  damping: 24,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: true as const,
};

// Default snap steps as fractions of available content area
export const DEFAULT_STEPS = [0.16, 0.4, 0.65, 0.95] as const;

// Drag handle dimensions
export const HANDLE_HEIGHT = 44;
export const HANDLE_PILL_WIDTH = 36;
export const HANDLE_PILL_HEIGHT = 4;
