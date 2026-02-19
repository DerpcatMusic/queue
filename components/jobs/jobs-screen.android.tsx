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
import { omitUndefined } from "@/lib/omit-undefined";
import type { JobsScreenProps } from "./jobs-screen.types";

function JobCard({
  title,
  notes,
  zoneId,
  startsAt,
  durationMinutes,
  payNis,
  canClaim,
  isClaiming,
  onClaim,
}: {
  title: string;
  notes?: string;
  zoneId: string;
  startsAt: number;
  durationMinutes: number;
  payNis: number;
  canClaim: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const formattedStart = new Date(startsAt).toLocaleString(
    i18n.resolvedLanguage ?? "en",
    {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    },
  );

  return (
    <BrandSurface tone="alt">
      <View style={styles.jobHead}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>{zoneId}</ThemedText>
      </View>
      {notes ? <ThemedText>{notes}</ThemedText> : null}
      <View style={styles.metaRow}>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("jobsTab.card.startsAt", { value: formattedStart })}
        </ThemedText>
        <ThemedText style={{ color: palette.textMuted }}>
          {t("jobsTab.card.duration", { value: durationMinutes })}
        </ThemedText>
        <ThemedText type="defaultSemiBold">
          {t("jobsTab.card.pay", { value: payNis })}
        </ThemedText>
      </View>
      {canClaim ? (
        <Pressable
          style={[
            styles.claimButton,
            { borderColor: palette.primary, backgroundColor: palette.surface },
          ]}
          onPress={onClaim}
          disabled={isClaiming}
        >
          <ThemedText type="defaultSemiBold" style={{ color: palette.primary }}>
            {isClaiming
              ? t("jobsTab.actions.claiming")
              : t("jobsTab.actions.claim")}
          </ThemedText>
        </Pressable>
      ) : null}
    </BrandSurface>
  );
}

export function AndroidJobsScreen({
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
          <ThemedText type="defaultSemiBold">
            {t("jobsTab.studioTitle")}
          </ThemedText>
          <TextInput
            value={draft.title}
            onChangeText={(value) => onDraftChange("title", value)}
            placeholder={t("jobsTab.form.titlePlaceholder")}
            placeholderTextColor={palette.textMuted}
            style={[
              styles.input,
              { borderColor: palette.border, color: palette.text },
            ]}
          />
          <TextInput
            value={draft.notes}
            onChangeText={(value) => onDraftChange("notes", value)}
            placeholder={t("jobsTab.form.notesPlaceholder")}
            placeholderTextColor={palette.textMuted}
            multiline
            style={[
              styles.input,
              styles.notesInput,
              { borderColor: palette.border, color: palette.text },
            ]}
          />
          <View style={styles.numericGrid}>
            <TextInput
              value={draft.startsInMinutes}
              onChangeText={(value) => onDraftChange("startsInMinutes", value)}
              keyboardType="number-pad"
              placeholder={t("jobsTab.form.startsIn")}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                styles.numericInput,
                { borderColor: palette.border, color: palette.text },
              ]}
            />
            <TextInput
              value={draft.durationMinutes}
              onChangeText={(value) => onDraftChange("durationMinutes", value)}
              keyboardType="number-pad"
              placeholder={t("jobsTab.form.duration")}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                styles.numericInput,
                { borderColor: palette.border, color: palette.text },
              ]}
            />
            <TextInput
              value={draft.payNis}
              onChangeText={(value) => onDraftChange("payNis", value)}
              keyboardType="decimal-pad"
              placeholder={t("jobsTab.form.pay")}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                styles.numericInput,
                { borderColor: palette.border, color: palette.text },
              ]}
            />
            <TextInput
              value={draft.ttlMinutes}
              onChangeText={(value) => onDraftChange("ttlMinutes", value)}
              keyboardType="number-pad"
              placeholder={t("jobsTab.form.ttl")}
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                styles.numericInput,
                { borderColor: palette.border, color: palette.text },
              ]}
            />
          </View>
          <Pressable
            style={[
              styles.submitButton,
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

      <View style={styles.listBlock}>
        <ThemedText type="defaultSemiBold">
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
            <JobCard
              key={job.id}
              title={job.title}
              zoneId={job.zoneId}
              startsAt={job.startsAt}
              durationMinutes={job.durationMinutes}
              payNis={job.payNis}
              canClaim={role === "instructor" && job.status === "open"}
              isClaiming={claimingJobId === job.id}
              onClaim={() => onClaimJob(job.id)}
              {...omitUndefined({ notes: job.notes })}
            />
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
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  header: {
    gap: 2,
  },
  message: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    minHeight: 88,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  numericGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  numericInput: {
    flexGrow: 1,
    minWidth: "47%",
  },
  submitButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  listBlock: {
    gap: 8,
  },
  jobHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  metaRow: {
    gap: 2,
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
