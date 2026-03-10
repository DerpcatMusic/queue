import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ColorValue } from "react-native";

export type InsetTone = "app" | "sheet" | "card" | "transparent";

type SystemUiContextValue = {
  topInsetTone: InsetTone;
  topInsetBackgroundColor: ColorValue | null;
  setTopInsetTone: (tone: InsetTone) => void;
  setTopInsetBackgroundColor: (color: ColorValue | null) => void;
};

const SystemUiContext = createContext<SystemUiContextValue | null>(null);

export function SystemUiProvider({ children }: PropsWithChildren) {
  const [topInsetTone, setTopInsetToneState] = useState<InsetTone>("app");
  const [topInsetBackgroundColor, setTopInsetBackgroundColorState] = useState<ColorValue | null>(
    null,
  );

  const setTopInsetTone = useCallback((tone: InsetTone) => {
    setTopInsetToneState(tone);
  }, []);

  const setTopInsetBackgroundColor = useCallback((color: ColorValue | null) => {
    setTopInsetBackgroundColorState(color);
  }, []);

  const value = useMemo<SystemUiContextValue>(
    () => ({
      topInsetTone,
      topInsetBackgroundColor,
      setTopInsetTone,
      setTopInsetBackgroundColor,
    }),
    [topInsetBackgroundColor, topInsetTone, setTopInsetBackgroundColor, setTopInsetTone],
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
