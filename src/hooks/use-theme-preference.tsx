import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  applyThemePreference,
  loadThemePreference,
  loadThemeStylePreference,
  persistThemePreference,
  persistThemeStylePreference,
  type ThemePreference,
  type ThemeStylePreference,
} from "@/lib/theme-preference";

type ResolvedScheme = "light" | "dark";

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  stylePreference: ThemeStylePreference;
  resolvedScheme: ResolvedScheme;
  isReady: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
  setStylePreference: (preference: ThemeStylePreference) => Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [stylePreference, setStylePreferenceState] =
    useState<ThemeStylePreference>("custom");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const bootstrapPreference = async () => {
      const [stored, storedStyle] = await Promise.all([
        loadThemePreference(),
        loadThemeStylePreference(),
      ]);
      const nextPreference = stored ?? "system";
      const nextStylePreference = storedStyle ?? "custom";
      applyThemePreference(nextPreference);
      if (!mounted) return;
      setPreferenceState(nextPreference);
      setStylePreferenceState(nextStylePreference);
      setIsReady(true);
    };
    void bootstrapPreference();
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    applyThemePreference(nextPreference);
    await persistThemePreference(nextPreference);
  }, []);

  const setStylePreference = useCallback(
    async (nextPreference: ThemeStylePreference) => {
      setStylePreferenceState(nextPreference);
      await persistThemeStylePreference(nextPreference);
    },
    [],
  );

  const resolvedScheme: ResolvedScheme =
    preference === "system" ? (systemScheme ?? "light") : preference;

  const value = useMemo<ThemePreferenceContextValue>(
    () => ({
      preference,
      stylePreference,
      resolvedScheme,
      isReady,
      setPreference,
      setStylePreference,
    }),
    [
      isReady,
      preference,
      resolvedScheme,
      setPreference,
      setStylePreference,
      stylePreference,
    ],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  }
  return context;
}
