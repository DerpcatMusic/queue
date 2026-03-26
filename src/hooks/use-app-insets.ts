/**
 * @deprecated Insets should be sourced from layout infrastructure (TabScreenRoot,
 * TabScreenScrollView, ScreenScaffold) or LayoutInsetsContext directly.
 * This hook is kept for backwards compatibility and will call useSafeAreaInsets()
 * if not inside a ScrollSheetProvider.
 *
 * INSET OWNERSHIP RULE (Expo 55 best practice):
 *   - Insets are owned by layouts and passed down through LayoutInsetsContext
 *   - ScrollSheetProvider sources insets once and provides them via context
 *   - Feature screens should NOT call useSafeAreaInsets() directly
 *
 * This backwards-compatible implementation reads from LayoutInsetsContext first,
 * falling back to useSafeAreaInsets() only when outside the provider tree.
 */
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LayoutInsetsContext } from "@/components/layout/scroll-sheet-provider";
import { BrandSpacing } from "@/constants/brand";

export type AppInsets = {
  safeTop: number;
  safeBottom: number;
  overlayBottom: number;
};

export function useAppInsets(): AppInsets {
  // Always call useSafeAreaInsets — it's cheap and React requires consistent hook calls
  const systemInsets = useSafeAreaInsets();
  // Always call useContext — it returns null if not in provider, which is fine
  const layoutInsets = useContext(LayoutInsetsContext);

  // Prefer layout-owned insets when inside ScrollSheetProvider
  // Fall back to system insets for backwards compatibility
  if (layoutInsets) {
    return layoutInsets;
  }

  return {
    safeTop: systemInsets.top,
    safeBottom: systemInsets.bottom,
    overlayBottom: BrandSpacing.lg,
  };
}
