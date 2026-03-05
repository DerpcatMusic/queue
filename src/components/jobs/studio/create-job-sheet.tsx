import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { KitButton } from "@/components/ui/kit/kit-button";
import { KitChip } from "@/components/ui/kit/kit-chip";
import { KitPressable } from "@/components/ui/kit/kit-pressable";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import type { StudioDraft } from "@/lib/jobs-utils";
import {
  createDefaultStudioDraft,
  formatDateWithWeekday,
  formatTime,
  sanitizeDecimalInput,
} from "@/lib/jobs-utils";

type CreateJobSheetProps = {
  innerRef: React.RefObject<BottomSheet>;
  onClose: () => void;
  onPost: (draft: StudioDraft) => Promise<void>;
  isSubmitting: boolean;
  palette: BrandPalette;
};

export function CreateJobSheet({
  innerRef,
  onClose,
  onPost,
  isSubmitting,
  palette,
}: CreateJobSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";

  const [draft, setDraft] = useState<StudioDraft>(createDefaultStudioDraft());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const snapPoints = useMemo(() => ["92%"], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    [],
  );

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      const currentStart = new Date(draft.startTime);
      newDate.setHours(currentStart.getHours(), currentStart.getMinutes());

      const diff = draft.endTime - draft.startTime;
      const newStartTime = newDate.getTime();

      setDraft((curr) => ({
        ...curr,
        startTime: newStartTime,
        endTime: newStartTime + diff,
      }));
    }
  };

  const handleStartTimeChange = (_event: any, selectedTime?: Date) => {
    setShowStartTimePicker(false);
    if (selectedTime) {
      const newStart = new Date(draft.startTime);
      newStart.setHours(selectedTime.getHours(), selectedTime.getMinutes());

      const diff = draft.endTime - draft.startTime;
      const newStartTime = newStart.getTime();

      setDraft((curr) => ({
        ...curr,
        startTime: newStartTime,
        endTime: newStartTime + diff,
      }));
    }
  };

  const handleEndTimeChange = (_event: any, selectedTime?: Date) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      const newEnd = new Date(draft.endTime);
      newEnd.setHours(selectedTime.getHours(), selectedTime.getMinutes());

      setDraft((curr) => ({
        ...curr,
        endTime: newEnd.getTime(),
      }));
    }
  };

  const handleCloseSheet = useCallback(() => {
    setDraft(createDefaultStudioDraft());
    onClose();
  }, [onClose]);

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleCloseSheet}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: palette.borderStrong as string }}
      backgroundStyle={{ backgroundColor: palette.appBg as string }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title" style={{ fontSize: 28 }}>
            {t("jobsTab.form.title", "Post New Job")}
          </ThemedText>
          <KitPressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close", { defaultValue: "Close" })}
            onPress={handleCloseSheet}
            style={[styles.closeButton, { backgroundColor: palette.surfaceAlt as string }]}
          >
            <AppSymbol name="xmark" size={18} tintColor={palette.textMuted as string} />
          </KitPressable>
        </View>

        <View style={styles.form}>
          {/* Sport Selection */}
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              {t("jobsTab.form.sport", "Select Sport")}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {SPORT_TYPES.map((sport) => {
                const isSelected = draft.sport === sport;
                return (
                  <KitChip
                    key={sport}
                    label={toSportLabel(sport as never)}
                    selected={isSelected}
                    onPress={() => {
                      setDraft((d) => ({ ...d, sport }));
                    }}
                    style={styles.sportPill}
                  />
                );
              })}
            </ScrollView>
          </View>

          {/* Date & Time Section */}
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              {t("jobsTab.form.schedule", "Schedule")}
            </ThemedText>

            <View style={styles.row}>
              <KitPressable
                accessibilityRole="button"
                accessibilityLabel={t("jobsTab.form.schedule", "Schedule")}
                onPress={() => setShowDatePicker(true)}
                style={[
                  styles.pickerTrigger,
                  {
                    backgroundColor: palette.surfaceAlt as string,
                    borderColor: palette.border as string,
                  },
                ]}
              >
                <AppSymbol name="calendar" size={16} tintColor={palette.primary as string} />
                <ThemedText style={styles.pickerText}>
                  {formatDateWithWeekday(draft.startTime, locale)}
                </ThemedText>
              </KitPressable>
            </View>

            <View style={[styles.row, { marginTop: 12 }]}>
              <KitPressable
                accessibilityRole="button"
                accessibilityLabel={t("jobsTab.form.startTime")}
                onPress={() => setShowStartTimePicker(true)}
                style={[
                  styles.pickerTrigger,
                  {
                    flex: 1,
                    backgroundColor: palette.surfaceAlt as string,
                    borderColor: palette.border as string,
                  },
                ]}
              >
                <AppSymbol name="clock" size={16} tintColor={palette.primary as string} />
                <View>
                  <ThemedText type="micro" style={{ color: palette.textMuted as string }}>
                    {t("jobsTab.form.startTime")}
                  </ThemedText>
                  <ThemedText style={styles.pickerText}>
                    {formatTime(draft.startTime, locale)}
                  </ThemedText>
                </View>
              </KitPressable>

              <View style={{ width: 12, alignItems: "center", justifyContent: "center" }}>
                <AppSymbol name="arrow.right" size={12} tintColor={palette.textMuted as string} />
              </View>

              <KitPressable
                accessibilityRole="button"
                accessibilityLabel={t("jobsTab.form.endTime")}
                onPress={() => setShowEndTimePicker(true)}
                style={[
                  styles.pickerTrigger,
                  {
                    flex: 1,
                    backgroundColor: palette.surfaceAlt as string,
                    borderColor: palette.border as string,
                  },
                ]}
              >
                <AppSymbol name="clock" size={16} tintColor={palette.primary as string} />
                <View>
                  <ThemedText type="micro" style={{ color: palette.textMuted as string }}>
                    {t("jobsTab.form.endTime")}
                  </ThemedText>
                  <ThemedText style={styles.pickerText}>
                    {formatTime(draft.endTime, locale)}
                  </ThemedText>
                </View>
              </KitPressable>
            </View>
          </View>

          {/* Pay & Participants */}
          <View style={[styles.row, { gap: 16 }]}>
            <View style={{ flex: 1 }}>
              <KitTextField
                label={t("jobsTab.form.pay", "Pay (₪)")}
                value={draft.payInput}
                onChangeText={(v) => setDraft((d) => ({ ...d, payInput: sanitizeDecimalInput(v) }))}
                keyboardType="decimal-pad"
                placeholder="250"
              />
            </View>
            <View style={{ flex: 1 }}>
              <KitTextField
                label={t("jobsTab.form.maxParticipants", "Max Participants")}
                value={String(draft.maxParticipants)}
                onChangeText={(v) =>
                  setDraft((d) => ({ ...d, maxParticipants: Number.parseInt(v, 10) || 12 }))
                }
                keyboardType="number-pad"
                placeholder="12"
              />
            </View>
          </View>

          {/* Notes */}
          <KitTextField
            label={t("jobsTab.form.notes", "Additional Notes (Optional)")}
            value={draft.note}
            onChangeText={(v) => setDraft((d) => ({ ...d, note: v }))}
            multiline
            numberOfLines={4}
            placeholder={t("jobsTab.form.notesPlaceholder")}
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />

          <View style={{ marginTop: 24, paddingBottom: 40 }}>
            <KitButton
              label={isSubmitting ? t("jobsTab.actions.posting") : t("jobsTab.actions.post")}
              onPress={() => onPost(draft)}
              disabled={isSubmitting || !draft.sport}
              loading={isSubmitting}
            />
          </View>
        </View>
      </BottomSheetScrollView>

      {/* Native Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date(draft.startTime)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
      {showStartTimePicker && (
        <DateTimePicker
          value={new Date(draft.startTime)}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleStartTimeChange}
        />
      )}
      {showEndTimePicker && (
        <DateTimePicker
          value={new Date(draft.endTime)}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleEndTimeChange}
          minimumDate={new Date(draft.startTime)}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: BrandSpacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    opacity: 0.9,
  },
  horizontalScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  sportPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderCurve: "continuous",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: BrandRadius.input,
    borderWidth: 1.2,
    borderCurve: "continuous",
  },
  pickerText: {
    fontSize: 15,
    fontWeight: "500",
  },
  pickerLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
});
