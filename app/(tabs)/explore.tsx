import { useClerk } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Collapsible } from "@/components/ui/collapsible";
import { ExternalLink } from "@/components/external-link";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts } from "@/constants/theme";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function ExploreScreen() {
  const { signOut } = useClerk();
  const { t } = useTranslation();
  const { language, setLanguage } = useAppLanguage();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={{
            fontFamily: Fonts.rounded,
          }}
        >
          {t("explore.title")}
        </ThemedText>
      </ThemedView>

      <ThemedText>{t("explore.intro")}</ThemedText>

      <ThemedView style={styles.languageCard}>
        <ThemedText type="subtitle">{t("language.label")}</ThemedText>
        <View style={styles.languageRow}>
          <Pressable
            style={[
              styles.languageButton,
              language === "en" && styles.languageButtonActive,
            ]}
            onPress={() => {
              void setLanguage("en");
            }}
          >
            <ThemedText type="defaultSemiBold">
              {t("language.english")}
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.languageButton,
              language === "he" && styles.languageButtonActive,
            ]}
            onPress={() => {
              void setLanguage("he");
            }}
          >
            <ThemedText type="defaultSemiBold">
              {t("language.hebrew")}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>

      <ThemedView style={styles.languageCard}>
        <ThemedText type="subtitle">{t("auth.accountSectionTitle")}</ThemedText>
        <Pressable
          style={[styles.languageButton, styles.signOutButton]}
          onPress={() => {
            void signOut();
          }}
        >
          <ThemedText type="defaultSemiBold">
            {t("auth.signOutButton")}
          </ThemedText>
        </Pressable>
      </ThemedView>

      <Collapsible title={t("explore.sectionRoutingTitle")}>
        <ThemedText>
          {t("explore.sectionRoutingLine1")}{" "}
          <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText>{" "}
          {t("explore.and")}{" "}
          <ThemedText type="defaultSemiBold">app/(tabs)/explore.tsx</ThemedText>
          .
        </ThemedText>
        <ThemedText>
          {t("explore.sectionRoutingLine2")}{" "}
          <ThemedText type="defaultSemiBold">app/(tabs)/_layout.tsx</ThemedText>{" "}
          {t("explore.sectionRoutingLine2End")}
        </ThemedText>
        <ExternalLink href="https://docs.expo.dev/router/introduction">
          <ThemedText type="link">{t("explore.learnMore")}</ThemedText>
        </ExternalLink>
      </Collapsible>

      <Collapsible title={t("explore.sectionPlatformsTitle")}>
        <ThemedText>{t("explore.sectionPlatformsBody")}</ThemedText>
      </Collapsible>

      <Collapsible title={t("explore.sectionImagesTitle")}>
        <ThemedText>{t("explore.sectionImagesBody")}</ThemedText>
        <Image
          source={require("@/assets/images/react-logo.png")}
          style={{ width: 100, height: 100, alignSelf: "center" }}
        />
        <ExternalLink href="https://reactnative.dev/docs/images">
          <ThemedText type="link">{t("explore.learnMore")}</ThemedText>
        </ExternalLink>
      </Collapsible>

      <Collapsible title={t("explore.sectionThemeTitle")}>
        <ThemedText>{t("explore.sectionThemeBody")}</ThemedText>
        <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
          <ThemedText type="link">{t("explore.learnMore")}</ThemedText>
        </ExternalLink>
      </Collapsible>

      <Collapsible title={t("explore.sectionAnimationsTitle")}>
        <ThemedText>
          {t("explore.sectionAnimationsBody")}{" "}
          <ThemedText type="defaultSemiBold" style={{ fontFamily: Fonts.mono }}>
            react-native-reanimated
          </ThemedText>
          .
        </ThemedText>
        {Platform.select({
          ios: <ThemedText>{t("explore.sectionAnimationsIos")}</ThemedText>,
        })}
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
  languageCard: {
    gap: 8,
  },
  languageRow: {
    flexDirection: "row",
    gap: 8,
  },
  languageButton: {
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  languageButtonActive: {
    borderColor: "#0a7ea4",
  },
  signOutButton: {
    alignSelf: "flex-start",
    borderColor: "#ef4444",
  },
});
