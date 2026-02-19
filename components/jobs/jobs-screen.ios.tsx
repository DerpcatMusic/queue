import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/themed-text";
import { BrandSurface } from "@/components/ui/brand-surface";
import { Brand } from "@/constants/brand";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { JobsScreenProps } from "./jobs-screen.types";

function StudioField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
}) {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  return (
    <View style={styles.field}>
      <ThemedText style={{ color: palette.textMuted }}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.input,
          multiline ? styles.notesInput : null,
          { borderColor: palette.border, color: palette.text },
        ]}
      />
    </View>
  );
}

export function IosJobsScreen({
  role,
  jobs,
  isLoadingJobs,
  isSubmitting,
  claimingJobId,
  draft,
  statusMessage,
  onDraftChange,
  onSubmitStudioJob,
  onClaimJob,
  onDismissMessage,
}: JobsScreenProps) {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.appBg }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <ThemedText type="title">{t("jobsTab.title")}</ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {role === "studio"
            ? t("jobsTab.studioSubtitle")
            : t("jobsTab.instructorSubtitle")}
        </ThemedText>
      </View>

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

      {role === "studio" ? (
        <BrandSurface>
          <ThemedText type="subtitle">{t("jobsTab.studioTitle")}</ThemedText>
          <StudioField
            label={t("jobsTab.form.title")}
            value={draft.title}
            onChangeText={(value) => onDraftChange("title", value)}
            placeholder={t("jobsTab.form.titlePlaceholder")}
          />
          <StudioField
            label={t("jobsTab.form.notes")}
            value={draft.notes}
            onChangeText={(value) => onDraftChange("notes", value)}
            placeholder={t("jobsTab.form.notesPlaceholder")}
            multiline
          />
          <View style={styles.grid}>
            <StudioField
              label={t("jobsTab.form.startsIn")}
              value={draft.startsInMinutes}
              onChangeText={(value) => onDraftChange("startsInMinutes", value)}
              placeholder={t("jobsTab.form.startsIn")}
              keyboardType="number-pad"
            />
            <StudioField
              label={t("jobsTab.form.duration")}
              value={draft.durationMinutes}
              onChangeText={(value) => onDraftChange("durationMinutes", value)}
              placeholder={t("jobsTab.form.duration")}
              keyboardType="number-pad"
            />
            <StudioField
              label={t("jobsTab.form.pay")}
              value={draft.payNis}
              onChangeText={(value) => onDraftChange("payNis", value)}
              placeholder={t("jobsTab.form.pay")}
              keyboardType="decimal-pad"
            />
            <StudioField
              label={t("jobsTab.form.ttl")}
              value={draft.ttlMinutes}
              onChangeText={(value) => onDraftChange("ttlMinutes", value)}
              placeholder={t("jobsTab.form.ttl")}
              keyboardType="number-pad"
            />
          </View>
          <Pressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: palette.primary,
                borderColor: palette.primaryPressed,
              },
            ]}
            onPress={onSubmitStudioJob}
            disabled={isSubmitting}
          >
            <ThemedText
              type="defaultSemiBold"
              style={{ color: palette.onPrimary }}
            >
              {isSubmitting
                ? t("jobsTab.actions.posting")
                : t("jobsTab.actions.post")}
            </ThemedText>
          </Pressable>
        </BrandSurface>
      ) : null}

      <View style={styles.feed}>
        <ThemedText type="subtitle">
          {role === "studio"
            ? t("jobsTab.studioFeedTitle")
            : t("jobsTab.instructorTitle")}
        </ThemedText>
        {isLoadingJobs ? (
          <ThemedText style={{ color: palette.textMuted }}>
            {t("jobsTab.loading")}
          </ThemedText>
        ) : jobs.length === 0 ? (
          <ThemedText style={{ color: palette.textMuted }}>
            {role === "studio"
              ? t("jobsTab.emptyStudio")
              : t("jobsTab.emptyInstructor")}
          </ThemedText>
        ) : (
          jobs.map((job) => (
            <BrandSurface key={job.id} tone="alt">
              <View style={styles.row}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {job.title}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {job.zoneId}
                </ThemedText>
              </View>
              {job.notes ? <ThemedText>{job.notes}</ThemedText> : null}
              <ThemedText style={{ color: palette.textMuted }}>
                {t("jobsTab.card.startsAt", {
                  value: new Date(job.startsAt).toLocaleString(
                    i18n.resolvedLanguage ?? "en",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short",
                    },
                  ),
                })}
              </ThemedText>
              <ThemedText style={{ color: palette.textMuted }}>
                {t("jobsTab.card.duration", { value: job.durationMinutes })}
              </ThemedText>
              <ThemedText type="defaultSemiBold">
                {t("jobsTab.card.pay", { value: job.payNis })}
              </ThemedText>
              {role === "instructor" && job.status === "open" ? (
                <Pressable
                  style={[
                    styles.claimButton,
                    {
                      borderColor: palette.primary,
                      backgroundColor: palette.surface,
                    },
                  ]}
                  onPress={() => onClaimJob(job.id)}
                  disabled={claimingJobId === job.id}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={{ color: palette.primary }}
                  >
                    {claimingJobId === job.id
                      ? t("jobsTab.actions.claiming")
                      : t("jobsTab.actions.claim")}
                  </ThemedText>
                </Pressable>
              ) : null}
            </BrandSurface>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  message: {
    borderWidth: 1,
    borderRadius: 13,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  field: {
    gap: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 94,
    textAlignVertical: "top",
    paddingTop: 11,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    minHeight: 45,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  feed: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  claimButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
});
