import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  applyThemePreference,
  loadThemePreference,
  persistThemePreference,
  type ThemePreference,
} from "@/lib/theme-preference";

type ResolvedScheme = "light" | "dark";

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
  isReady: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const DEFAULT_THEME_PREFERENCE_CONTEXT: ThemePreferenceContextValue = {
  preference: "system",
  resolvedScheme: "light",
  isReady: false,
  setPreference: async () => undefined,
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>(
  DEFAULT_THEME_PREFERENCE_CONTEXT,
);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const bootstrapPreference = async () => {
      const stored = await loadThemePreference();
      const nextPreference = stored ?? "system";
      applyThemePreference(nextPreference);
      if (!mounted) return;
      setPreferenceState(nextPreference);
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

  const resolvedScheme: ResolvedScheme =
    preference === "system" ? (systemScheme ?? "light") : preference;

  const value = useMemo<ThemePreferenceContextValue>(
    () => ({
      preference,
      resolvedScheme,
      isReady,
      setPreference,
    }),
    [isReady, preference, resolvedScheme, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
