import { useColorScheme as useRNColorScheme } from "react-native";

/** React Native can return `'unspecified'` on some Android devices. Normalize it to keep callers type-safe. */
export function useColorScheme(): "light" | "dark" | null {
  const scheme = useRNColorScheme();
  if (scheme === "light" || scheme === "dark") return scheme;
  return null;
}
