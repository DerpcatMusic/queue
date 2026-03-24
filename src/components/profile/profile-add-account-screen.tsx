import { useAuthActions } from "@convex-dev/auth/react";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import {
  clearPendingPostSignOutAuthIntent,
  setPendingPostSignOutAuthIntent,
  type PostSignOutAuthIntent,
} from "@/modules/session/post-signout-auth-intent";

type ProfileAddAccountScreenProps = {
  profileRoute: Href;
  routeMatchPath: string;
};

const AUTH_SIGN_IN_ROUTE = "/sign-in?intent=sign-in" as Href;
const AUTH_SIGN_UP_ROUTE = "/sign-in?intent=sign-up" as Href;

export function ProfileAddAccountScreen({
  profileRoute,
  routeMatchPath,
}: ProfileAddAccountScreenProps) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { t } = useTranslation();
  const palette = useBrand();
  const [pendingIntent, setPendingIntent] = useState<PostSignOutAuthIntent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useProfileSubpageSheet({
    title: t("profile.navigation.addAccount"),
    routeMatchPath,
  });

  const handleCancel = useCallback(() => {
    router.replace(profileRoute);
  }, [profileRoute, router]);

  const handleContinue = useCallback(
    async (intent: PostSignOutAuthIntent) => {
      if (pendingIntent) {
        return;
      }

      setPendingIntent(intent);
      setErrorMessage(null);
      setPendingPostSignOutAuthIntent(intent);

      try {
        await signOut();
        router.replace(intent === "sign-up" ? AUTH_SIGN_UP_ROUTE : AUTH_SIGN_IN_ROUTE);
      } catch (error) {
        clearPendingPostSignOutAuthIntent();
        setErrorMessage(
          error instanceof Error && error.message ? error.message : t("auth.unexpectedError"),
        );
        setPendingIntent(null);
      }
    },
    [pendingIntent, router, signOut, t],
  );

  return (
    <ProfileSubpageScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        gap: BrandSpacing.md,
      }}
    >
      <ProfileSectionHeader
        label={t("profile.switcher.addAccountTitle")}
        description={t("profile.switcher.addAccountBody")}
        icon="person.crop.circle.badge.plus"
        palette={palette}
      />

      <ProfileSectionCard palette={palette}>
        <View
          style={{
            gap: BrandSpacing.sm,
            paddingHorizontal: BrandSpacing.lg,
            paddingVertical: BrandSpacing.lg,
          }}
        >
          <ThemedText type="bodyStrong" style={{ color: palette.text as string }}>
            {t("profile.switcher.addAccountCurrentTitle")}
          </ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
            {t("profile.switcher.addAccountCurrentBody")}
          </ThemedText>
        </View>
      </ProfileSectionCard>

      <View
        style={{
          gap: BrandSpacing.sm,
          paddingHorizontal: BrandSpacing.inset,
        }}
      >
        <ActionButton
          label={
            pendingIntent === "sign-in"
              ? t("profile.switcher.signingInAnother")
              : t("profile.switcher.signInAnotherTitle")
          }
          onPress={() => {
            void handleContinue("sign-in");
          }}
          disabled={pendingIntent !== null}
          palette={palette}
          fullWidth
          size="lg"
        />
        <ActionButton
          label={
            pendingIntent === "sign-up"
              ? t("profile.switcher.creatingAnother")
              : t("profile.switcher.createAnotherTitle")
          }
          onPress={() => {
            void handleContinue("sign-up");
          }}
          disabled={pendingIntent !== null}
          palette={palette}
          tone="secondary"
          fullWidth
          size="lg"
        />
      </View>

      <ProfileSectionCard
        palette={palette}
        style={{
          borderRadius: BrandRadius.soft,
        }}
      >
        <ProfileSettingRow
          title={t("profile.switcher.signInAnotherTitle")}
          subtitle={t("profile.switcher.signInAnotherHint")}
          icon="person.badge.key.fill"
          palette={palette}
          showDivider
        />
        <ProfileSettingRow
          title={t("profile.switcher.createAnotherTitle")}
          subtitle={t("profile.switcher.createAnotherHint")}
          icon="plus.circle.fill"
          palette={palette}
          showDivider
        />
        <ProfileSettingRow
          title={t("profile.switcher.cancelAddAccountTitle")}
          subtitle={errorMessage ?? t("profile.switcher.cancelAddAccountHint")}
          icon="arrow.uturn.backward.circle.fill"
          onPress={handleCancel}
          palette={palette}
          tone={errorMessage ? "danger" : "default"}
        />
      </ProfileSectionCard>
    </ProfileSubpageScrollView>
  );
}
