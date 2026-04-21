import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

export function SettingsUnavailableScreen({ label }: { label: string }) {
  const { t } = useTranslation();
  const { color } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: BrandSpacing.sm,
        paddingHorizontal: BrandSpacing.xl,
        paddingVertical: BrandSpacing.xl,
        backgroundColor: color.appBg,
      }}
    >
      <ThemedText type="title" style={{ color: color.text, textAlign: "center" }}>
        {label}
      </ThemedText>
      <ThemedText type="caption" style={{ color: color.textMuted, textAlign: "center" }}>
        {t("profile.settings.unavailableBody", {
          defaultValue: "This settings page is unavailable for the current account.",
        })}
      </ThemedText>
    </View>
  );
}
