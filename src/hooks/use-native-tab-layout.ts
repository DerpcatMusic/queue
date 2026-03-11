import { useAppInsets } from "@/hooks/use-app-insets";

/**
 * @deprecated Use `useAppInsets` directly.
 */
export function useNativeTabLayout() {
  const insets = useAppInsets();

  return {
    topInset: insets.safeTop,
    safeBottomInset: insets.safeBottom,
    bottomInset: insets.overlayBottom,
    bottomOverlayInset: insets.overlayBottom,
  };
}
