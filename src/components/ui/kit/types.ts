import type { ReactNode } from "react";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";

export type KitTextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export type KitChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export type KitStatusBadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type KitStatusBadgeProps = {
  label: string;
  tone?: KitStatusBadgeTone;
  showDot?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type KitFloatingBadgeMotion = "none" | "float";

export type KitFloatingBadgeProps = {
  children: ReactNode;
  visible?: boolean;
  size?: number;
  backgroundColor?: string;
  borderColor?: string;
  motion?: KitFloatingBadgeMotion;
  style?: StyleProp<ViewStyle>;
};
