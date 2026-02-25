import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useBrand } from "@/hooks/use-brand";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View, Switch, Pressable } from "react-native";
import type { BrandPalette } from "@/constants/brand";
import { useTranslation } from "react-i18next";

import { LoadingScreen } from "@/components/loading-screen";
import { RoleRouteGate } from "@/components/auth/role-route-gate";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useUser } from "@/contexts/user-context";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;

export default function InstructorProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { language, setLanguage } = useAppLanguage();
  const { preference, setPreference, resolvedScheme, stylePreference, setStylePreference } =
    useThemePreference();
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isFocused) {
      setHasActivated(true);
    }
  }, [isFocused]);

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" && hasActivated ? {} : "skip",
  );
  const paymentPreview = useQuery(
    api.payments.listMyPayments,
    currentUser?.role === "instructor" && hasActivated ? { limit: 1 } : "skip",
  );

  if (!hasActivated) return <LoadingScreen />;

  const nameValue = currentUser?.fullName ?? t("profile.account.fallbackName");
  const emailValue = currentUser?.email ?? t("profile.account.fallbackEmail");
  const roleValue = t(
    ROLE_TRANSLATION_KEYS[currentUser?.role as keyof typeof ROLE_TRANSLATION_KEYS] ??
      "profile.roles.pending",
  );
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? "en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const sports = instructorSettings?.sports ?? [];
  const sportsSummary =
    sports.length === 0
      ? t("profile.settings.sports.none")
      : sports.length <= 2
        ? sports.map((sport) => (isSportType(sport) ? toSportLabel(sport) : sport)).join(", ")
        : t("profile.settings.sports.selected", { count: sports.length });

  const addr = instructorSettings?.address;
  const locationSummary = !addr
    ? t("profile.settings.location.zoneNotDetected")
    : addr.length > 35
      ? `${addr.slice(0, 32)}...`
      : addr;

  const provider = instructorSettings?.calendarProvider;
  const calendarSummary =
    !provider || provider === "none"
      ? t("profile.settings.calendar.provider.none")
      : provider === "google"
        ? "Google"
        : t("profile.roles.unknown");

  const latestPayment = paymentPreview?.[0];
  const paymentSummary =
    paymentPreview === undefined
      ? "Loading..."
      : !latestPayment
        ? "No payments yet"
        : latestPayment.payout
          ? `Payout ${latestPayment.payout.status}`
          : `Payment ${latestPayment.payment.status}`;

  const chevron = <IconSymbol name="chevron.right" size={14} color={palette.textMicro} />;

  return (
    <RoleRouteGate requiredRole="instructor" redirectHref="/(tabs)/studio/profile/index">
      <TabScreenScrollView
        routeKey="instructor/profile"
        key={resolvedScheme}
        style={[styles.screen, { backgroundColor: palette.appBg }]}
        contentContainerStyle={styles.content}
      >
      <SectionHeader label={t("profile.account.title")} palette={palette} />
      <View style={{ borderTopWidth: 1, borderTopColor: palette.border }}>
        <ProfileRow title={t("profile.account.nameLabel")} subtitle={nameValue} palette={palette} />
        <ProfileRow title={t("profile.account.emailLabel")} subtitle={emailValue} palette={palette} />
        <ProfileRow title={t("profile.account.roleLabel")} subtitle={roleValue} palette={palette} />
        {memberSince && <ProfileRow title={t("profile.account.memberSince")} subtitle={memberSince} palette={palette} />}
      </View>

      <SectionHeader label={t("profile.appearance.title")} palette={palette} />
      <View style={{ borderTopWidth: 1, borderTopColor: palette.border }}>
        <ProfileRow
          title={t("profile.language.title")}
          subtitle={language === "en" ? t("language.english") : t("language.hebrew")}
          onPress={() => void setLanguage(language === "en" ? "he" : "en")}
          palette={palette}
          accessory={chevron}
        />
        <ProfileRow
          title={t("profile.appearance.themeStyle.title")}
          subtitle={
            stylePreference === "native"
              ? t("profile.appearance.themeStyle.nativeDescription")
              : t("profile.appearance.themeStyle.customDescription")
          }
          palette={palette}
          accessory={
            <Switch
              value={stylePreference === "native"}
              onValueChange={(val) => setStylePreference(val ? "native" : "custom")}
              trackColor={{ true: palette.primary, false: palette.borderStrong }}
            />
          }
        />
        <ProfileRow
          title={t("profile.appearance.systemTheme.title")}
          subtitle={t("profile.appearance.systemTheme.description")}
          palette={palette}
          accessory={
            <Switch
              value={preference === "system"}
              onValueChange={(val) => setPreference(val ? "system" : "light")}
              trackColor={{ true: palette.primary, false: palette.borderStrong }}
            />
          }
        />
        <ProfileRow
          title={t("profile.appearance.darkMode.title")}
          subtitle={
            preference === "system"
              ? t("profile.appearance.darkMode.disableSystemFirst")
              : t("profile.appearance.darkMode.description")
          }
          palette={palette}
          accessory={
            <Switch
              disabled={preference === "system"}
              value={preference === "dark"}
              onValueChange={(val) => setPreference(val ? "dark" : "light")}
              trackColor={{ true: palette.primary, false: palette.borderStrong }}
            />
          }
        />
      </View>

      <SectionHeader label="Payments" palette={palette} />
      <View style={{ borderTopWidth: 1, borderTopColor: palette.border }}>
        <ProfileRow
          title="Payments & payouts"
          subtitle={paymentSummary}
          onPress={() => router.push("/(tabs)/instructor/profile/payments")}
          palette={palette}
          accessory={chevron}
        />
      </View>

      <SectionHeader label={t("profile.settings.title")} palette={palette} />
      <View style={{ borderTopWidth: 1, borderTopColor: palette.border }}>
        <ProfileRow
          title={t("profile.settings.sports.title")}
          subtitle={sportsSummary}
          onPress={() => router.push("/(tabs)/instructor/profile/sports")}
          palette={palette}
          accessory={chevron}
        />
        <ProfileRow
          title={t("profile.settings.location.title")}
          subtitle={locationSummary}
          onPress={() => router.push("/(tabs)/instructor/profile/location")}
          palette={palette}
          accessory={chevron}
        />
        <ProfileRow
          title={t("profile.settings.calendar.title")}
          subtitle={calendarSummary}
          onPress={() => router.push("/(tabs)/instructor/profile/calendar-settings")}
          palette={palette}
          accessory={chevron}
        />
      </View>

      <View style={{ marginTop: 48, marginBottom: 32 }}>
        <ProfileRow
          title={t("auth.signOutButton")}
          subtitle={t("profile.signOut.description")}
          onPress={() => void signOut()}
          palette={palette}
          accessory={<IconSymbol name="arrow.right.square" size={24} color={palette.danger} />}
        />
      </View>
      </TabScreenScrollView>
    </RoleRouteGate>
  );
}

type SectionHeaderProps = {
  label: string;
  palette: BrandPalette;
};

function SectionHeader({ label, palette }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText
        type="title"
        style={{
          color: palette.text,
          textTransform: "uppercase",
          fontWeight: "900",
          letterSpacing: -1,
          fontSize: 32,
        }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

function ProfileRow({
  title,
  subtitle,
  accessory,
  onPress,
  palette,
}: {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  onPress?: () => void;
  palette: BrandPalette;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        <ThemedText style={{ fontSize: 16, fontWeight: "800", color: palette.text, letterSpacing: -0.5, textTransform: "uppercase" }}>
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText style={{ color: palette.textMuted, fontSize: 14, fontWeight: "600", marginTop: 4 }}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {accessory && <View>{accessory}</View>}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 0,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 16,
  },
});
