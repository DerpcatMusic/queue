import type { ReactNode } from "react";
import type { GestureResponderEvent } from "react-native";

export type AppButtonTone = "primary" | "secondary";
export type AppButtonShape = "pill" | "square";
export type AppButtonSize = "md" | "lg";

export type AppButtonColors = {
  backgroundColor?: string;
  pressedBackgroundColor?: string;
  disabledBackgroundColor?: string;
  labelColor?: string;
  disabledLabelColor?: string;
  nativeTintColor?: string;
};

export type AppButtonProps = {
  label?: string;
  onPress: (event?: GestureResponderEvent) => void;
  tone?: AppButtonTone;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  shape?: AppButtonShape;
  size?: AppButtonSize;
  native?: boolean;
  radius?: number;
  dimension?: number;
  colors?: AppButtonColors;
  haptic?: boolean;
  labelStyle?: object;
};
