import type { ReactNode } from "react";
import type { SymbolViewProps } from "expo-symbols";
import type { GestureResponderEvent, StyleProp, TextInputProps, ViewStyle } from "react-native";

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

