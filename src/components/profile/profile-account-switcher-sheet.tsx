import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import type { RememberedDeviceAccount } from "@/modules/session/device-account-store";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;
type ProfileAccountSwitcherSheetProps = {
  currentAccountEmail?: string | null | undefined;
  currentAccountName: string;
  currentAccountId?: string | null | undefined;
  currentRoleLabel: string;
  innerRef: React.RefObject<BottomSheet | null>;
  onDismissed: () => void;
  onOpenStateChange?: (open: boolean) => void;
  onSelectRememberedAccount: (accountId: string) => void;
  onSignOut: () => void;
  onUseAnotherAccount: () => void;
  profileImageUrl?: string | null | undefined;
  rememberedAccounts: RememberedDeviceAccount[];
  switchingAccountId?: string | null | undefined;
};

export function ProfileAccountSwitcherSheet({
  currentAccountEmail,
  currentAccountId,
  currentAccountName,
  currentRoleLabel,
  innerRef,
  onDismissed,
  onOpenStateChange,
  onSelectRememberedAccount,
  onSignOut,
  onUseAnotherAccount,
  profileImageUrl,
  rememberedAccounts,
  switchingAccountId,
}: ProfileAccountSwitcherSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const snapPoints = ["72%"];
  const compactAccountAvatarSize = BrandSpacing.iconContainer + BrandSpacing.xxs;
  const normalizedCurrentEmail = currentAccountEmail?.trim().toLowerCase() ?? null;
  const otherAccounts = rememberedAccounts.filter(
    (account) =>
      account.id !== currentAccountId &&
      (!normalizedCurrentEmail || account.email?.toLowerCase() !== normalizedCurrentEmail),
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: theme.color.appBg }]}
      />
    ),
    [theme.color.appBg],
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
      handleIndicatorStyle={{ backgroundColor: theme.color.borderStrong }}
      backgroundStyle={{ backgroundColor: theme.color.surfaceElevated }}
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
            <ThemedText type="title" style={{ color: theme.color.text }}>
              {t("profile.switcher.sheetTitle")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
              {t("profile.switcher.sheetBody")}
            </ThemedText>
          </View>
          <IconButton
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            tone="secondary"
            icon={<IconSymbol name="xmark" size={16} color={theme.color.text} />}
          />
        </View>

        <View
          style={{
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            backgroundColor: theme.color.surface,
            padding: BrandSpacing.lg,
            gap: BrandSpacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
            <ProfileAvatar
              imageUrl={profileImageUrl}
              fallbackName={currentAccountName}
              size={BrandSpacing.iconContainerLarge}
              roundedSquare
            />
            <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
              <ThemedText type="bodyStrong" style={{ color: theme.color.text }}>
                {currentAccountName}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                {currentRoleLabel}
              </ThemedText>
              {currentAccountEmail ? (
                <ThemedText selectable type="caption" style={{ color: theme.color.textMuted }}>
                  {currentAccountEmail}
                </ThemedText>
              ) : null}
              <View
                style={{
                  alignSelf: "flex-start",
                  borderRadius: BrandRadius.pill,
                  borderCurve: "continuous",
                  backgroundColor: theme.color.primarySubtle,
                  paddingHorizontal: BrandSpacing.controlX,
                  paddingVertical: BrandSpacing.xs,
                }}
              >
                <ThemedText type="micro" style={{ color: theme.color.primary }}>
                  {t("profile.switcher.currentAccountBadge")}
                </ThemedText>
              </View>
            </View>
          </View>

          {otherAccounts.length > 0 ? (
            <View
              style={{
                marginTop: BrandSpacing.xs,
                borderTopWidth: 1,
                borderTopColor: theme.color.border,
                paddingTop: BrandSpacing.sm,
                gap: BrandSpacing.xs,
              }}
            >
              {otherAccounts.map((account, index) => {
                const accountRoleKey =
                  ROLE_TRANSLATION_KEYS[account.role as keyof typeof ROLE_TRANSLATION_KEYS] ??
                  "profile.roles.pending";
                const isSwitching = switchingAccountId === account.id;
                const accountName =
                  account.fullName ??
                  account.name ??
                  account.email ??
                  t("profile.account.fallbackName");

                return (
                  <View key={account.id}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSwitching}
                      onPress={() => onSelectRememberedAccount(account.id)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: BrandSpacing.md,
                        paddingHorizontal: BrandSpacing.xs,
                        paddingVertical: BrandSpacing.sm,
                        opacity: pressed || isSwitching ? 0.82 : 1,
                      })}
                    >
                      <ProfileAvatar
                        imageUrl={account.image}
                        fallbackName={accountName}
                        size={compactAccountAvatarSize}
                      />
                      <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
                        <ThemedText type="bodyStrong" style={{ color: theme.color.text }}>
                          {accountName}
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: theme.color.textMuted }}>
                          {account.email ?? t(accountRoleKey)}
                        </ThemedText>
                      </View>
                      {isSwitching ? (
                        <View
                          style={{
                            borderRadius: BrandRadius.pill,
                            borderCurve: "continuous",
                            backgroundColor: theme.color.primarySubtle,
                            paddingHorizontal: BrandSpacing.controlX,
                            paddingVertical: BrandSpacing.xs,
                          }}
                        >
                          <ThemedText type="micro" style={{ color: theme.color.primary }}>
                            {t("profile.switcher.loadingLabel")}
                          </ThemedText>
                        </View>
                      ) : (
                        <IconSymbol name="chevron.right" size={14} color={theme.color.textMuted} />
                      )}
                    </Pressable>
                    {index < otherAccounts.length - 1 ? (
                      <View
                        style={{
                          height: 1,
                          marginLeft: compactAccountAvatarSize + BrandSpacing.md + BrandSpacing.xs,
                          marginRight: BrandSpacing.xs,
                          backgroundColor: theme.color.border,
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <ProfileSectionHeader
          label={t("profile.switcher.accountsTitle")}
          icon="person.2.fill"
          flush
        />
        <ProfileSectionCard>
          <ProfileSettingRow
            title={t("profile.switcher.useAnotherAccountTitle")}
            subtitle={t("profile.switcher.useAnotherAccountHint")}
            icon="person.crop.circle.badge.plus"
            onPress={onUseAnotherAccount}
            showDivider
          />
          <ProfileSettingRow
            title={t("tabsLayout.actions.signOut")}
            subtitle={t("profile.settings.signOutDesc")}
            icon="rectangle.portrait.and.arrow.right"
            onPress={onSignOut}
            tone="danger"
          />
        </ProfileSectionCard>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
