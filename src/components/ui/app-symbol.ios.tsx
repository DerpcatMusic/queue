import {
  SymbolView,
  type SymbolViewProps,
} from "expo-symbols";
import { Platform } from "react-native";
import type { OpaqueColorValue, StyleProp, ViewStyle } from "react-native";

type AppSymbolProps = {
  name: unknown;
  size?: number;
  tintColor?: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
};

function getIosSymbolName(name: unknown): SymbolViewProps["name"] {
  if (typeof name === "string") return name as SymbolViewProps["name"];
  if (name && typeof name === "object") {
    const record = name as Record<string, unknown>;
    const platformValue = record[Platform.OS];
    if (typeof platformValue === "string") return platformValue as SymbolViewProps["name"];
    if (typeof record.ios === "string") return record.ios as SymbolViewProps["name"];
  }
  return "questionmark.circle" as SymbolViewProps["name"];
}

export function AppSymbol({ name, size = 20, tintColor, style }: AppSymbolProps) {
  return (
    <SymbolView
      name={getIosSymbolName(name)}
      size={size}
      {...(typeof tintColor === "string" ? { tintColor } : {})}
      resizeMode="scaleAspectFit"
      style={style}
    />
  );
}
