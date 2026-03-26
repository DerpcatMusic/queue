// Android/Web implementation using expo-symbols SymbolView with Android Symbols,
// falling back to MaterialIcons for unmapped icons.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import type { OpaqueColorValue, StyleProp, TextStyle, ViewStyle } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

/**
 * SF Symbols to Material Icon names mapping (for fallback).
 * Used when no Android Symbol mapping exists.
 */
const SF_TO_MATERIAL_MAPPING: Record<string, MaterialIconName> = {
  "archivebox.fill": "archive",
  "arrow.clockwise": "autorenew",
  "arrow.down": "south",
  "arrow.right": "arrow-forward",
  "arrow.right.square": "logout",
  "arrow.up.right": "north-east",
  "bag.badge.plus": "work-outline",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications-off",
  "briefcase.fill": "work",
  "building.2.fill": "business",
  "building.columns.fill": "account-balance",
  calendar: "calendar-today",
  "calendar.badge.minus": "event-busy",
  "calendar.badge.plus": "event-available",
  "calendar.badge.clock": "event",
  "calendar.circle.fill": "event",
  "creditcard.fill": "credit-card",
  checkmark: "check",
  "house.fill": "home",
  "map.fill": "map",
  clock: "schedule",
  "clock.fill": "access-time-filled",
  "exclamationmark.circle.fill": "error",
  "exclamationmark.circle": "error-outline",
  "flame.fill": "local-fire-department",
  globe: "language",
  "gym.bag.fill": "fitness-center",
  "mappin.and.ellipse": "place",
  "mappin.circle.fill": "location-on",
  magnifyingglass: "search",
  plus: "add",
  "plus.circle.fill": "add-circle",
  "moon.fill": "dark-mode",
  pencil: "edit",
  "person.crop.circle.fill": "account-circle",
  "person.3.sequence.fill": "groups",
  "quote.bubble.fill": "format-quote",
  "slider.horizontal.3": "tune",
  sparkles: "auto-awesome",
  "square.and.pencil": "edit",
  "checkmark.circle.fill": "check-circle",
  banknote: "payments",
  "chevron.down": "expand-more",
  "location.fill": "my-location",
  "line.3.horizontal.decrease.circle": "filter-list",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  xmark: "close",
  "xmark.circle.fill": "cancel",
};

/**
 * SF Symbols to Android Symbol names mapping.
 * Android Symbols are Google's Material Symbols (outlined style).
 * See https://fonts.google.com/icons for available icons.
 *
 * Note: Android Symbols use snake_case naming, not SF Symbols' dot.notation.
 */
const SF_TO_ANDROID_MAPPING: Record<string, string> = {
  "archivebox.fill": "archive",
  "arrow.clockwise": "autorenew",
  "arrow.down": "south",
  "arrow.right": "arrow_forward",
  "arrow.right.square": "logout",
  "arrow.up.right": "north_east",
  "bag.badge.plus": "work_outline",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications_off",
  "briefcase.fill": "work",
  "building.2.fill": "business",
  "building.columns.fill": "account_balance",
  calendar: "calendar_today",
  "calendar.badge.minus": "event_busy",
  "calendar.badge.plus": "event_available",
  "calendar.badge.clock": "event",
  "calendar.circle.fill": "event",
  "creditcard.fill": "credit_card",
  checkmark: "check",
  "house.fill": "home",
  "map.fill": "map",
  clock: "schedule",
  "clock.fill": "access_time_filled",
  "exclamationmark.circle.fill": "error",
  "exclamationmark.circle": "error",
  "flame.fill": "local_fire_department",
  globe: "language",
  "gym.bag.fill": "fitness_center",
  "mappin.and.ellipse": "place",
  "mappin.circle.fill": "place",
  magnifyingglass: "search",
  plus: "add",
  "plus.circle.fill": "add_circle",
  "moon.fill": "dark_mode",
  pencil: "edit",
  "person.crop.circle.fill": "account_circle",
  "person.3.sequence.fill": "groups",
  "quote.bubble.fill": "format_quote",
  "slider.horizontal.3": "tune",
  sparkles: "auto_awesome",
  "square.and.pencil": "edit",
  "checkmark.circle.fill": "check_circle",
  banknote: "payments",
  "chevron.down": "expand_more",
  "location.fill": "my_location",
  "line.3.horizontal.decrease.circle": "filter_list",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron_right",
  xmark: "close",
  "xmark.circle.fill": "cancel",
};

type IconSymbolName = keyof typeof SF_TO_MATERIAL_MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS,
 * and expo-symbols SymbolView with Android Symbols on Android.
 *
 * On Android, uses SymbolView with the SF Symbol name passed via
 * the `android` key of the name prop object, enabling native
 * Material Symbols rendering with automatic fallback to MaterialIcons
 * for unmapped icons.
 *
 * Icon `name`s are based on SF Symbols and require manual mapping
 * to Android Symbol names.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle | TextStyle>;
}) {
  const androidSymbolName = SF_TO_ANDROID_MAPPING[name];

  // Primary path: Use SymbolView with Android Symbol when mapping exists
  if (androidSymbolName) {
    return (
      <SymbolView
        name={{ android: androidSymbolName as any }}
        tintColor={color as any}
        resizeMode="scaleAspectFit"
        style={[
          {
            width: size,
            height: size,
          },
          style as StyleProp<ViewStyle>,
        ]}
      />
    );
  }

  // Fallback: Use MaterialIcons for unmapped icons
  const materialIconName = SF_TO_MATERIAL_MAPPING[name];
  if (materialIconName) {
    return (
      <MaterialIcons
        color={color}
        size={size}
        name={materialIconName}
        style={style as StyleProp<TextStyle>}
      />
    );
  }

  // Final fallback: Return null for completely unmapped icons
  return null;
}
