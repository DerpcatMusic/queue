/**
 * Studio Public Profile Sheet — bottom sheet version of the studio's public profile.
 *
 * Displays studio info (name, bio, sports, zones, verification status, branches)
 * in a bottom sheet instead of a full screen. Opened from calendar lesson detail.
 */

import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery } from "convex/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native-unistyles";
import { LoadingScreen } from "@/components/loading-screen";
import { BaseProfileSheet } from "@/components/sheets/profile/base-profile-sheet";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";

interface StudioPublicProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  slug: string | null;
}

export const StudioPublicProfileSheet = memo(function StudioPublicProfileSheet({
  visible,
  onClose,
  slug,
}: StudioPublicProfileSheetProps) {
  const { t, i18n } = useTranslation();
  const { color } = useTheme();

  const profile = useQuery(api.users.getStudioPublicProfileBySlug, slug ? { slug } : "skip");

  const zoneLanguage = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";

  if (!slug) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("common.notFound", { defaultValue: "Not found" })} />
      </BaseProfileSheet>
    );
  }

  if (profile === undefined) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen />
      </BaseProfileSheet>
    );
  }

  if (!profile) {
    return (
      <BaseProfileSheet visible={visible} onClose={onClose}>
        <LoadingScreen label={t("common.notFound", { defaultValue: "Not found" })} />
      </BaseProfileSheet>
    );
  }

  const sports = (profile.sports ?? []).map((sport: string) => toSportLabel(sport as never));

  return (
    <BaseProfileSheet visible={visible} onClose={onClose} snapPoints={["85%"]} scrollable={false}>
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Card */}
        <Box style={styles.heroCard}>
          <Box style={styles.heroRow}>
            <ProfileAvatar
              imageUrl={profile.profileImageUrl}
              fallbackName={profile.studioName}
              size={72}
              roundedSquare={false}
              accessibilityLabel={profile.studioName}
            />
            <Box style={styles.heroInfo}>
              <Text variant="titleLarge" style={styles.studioName}>
                {profile.studioName}
              </Text>
              <Box style={styles.verifiedRow}>
                {profile.isVerified ? (
                  <>
                    <Text style={styles.verifiedIcon}>✅</Text>
                    <Text variant="caption" style={{ color: color.textMuted }}>
                      {t("publicProfile.studio.verified", {
                        defaultValue: "Verified driving school",
                      })}
                    </Text>
                  </>
                ) : (
                  <Text variant="caption" style={{ color: color.textMuted }}>
                    {t("publicProfile.studio.public", {
                      defaultValue: "Driving school profile",
                    })}
                  </Text>
                )}
              </Box>
            </Box>
          </Box>

          {profile.bio ? (
            <Text variant="body" style={styles.bio}>
              {profile.bio}
            </Text>
          ) : null}

          {/* Zone */}
          <Box style={styles.zoneRow}>
            <Text style={styles.zoneIcon}>📍</Text>
            <Text variant="bodyMedium" style={{ color: color.text }}>
              {getZoneLabel(profile.zone, zoneLanguage)}
            </Text>
          </Box>
        </Box>

        {/* Sports */}
        {sports.length > 0 ? (
          <Box style={styles.section}>
            <Text variant="micro" style={styles.sectionLabel}>
              {t("publicProfile.studio.sports", {
                defaultValue: "Driving lessons offered",
              })}
            </Text>
            <Box style={styles.sportsRow}>
              {sports.map((sport: string) => (
                <Box key={sport} style={styles.sportChip}>
                  <Text style={styles.sportText}>{sport}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        {/* Coverage / Branches */}
        {profile.branches && profile.branches.length > 0 ? (
          <Box style={styles.section}>
            <Text variant="micro" style={styles.sectionLabel}>
              {t("publicProfile.studio.locations", {
                defaultValue: "Our locations",
              })}
            </Text>
            <Box style={styles.branchesCard}>
              {profile.branches.map(
                (
                  branch: {
                    branchId: string;
                    name: string;
                    isPrimary?: boolean;
                    address: string;
                  },
                  index: number,
                ) => (
                  <Box
                    key={branch.branchId}
                    style={[
                      styles.branchRow,
                      index < (profile.branches?.length ?? 0) - 1 && styles.branchRowBorder,
                    ]}
                  >
                    <Text style={styles.branchIcon}>📍</Text>
                    <Box style={styles.branchInfo}>
                      <Text variant="bodyMedium" style={{ color: color.text }}>
                        {branch.name}
                        {branch.isPrimary ? (
                          <Text style={[styles.primaryLabel, { color: color.primary }]}>
                            {" "}
                            ({t("publicProfile.studio.primary", { defaultValue: "Main" })})
                          </Text>
                        ) : null}
                      </Text>
                      <Text variant="caption" style={{ color: color.textMuted }}>
                        {branch.address}
                      </Text>
                    </Box>
                  </Box>
                ),
              )}
            </Box>
          </Box>
        ) : null}

        {/* App CTA */}
        <Box style={[styles.ctaCard, { backgroundColor: color.primary }]}>
          <Text variant="bodyMedium" style={[styles.ctaText, { color: color.surface }]}>
            {t("publicProfile.studio.cta", {
              defaultValue: "Book driving lessons at {{name}}",
              name: profile.studioName,
            })}
          </Text>
          <Box
            style={[
              styles.ctaButton,
              { backgroundColor: color.primary, borderColor: color.onPrimary },
            ]}
          >
            <Text style={[styles.ctaButtonText, { color: color.surface }]}>
              {t("publicProfile.studio.book", { defaultValue: "View available instructors" })}
            </Text>
          </Box>
        </Box>
      </BottomSheetScrollView>
    </BaseProfileSheet>
  );
});

const styles = StyleSheet.create((theme) => ({
  scrollContent: {
    paddingBottom: BrandSpacing.xxl * 2,
  },
  heroCard: {
    borderRadius: BrandRadius.soft,
    borderCurve: "continuous",
    padding: BrandSpacing.lg,
    gap: BrandSpacing.md,
    backgroundColor: theme.color.surfaceElevated,
    marginBottom: BrandSpacing.md,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
  },
  heroInfo: {
    flex: 1,
    gap: BrandSpacing.xxs,
  },
  studioName: {
    color: theme.color.text,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  verifiedIcon: {
    fontSize: 12,
  },
  bio: {
    lineHeight: 22,
    color: theme.color.text,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xs,
  },
  zoneIcon: {
    fontSize: 14,
  },
  section: {
    marginBottom: BrandSpacing.md,
  },
  sectionLabel: {
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    color: theme.color.textMuted,
    marginBottom: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.xs,
  },
  sportsRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: BrandSpacing.sm,
  },
  sportChip: {
    backgroundColor: theme.color.surface,
    borderRadius: BrandRadius.buttonSubtle,
    paddingHorizontal: BrandSpacing.controlX,
    paddingVertical: BrandSpacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  sportText: {
    ...BrandType.micro,
    color: theme.color.textMuted,
  },
  branchesCard: {
    backgroundColor: theme.color.surfaceElevated,
    borderRadius: BrandRadius.card,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: "hidden",
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.md,
  },
  branchRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.divider,
  },
  branchIcon: {
    fontSize: 16,
  },
  branchInfo: {
    flex: 1,
  },
  primaryLabel: {
    fontSize: 12,
  },
  ctaCard: {
    borderRadius: BrandRadius.soft,
    borderCurve: "continuous",
    padding: BrandSpacing.lg,
    gap: BrandSpacing.md,
    alignItems: "center",
    marginTop: BrandSpacing.md,
  },
  ctaText: {
    textAlign: "center",
  },
  ctaButton: {
    borderRadius: BrandRadius.button,
    paddingHorizontal: BrandSpacing.xl,
    paddingVertical: BrandSpacing.sm + 2,
    borderWidth: 1,
  },
  ctaButtonText: {
    ...BrandType.bodyMedium,
    fontWeight: "600",
  },
}));
