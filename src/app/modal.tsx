import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { I18nManager, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";

export default function ModalScreen() {
  const { t } = useTranslation();
  const palette = useBrand();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.surface as string,
          direction: I18nManager.isRTL ? "rtl" : "ltr",
        },
      ]}
    >
      <ThemedText type="title">{t("modal.title")}</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">{t("modal.goHome")}</ThemedText>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
