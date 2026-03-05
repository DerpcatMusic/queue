import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  applyThemePreference,
  loadThemePreference,
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

const DEFAULT_THEME_PREFERENCE_CONTEXT: ThemePreferenceContextValue = {
  preference: "system",
  stylePreference: "custom",
  resolvedScheme: "light",
  isReady: false,
  setPreference: async () => undefined,
  setStylePreference: async () => undefined,
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>(
  DEFAULT_THEME_PREFERENCE_CONTEXT,
);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [stylePreference, setStylePreferenceState] = useState<ThemeStylePreference>("custom");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const bootstrapPreference = async () => {
      const [stored] = await Promise.all([loadThemePreference()]);
      const nextPreference = stored ?? "system";
      const nextStylePreference: ThemeStylePreference = "custom";
      applyThemePreference(nextPreference);
      if (!mounted) return;
      setPreferenceState(nextPreference);
      setStylePreferenceState(nextStylePreference);
      await persistThemeStylePreference("custom");
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

  const setStylePreference = useCallback(async (nextPreference: ThemeStylePreference) => {
    const resolvedPreference: ThemeStylePreference =
      nextPreference === "custom" ? "custom" : "custom";
    setStylePreferenceState(resolvedPreference);
    await persistThemeStylePreference(resolvedPreference);
  }, []);

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
    [isReady, preference, resolvedScheme, setPreference, setStylePreference, stylePreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
