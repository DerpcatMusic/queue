/**
 * Base sheet wrapper with close button.
 * Used by all profile sub-page sheets.
 *
 * Uses BottomSheetModal (portal-based) so sheets render above all app content
 * regardless of where GlobalSheets sits in the component tree.
 *
 * The modal is always mounted (gorham pattern). Visibility is controlled
 * via imperative present()/dismiss() calls synced to the `visible` prop.
 */

import type { BottomSheetModal as BottomSheetModalRef } from "@gorhom/bottom-sheet";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useRef } from "react";
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
  /** When false, children are rendered in a static BottomSheetView instead of a scrollable sheet wrapper. */
  scrollable?: boolean;
  /** Snap points array. Defaults to ["100%"] (full screen). */
  snapPoints?: (string | number)[];
  /** When true, children render directly without ScrollView wrapper or padding.
   *  Use for embedded webviews (e.g., Stripe) that need edge-to-edge layout. */
  edgeToEdge?: boolean;
}

const DEFAULT_SNAP_POINTS: (string | number)[] = ["100%"];

export function BaseProfileSheet({
  visible,
  onClose,
  children,
  headerContent,
  scrollable = true,
  snapPoints = DEFAULT_SNAP_POINTS,
  edgeToEdge = false,
}: BaseProfileSheetProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const ref = useRef<BottomSheetModalRef>(null);

  // Track whether we've presented — prevents onDismiss→onClose cycle
  // when dismiss() is called on an already-dismissed modal.
  const presentedRef = useRef(false);

  // Sync visible prop to imperative present/dismiss.
  // Modal stays mounted — gorham handles visibility via portal.
  useEffect(() => {
    if (visible) {
      presentedRef.current = true;
      ref.current?.present();
    } else if (presentedRef.current) {
      ref.current?.dismiss();
    }
  }, [visible]);

  const handleCloseRequest = useCallback(() => {
    ref.current?.dismiss();
  }, []);

  // Fires when the sheet finishes its dismiss animation (user swipe, backdrop tap, etc.)
  const handleDismiss = useCallback(() => {
    presentedRef.current = false;
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={[props.style, styles.backdrop]}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
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

      {/* Fixed content above scroll (e.g., segmented toggle) */}
      {headerContent ? (
        <View style={{ paddingHorizontal: BrandSpacing.lg, paddingTop: BrandSpacing.lg }}>
          {headerContent}
        </View>
      ) : null}

      {/* Scrollable content — or edge-to-edge for embedded webviews */}
      {edgeToEdge || !scrollable ? (
        <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
      ) : (
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
      )}
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
