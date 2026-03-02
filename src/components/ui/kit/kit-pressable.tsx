import {
  Platform,
  Pressable,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { triggerHaptic } from "./native-interaction";
import type { KitPressableProps } from "./types";
import { useKitTheme } from "./use-kit-theme";

function resolveStyle(
  style:
    | StyleProp<ViewStyle>
    | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>)
    | undefined,
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> | undefined {
  if (!style) {
    return undefined;
  }

  if (typeof style === "function") {
    return resolveStyle(style(state), state);
  }

  if (Array.isArray(style)) {
    const flattened: StyleProp<ViewStyle>[] = [];
    for (const entry of style) {
      const resolved = resolveStyle(entry as StyleProp<ViewStyle>, state);
      if (resolved) {
        flattened.push(resolved);
      }
    }
    return flattened.length > 0 ? flattened : undefined;
  }

  return style;
}

export function KitPressable({
  children,
  style,
  pressStyle,
  onPress,
  disabled = false,
  haptic = "selection",
  nativeFeedback = true,
  pressedOpacity = 0.92,
  rippleRadius,
  borderlessRipple = false,
  ...props
}: KitPressableProps) {
  const { interaction } = useKitTheme();
  const rippleColor =
    typeof interaction.ripple === "string" ? interaction.ripple : "rgba(0,0,0,0.14)";

  // Emergency fallback: keep this primitive as close as possible to native Pressable
  // while preserving the Kit API surface for consumers.

  const androidRipple =
    nativeFeedback && Platform.OS === "android"
      ? {
          color: rippleColor,
          ...(rippleRadius ? { radius: rippleRadius } : {}),
          borderless: borderlessRipple,
        }
      : undefined;

  return (
    <Pressable
      disabled={disabled}
      onPress={(event) => {
        if (!disabled && haptic !== "none") {
          triggerHaptic(haptic);
        }
        onPress?.(event);
      }}
      android_ripple={androidRipple}
      style={(state) => {
        const baseStyle = resolveStyle(style, state);
        const activePressStyle =
          state.pressed && !disabled
            ? (resolveStyle(pressStyle, state) ?? { opacity: pressedOpacity })
            : null;
        return [baseStyle, activePressStyle];
      }}
      {...props}
    >
      {children}
    </Pressable>
  );
}
