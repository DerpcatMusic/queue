import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";

type AppSymbolProps = {
  name: unknown;
  size?: number;
  tintColor?: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
};

const SYMBOL_TO_MATERIAL: Record<string, React.ComponentProps<typeof MaterialIcons>["name"]> = {
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "briefcase.fill": "work",
  "calendar.circle.fill": "calendar-today",
  "calendar.badge.exclamationmark": "event-busy",
  "bag.badge.plus": "add-shopping-cart",
  plus: "add",
  "figure.run": "directions-run",
  "dumbbell.fill": "fitness-center",
  "figure.yoga": "self-improvement",
  "person.badge.key.fill": "admin-panel-settings",
  "apple.logo": "apple",
};

function getSymbolName(name: unknown): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") {
    const record = name as Record<string, unknown>;
    const platformValue = record[Platform.OS];
    if (typeof platformValue === "string") return platformValue;
    if (typeof record.ios === "string") return record.ios;
    if (typeof record.android === "string") return record.android;
    if (typeof record.web === "string") return record.web;
  }
  return "";
}

function resolveMaterialIconName(rawName: unknown): React.ComponentProps<typeof MaterialIcons>["name"] {
  const name = getSymbolName(rawName);
  if (!name) return "help-outline";
  if (SYMBOL_TO_MATERIAL[name]) return SYMBOL_TO_MATERIAL[name];
  if (name.endsWith(".fill")) {
    const base = name.slice(0, -5);
    if (SYMBOL_TO_MATERIAL[base]) return SYMBOL_TO_MATERIAL[base];
  }
  return "help-outline";
}

export function AppSymbol({ name, size = 20, tintColor, style }: AppSymbolProps) {
  return (
    <MaterialIcons
      name={resolveMaterialIconName(name)}
      size={size}
      color={tintColor}
      style={style}
    />
  );
}
