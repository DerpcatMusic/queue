import { useAuthActions } from "@convex-dev/auth/react";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import {
  clearPendingPostSignOutAuthIntent,
  setPendingPostSignOutAuthHandoff,
} from "@/modules/session/post-signout-auth-intent";

type ProfileAddAccountScreenProps = {
  profileRoute: Href;
  routeMatchPath: string;
};

export function ProfileAddAccountScreen({
  profileRoute,
  routeMatchPath,
}: ProfileAddAccountScreenProps) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { t } = useTranslation();
  const palette = useBrand();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useProfileSubpageSheet({
    title: t("profile.navigation.addAccount"),
    routeMatchPath,
  });

  const handleCancel = useCallback(() => {
    router.replace(profileRoute);
  }, [profileRoute, router]);

  const normalizedEmail = email.trim();

  const handleContinue = useCallback(
    async () => {
      if (isSubmitting || normalizedEmail.length === 0) {
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);
      setPendingPostSignOutAuthHandoff({
        email: normalizedEmail,
        intent: "sign-in",
      });

      try {
        await signOut();
        router.replace(`/sign-in?email=${encodeURIComponent(normalizedEmail)}` as Href);
      } catch (error) {
        clearPendingPostSignOutAuthIntent();
        setErrorMessage(
          error instanceof Error && error.message ? error.message : t("auth.unexpectedError"),
        );
        setIsSubmitting(false);
      }
    },
    [isSubmitting, normalizedEmail, router, signOut, t],
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
        icon="person.badge.plus"
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
          <KitTextField
            value={email}
            onChangeText={setEmail}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
            placeholder={t("auth.emailPlaceholder")}
            style={{
              ...BrandType.bodyMedium,
              includeFontPadding: false,
            }}
          />
          <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
            {t("profile.switcher.addAccountFieldHint")}
          </ThemedText>
          {errorMessage ? (
            <ThemedText type="caption" style={{ color: palette.danger as string }}>
              {errorMessage}
            </ThemedText>
          ) : null}
          <View style={{ gap: BrandSpacing.sm, paddingTop: BrandSpacing.xs }}>
            <ActionButton
              label={
                isSubmitting
                  ? t("profile.switcher.continuingWithEmail")
                  : t("profile.switcher.continueWithEmail")
              }
              onPress={() => {
                void handleContinue();
              }}
              disabled={isSubmitting || normalizedEmail.length === 0}
              palette={palette}
              fullWidth
              size="lg"
            />
            <ActionButton
              label={t("common.cancel")}
              onPress={handleCancel}
              disabled={isSubmitting}
              palette={palette}
              tone="secondary"
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </ProfileSectionCard>
    </ProfileSubpageScrollView>
  );
}
