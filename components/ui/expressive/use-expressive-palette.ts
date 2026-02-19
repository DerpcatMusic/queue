import { Brand } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useExpressivePalette() {
  const scheme = useColorScheme() ?? "light";
  const palette = Brand[scheme];

  return {
    scheme,
    palette,
    glassOverlay: scheme === "dark" ? "rgba(14, 20, 32, 0.72)" : "rgba(255, 255, 255, 0.72)",
    shadowColor: scheme === "dark" ? "#05070d" : "#0b1a2d",
  };
}
