// Primitive core exports
// These are the foundational building blocks for UI composition.

export { Box } from "./box";
export { Text } from "./text";
export { Icon } from "./icon";
export { Center, HStack, Inline, Stack, VStack } from "./stack";
export { Spacer } from "./spacer";

// Re-export types for consumer convenience
export type {
  BoxProps,
  TextProps,
  IconProps,
  ColorToken,
  IconSizeToken,
  SpaceToken,
  TypographyToken,
  SpacingShorthand,
} from "./types";
export type { StackProps } from "./stack";
export type { SpacerProps } from "./spacer";
