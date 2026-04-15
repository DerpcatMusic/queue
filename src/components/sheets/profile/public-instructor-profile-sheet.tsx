import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
} from "@/components/profile/profile-settings-sections";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ThemedText } from "@/components/themed-text";
import { KitPressable } from "@/components/ui/kit/kit-pressable";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

interface PublicInstructorProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  instructorId: string | null;
}

export function PublicInstructorProfileSheet({
  visible,
  onClose,
  instructorId,
}: PublicInstructorProfileSheetProps) {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();
  const profile = useQuery(
    api.instructors.publicProfiles.getInstructorPublicProfileForInstructor,
    instructorId ? { instructorId: instructorId as Id<"instructorProfiles"> } : "skip",
  );
  const zoneLanguage = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const sports = useMemo(
    () => (profile?.sports ?? []).map((sport) => toSportLabel(sport as never)),
    [profile?.sports],
  );

  if (!instructorId || profile === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose} snapPoints={["85%"]} scrollable={false}>
        <LoadingScreen />
      </BaseProfileSheet>
    );
  }

  if (!profile) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose} snapPoints={["85%"]} scrollable={false}>
        <LoadingScreen label={t("common.notFound", { defaultValue: "Not found" })} />
      </BaseProfileSheet>
    );
  }

  return (
    <BaseProfileSheet visible={visible} onClose={onClose} snapPoints={["85%"]} scrollable={false}>
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

          {profile.hourlyRateExpectation ? (
            <Box
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.sm,
                paddingVertical: BrandSpacing.xs,
              }}
            >
              <Text style={{ fontSize: 14 }}>💰</Text>
              <ThemedText type="bodyMedium">
                {t("publicProfile.instructor.rate", { defaultValue: "Hourly rate" })}: ₪
                {profile.hourlyRateExpectation}
              </ThemedText>
            </Box>
          ) : null}
        </Box>

        {sports.length > 0 ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.instructor.sports", { defaultValue: "Sports I teach" })}
            />
            <Box
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: BrandSpacing.sm,
                paddingHorizontal: BrandSpacing.inset,
              }}
            >
              {sports.map((sport: string) => (
                <KitPressable
                  key={sport}
                  disabled
                  haptic={false}
                  onPress={() => {}}
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
                    backgroundColor: color.surface,
                    pressedBackgroundColor: color.surface,
                  }}
                >
                  <Text
                    style={[BrandType.micro, { color: color.textMuted, includeFontPadding: false }]}
                  >
                    {sport}
                  </Text>
                </KitPressable>
              ))}
            </Box>
          </>
        ) : null}

        <ProfileSectionHeader
          label={t("publicProfile.instructor.coverage", { defaultValue: "Coverage areas" })}
        />
        <ProfileSectionCard>
          {profile.zones.map((zone: string, index: number) => (
            <Box
              key={zone}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                paddingVertical: BrandSpacing.sm,
                borderBottomWidth: index < profile.zones.length - 1 ? 1 : 0,
                borderBottomColor: color.divider,
              }}
            >
              <Text style={{ fontSize: 16 }}>📍</Text>
              <ThemedText type="bodyMedium">{getZoneLabel(zone, zoneLanguage)}</ThemedText>
            </Box>
          ))}
        </ProfileSectionCard>
      </TabScreenScrollView>
    </BaseProfileSheet>
  );
}
