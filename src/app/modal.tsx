import { Link } from "expo-router";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandSpacing } from "@/constants/brand";

export default function ModalScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView className="flex-1 items-center justify-center" style={{ padding: BrandSpacing.lg }}>
      <ThemedText type="title">{t("modal.title")}</ThemedText>
      <Link
        href="/"
        dismissTo
        style={{ marginTop: BrandSpacing.component, paddingVertical: BrandSpacing.component }}
      >
        <ThemedText type="link">{t("modal.goHome")}</ThemedText>
      </Link>
    </ThemedView>
  );
}
