import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  applyThemePreference,
  loadThemePreference,
  persistThemePreference,
  resolveThemeScheme,
  type ThemePreference,
} from "@/theme/theme";

type ResolvedScheme = "light" | "dark";

// Animation duration must match THEME_TRANSITION_DURATION in use-animated-theme-colors
const THEME_TRANSITION_DURATION = 300;

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

  // Track pending scheme transition so we don't double-apply
  const pendingSchemeRef = useRef<ThemePreference | null>(null);
  // Timeout ref to defer Unistyles sync until after animation
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    const bootstrapPreference = async () => {
      const stored = loadThemePreference();
      const nextPreference = stored ?? "system";
      // On startup, apply immediately (no animation — just restore persisted state)
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
    // Cancel any pending sync that hasn't fired yet
    if (syncTimeoutRef.current !== null) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    // Persist immediately (user expects setting to stick)
    await persistThemePreference(nextPreference);

    // Update state — this triggers the color animation in useAnimatedThemeColors
    setPreferenceState(nextPreference);

    // Schedule Unistyles sync for AFTER the color animation completes.
    // Calling applyThemePreference immediately would trigger UnistylesRuntime.setTheme()
    // synchronously, causing a mass re-render of every themed component and a visible snap.
    // By deferring it, the animation runs to completion on the UI thread first.
    pendingSchemeRef.current = nextPreference;
    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null;
      applyThemePreference(nextPreference);
      pendingSchemeRef.current = null;
    }, THEME_TRANSITION_DURATION);
  }, []);

  const resolvedScheme: ResolvedScheme = resolveThemeScheme(preference, systemScheme);

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
