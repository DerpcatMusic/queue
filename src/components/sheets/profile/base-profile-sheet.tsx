/**
 * Base sheet wrapper with close button.
 * Used by all profile sub-page sheets.
 *
 * Uses BottomSheetModal (portal-based) so sheets render above all app content
 * regardless of where GlobalSheets sits in the component tree.
 * Controlled via `visible` prop — synced to imperative present()/dismiss().
 *
 * Supports two modes:
 * - Multi-snap (default): drag up/down to resize, pan down to close
 * - Single-snap: fixed size, no drag-to-expand, pan down to close
 */

import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { BottomSheetModal as BottomSheetModalRef } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";

interface BaseProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  /** Snap points array. Defaults to ["100%"] (full screen). */
  snapPoints?: (string | number)[];
  /**
   * When true, uses a single snap point with no drag-to-expand.
   * The sheet opens to the only snap point and stays there — user can
   * only pan down to close or drag within the same point.
   * Useful for compact sheets like job cards.
   */
  singleSnapPoint?: boolean;
  /** Haptic feedback on snap. Default true. */
  enableHapticFeedback?: boolean;
}

const DEFAULT_SNAP_POINTS: (string | number)[] = ["100%"];
const SINGLE_SNAP_SPRING_CONFIG = {
  damping: 85,
  stiffness: 500,
  mass: 1,
  overshootClamping: true,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

export function BaseProfileSheet({
  visible,
  onClose,
  children,
  headerContent,
  snapPoints = DEFAULT_SNAP_POINTS,
  singleSnapPoint = false,
  enableHapticFeedback = true,
}: BaseProfileSheetProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const ref = useRef<BottomSheetModalRef>(null);
  const hasPresentedRef = useRef(false);

  // Animation config for single-snap sheets — smoother, less bouncy
  const animationConfig = useMemo(
    () => (singleSnapPoint ? SINGLE_SNAP_SPRING_CONFIG : undefined),
    [singleSnapPoint],
  );

  useEffect(() => {
    if (!visible || hasPresentedRef.current) {
      return;
    }

    hasPresentedRef.current = true;
    ref.current?.present();
  }, [visible]);

  const handleCloseRequest = useCallback(() => {
    ref.current?.dismiss();
  }, []);

  const handleDismiss = useCallback(() => {
    hasPresentedRef.current = false;
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={singleSnapPoint ? 0 : -1}
        style={[props.style, styles.backdrop]}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [singleSnapPoint],
  );

  if (!visible) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={ref}
      // For single snap point: index 0 is the only snap, so sheet stays fixed
      // For multi-snap: index 0 = smallest, user can drag up
      index={singleSnapPoint ? 0 : 0}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      enableHapticFeedback={enableHapticFeedback}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      animationConfigs={animationConfig}
      backgroundStyle={{
        borderTopLeftRadius: BrandRadius.soft,
        borderTopRightRadius: BrandRadius.soft,
        borderCurve: "continuous",
        backgroundColor: theme.color.surface,
      }}
      handleIndicatorStyle={{
        width: 36,
        height: 5,
        borderRadius: 3,
        backgroundColor: theme.color.borderStrong,
      }}
      style={styles.sheet}
    >
      {/* Header with close button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: BrandSpacing.inset,
          paddingVertical: BrandSpacing.md,
          minHeight: 52,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.color.divider,
        }}
      >
        <IconButton
          accessibilityLabel={t("common.close")}
          onPress={handleCloseRequest}
          tone="secondary"
          size={36}
          icon={<IconSymbol name="xmark" size={18} color={theme.color.textMuted} />}
        />
        <View style={styles.titleSpacer} />
      </View>

      {/* Fixed content above scroll (e.g., map) */}
      {headerContent ? (
        <View style={{ paddingHorizontal: BrandSpacing.lg, paddingTop: BrandSpacing.lg }}>
          {headerContent}
        </View>
      ) : null}

      {/* Scrollable content */}
      <BottomSheetScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: headerContent ? BrandSpacing.md : BrandSpacing.lg,
          paddingBottom: BrandSpacing.xxl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 0,
  },
  backdrop: {
    backgroundColor: "#000000",
  },
  titleSpacer: {
    flex: 1,
  },
});
