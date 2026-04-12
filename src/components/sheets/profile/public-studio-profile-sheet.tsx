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
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";

interface PublicStudioProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  studioId: string | null;
}

export function PublicStudioProfileSheet({
  visible,
  onClose,
  studioId,
}: PublicStudioProfileSheetProps) {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();

  const profile = useQuery(
    api.users.getStudioPublicProfileForInstructor,
    studioId ? { studioId } : "skip",
  );
  const zoneLanguage = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const sports = useMemo(
    () => (profile?.sports ?? []).map((sport: string) => toSportLabel(sport as never)),
    [profile?.sports],
  );

  if (!studioId || profile === undefined) {
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
              fallbackName={profile.studioName}
              size={72}
              roundedSquare={false}
              fallbackIcon="building.2.fill"
              accessibilityLabel={profile.studioName}
            />
            <Box style={{ flex: 1, gap: BrandSpacing.xxs }}>
              <ThemedText type="title">{profile.studioName}</ThemedText>
              <ThemedText type="caption" style={{ color: color.textMuted }}>
                {profile.isVerified
                  ? t("publicProfile.studio.verified", {
                      defaultValue: "Verified driving school",
                    })
                  : t("publicProfile.studio.public", {
                      defaultValue: "Driving school profile",
                    })}
              </ThemedText>
            </Box>
          </Box>

          {profile.bio ? <ThemedText style={{ lineHeight: 22 }}>{profile.bio}</ThemedText> : null}

          <Box
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BrandSpacing.sm,
              paddingVertical: BrandSpacing.xs,
            }}
          >
            <Text style={{ fontSize: 14 }}>📍</Text>
            <ThemedText type="bodyMedium">{getZoneLabel(profile.zone, zoneLanguage)}</ThemedText>
          </Box>
        </Box>

        {sports.length > 0 ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.studio.sports", {
                defaultValue: "Driving lessons offered",
              })}
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

        {profile.branches && profile.branches.length > 0 ? (
          <>
            <ProfileSectionHeader
              label={t("publicProfile.studio.locations", { defaultValue: "Our locations" })}
            />
            <ProfileSectionCard>
              {profile.branches.map(
                (
                  branch: { branchId: string; name: string; isPrimary?: boolean; address: string },
                  index: number,
                ) => (
                  <Box
                    key={branch.branchId}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: BrandSpacing.md,
                      paddingVertical: BrandSpacing.sm,
                      borderBottomWidth: index < (profile.branches?.length ?? 0) - 1 ? 1 : 0,
                      borderBottomColor: color.divider,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>📍</Text>
                    <Box style={{ flex: 1 }}>
                      <ThemedText type="bodyMedium">
                        {branch.name}
                        {branch.isPrimary ? (
                          <Text style={{ fontSize: 12, color: color.primary }}>
                            {" "}
                            ({t("publicProfile.studio.primary", { defaultValue: "Main" })})
                          </Text>
                        ) : null}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: color.textMuted, includeFontPadding: false }}
                      >
                        {branch.address}
                      </ThemedText>
                    </Box>
                  </Box>
                ),
              )}
            </ProfileSectionCard>
          </>
        ) : null}

        <Box
          style={{
            marginHorizontal: BrandSpacing.inset,
            marginTop: BrandSpacing.lg,
            borderRadius: BrandRadius.soft,
            borderCurve: "continuous",
            padding: BrandSpacing.lg,
            gap: BrandSpacing.md,
            backgroundColor: color.primary,
            alignItems: "center",
          }}
        >
          <ThemedText type="bodyMedium" style={{ color: color.surface, textAlign: "center" }}>
            {t("publicProfile.studio.cta", {
              defaultValue: "Book driving lessons at {{name}}",
              name: profile.studioName,
            })}
          </ThemedText>
          <KitPressable
            onPress={() => {}}
            style={{
              tone: "primary",
              variant: "solid",
              size: { minHeight: 48, borderRadius: BrandRadius.button },
              padding: { horizontal: BrandSpacing.xl },
            }}
          >
            <Text style={[BrandType.bodyMedium, { color: color.surface }]}>
              {t("publicProfile.studio.book", { defaultValue: "View available instructors" })}
            </Text>
          </KitPressable>
        </Box>
      </TabScreenScrollView>
    </BaseProfileSheet>
  );
}
