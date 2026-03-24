import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ProfileSectionCard, ProfileSectionHeader, ProfileSettingRow } from "@/components/profile/profile-settings-sections";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { type BrandPalette, BrandRadius, BrandSpacing } from "@/constants/brand";
type ProfileAccountSwitcherSheetProps = {
  currentAccountEmail?: string | null | undefined;
  currentAccountName: string;
  currentRoleLabel: string;
  innerRef: React.RefObject<BottomSheet | null>;
  onDismissed: () => void;
  onOpenStateChange?: (open: boolean) => void;
  onSignOut: () => void;
  onUseAnotherAccount: () => void;
  palette: BrandPalette;
  profileImageUrl?: string | null | undefined;
};

export function ProfileAccountSwitcherSheet({
  currentAccountEmail,
  currentAccountName,
  currentRoleLabel,
  innerRef,
  onDismissed,
  onOpenStateChange,
  onSignOut,
  onUseAnotherAccount,
  palette,
  profileImageUrl,
}: ProfileAccountSwitcherSheetProps) {
  const { t } = useTranslation();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const snapPoints = ["72%"];

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: palette.appBg as string }]}
      />
    ),
    [palette.appBg],
  );

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      topInset={collapsedSheetHeight}
      enablePanDownToClose
      onChange={(index) => {
        onOpenStateChange?.(index >= 0);
      }}
      onClose={() => {
        onOpenStateChange?.(false);
        onDismissed();
      }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: palette.borderStrong as string }}
      backgroundStyle={{ backgroundColor: palette.surfaceElevated as string }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.lg,
          paddingBottom: BrandSpacing.xxl,
          gap: BrandSpacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: BrandSpacing.md,
          }}
        >
          <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
            <ThemedText type="title" style={{ color: palette.text as string }}>
              {t("profile.switcher.sheetTitle")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
              {t("profile.switcher.sheetBody")}
            </ThemedText>
          </View>
          <IconButton
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            tone="secondary"
            icon={<IconSymbol name="xmark" size={16} color={palette.text as string} />}
          />
        </View>

        <View
          style={{
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            backgroundColor: palette.surface as string,
            padding: BrandSpacing.lg,
            gap: BrandSpacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
            <ProfileAvatar
              imageUrl={profileImageUrl}
              fallbackName={currentAccountName}
              palette={palette}
              size={BrandSpacing.iconContainerLarge}
              roundedSquare
            />
            <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
              <ThemedText type="bodyStrong" style={{ color: palette.text as string }}>
                {currentAccountName}
              </ThemedText>
              <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                {currentRoleLabel}
              </ThemedText>
              {currentAccountEmail ? (
                <ThemedText selectable type="caption" style={{ color: palette.textMuted as string }}>
                  {currentAccountEmail}
                </ThemedText>
              ) : null}
              <View
                style={{
                  alignSelf: "flex-start",
                  borderRadius: BrandRadius.pill,
                  borderCurve: "continuous",
                  backgroundColor: palette.primarySubtle as string,
                  paddingHorizontal: BrandSpacing.controlX,
                  paddingVertical: BrandSpacing.xs,
                }}
              >
                <ThemedText type="micro" style={{ color: palette.primary as string }}>
                  {t("profile.switcher.currentAccountBadge")}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <ProfileSectionHeader
          label={t("profile.switcher.accountsTitle")}
          description={t("profile.switcher.accountsBody")}
          icon="person.2.fill"
          palette={palette}
          flush
        />
        <ProfileSectionCard palette={palette}>
          <ProfileSettingRow
            title={t("profile.switcher.useAnotherAccountTitle")}
            subtitle={t("profile.switcher.useAnotherAccountHint")}
            icon="person.crop.circle.badge.plus"
            onPress={onUseAnotherAccount}
            palette={palette}
            showDivider
          />
          <ProfileSettingRow
            title={t("tabsLayout.actions.signOut")}
            subtitle={t("profile.settings.signOutDesc")}
            icon="rectangle.portrait.and.arrow.right"
            onPress={onSignOut}
            palette={palette}
            tone="danger"
          />
        </ProfileSectionCard>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
