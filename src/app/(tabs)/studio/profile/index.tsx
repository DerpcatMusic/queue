import { useAuthActions } from "@convex-dev/auth/react";
import { useBrand } from "@/hooks/use-brand";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { useIsFocused } from "@react-navigation/native";
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

export default function StudioProfileScreen() {
  const { signOut } = useAuthActions();
  const { currentUser } = useUser();
  const { language, setLanguage } = useAppLanguage();
  const { preference, setPreference, resolvedScheme } =
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

  const chevron = <IconSymbol name="chevron.right" size={14} color={palette.textMicro} />;

  return (
    <RoleRouteGate requiredRole="studio" redirectHref="/(tabs)/instructor/profile">
      <TabScreenScrollView
        routeKey="studio/profile"
        key={resolvedScheme}
        style={[styles.screen, { backgroundColor: palette.appBg }]}
        contentContainerStyle={styles.content}
      >
      <SectionHeader label={t("profile.account.title")} palette={palette} />
      <View style={[styles.cardGroup, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
        <ProfileRow title={t("profile.account.nameLabel")} subtitle={nameValue} palette={palette} />
        <ProfileRow title={t("profile.account.emailLabel")} subtitle={emailValue} palette={palette} />
        <ProfileRow title={t("profile.account.roleLabel")} subtitle={roleValue} palette={palette} isLast={!memberSince} />
        {memberSince && <ProfileRow title={t("profile.account.memberSince")} subtitle={memberSince} palette={palette} isLast />}
      </View>

      <SectionHeader label={t("profile.appearance.title")} palette={palette} />
      <View style={[styles.cardGroup, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
        <ProfileRow
          title={t("profile.language.title")}
          subtitle={language === "en" ? t("language.english") : t("language.hebrew")}
          onPress={() => void setLanguage(language === "en" ? "he" : "en")}
          palette={palette}
          accessory={chevron}
        />
        <ProfileRow
          title={t("profile.appearance.systemTheme.title")}
          subtitle=""
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
          subtitle=""
          palette={palette}
          isLast
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
      <View style={[styles.cardGroup, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
        <ProfileRow
          title="Payments & payouts"
          onPress={() => router.push("/(tabs)/studio/profile/payments")}
          palette={palette}
          isLast
          accessory={chevron}
        />
      </View>

      <View style={{ marginTop: 40, marginBottom: 40 }}>
        <View style={[styles.cardGroup, { backgroundColor: palette.surfaceElevated, borderColor: palette.border }]}>
          <ProfileRow
            title={t("auth.signOutButton")}
            subtitle=""
            onPress={() => void signOut()}
            palette={palette}
            isLast
            accessory={<IconSymbol name="arrow.right.square" size={24} color={palette.danger} />}
          />
        </View>
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
          fontWeight: "600",
          letterSpacing: -0.2,
          fontSize: 20,
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
  isLast = false,
}: {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  onPress?: () => void;
  palette: BrandPalette;
  isLast?: boolean;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        <ThemedText style={{ fontSize: 16, fontWeight: "500", color: palette.text, letterSpacing: -0.1 }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={{ color: palette.textMuted, fontSize: 13, fontWeight: "400", marginTop: 4 }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {accessory && <View>{accessory}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          { backgroundColor: pressed ? (palette.surfaceAlt as string) : "transparent" },
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 0,
    paddingVertical: 16,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardGroup: {
    borderWidth: 1,
    borderRadius: 24,
    marginHorizontal: 16,
    overflow: "hidden",
  },
});
