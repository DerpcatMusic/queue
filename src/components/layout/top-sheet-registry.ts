import {
  createContext,
  createElement,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";
import type { AppTheme } from "@/theme/theme";
import type {
  TopSheetCollapsedHeightMode,
  TopSheetExpandMode,
  TopSheetPadding,
  TopSheetProps,
} from "./top-sheet";

/**
 * Returns the default backgroundColor and topInsetColor for a given tab.
 * These colors are used when the config does not explicitly specify them.
 *
 * Real color values are required for native TopSheet (CSS vars don't resolve in RN native views).
 */
export function getDefaultSheetColors(tabId: string, theme: AppTheme) {
  if (tabId === "map") {
    return {
      backgroundColor: theme.color.surfaceElevated,
      topInsetColor: theme.color.surfaceElevated,
    };
  }

  return {
    backgroundColor: theme.color.primary,
    topInsetColor: theme.color.primary,
  };
}

/**
 * Returns the resolved sheet colors for a tab config, applying theme-aware defaults
 * when the config does not explicitly specify backgroundColor or topInsetColor.
 */
export function resolveSheetColors(
  tabId: string,
  configBackgroundColor: ColorValue | undefined,
  configTopInsetColor: ColorValue | undefined,
  theme: AppTheme,
) {
  const defaults = getDefaultSheetColors(tabId, theme);
  return {
    backgroundColor: (configBackgroundColor as string | undefined) ?? defaults.backgroundColor,
    topInsetColor: (configTopInsetColor as string | undefined) ?? defaults.topInsetColor,
  };
}

export type TopSheetRenderProps = {
  scrollY: SharedValue<number>;
};

type TopSheetFrameConfig = Omit<TopSheetProps, "children"> & {
  children?: React.ReactNode;
  backgroundColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export type TopSheetRenderResult = React.ReactNode | TopSheetFrameConfig;

export type TopSheetTabConfig = {
  tabId: string;
  content?: React.ReactNode;
  render?: (props: TopSheetRenderProps) => TopSheetRenderResult;
  overlay?: React.ReactNode;
  contentPaddingTop?: number;
  draggable?: boolean;
  expandable?: boolean;
  steps?: readonly number[];
  initialStep?: number;
  activeStep?: number;
  minHeight?: number;
  collapsedHeightMode?: TopSheetCollapsedHeightMode;
  expandMode?: TopSheetExpandMode;
  onStepChange?: (step: number) => void;
  padding?: TopSheetPadding;
  backgroundColor?: ColorValue;
  topInsetColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
  stickyHeader?: React.ReactNode;
  stickyFooter?: React.ReactNode;
  revealOnExpand?: React.ReactNode;
};

type TopSheetTabOverride = Omit<Partial<TopSheetTabConfig>, "tabId">;
type TopSheetTabOverrideEntry = {
  ownerId: string;
  config: TopSheetTabOverride;
};

function areSheetOverridesEqual(
  previous: TopSheetTabOverride | undefined,
  next: TopSheetTabOverride,
) {
  if (!previous) {
    return false;
  }

  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) =>
    Object.is(previous[key as keyof TopSheetTabOverride], next[key as keyof TopSheetTabOverride]),
  );
}

const DEFAULT_TOP_SHEET_CONFIGS: Record<string, TopSheetTabConfig> = {
  jobs: {
    tabId: "jobs",
    steps: [0.26],
    initialStep: 0,
  },
  calendar: {
    tabId: "calendar",
    steps: [0.28],
    initialStep: 0,
  },
  map: {
    tabId: "map",
    draggable: true,
    expandable: true,
    steps: [0.18, 0.52],
    initialStep: 0,
    expandMode: "overlay",
  },
  index: {
    tabId: "index",
    steps: [0.22],
    initialStep: 0,
  },
  profile: {
    tabId: "profile",
    steps: [0.22],
    initialStep: 0,
  },
  "sign-in": {
    tabId: "sign-in",
    steps: [0.18],
    initialStep: 0,
  },
  onboarding: {
    tabId: "onboarding",
    steps: [0.22],
    initialStep: 0,
  },
};

export const DEFAULT_SHEET_PADDING_TOP = 140;

type TopSheetRegistryContextValue = {
  overrides: Record<string, TopSheetTabOverrideEntry[] | undefined>;
  replaceConfig: (tabId: string, ownerId: string, config: TopSheetTabOverride | null) => void;
  clearConfig: (tabId: string, ownerId: string) => void;
};

const TopSheetRegistryContext = createContext<TopSheetRegistryContextValue | null>(null);

