import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import { ThemedText } from "@/components/themed-text";
import { KitChip } from "@/components/ui/kit/kit-chip";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";

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
        <View
          style={{
            marginHorizontal: BrandSpacing.inset,
            marginTop: BrandSpacing.lg,
            borderRadius: 24,
            borderCurve: "continuous",
            padding: BrandSpacing.lg,
            gap: BrandSpacing.md,
            backgroundColor: color.surfaceElevated,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
            <ProfileAvatar
              imageUrl={profile.profileImageUrl}
              fallbackName={profile.displayName}
              size={64}
              roundedSquare={false}
            />
            <View style={{ flex: 1, gap: BrandSpacing.xxs }}>
              <ThemedText type="title">{profile.displayName}</ThemedText>
              <ThemedText type="caption" style={{ color: color.textMuted }}>
                {profile.isVerified
                  ? t("publicProfile.instructor.verified", { defaultValue: "Verified instructor" })
                  : t("publicProfile.instructor.public", { defaultValue: "Instructor profile" })}
              </ThemedText>
            </View>
          </View>
          {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}
        </View>

        {sports.length > 0 ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.instructor.sports", { defaultValue: "Sports" })}
            />
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: BrandSpacing.sm,
                paddingHorizontal: BrandSpacing.inset,
              }}
            >
              {sports.map((sport) => (
                <KitChip key={sport} label={sport} selected={false} onPress={() => {}} disabled />
              ))}
            </View>
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
