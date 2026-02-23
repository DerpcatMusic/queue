import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { isSportType, toSportLabel } from "@/convex/constants";
import { useBrand } from "@/hooks/use-brand";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { type BrandPalette } from "@/constants/brand";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { NativeList, NativeListItem } from "@/components/ui/native-list";
import { KitSwitchRow } from "@/components/ui/kit";

const ROLE_TRANSLATION_KEYS = {
  pending: "profile.roles.pending",
  instructor: "profile.roles.instructor",
  studio: "profile.roles.studio",
  admin: "profile.roles.admin",
} as const;

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);
  const { language, setLanguage } = useAppLanguage();
  const {
    preference,
    setPreference,
    resolvedScheme,
    stylePreference,
    setStylePreference,
  } = useThemePreference();
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const router = useRouter();

  const instructorSettings = useQuery(
    api.users.getMyInstructorSettings,
    currentUser?.role === "instructor" ? {} : "skip",
  );

  const nameValue = currentUser?.fullName ?? t("profile.account.fallbackName");
  const emailValue = currentUser?.email ?? t("profile.account.fallbackEmail");
  const roleValue = currentUser?.role
    ? t(ROLE_TRANSLATION_KEYS[currentUser.role as keyof typeof ROLE_TRANSLATION_KEYS] ?? "profile.roles.pending")
     : t("profile.roles.unknown");
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(
        i18n.resolvedLanguage ?? "en",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : null;

  // Sports summary for drill-in row
  const sportsSummary = useMemo(() => {
    const sports = instructorSettings?.sports ?? [];
    if (sports.length === 0) return t("profile.settings.sports.none");
    if (sports.length <= 2) {
      return sports
        .map((sport) =>
          isSportType(sport) ? toSportLabel(sport) : sport,
        )
        .join(", ");
    }
    return t("profile.settings.sports.selected", { count: sports.length });
  }, [instructorSettings, t]);

  // Location summary for drill-in row
  const locationSummary = useMemo(() => {
    const addr = instructorSettings?.address;
    if (!addr) return t("profile.settings.location.zoneNotDetected");
    return addr.length > 35 ? `${addr.slice(0, 32)}...` : addr;
  }, [instructorSettings, t]);

  // Calendar summary
  const calendarSummary = useMemo(() => {
    const provider = instructorSettings?.calendarProvider;
    if (!provider || provider === "none") return t("profile.settings.calendar.provider.none");
    return provider === "google" ? "Google"  : t("profile.roles.unknown");
  }, [instructorSettings, t]);

  const chevron = (
    <IconSymbol name="chevron.right" size={14} color={palette.textMicro} />
  );

  return (
    <ScrollView
      key={resolvedScheme}
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <SectionHeader label={t("profile.account.title")} palette={palette} />
      <NativeList inset>
        <NativeListItem
          title={t("profile.account.nameLabel")}
          accessory={<ThemedText style={{ color: palette.textMuted }}>{nameValue}</ThemedText>}
        />
        <NativeListItem
          title={t("profile.account.emailLabel")}
          accessory={<ThemedText style={{ color: palette.textMuted }}>{emailValue}</ThemedText>}
        />
        <NativeListItem
          title={t("profile.account.roleLabel")}
          accessory={<ThemedText style={{ color: palette.textMuted }}>{roleValue}</ThemedText>}
        />
        {memberSince ? (
          <NativeListItem
            title={t("profile.account.memberSince")}
            accessory={<ThemedText style={{ color: palette.textMuted }}>{memberSince}</ThemedText>}
          />
        ) : null}
      </NativeList>

      <SectionHeader label={t("profile.appearance.title")} palette={palette} />
      <NativeList inset>
        <NativeListItem
          title={t("profile.language.title")}
          onPress={() => {
            void setLanguage(language === "en" ? "he" : "en");
          }}
          accessory={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ThemedText style={{ color: palette.textMuted }}>
                {language === "en" ? t("language.english") : t("language.hebrew")}
              </ThemedText>
              {chevron}
            </View>
          }
        />
        <KitSwitchRow
          title={t("profile.appearance.themeStyle.title")}
          value={stylePreference === "native"}
          onValueChange={(enabled) => {
            void setStylePreference(enabled ? "native" : "custom");
          }}
          description={
            stylePreference === "native"
              ? t("profile.appearance.themeStyle.nativeDescription")
              : t("profile.appearance.themeStyle.customDescription")
          }
        />
        <KitSwitchRow
          title={t("profile.appearance.systemTheme.title")}
          value={preference === "system"}
          onValueChange={(enabled) => {
            void setPreference(enabled ? "system" : "light");
          }}
          description={t("profile.appearance.systemTheme.description")}
        />
        <KitSwitchRow
          title={t("profile.appearance.darkMode.title")}
          value={preference === "dark"}
          disabled={preference === "system"}
          onValueChange={(enabled) => {
            void setPreference(enabled ? "dark" : "light");
          }}
          description={
            preference === "system"
              ? t("profile.appearance.darkMode.disableSystemFirst")
              : t("profile.appearance.darkMode.description")
          }
        />
      </NativeList>

      {currentUser?.role === "instructor" ? (
        <>
          <SectionHeader label={t("profile.settings.title")} palette={palette} />
          <NativeList inset>
            <NativeListItem
              title={t("profile.settings.sports.title")}
              onPress={() => router.push("/(tabs)/profile/sports")}
              accessory={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ThemedText style={{ color: palette.textMuted }} numberOfLines={1}>
                    {sportsSummary}
                  </ThemedText>
                  {chevron}
                </View>
              }
            />
            <NativeListItem
              title={t("profile.settings.location.title")}
              onPress={() => router.push("/(tabs)/profile/location")}
              accessory={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 200 }}>
                  <ThemedText style={{ color: palette.textMuted }} numberOfLines={1}>
                    {locationSummary}
                  </ThemedText>
                  {chevron}
                </View>
              }
            />
            <NativeListItem
              title={t("profile.settings.calendar.title")}
              onPress={() => router.push("/(tabs)/profile/calendar-settings")}
              accessory={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {calendarSummary}
                  </ThemedText>
                  {chevron}
                </View>
              }
            />
          </NativeList>
        </>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <NativeList inset>
          <NativeListItem
            title={t("auth.signOutButton")}
            onPress={() => {
              void signOut();
            }}
          >
            <ThemedText style={{ color: palette.textMuted, fontSize: 13, marginTop: 2 }}>
              {t("profile.signOut.description")}
            </ThemedText>
          </NativeListItem>
        </NativeList>
      </View>
    </ScrollView>
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
        type="caption"
        style={{
          color: palette.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 0,
  },
  sectionHeader: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 6,
  },
});

