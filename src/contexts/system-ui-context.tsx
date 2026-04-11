import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ColorValue } from "react-native";

export type InsetTone = "app" | "sheet" | "card";

type SystemUiContextValue = {
  topInsetTone: InsetTone;
  topInsetBackgroundColor: ColorValue | null;
  topInsetVisible: boolean;
  setTopInsetTone: (tone: InsetTone) => void;
  setTopInsetBackgroundColor: (color: ColorValue | null) => void;
  setTopInsetVisible: (visible: boolean) => void;
};

const SystemUiContext = createContext<SystemUiContextValue | null>(null);

export function SystemUiProvider({ children }: PropsWithChildren) {
  const [topInsetTone, setTopInsetToneState] = useState<InsetTone>("app");
  const [topInsetBackgroundColor, setTopInsetBackgroundColorState] = useState<ColorValue | null>(
    null,
  );
  const [topInsetVisible, setTopInsetVisibleState] = useState(true);

  const setTopInsetTone = useCallback((tone: InsetTone) => {
    setTopInsetToneState(tone);
  }, []);

  const setTopInsetBackgroundColor = useCallback((color: ColorValue | null) => {
    setTopInsetBackgroundColorState(color);
  }, []);

  const setTopInsetVisible = useCallback((visible: boolean) => {
    setTopInsetVisibleState(visible);
  }, []);

  const value = useMemo<SystemUiContextValue>(
    () => ({
      topInsetTone,
      topInsetBackgroundColor,
      topInsetVisible,
      setTopInsetTone,
      setTopInsetBackgroundColor,
      setTopInsetVisible,
    }),
    [
      topInsetBackgroundColor,
      topInsetTone,
      topInsetVisible,
      setTopInsetBackgroundColor,
      setTopInsetTone,
      setTopInsetVisible,
    ],
  );

  return <SystemUiContext.Provider value={value}>{children}</SystemUiContext.Provider>;
}

export function useSystemUi() {
  const context = useContext(SystemUiContext);
  if (!context) {
    throw new Error("useSystemUi must be used within a SystemUiProvider");
  }
  return context;
}
