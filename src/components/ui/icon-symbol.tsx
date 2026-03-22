// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { SymbolViewProps, SymbolWeight } from "expo-symbols";
import type { ComponentProps } from "react";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

type IconMapping = Record<
  Extract<SymbolViewProps["name"], string>,
  ComponentProps<typeof MaterialIcons>["name"]
>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
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
  "calendar.badge.clock": "event",
  "calendar.circle.fill": "event",
  "creditcard.fill": "credit-card",
  checkmark: "check",
  "house.fill": "home",
  "map.fill": "map",
  clock: "schedule",
  "clock.fill": "schedule",
  "exclamationmark.circle.fill": "error",
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
  "checkmark.circle.fill": "check-circle",
  banknote: "payments",
  "location.fill": "my-location",
  "line.3.horizontal.decrease.circle": "filter-list",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  xmark: "close",
  "xmark.circle.fill": "cancel",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
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
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
