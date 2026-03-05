import type { SymbolViewProps } from "expo-symbols";
import type { OpaqueColorValue, StyleProp, TextStyle } from "react-native";
import { Platform } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

type AppSymbolProps = {
  name: unknown;
  size?: number;
  tintColor?: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
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

export function AppSymbol({ name, size = 20, tintColor, style }: AppSymbolProps) {
  const resolvedName = getSymbolName(name) as Extract<SymbolViewProps["name"], string>;

  // Fallback if no specific icon name mapped
  if (!resolvedName) {
    return null;
  }

  return (
    <IconSymbol name={resolvedName as any} size={size} color={tintColor as string} style={style} />
  );
}
