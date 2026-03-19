import {
  createContext,
  createElement,
  type PropsWithChildren,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import type { TopSheetExpandMode, TopSheetPadding, TopSheetProps } from "./top-sheet";

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
  contentPaddingTop?: number;
  draggable?: boolean;
  expandable?: boolean;
  steps?: readonly number[];
  initialStep?: number;
  activeStep?: number;
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
  overrides: Record<string, TopSheetTabOverride | undefined>;
  replaceConfig: (tabId: string, config: TopSheetTabOverride | null) => void;
  clearConfig: (tabId: string) => void;
};

const TopSheetRegistryContext = createContext<TopSheetRegistryContextValue | null>(null);

export function GlobalTopSheetProvider({ children }: PropsWithChildren) {
  const [overrides, setOverrides] = useState<Record<string, TopSheetTabOverride | undefined>>({});

  const replaceConfig = useCallback((tabId: string, config: TopSheetTabOverride | null) => {
    setOverrides((current) => {
      if (config === null) {
        if (!current[tabId]) {
          return current;
        }
        const next = { ...current };
        delete next[tabId];
        return next;
      }

      if (areSheetOverridesEqual(current[tabId], config)) {
        return current;
      }

      return {
        ...current,
        [tabId]: { ...config },
      };
    });
  }, []);

  const clearConfig = useCallback((tabId: string) => {
    setOverrides((current) => {
      if (!current[tabId]) {
        return current;
      }
      const next = { ...current };
      delete next[tabId];
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
  overrides: Record<string, TopSheetTabOverride | undefined>,
): TopSheetTabConfig | null {
  const baseConfig = DEFAULT_TOP_SHEET_CONFIGS[tabId];
  const overrideConfig = overrides[tabId];

  if (!baseConfig && !overrideConfig) {
    return null;
  }

  return {
    ...(baseConfig ?? { tabId }),
    ...(overrideConfig ?? {}),
    tabId,
  };
}

export function useGlobalTopSheet(tabId: string, config: TopSheetTabOverride | null) {
  const { replaceConfig, clearConfig } = useTopSheetRegistry();
  const latestTabIdRef = useRef(tabId);
  latestTabIdRef.current = tabId;

  useLayoutEffect(() => {
    replaceConfig(tabId, config);
  }, [config, replaceConfig, tabId]);

  useLayoutEffect(
    () => () => {
      clearConfig(latestTabIdRef.current);
    },
    [clearConfig],
  );
}

export function useResolvedTabSheetConfig(tabId: string | null) {
  const { overrides } = useTopSheetRegistry();
  return useMemo(
    () => (tabId ? resolveTabSheetConfig(tabId, overrides) : null),
    [overrides, tabId],
  );
}
