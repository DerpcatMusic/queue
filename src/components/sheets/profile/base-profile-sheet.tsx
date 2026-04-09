/**
 * Base sheet wrapper with back arrow header.
 * Used by all profile sub-page sheets.
 *
 * Uses BottomSheetModal (portal-based) so sheets render above all app content
 * regardless of where GlobalSheets sits in the component tree.
 * Controlled via `visible` prop — synced to imperative present()/dismiss().
 */

import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing } from "@/constants/brand";

interface BaseProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
}

export function BaseProfileSheet({
  visible,
  onClose,
  children,
  snapPoints = ["100%"] as (string | number)[],
}: BaseProfileSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const ref = useRef<BottomSheetModal>(null);

  // Sync visible prop to imperative present/dismiss
  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={[props.style, styles.backdrop]}
        opacity={0.4}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.background, { backgroundColor: theme.color.surfaceElevated }]}
      handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: theme.color.borderStrong }]}
      style={styles.sheet}
    >
      {/* Header with back arrow */}
      <View style={[styles.header, { borderBottomColor: theme.color.border }]}>
        <IconButton
          accessibilityLabel={t("common.back")}
          onPress={onClose}
          tone="secondary"
          size={36}
          icon={<IconSymbol name="chevron.left" size={18} color={theme.color.text} />}
        />
        <View style={styles.titleSpacer} />
      </View>

      {/* Scrollable content */}
      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { backgroundColor: theme.color.appBg }]}
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
  background: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderCurve: "continuous",
  },
  handleIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  backdrop: {
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: BrandSpacing.inset,
    paddingVertical: BrandSpacing.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleSpacer: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: BrandSpacing.lg,
    paddingTop: BrandSpacing.lg,
    paddingBottom: BrandSpacing.xxl * 2,
  },
});
