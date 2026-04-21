import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getSportSupportedCapabilityTags, SPORT_TYPES, toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import type { StudioDraft } from "@/lib/jobs-utils";
import { createDefaultStudioDraft } from "@/lib/jobs-utils";
import {
  BoostBonusSection,
  NotesSection,
  PaymentTimingSection,
  PayParticipantsSection,
  PickerDock,
  PostingOptionsSection,
  ScheduleSection,
  SportPickerSection,
  SubmitBar,
} from "./create-job-sheet-sections";

type CreateJobSheetProps = {
  innerRef: React.RefObject<BottomSheet>;
  onDismissed: () => void;
  onPost: (draft: StudioDraft) => Promise<void>;
  isSubmitting: boolean;
  defaultBranchId?: StudioDraft["branchId"];
};

export function CreateJobSheet({
  innerRef,
  onDismissed,
  onPost,
  isSubmitting,
  defaultBranchId = null,
}: CreateJobSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const { color: palette } = useTheme();

  const [draft, setDraft] = useState<StudioDraft>(createDefaultStudioDraft(defaultBranchId));
  const [sportQuery, setSportQuery] = useState("");
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const snapPoints = ["100%"];
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
    setDraft((d) => ({
      ...d,
      sport,
      requiredCapabilityTags: [],
      preferredCapabilityTags: [],
    }));
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
      setDraft((curr) => ({
        ...curr,
        sport: exactMatch,
        requiredCapabilityTags: curr.sport === exactMatch ? curr.requiredCapabilityTags : [],
        preferredCapabilityTags: curr.sport === exactMatch ? curr.preferredCapabilityTags : [],
      }));
    }
  }, []);
  const supportedCapabilityTags = useMemo(
    () => getSportSupportedCapabilityTags(draft.sport),
    [draft.sport],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: palette.overlay }]}
      />
    ),
    [palette.overlay],
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
    setDraft(createDefaultStudioDraft(defaultBranchId));
    setSportQuery("");
    setSportPickerOpen(false);
    setShowDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
    onDismissed();
  }, [defaultBranchId, onDismissed]);

  useEffect(() => {
    if (!defaultBranchId) return;
    setDraft((current) => (current.branchId ? current : { ...current, branchId: defaultBranchId }));
  }, [defaultBranchId]);

  return (
    <BottomSheet
      ref={innerRef}
      index={-1}
      snapPoints={snapPoints}
      topInset={collapsedSheetHeight}
      enablePanDownToClose
      onClose={handleDismissed}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: palette.borderStrong }}
      backgroundStyle={{ backgroundColor: palette.surface }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title">{t("jobsTab.studioCreateTitle")}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: pressed ? palette.surfaceElevated : palette.surfaceMuted,
              },
            ]}
          >
            <AppSymbol name="xmark" size={18} tintColor={palette.textMuted} />
          </Pressable>
        </View>

        <View style={styles.form}>
          <SportPickerSection
            draft={draft}
            sportQuery={sportQuery}
            sportPickerOpen={sportPickerOpen}
            locale={locale}
            filteredSports={filteredSports}
            setSportQuery={setSportQuery}
            setSportPickerOpen={setSportPickerOpen}
            setDraft={setDraft}
            resolveSportSelection={resolveSportSelection}
            selectSport={selectSport}
          />

          <PostingOptionsSection
            draft={draft}
            setDraft={setDraft}
            supportedCapabilityTags={supportedCapabilityTags}
          />

          <ScheduleSection
            draft={draft}
            locale={locale}
            onOpenDate={() => setShowDatePicker(true)}
            onOpenStartTime={() => setShowStartTimePicker(true)}
            onOpenEndTime={() => setShowEndTimePicker(true)}
          />

          <BoostBonusSection draft={draft} setDraft={setDraft} />
          <PayParticipantsSection draft={draft} setDraft={setDraft} />
          <PaymentTimingSection draft={draft} setDraft={setDraft} />
          <NotesSection draft={draft} setDraft={setDraft} />

          <SubmitBar
            draft={draft}
            isSubmitting={isSubmitting}
            isBoostEnabled={
              draft.boostPreset !== undefined || draft.boostCustomAmount !== undefined
            }
            onPost={() => {
              void onPost(draft);
            }}
          />
        </View>
      </BottomSheetScrollView>

      <PickerDock
        visible={showDatePicker}
        value={new Date(draft.startTime)}
        mode="date"
        display={Platform.OS === "ios" ? "inline" : "default"}
        onChange={handleDateChange}
        minimumDate={new Date()}
        onDone={() => setShowDatePicker(false)}
      />
      <PickerDock
        visible={showStartTimePicker}
        value={new Date(draft.startTime)}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={handleStartTimeChange}
        onDone={() => setShowStartTimePicker(false)}
      />
      <PickerDock
        visible={showEndTimePicker}
        value={new Date(draft.endTime)}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={handleEndTimeChange}
        minimumDate={new Date(draft.startTime)}
        onDone={() => setShowEndTimePicker(false)}
      />
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
    marginBottom: BrandSpacing.xl,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BrandRadius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    gap: BrandSpacing.lg,
  },
});
