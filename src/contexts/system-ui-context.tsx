import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ColorValue } from "react-native";

type SystemUiContextValue = {
  topInsetBackgroundColor: ColorValue | null;
  setTopInsetBackgroundColor: (color: ColorValue | null) => void;
};

const SystemUiContext = createContext<SystemUiContextValue | null>(null);

export function SystemUiProvider({ children }: PropsWithChildren) {
  const [topInsetBackgroundColor, setTopInsetBackgroundColorState] = useState<ColorValue | null>(
    null,
  );

  const setTopInsetBackgroundColor = useCallback((color: ColorValue | null) => {
    setTopInsetBackgroundColorState(color);
  }, []);

  const value = useMemo<SystemUiContextValue>(
    () => ({
      topInsetBackgroundColor,
      setTopInsetBackgroundColor,
    }),
    [topInsetBackgroundColor, setTopInsetBackgroundColor],
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
