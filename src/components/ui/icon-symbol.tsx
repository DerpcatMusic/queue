// Material Symbols Rounded icon component using static fonts
// Uses MaterialSymbols_400Regular (filled style)

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

/**
 * SF Symbols to Material Icons (filled variants).
 */
const SF_TO_MATERIAL_ICON: Record<string, MaterialIconName> = {
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
  "person.2.fill": "group",
  "person.fill": "person",
  help: "help",
  "help.circle.fill": "help-outline",
};

type IconSymbolName = keyof typeof SF_TO_MATERIAL_ICON;

/**
 * Icon component using Material Icons (filled variants).
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
}) {
  const iconName = SF_TO_MATERIAL_ICON[name];

  if (iconName) {
    return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
  }

  // Fallback: use the icon name directly
  const fallbackName = name.replace(/\./g, "_").replace(/_fill$/, "") as MaterialIconName;
  return <MaterialIcons color={color} size={size} name={fallbackName} style={style} />;
}
