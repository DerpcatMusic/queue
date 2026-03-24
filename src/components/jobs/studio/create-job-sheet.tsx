import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { ThemedText } from "@/components/themed-text";
import { AppSymbol } from "@/components/ui/app-symbol";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import type { Id } from "@/convex/_generated/dataModel";
import type { StudioDraft } from "@/lib/jobs-utils";
import { createDefaultStudioDraft } from "@/lib/jobs-utils";
import {
  NotesSection,
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
  palette: BrandPalette;
  branches: Array<{
    branchId: Id<"studioBranches">;
    name: string;
    address: string;
    isPrimary: boolean;
    zone: string;
    status: "active" | "archived";
  }>;
  defaultBranchId?: Id<"studioBranches"> | null;
};

export function CreateJobSheet({
  innerRef,
  onDismissed,
  onPost,
  isSubmitting,
  palette,
  branches,
  defaultBranchId = null,
}: CreateJobSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en";
  const collapsedSheetHeight = useCollapsedSheetHeight();

  const [draft, setDraft] = useState<StudioDraft>(createDefaultStudioDraft());
  const [sportQuery, setSportQuery] = useState("");
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.branchId === draft.branchId) ?? null,
    [branches, draft.branchId],
  );

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
      <BottomSheetBackdrop
        {...props}
        disappearsAt={-1}
        appearsAt={0}
        style={[props.style, { backgroundColor: palette.appBg as string }]}
      />
    ),
    [palette.appBg],
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
    setDraft({
      ...createDefaultStudioDraft(),
      branchId: defaultBranchId,
    });
    setSportQuery("");
    setSportPickerOpen(false);
    setBranchPickerOpen(false);
    setShowDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
    onDismissed();
  }, [defaultBranchId, onDismissed]);

  const initialBranchId = defaultBranchId ?? branches[0]?.branchId ?? null;

  useEffect(() => {
    if (draft.branchId === null && initialBranchId) {
      setDraft((current) => ({ ...current, branchId: initialBranchId }));
    }
  }, [draft.branchId, initialBranchId]);

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
      backgroundStyle={{ backgroundColor: palette.surfaceElevated as string }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="heading">{t("jobsTab.studioCreateTitle")}</ThemedText>
          <IconButton
            accessibilityLabel={t("common.close")}
            onPress={() => innerRef.current?.close()}
            size={BrandSpacing.controlSm}
            tone="secondary"
            backgroundColorOverride={String(palette.surfaceAlt)}
            icon={<AppSymbol name="xmark" size={18} tintColor={palette.textMuted as string} />}
          />
        </View>

        <View style={styles.form}>
          <View style={styles.section}>
            <ThemedText type="defaultSemiBold">{t("jobsTab.form.branch")}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: branchPickerOpen }}
              onPress={() => setBranchPickerOpen((current) => !current)}
              style={({ pressed }) => [
                styles.branchTrigger,
                {
                  backgroundColor: palette.surfaceAlt as string,
                  borderColor: branchPickerOpen
                    ? (palette.primary as string)
                    : (palette.border as string),
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={styles.branchTriggerCopy}>
                <ThemedText type="defaultSemiBold" style={{ color: palette.text as string }}>
                  {selectedBranch?.name ?? t("jobsTab.form.selectBranch")}
                </ThemedText>
                <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                  {selectedBranch
                    ? `${selectedBranch.address} · ${getZoneLabel(selectedBranch.zone, locale.startsWith("he") ? "he" : "en")}`
                    : t("jobsTab.form.branchHint")}
                </ThemedText>
              </View>
              <IconSymbol
                name={branchPickerOpen ? "chevron.up" : "chevron.down"}
                size={16}
                color={palette.textMuted as string}
              />
            </Pressable>
            {branchPickerOpen ? (
              <View style={styles.branchList}>
                {branches.map((branch) => {
                  const isSelected = draft.branchId === branch.branchId;
                  return (
                    <Pressable
                      key={String(branch.branchId)}
                      accessibilityRole="button"
                      onPress={() => {
                        setDraft((current) => ({ ...current, branchId: branch.branchId }));
                        setBranchPickerOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.branchOption,
                        {
                          backgroundColor: isSelected
                            ? (palette.primarySubtle as string)
                            : (palette.surfaceAlt as string),
                          borderColor: isSelected
                            ? (palette.primary as string)
                            : (palette.border as string),
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <View style={styles.branchOptionHeader}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={{
                            color: isSelected
                              ? (palette.primary as string)
                              : (palette.text as string),
                          }}
                        >
                          {branch.name}
                        </ThemedText>
                        {branch.isPrimary ? (
                          <View
                            style={[
                              styles.branchBadge,
                              { backgroundColor: palette.primarySubtle as string },
                            ]}
                          >
                            <ThemedText
                              type="micro"
                              style={{ color: palette.primary as string }}
                            >
                              {t("jobsTab.form.branchPrimaryBadge")}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                        {branch.address}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                        {getZoneLabel(branch.zone, locale.startsWith("he") ? "he" : "en")}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {selectedBranch ? (
              <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                {selectedBranch.isPrimary
                  ? `${selectedBranch.name} · ${t("jobsTab.form.branchPrimaryBadge")}`
                  : selectedBranch.name}
              </ThemedText>
            ) : null}
          </View>

          <SportPickerSection
            draft={draft}
            sportQuery={sportQuery}
            sportPickerOpen={sportPickerOpen}
            locale={locale}
            palette={palette}
            filteredSports={filteredSports}
            setSportQuery={setSportQuery}
            setSportPickerOpen={setSportPickerOpen}
            setDraft={setDraft}
            resolveSportSelection={resolveSportSelection}
            selectSport={selectSport}
          />

          <ScheduleSection
            draft={draft}
            locale={locale}
            palette={palette}
            onOpenDate={() => setShowDatePicker(true)}
            onOpenStartTime={() => setShowStartTimePicker(true)}
            onOpenEndTime={() => setShowEndTimePicker(true)}
          />

          <PostingOptionsSection draft={draft} setDraft={setDraft} palette={palette} />
          <PayParticipantsSection draft={draft} setDraft={setDraft} />
          <NotesSection draft={draft} setDraft={setDraft} />

          <SubmitBar
            draft={draft}
            isSubmitting={isSubmitting}
            palette={palette}
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
        palette={palette}
        onDone={() => setShowDatePicker(false)}
      />
      <PickerDock
        visible={showStartTimePicker}
        value={new Date(draft.startTime)}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={handleStartTimeChange}
        palette={palette}
        onDone={() => setShowStartTimePicker(false)}
      />
      <PickerDock
        visible={showEndTimePicker}
        value={new Date(draft.endTime)}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={handleEndTimeChange}
        minimumDate={new Date(draft.startTime)}
        palette={palette}
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
  form: {
    gap: BrandSpacing.stackLoose,
  },
  section: {
    gap: BrandSpacing.sm,
  },
  branchList: {
    gap: BrandSpacing.sm,
  },
  branchTrigger: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
  },
  branchTriggerCopy: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  branchOption: {
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    gap: BrandSpacing.xs,
  },
  branchOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  branchBadge: {
    borderRadius: BrandRadius.pill,
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xs,
  },
});
