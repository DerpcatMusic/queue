import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { I18nManager, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AppSymbol } from "@/components/ui/app-symbol";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import type { BrandPalette } from "@/constants/brand";
import { SPORT_TYPES, toSportLabel } from "@/convex/constants";
import type { StudioDraft } from "@/lib/jobs-utils";
import { formatDateWithWeekday, formatTime, sanitizeDecimalInput } from "@/lib/jobs-utils";

type SportPickerSectionProps = {
  draft: StudioDraft;
  sportQuery: string;
  sportPickerOpen: boolean;
  locale: string;
  palette: BrandPalette;
  filteredSports: readonly string[];
  setSportQuery: (value: string) => void;
  setSportPickerOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>;
  resolveSportSelection: (value: string) => void;
  selectSport: (sport: string) => void;
};

export function SportPickerSection({
  draft,
  sportQuery,
  sportPickerOpen,
  palette,
  filteredSports,
  setSportQuery,
  setSportPickerOpen,
  setDraft,
  resolveSportSelection,
  selectSport,
}: SportPickerSectionProps) {
  const { t } = useTranslation();
  const selectedSportLabel = draft.sport
    ? toSportLabel(draft.sport as never)
    : t("jobsTab.form.pickSport");

  return (
    <View style={{ gap: 12 }}>
      <ThemedText type="defaultSemiBold" style={{ fontSize: 16, opacity: 0.9 }}>
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
            if (!next) setSportQuery("");
            return next;
          });
        }}
      />

      {sportPickerOpen ? (
        <View style={{ gap: 10, paddingTop: 10 }}>
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
                  toSportLabel(sport as never).toLowerCase() === sportQuery.trim().toLowerCase(),
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
              <AppSymbol name="magnifyingglass" size={16} tintColor={palette.textMuted as string} />
            }
          />

          <View style={{ maxHeight: 208 }}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                paddingTop: 4,
                paddingBottom: 4,
              }}
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
                      onPress={() => selectSport(sport)}
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
  );
}

type ScheduleSectionProps = {
  draft: StudioDraft;
  locale: string;
  palette: BrandPalette;
  onOpenDate: () => void;
  onOpenStartTime: () => void;
  onOpenEndTime: () => void;
};

export function ScheduleSection({
  draft,
  locale,
  palette,
  onOpenDate,
  onOpenStartTime,
  onOpenEndTime,
}: ScheduleSectionProps) {
  const { t } = useTranslation();

  return (
    <View style={{ gap: 12 }}>
      <ThemedText type="defaultSemiBold" style={{ fontSize: 16, opacity: 0.9 }}>
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
        onPress={onOpenDate}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ChoicePill
          label={formatTime(draft.startTime, locale)}
          compact
          icon={<AppSymbol name="clock" size={15} tintColor={palette.primary as string} />}
          backgroundColor={palette.surfaceAlt as string}
          selectedBackgroundColor={palette.surfaceAlt as string}
          labelColor={palette.text as string}
          selectedLabelColor={palette.text as string}
          onPress={onOpenStartTime}
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
          onPress={onOpenEndTime}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

type PayParticipantsSectionProps = {
  draft: StudioDraft;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>;
};

export function PayParticipantsSection({ draft, setDraft }: PayParticipantsSectionProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
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
  );
}

type NotesSectionProps = {
  draft: StudioDraft;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>;
};

export function NotesSection({ draft, setDraft }: NotesSectionProps) {
  const { t } = useTranslation();
  return (
    <KitTextField
      label={t("jobsTab.form.notes")}
      value={draft.note}
      onChangeText={(v) => setDraft((d) => ({ ...d, note: v }))}
      multiline
      numberOfLines={4}
      placeholder={t("jobsTab.form.notesPlaceholder")}
      style={{ minHeight: 100, textAlignVertical: "top" }}
    />
  );
}

type SubmitBarProps = {
  draft: StudioDraft;
  isSubmitting: boolean;
  palette: BrandPalette;
  onPost: () => void;
};

export function SubmitBar({ draft, isSubmitting, palette, onPost }: SubmitBarProps) {
  const { t } = useTranslation();
  return (
    <View style={{ marginTop: 24, paddingBottom: 40 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSubmitting ? t("jobsTab.actions.posting") : t("jobsTab.actions.post")}
        accessibilityState={{ disabled: isSubmitting || !draft.sport, busy: isSubmitting }}
        disabled={isSubmitting || !draft.sport}
        onPress={onPost}
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
  );
}

type PickerDockProps = {
  visible: boolean;
  value: Date;
  mode: "date" | "time";
  display: "default" | "inline" | "spinner";
  minimumDate?: Date;
  palette: BrandPalette;
  onChange: (_event: unknown, selectedDate?: Date) => void;
  onDone: () => void;
};

export function PickerDock({
  visible,
  value,
  mode,
  display,
  minimumDate,
  palette,
  onChange,
  onDone,
}: PickerDockProps) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View style={{ gap: 12, paddingHorizontal: 24, paddingBottom: 24 }}>
      <DateTimePicker
        value={value}
        mode={mode}
        display={display}
        onChange={onChange}
        {...(minimumDate ? { minimumDate } : {})}
      />
      {Platform.OS === "ios" ? (
        <ActionButton
          label={t("common.done")}
          onPress={onDone}
          palette={palette}
          tone="secondary"
        />
      ) : null}
    </View>
  );
}
