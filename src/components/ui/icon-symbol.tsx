// Google Material Symbols Rounded — instanced at FILL=1, GRAD=200, opsz=48, wght=700.
// Pre-baked static font so all axes work on every platform without fontVariationSettings.

import { useFonts } from "expo-font";
import { memo } from "react";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";
import { View } from "react-native";
import { Text } from "@/primitives";

import androidSymbols from "./android-symbols.json";

const FONT_KEY = "MaterialSymbolsRoundedFill";

const SF_TO_ANDROID_SYMBOL = {
  "archivebox.fill": "archive",
  bag: "shopping_bag",
  "arrow.clockwise": "autorenew",
  "arrow.2.squarepath": "cached",
  "arrow.down": "south",
  "arrow.right": "arrow_forward",
  "arrow.right.square": "logout",
  "arrow.up.right": "north_east",
  "bag.badge.plus": "work_outline",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications_off",
  "briefcase.fill": "work",
  "building.2.fill": "business",
  "building.columns": "account_balance",
  "building.columns.fill": "account_balance",
  calendar: "calendar_today",
  "calendar.badge.minus": "event_busy",
  "calendar.badge.plus": "event_available",
  "calendar.badge.clock": "event",
  "calendar.circle.fill": "event",
  "checkmark.circle.fill": "check_circle",
  "checkmark.seal.fill": "verified",
  "checkmark.shield.fill": "verified_user",
  "checkmark.circle": "check_circle_outline",
  circle: "circle_outline",
  "circle.fill": "check_circle",
  "clock.badge.checkmark": "pending_actions",
  "clock.fill": "access_time_filled",
  clock: "schedule",
  "creditcard.fill": "credit_card",
  creditcard: "credit_card",
  "exclamationmark.circle.fill": "error",
  "exclamationmark.circle": "error_outline",
  "flame.fill": "local_fire_department",
  globe: "language",
  "gym.bag.fill": "fitness_center",
  help: "help",
  "help.circle.fill": "help_outline",
  "house.fill": "home",
  "info.circle.fill": "info",
  "line.3.horizontal.decrease.circle": "filter_list",
  "location.fill": "my_location",
  magnifyingglass: "search",
  "map.fill": "map",
  "mappin.and.ellipse": "place",
  "mappin.circle.fill": "location_on",
  "minus.circle.fill": "remove_circle",
  minus: "remove",
  "moon.fill": "dark_mode",
  number: "numbers",
  "paperplane.fill": "send",
  "person.2": "group",
  "person.2.fill": "group",
  "person.badge.plus": "person_add",
  "person.crop.circle.badge.plus": "person_add",
  "person.crop.circle.fill": "account_circle",
  "person.fill": "person",
  "person.text.rectangle.fill": "id_card",
  pencil: "edit",
  plus: "add",
  "plus.circle.fill": "add_circle",
  "quote.bubble.fill": "format_quote",
  rosettes: "workspace_premium",
  "rectangle.portrait.and.arrow.right": "logout",
  "shield.lefthalf.filled": "shield",
  "slider.horizontal.3": "tune",
  sparkles: "auto_awesome",
  "square.and.pencil": "edit",
  "square.stack.3d.up.fill": "stack",
  "xmark.circle.fill": "cancel",
  xmark: "close",
  "chevron.down": "expand_more",
  "chevron.left": "chevron_left",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron_right",
  "doc.text": "description",
  "doc.text.fill": "description",
  envelope: "mail",
  "list.bullet.rectangle.portrait.fill": "list_alt",
  archivebox: "archive",
  checkmark: "check",
} satisfies Record<string, string>;

function resolveAndroidSymbolName(name: string): string {
  const alias = SF_TO_ANDROID_SYMBOL[name as keyof typeof SF_TO_ANDROID_SYMBOL];
  if (alias) return alias;
  return name.replace(/\./g, "_").replace(/-+/g, "_");
}

function toGlyph(name: string): string | null {
  const symbolName = resolveAndroidSymbolName(name);
  const codePoint = androidSymbols[symbolName as keyof typeof androidSymbols];
  return typeof codePoint === "number" ? String.fromCharCode(codePoint) : null;
}

export const IconSymbol = memo(function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const [fontsLoaded] = useFonts({
    [FONT_KEY]: require("../../../assets/fonts/MaterialSymbolsRounded_FillGrad700.ttf"),
  });

  const glyph = toGlyph(name);
  if (!glyph) return null;

  if (!fontsLoaded) {
    return <View style={{ width: size, height: size }} />;
  }

  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: FONT_KEY,
          fontSize: size,
          lineHeight: size,
          color: color as string,
          textAlign: "center",
          includeFontPadding: false,
          textAlignVertical: "center",
        },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
});
