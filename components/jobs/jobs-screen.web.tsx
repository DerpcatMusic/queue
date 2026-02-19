import { Pressable, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { BrandSurface } from "@/components/ui/brand-surface";
import { Brand } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { JobsScreenProps } from "./jobs-screen.types";

export function JobsScreen({
  role,
  jobs,
  isLoadingJobs,
  statusMessage,
  onDismissMessage,
}: JobsScreenProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <BrandSurface>
        <ThemedText type="defaultSemiBold">{t("jobsTab.webTitle")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("jobsTab.webSubtitle")}
        </ThemedText>
      </BrandSurface>

      <BrandSurface tone="alt">
        <ThemedText type="defaultSemiBold">
          {role === "studio"
            ? t("jobsTab.studioTitle")
            : t("jobsTab.instructorTitle")}
        </ThemedText>
        {isLoadingJobs ? (
          <ThemedText style={{ color: palette.textMuted }}>
            {t("jobsTab.loading")}
          </ThemedText>
        ) : (
          <ThemedText style={{ color: palette.textMuted }}>
            {t("jobsTab.webStats", { count: jobs.length })}
          </ThemedText>
        )}
      </BrandSurface>

      {statusMessage ? (
        <Pressable
          onPress={onDismissMessage}
          style={[
            styles.message,
            {
              borderColor:
                statusMessage.kind === "error"
                  ? palette.danger
                  : palette.border,
              backgroundColor:
                statusMessage.kind === "error"
                  ? palette.surfaceAlt
                  : palette.surface,
            },
          ]}
        >
          <ThemedText
            style={{
              color:
                statusMessage.kind === "error" ? palette.danger : palette.text,
            }}
          >
            {statusMessage.text}
          </ThemedText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  message: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
