import {
  createContext,
  createElement,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  TopSheetShadow,
} from "./top-sheet";

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
  collapsedContent?: React.ReactNode;
  expandedContent?: React.ReactNode;
  render?: (props: TopSheetRenderProps) => TopSheetRenderResult;
  overlay?: React.ReactNode;
  contentPaddingTop?: number;
  draggable?: boolean;
  expandable?: boolean;
  steps?: readonly number[];
  initialStep?: number;
  activeStep?: number;
  collapsedHeightMode?: TopSheetCollapsedHeightMode;
  expandMode?: TopSheetExpandMode;
  onStepChange?: (step: number) => void;
  padding?: TopSheetPadding;
  backgroundColor?: ColorValue;
  topInsetColor?: ColorValue;
  gradientBackground?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  stickyHeader?: React.ReactNode;
  stickyFooter?: React.ReactNode;
  revealOnExpand?: React.ReactNode;
  sheetVisible?: boolean;
  routeMatchPath?: string;
  routeMatchExact?: boolean;
  disableSafeTopPadding?: boolean;
  shadow?: TopSheetShadow;
};

export type ResolvedTopSheetTabConfig = TopSheetTabConfig & {
  backgroundColor: ColorValue;
  topInsetColor: ColorValue;
};

type TopSheetTabOverride = Omit<Partial<TopSheetTabConfig>, "tabId">;
export type TopSheetDescriptorConfig = Omit<
  Partial<TopSheetTabConfig>,
  "tabId" | "routeMatchPath" | "routeMatchExact"
>;
type TopSheetTabOverrideEntry = {
  ownerId: string;
  config: TopSheetTabOverride;
};

