import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AppSymbol } from "@/components/ui/app-symbol";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import type { BrandPalette } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";
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
  onDismissed: () => void;
  onPost: (draft: StudioDraft) => Promise<void>;
  isSubmitting: boolean;
  palette: BrandPalette;
};

export function CreateJobSheet({
  innerRef,
  onDismissed,
  onPost,
  isSubmitting,
  palette,
}: CreateJobSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const collapsedSheetHeight = useCollapsedSheetHeight();

  const [draft, setDraft] = useState<StudioDraft>(createDefaultStudioDraft());
  const [sportQuery, setSportQuery] = useState("");
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const snapPoints = ["100%"];
  const selectedSportLabel = draft.sport
    ? toSportLabel(draft.sport as never)
    : t("jobsTab.form.pickSport");
  const filteredSports = useMemo(() => {
    const query = sportQuery.trim().toLowerCase();
    if (!query) {
      return SPORT_TYPES;
    }
    return SPORT_TYPES.filter((sport) =>
      toSportLabel(sport as never)
        .toLowerCase()
        .includes(query),
    );
  }, [sportQuery]);
  const selectSport = useCallback((sport: string) => {
    setDraft((d) => ({ ...d, sport }));
    setSportQuery("");
    setSportPickerOpen(false);
  }, []);
  const resolveSportSelection = useCallback((value: string) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    const exactMatch = SPORT_TYPES.find((sport) =>
      toSportLabel(sport as never)
        .toLowerCase()
        .replace(/[\s_-]+/g, "")
        .includes(normalized),
    );
    if (exactMatch) {
      setDraft((curr) => ({ ...curr, sport: exactMatch }));
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.5} />
    ),
    [],
  );

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
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
    if (Platform.OS !== "ios") {
      setShowStartTimePicker(false);
    }
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
    if (Platform.OS !== "ios") {
      setShowEndTimePicker(false);
    }
    if (selectedTime) {
      const newEnd = new Date(draft.endTime);
      newEnd.setHours(selectedTime.getHours(), selectedTime.getMinutes());

      setDraft((curr) => ({
        ...curr,
        endTime: newEnd.getTime(),
      }));
    }
  };

  const handleDismissed = useCallback(() => {
    setDraft(createDefaultStudioDraft());
    setSportQuery("");
    setSportPickerOpen(false);
    setShowDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
    onDismissed();
  }, [onDismissed]);

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      topInset={collapsedSheetHeight}
      enablePanDownToClose
      onClose={handleDismissed}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: palette.borderStrong as string }}
      backgroundStyle={{ backgroundColor: palette.appBg as string }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title" style={{ fontSize: 28 }}>
            {t("jobsTab.studioCreateTitle")}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: palette.surfaceAlt as string,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <AppSymbol name="xmark" size={18} tintColor={palette.textMuted as string} />
          </Pressable>
        </View>

        <View style={styles.form}>
          {/* Sport Selection */}
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              {t("jobsTab.form.sport")}
            </ThemedText>
            <ChoicePill
              label={draft.sport ? selectedSportLabel : t("jobsTab.form.pickSport")}
              compact
              fullWidth
              icon={
                <AppSymbol
                  name={sportPickerOpen ? "chevron.up" : "chevron.down"}
                  size={14}
                  tintColor={palette.textMuted as string}
                />
              }
              backgroundColor={palette.surfaceAlt as string}
              selectedBackgroundColor={palette.surfaceAlt as string}
              labelColor={palette.text as string}
              selectedLabelColor={palette.text as string}
              onPress={() => {
                setSportPickerOpen((curr) => {
                  const next = !curr;
                  if (!next) {
                    setSportQuery("");
                  }
                  return next;
                });
              }}
            />

            {sportPickerOpen ? (
              <View style={styles.optionStack}>
                <KitTextField
                  value={sportQuery}
                  onChangeText={(value) => {
                    setSportQuery(value);
                    resolveSportSelection(value);
                    if (!value.trim()) {
                      setDraft((curr) => ({ ...curr, sport: "" }));
                    }
                  }}
                  onSubmitEditing={() => {
                    const exact = SPORT_TYPES.find(
                      (sport) =>
                        toSportLabel(sport as never).toLowerCase() ===
                        sportQuery.trim().toLowerCase(),
                    );
                    if (exact) {
                      selectSport(exact);
                      return;
                    }
                    if (filteredSports.length === 1) {
                      selectSport(filteredSports[0]!);
                    }
                  }}
                  placeholder={t("jobsTab.form.sportSearch")}
                  leading={
                    <AppSymbol
                      name="magnifyingglass"
                      size={16}
                      tintColor={palette.textMuted as string}
                    />
                  }
                />

                <View style={styles.optionList}>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.optionListContent}
                  >
                    {filteredSports.length > 0 ? (
                      filteredSports.map((sport) => {
                        const isSelected = draft.sport === sport;
                        return (
                          <ChoicePill
                            key={sport}
                            label={toSportLabel(sport as never)}
                            selected={isSelected}
                            compact
                            backgroundColor={palette.surfaceAlt as string}
                            selectedBackgroundColor={palette.primary as string}
                            labelColor={palette.text as string}
                            selectedLabelColor={palette.onPrimary as string}
                            onPress={() => {
                              selectSport(sport);
                            }}
                          />
                        );
                      })
                    ) : (
                      <ThemedText
                        type="micro"
                        style={{ color: palette.textMuted as string, paddingHorizontal: 4 }}
                      >
                        {t("jobsTab.form.noSportResults")}
                      </ThemedText>
                    )}
                  </ScrollView>
                </View>
              </View>
            ) : null}
          </View>

          {/* Date & Time Section */}
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              {t("jobsTab.form.schedule")}
            </ThemedText>

            <ChoicePill
              label={formatDateWithWeekday(draft.startTime, locale)}
              compact
              fullWidth
              icon={<AppSymbol name="calendar" size={15} tintColor={palette.primary as string} />}
              backgroundColor={palette.surfaceAlt as string}
              selectedBackgroundColor={palette.surfaceAlt as string}
              labelColor={palette.text as string}
              selectedLabelColor={palette.text as string}
              onPress={() => setShowDatePicker(true)}
            />

            <View style={[styles.row, { gap: 10 }]}>
              <ChoicePill
                label={formatTime(draft.startTime, locale)}
                compact
                icon={<AppSymbol name="clock" size={15} tintColor={palette.primary as string} />}
                backgroundColor={palette.surfaceAlt as string}
                selectedBackgroundColor={palette.surfaceAlt as string}
                labelColor={palette.text as string}
                selectedLabelColor={palette.text as string}
                onPress={() => setShowStartTimePicker(true)}
                style={{ flex: 1 }}
              />

              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 14,
                  marginHorizontal: -2,
                }}
              >
                <AppSymbol
                  name={I18nManager.isRTL ? "arrow.left" : "arrow.right"}
                  size={12}
                  tintColor={palette.textMuted as string}
                />
              </View>

              <ChoicePill
                label={formatTime(draft.endTime, locale)}
                compact
                icon={<AppSymbol name="clock" size={15} tintColor={palette.primary as string} />}
                backgroundColor={palette.surfaceAlt as string}
                selectedBackgroundColor={palette.surfaceAlt as string}
                labelColor={palette.text as string}
                selectedLabelColor={palette.text as string}
                onPress={() => setShowEndTimePicker(true)}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          {/* Pay & Participants */}
          <View style={[styles.row, { gap: 16 }]}>
            <View style={{ flex: 1 }}>
              <KitTextField
                label={t("jobsTab.form.pay")}
                value={draft.payInput}
                onChangeText={(v) => setDraft((d) => ({ ...d, payInput: sanitizeDecimalInput(v) }))}
                keyboardType="decimal-pad"
                placeholder="250"
              />
            </View>
            <View style={{ flex: 1 }}>
              <KitTextField
                label={t("jobsTab.form.maxParticipants")}
                value={String(draft.maxParticipants)}
                onChangeText={(v) =>
                  setDraft((d) => ({
                    ...d,
                    maxParticipants: Number.parseInt(v, 10) || 12,
                  }))
                }
                keyboardType="number-pad"
                placeholder="12"
              />
            </View>
          </View>

          {/* Notes */}
          <KitTextField
            label={t("jobsTab.form.notes")}
            value={draft.note}
            onChangeText={(v) => setDraft((d) => ({ ...d, note: v }))}
            multiline
            numberOfLines={4}
            placeholder={t("jobsTab.form.notesPlaceholder")}
            style={{ minHeight: 100, textAlignVertical: "top" }}
          />

          <View style={{ marginTop: 24, paddingBottom: 40 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isSubmitting ? t("jobsTab.actions.posting") : t("jobsTab.actions.post")
              }
              accessibilityState={{ disabled: isSubmitting || !draft.sport, busy: isSubmitting }}
              disabled={isSubmitting || !draft.sport}
              onPress={() => {
                void onPost(draft);
              }}
              style={({ pressed }) => ({
                minHeight: 56,
                width: "100%",
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor:
                  isSubmitting || !draft.sport
                    ? (palette.primaryPressed as string)
                    : (palette.primary as string),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <AppSymbol name="plus" size={18} tintColor={palette.onPrimary as string} />
              <Text
                style={{
                  color: palette.onPrimary as string,
                  fontSize: 16,
                  fontWeight: "700",
                  includeFontPadding: false,
                }}
              >
                {isSubmitting ? t("jobsTab.actions.posting") : t("jobsTab.actions.post")}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheetScrollView>

      {/* Native Pickers */}
      {showDatePicker && (
        <View style={styles.pickerDock}>
          <DateTimePicker
            value={new Date(draft.startTime)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
          {Platform.OS === "ios" ? (
            <ActionButton
              label={t("common.done")}
              onPress={() => setShowDatePicker(false)}
              palette={palette}
              tone="secondary"
            />
          ) : null}
        </View>
      )}
      {showStartTimePicker && (
        <View style={styles.pickerDock}>
          <DateTimePicker
            value={new Date(draft.startTime)}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleStartTimeChange}
          />
          {Platform.OS === "ios" ? (
            <ActionButton
              label={t("common.done")}
              onPress={() => setShowStartTimePicker(false)}
              palette={palette}
              tone="secondary"
            />
          ) : null}
        </View>
      )}
      {showEndTimePicker && (
        <View style={styles.pickerDock}>
          <DateTimePicker
            value={new Date(draft.endTime)}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleEndTimeChange}
            minimumDate={new Date(draft.startTime)}
          />
          {Platform.OS === "ios" ? (
            <ActionButton
              label={t("common.done")}
              onPress={() => setShowEndTimePicker(false)}
              palette={palette}
              tone="secondary"
            />
          ) : null}
        </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionStack: {
    gap: 10,
    paddingTop: 10,
  },
  optionList: {
    maxHeight: 208,
  },
  optionListContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 4,
    paddingBottom: 4,
  },
  pickerDock: {
    gap: 12,
    paddingHorizontal: BrandSpacing.lg,
    paddingBottom: BrandSpacing.lg,
  },
});
