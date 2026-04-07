import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";

import { ThemedText } from "@/components/themed-text";
import { KitPressable } from "@/components/ui/kit/kit-pressable";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

export function PublicInstructorProfileScreen() {
  const { instructorId } = useLocalSearchParams<{ instructorId: string }>();
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const profile = useQuery(
    api.users.getInstructorPublicProfileForInstructor,
    instructorId ? { instructorId: instructorId as Id<"instructorProfiles"> } : "skip",
  );
  const zoneLanguage = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const sports = useMemo(
    () => (profile?.sports ?? []).map((sport) => toSportLabel(sport as never)),
    [profile?.sports],
  );

  if (profile === undefined) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return <LoadingScreen label={t("common.notFound", { defaultValue: "Not found" })} />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TabScreenScrollView contentContainerStyle={{ paddingBottom: BrandSpacing.section }}>
        <Box
          style={{
            marginHorizontal: BrandSpacing.inset,
            marginTop: BrandSpacing.lg,
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            padding: BrandSpacing.lg,
            gap: BrandSpacing.md,
            backgroundColor: color.surfaceElevated,
          }}
        >
          <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
            <ProfileAvatar
              imageUrl={profile.profileImageUrl}
              fallbackName={profile.displayName}
              size={64}
              roundedSquare={false}
              accessibilityLabel={profile.displayName}
            />
            <Box style={{ flex: 1, gap: BrandSpacing.xxs }}>
              <ThemedText type="title">{profile.displayName}</ThemedText>
              <ThemedText type="caption" style={{ color: color.textMuted }}>
                {profile.isVerified
                  ? t("publicProfile.instructor.verified", { defaultValue: "Verified instructor" })
                  : t("publicProfile.instructor.public", { defaultValue: "Instructor profile" })}
              </ThemedText>
            </Box>
          </Box>
          {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}
        </Box>

        {sports.length > 0 ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.instructor.sports", { defaultValue: "Sports" })}
            />
            <Box
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: BrandSpacing.sm,
                paddingHorizontal: BrandSpacing.inset,
              }}
            >
              {sports.map((sport) => {
                const bgColor = color.surface;
                const pressedBgColor = color.surface;
                const textColor = color.textMuted;
                return (
                  <KitPressable
                    key={sport}
                    accessibilityRole="none"
                    accessibilityHint={t("publicProfile.instructor.sportChipHint", {
                      defaultValue: "Sport offered by this instructor",
                    })}
                    disabled
                    haptic={false}
                    onPress={() => {
                      triggerSelectionHaptic();
                    }}
                    style={{
                      tone: "surface",
                      variant: "solid",
                      size: {
                        minHeight: BrandSpacing.controlSm,
                        borderRadius: BrandRadius.buttonSubtle,
                      },
                      padding: {
                        horizontal: BrandSpacing.controlX,
                        vertical: BrandSpacing.sm,
                      },
                      backgroundColor: bgColor,
                      pressedBackgroundColor: pressedBgColor,
                    }}
                  >
                    <Text
                      style={[BrandType.micro, { color: textColor, includeFontPadding: false }]}
                    >
                      {sport}
                    </Text>
                  </KitPressable>
                );
              })}
            </Box>
          </>
        ) : null}

        <ProfileSectionHeader
          label={t("publicProfile.instructor.coverage", { defaultValue: "Coverage" })}
        />
        <ProfileSectionCard>
          {profile.zones.map((zone, index) => (
            <ProfileSettingRow
              key={zone}
              title={getZoneLabel(zone, zoneLanguage)}
              icon="mappin.and.ellipse"
              showDivider={index < profile.zones.length - 1}
            />
          ))}
          {profile.hourlyRateExpectation ? (
            <ProfileSettingRow
              title={t("publicProfile.instructor.rate", { defaultValue: "Hourly expectation" })}
              value={`₪${String(profile.hourlyRateExpectation)}`}
              icon="shekelsign.circle"
            />
          ) : null}
        </ProfileSectionCard>
      </TabScreenScrollView>
    </>
  );
}
