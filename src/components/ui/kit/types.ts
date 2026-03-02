import type { SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import type {
  GestureResponderEvent,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextInputProps,
  ViewStyle,
} from "react-native";

export type KitPressableHaptic = "none" | "selection" | "impact";

export type KitPressableProps = Omit<PressableProps, "android_ripple" | "children" | "style"> & {
  children: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  pressStyle?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  haptic?: KitPressableHaptic;
  nativeFeedback?: boolean;
  pressedOpacity?: number;
  rippleRadius?: number;
  borderlessRipple?: boolean;
};

export type KitButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type KitButtonSize = "sm" | "md" | "lg";

export type KitButtonProps = {
  label: string;
  onPress: (event?: GestureResponderEvent) => void;
  variant?: KitButtonVariant;
  size?: KitButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: SymbolViewProps["name"];
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

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

export type KitFabProps = {
  icon: ReactNode;
  onPress: () => void;
  badgeLabel?: string;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type KitStatusBadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

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
