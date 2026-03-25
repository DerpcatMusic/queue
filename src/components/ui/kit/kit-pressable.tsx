import type { ReactNode } from "react";
import {
  type AccessibilityState,
  I18nManager,
  Pressable,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { triggerSelectionHaptic } from "./native-interaction";

type KitPressableTone = "primary" | "primarySubtle" | "secondary" | "surface";

type KitPressableVariant = "solid" | "soft";

type KitPressableBorderConfig = {
  width?: number;
  color?: string;
};

type KitPressablePaddingConfig = {
  horizontal?: number;
  vertical?: number;
};

type KitPressableSizeConfig = {
  minHeight?: number;
  minWidth?: number;
  borderRadius?: number;
  width?: ViewStyle["width"];
};

type KitPressableLayoutConfig = {
  alignSelf?: ViewStyle["alignSelf"];
};

type KitPressableStyleConfig = {
  tone?: KitPressableTone;
  variant?: KitPressableVariant;
  padding?: KitPressablePaddingConfig;
  size?: KitPressableSizeConfig;
  layout?: KitPressableLayoutConfig;
  border?: KitPressableBorderConfig;
  backgroundColor?: string;
  pressedBackgroundColor?: string;
  disabledBackgroundColor?: string;
  borderColor?: string;
  pressedBorderColor?: string;
  disabledBorderColor?: string;
};

type KitPressableProps = {
  children: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string | undefined;
  accessibilityState?: AccessibilityState;
  accessibilityRole?:
    | "button"
    | "checkbox"
    | "radio"
    | "menuitem"
    | "tab"
    | "switch"
    | "link"
    | "none";
  style?: KitPressableStyleConfig;
  containerStyle?: StyleProp<ViewStyle>;
  haptic?: boolean;
  testID?: string;
};

/**
 * Derives pressed/disabled background colors from tone/variant and base backgroundColor.
 */
function deriveSemanticColors(
  tone: KitPressableTone,
  variant: KitPressableVariant,
  baseColor: string,
  theme: {
    color: {
      primaryPressed: string;
      surfaceElevated: string;
      surface: string;
      primarySubtle: string;
    };
  },
) {
  const isSoft = variant === "soft";
  const isPrimary = tone === "primary" || tone === "primarySubtle";

  if (isPrimary) {
    return {
      pressed: theme.color.primaryPressed,
      disabled: isSoft ? theme.color.primarySubtle : theme.color.primaryPressed,
    };
  }
  return {
    pressed: isSoft ? theme.color.surfaceElevated : baseColor,
    disabled: isSoft ? theme.color.surfaceElevated : theme.color.surface,
  };
}

export function KitPressable({
  children,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityState,
  accessibilityRole = "button",
  style,
  containerStyle,
  haptic = true,
  testID,
}: KitPressableProps) {
  const theme = useTheme();

  const {
    tone = "primary",
    variant = "solid",
    padding,
    size,
    layout,
    border,
    backgroundColor,
    pressedBackgroundColor,
    disabledBackgroundColor,
    borderColor,
    pressedBorderColor,
    disabledBorderColor,
  } = style ?? {};

  const isDisabled = disabled || loading;

  // Derive base background
  const resolvedBackgroundColor =
    backgroundColor ??
    (() => {
      switch (tone) {
        case "primary":
          return theme.color.primary;
        case "primarySubtle":
          return theme.color.primarySubtle;
        case "secondary":
          return theme.color.surfaceAlt;
        case "surface":
          return theme.color.surface;
        default:
          return theme.color.primary;
      }
    })();

  // Derive semantic colors if not explicitly provided
  const { pressed: derivedPressedBg, disabled: derivedDisabledBg } = deriveSemanticColors(
    tone,
    variant,
    resolvedBackgroundColor,
    theme,
  );

  const resolvedPressedBg = pressedBackgroundColor ?? derivedPressedBg;
  const resolvedDisabledBg = disabledBackgroundColor ?? derivedDisabledBg;

  // Border colors
  const resolvedBorderColor = borderColor ?? border?.color ?? "transparent";
  const resolvedPressedBorderColor = pressedBorderColor ?? resolvedBorderColor;
  const resolvedDisabledBorderColor = disabledBorderColor ?? resolvedBorderColor;

  // Size defaults
  const resolvedBorderRadius = size?.borderRadius ?? 8;
  const resolvedMinHeight = size?.minHeight;
  const resolvedMinWidth = size?.minWidth;
  const resolvedWidth = size?.width;
  const resolvedPaddingH = padding?.horizontal ?? 14;
  const resolvedPaddingV = padding?.vertical ?? 8;
  const resolvedBorderWidth = border?.width ?? 0;
  const resolvedAlignSelf = layout?.alignSelf;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading, ...accessibilityState }}
      disabled={isDisabled}
      onPress={
        onPress
          ? () => {
              if (haptic) triggerSelectionHaptic();
              onPress();
            }
          : undefined
      }
      style={({ pressed }: PressableStateCallbackType) => {
        const isPressed = pressed && !isDisabled;

        const resolvedBg = isDisabled
          ? resolvedDisabledBg
          : isPressed
            ? resolvedPressedBg
            : resolvedBackgroundColor;

        const resolvedBr = isDisabled
          ? resolvedDisabledBorderColor
          : isPressed
            ? resolvedPressedBorderColor
            : resolvedBorderColor;

        return [
          {
            minHeight: resolvedMinHeight,
            minWidth: resolvedMinWidth,
            width: resolvedWidth,
            alignSelf: resolvedAlignSelf,
            paddingHorizontal: resolvedPaddingH,
            paddingVertical: resolvedPaddingV,
            borderRadius: resolvedBorderRadius,
            borderCurve: "continuous",
            borderWidth: resolvedBorderWidth,
            borderColor: resolvedBr,
            backgroundColor: resolvedBg,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
          } satisfies ViewStyle,
          containerStyle,
        ];
      }}
    >
      {(state: PressableStateCallbackType) => {
        if (typeof children === "function") {
          return children(state);
        }
        return children;
      }}
    </Pressable>
  );
}