function isSheetRouteMatch(
  pathname: string | null,
  routeMatchPath?: string,
  routeMatchExact?: boolean,
) {
  if (!routeMatchPath) {
    return true;
  }

  if (!pathname) {
    return false;
  }

  // Check if pathname has a role prefix but routeMatchPath doesn't
  // This allows /instructor/profile/sports to match routeMatchPath /profile/sports
  // while still allowing /instructor/jobs to match routeMatchPath /instructor/jobs
  const pathnameHasRolePrefix = /^\/(instructor|studio)\//.test(pathname);
  const routeMatchPathHasRolePrefix = /^\/(instructor|studio)\//.test(routeMatchPath);

  if (routeMatchExact) {
    return pathname === routeMatchPath;
  }

  // If pathname has role prefix but routeMatchPath doesn't, strip role prefix from pathname
  if (pathnameHasRolePrefix && !routeMatchPathHasRolePrefix) {
    const strippedPathname = pathname.replace(/^\/(instructor|studio)\//, "/");
    return strippedPathname === routeMatchPath || strippedPathname.startsWith(`${routeMatchPath}/`);
  }

  return pathname === routeMatchPath || pathname.startsWith(`${routeMatchPath}/`);
}

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

function areTopSheetConfigsEqual(
  previous: TopSheetTabOverride | null | undefined,
  next: TopSheetTabOverride | null,
) {
  if (previous === next) {
    return true;
  }

  if (!previous || !next) {
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

function normalizeDynamicCollapsedSteps(steps?: readonly number[]) {
  if (!steps || steps.length === 0) {
    return [0] as const;
  }

  return [0, ...steps.slice(1)] as const;
}

export function createContentDrivenTopSheetConfig<T extends TopSheetTabOverride>(config: T): T {
  return {
    initialStep: 0,
    collapsedHeightMode: "content",
    ...config,
    steps: normalizeDynamicCollapsedSteps(config.steps),
  } as T;
}

const DEFAULT_TOP_SHEET_CONFIGS: Record<string, TopSheetTabConfig> = {
  jobs: createContentDrivenTopSheetConfig({
    tabId: "jobs",
    steps: [0],
  }),
  calendar: createContentDrivenTopSheetConfig({
    tabId: "calendar",
    steps: [0],
  }),
  map: createContentDrivenTopSheetConfig({
    tabId: "map",
    render: () => null,
    steps: [0],
    sheetVisible: false,
  }),
  index: createContentDrivenTopSheetConfig({
    tabId: "index",
    steps: [0],
  }),
  profile: createContentDrivenTopSheetConfig({
    tabId: "profile",
    steps: [0],
  }),
  "sign-in": createContentDrivenTopSheetConfig({
    tabId: "sign-in",
    steps: [0],
  }),
  onboarding: createContentDrivenTopSheetConfig({
    tabId: "onboarding",
    steps: [0],
  }),
};

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
  pathname: string | null,
): TopSheetTabConfig | null {
  const baseConfig = DEFAULT_TOP_SHEET_CONFIGS[tabId];
  const matchingEntries =
    overrides[tabId]?.filter((entry) =>
      isSheetRouteMatch(pathname, entry.config.routeMatchPath, entry.config.routeMatchExact),
    ) ?? [];
  const overrideConfig =
    matchingEntries
      .sort((left, right) => {
        const leftLength = left.config.routeMatchPath?.length ?? 0;
        const rightLength = right.config.routeMatchPath?.length ?? 0;
        return leftLength - rightLength;
      })
      .at(-1)?.config ?? null;

  if (!baseConfig && !overrideConfig) {
    return null;
  }

  return {
    ...(baseConfig ?? { tabId }),
    ...(overrideConfig ?? {}),
    tabId,
  };
}

export function getMainTabSheetBackgroundColor(theme: AppTheme) {
  return theme.color.surfaceElevated;
}

export function getDefaultSheetColors(_tabId: string, theme: AppTheme) {
  const backgroundColor = getMainTabSheetBackgroundColor(theme);
  return {
    backgroundColor,
    topInsetColor: backgroundColor,
  } as const;
}

export function resolveSheetColors(tabId: string, config: TopSheetTabConfig, theme: AppTheme) {
  const defaults = getDefaultSheetColors(tabId, theme);

  return {
    ...config,
    backgroundColor: config.backgroundColor ?? defaults.backgroundColor,
    topInsetColor: config.topInsetColor ?? defaults.topInsetColor,
  } satisfies ResolvedTopSheetTabConfig;
}

export function useGlobalTopSheet(
  tabId: string,
  config: TopSheetTabOverride | null,
  explicitOwnerId?: string,
  registration?: {
    routeMatchPath?: string;
    routeMatchExact?: boolean;
  },
) {
  const { replaceConfig, clearConfig } = useTopSheetRegistry();
  const ownerIdRef = useRef<string | null>(null);
  const lastConfigRef = useRef<TopSheetTabOverride | null>(null);
  if (!ownerIdRef.current) {
    ownerIdRef.current = `${tabId}:${Math.random().toString(36).slice(2, 10)}`;
  }
  const ownerId = explicitOwnerId ?? ownerIdRef.current;
  const registeredConfig = useMemo<TopSheetTabOverride | null>(
    () =>
      config
        ? {
            ...config,
            ...(registration?.routeMatchPath
              ? { routeMatchPath: registration.routeMatchPath }
              : {}),
            ...(registration?.routeMatchExact !== undefined
              ? { routeMatchExact: registration.routeMatchExact }
              : {}),
          }
        : null,
    [config, registration?.routeMatchExact, registration?.routeMatchPath],
  );

  useLayoutEffect(() => {
    if (areTopSheetConfigsEqual(lastConfigRef.current, registeredConfig)) {
      return;
    }
    lastConfigRef.current = registeredConfig;
    replaceConfig(tabId, ownerId, registeredConfig);
  }, [ownerId, registeredConfig, replaceConfig, tabId]);

  useEffect(
    () => () => {
      clearConfig(tabId, ownerId);
    },
    [clearConfig, ownerId, tabId],
  );
}

export function useResolvedTabSheetConfig(tabId: string | null, pathname: string | null) {
  const { overrides } = useTopSheetRegistry();
  const theme = useTheme();

  return useMemo(() => {
    if (!tabId) {
      return null;
    }

    const resolved = resolveTabSheetConfig(tabId, overrides, pathname);
    if (!resolved) {
      return null;
    }

    return resolveSheetColors(tabId, resolved, theme);
  }, [overrides, pathname, tabId, theme]);
}
