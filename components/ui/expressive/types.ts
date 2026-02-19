import type { ReactNode } from "react";
import type {
  GestureResponderEvent,
  StyleProp,
  TextInputProps,
  ViewProps,
  ViewStyle,
} from "react-native";

export type ExpressiveTone = "default" | "elevated" | "glass";

export type ExpressiveSurfaceProps = ViewProps & {
  tone?: ExpressiveTone;
  padding?: number;
  gap?: number;
};

export type ExpressiveButtonVariant = "primary" | "secondary" | "ghost";

export type ExpressiveButtonProps = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ExpressiveButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  leadingIcon?: ReactNode;
};

export type ExpressiveTextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
};

export type ExpressiveChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export type ExpressiveFabProps = {
  icon: ReactNode;
  onPress: () => void;
  badgeLabel?: string;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};