export function GlobalTopSheetProvider({ children }: PropsWithChildren) {
  const [overrides, setOverrides] = useState<
    Record<string, TopSheetTabOverrideEntry[] | undefined>
  >({});

  const replaceConfig = useCallback(
    (tabId: string, ownerId: string, config: TopSheetTabOverride | null) => {
      setOverrides((current) => {
        const currentEntries = current[tabId] ?? [];

        if (config === null) {
          const nextEntries = currentEntries.filter((entry) => entry.ownerId !== ownerId);
          if (nextEntries.length === currentEntries.length) {
            return current;
          }
          const next = { ...current };
          if (nextEntries.length === 0) {
            delete next[tabId];
          } else {
            next[tabId] = nextEntries;
          }
          return next;
        }

        const existingEntry = currentEntries.find((entry) => entry.ownerId === ownerId);
        if (existingEntry && areSheetOverridesEqual(existingEntry.config, config)) {
          return current;
        }

        return {
          ...current,
          [tabId]: [
            ...currentEntries.filter((entry) => entry.ownerId !== ownerId),
            {
              ownerId,
              config: { ...config },
            },
          ],
        };
      });
    },
    [],
  );

  const clearConfig = useCallback((tabId: string, ownerId: string) => {
    setOverrides((current) => {
      const currentEntries = current[tabId] ?? [];
      const nextEntries = currentEntries.filter((entry) => entry.ownerId !== ownerId);
      if (nextEntries.length === currentEntries.length) {
        return current;
      }
      const next = { ...current };
      if (nextEntries.length === 0) {
        delete next[tabId];
      } else {
        next[tabId] = nextEntries;
      }
      return next;
    });
  }, []);

  const value = useMemo<TopSheetRegistryContextValue>(
    () => ({
      overrides,
      replaceConfig,
      clearConfig,
    }),
    [clearConfig, overrides, replaceConfig],
  );

  return createElement(TopSheetRegistryContext.Provider, { value }, children);
}

function useTopSheetRegistry() {
  const context = useContext(TopSheetRegistryContext);
  if (!context) {
    throw new Error("useTopSheetRegistry must be used inside <GlobalTopSheetProvider>");
  }
  return context;
}

export function resolveTabSheetConfig(
  tabId: string,
  overrides: Record<string, TopSheetTabOverrideEntry[] | undefined>,
): TopSheetTabConfig | null {
  const baseConfig = DEFAULT_TOP_SHEET_CONFIGS[tabId];
  const overrideConfig = overrides[tabId]?.[overrides[tabId]!.length - 1]?.config;

  if (!baseConfig && !overrideConfig) {
    return null;
  }

  return {
    ...(baseConfig ?? { tabId }),
    ...(overrideConfig ?? {}),
    tabId,
  };
}

export function useGlobalTopSheet(
  tabId: string,
  config: TopSheetTabOverride | null,
  explicitOwnerId?: string,
) {
  const { replaceConfig, clearConfig } = useTopSheetRegistry();
  const ownerIdRef = useRef<string | null>(null);
  if (!ownerIdRef.current) {
    ownerIdRef.current = `${tabId}:${Math.random().toString(36).slice(2, 10)}`;
  }
  const ownerId = explicitOwnerId ?? ownerIdRef.current;

  useEffect(() => {
    replaceConfig(tabId, ownerId, config);
    return () => {
      clearConfig(tabId, ownerId);
    };
  }, [clearConfig, config, ownerId, replaceConfig, tabId]);
}

export function useResolvedTabSheetConfig(tabId: string | null) {
  const { overrides } = useTopSheetRegistry();
  const activeEntry = tabId ? overrides[tabId]?.[overrides[tabId]!.length - 1] : undefined;
  const theme = useTheme();

  return useMemo(() => {
    if (!tabId) return null;

    const baseConfig = DEFAULT_TOP_SHEET_CONFIGS[tabId] ?? { tabId };
    const overrideConfig = activeEntry?.config;

    // Merge base and override config
    const merged: TopSheetTabConfig = {
      ...baseConfig,
      ...(overrideConfig ?? {}),
      tabId,
    };

    // Resolve colors with theme-aware defaults (native TopSheet needs real color values)
    const resolvedColors = resolveSheetColors(
      tabId,
      merged.backgroundColor,
      merged.topInsetColor,
      theme,
    );

    return {
      ...merged,
      backgroundColor: resolvedColors.backgroundColor,
      topInsetColor: resolvedColors.topInsetColor,
    } as TopSheetTabConfig;
  }, [activeEntry, tabId, theme]);
}
