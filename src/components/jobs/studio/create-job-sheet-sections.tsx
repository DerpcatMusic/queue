import DateTimePicker from "@expo/ui/datetimepicker";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { I18nManager, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { AppSymbol } from "@/components/ui/app-symbol";
import { ChoicePill } from "@/components/ui/choice-pill";
import { KitSwitch } from "@/components/ui/kit/kit-switch";
import { KitTextField } from "@/components/ui/kit/kit-text-field";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { SPORT_TYPES, toCapabilityTagLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import type { StudioDraft } from "@/lib/jobs-utils";
import {
  BOOST_CUSTOM_DEFAULT,
  BOOST_CUSTOM_MAX,
  BOOST_CUSTOM_MIN,
  BOOST_CUSTOM_STEP,
  BOOST_PRESET_VALUES,
  BOOST_TRIGGER_MINUTES_OPTIONS,
  EXPIRY_OVERRIDE_PRESETS,
  formatDateWithWeekday,
  formatTime,
  sanitizeDecimalInput,
} from "@/lib/jobs-utils";
import { toSportLabelI18n } from "@/lib/sport-i18n";

type SportPickerSectionProps = {
  draft: StudioDraft;
  sportQuery: string;
  sportPickerOpen: boolean;
  locale: string;
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
  filteredSports,
  setSportQuery,
  setSportPickerOpen,
  setDraft,
  resolveSportSelection,
  selectSport,
}: SportPickerSectionProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();
  const selectedSportLabel = draft.sport
    ? toSportLabelI18n(draft.sport, t)
    : t("jobsTab.form.pickSport");

  return (
    <View style={{ gap: BrandSpacing.md }}>
      <ChoicePill
        label={draft.sport ? selectedSportLabel : t("jobsTab.form.pickSport")}
        compact
        fullWidth
        icon={
          <AppSymbol
            name={sportPickerOpen ? "chevron.up" : "chevron.down"}
            size={14}
            tintColor={palette.textMuted}
          />
        }
        backgroundColor={palette.surfaceAlt}
        selectedBackgroundColor={palette.surfaceAlt}
        labelColor={palette.text}
        selectedLabelColor={palette.text}
        onPress={() => {
          setSportPickerOpen((curr) => {
            const next = !curr;
            if (!next) setSportQuery("");
            return next;
          });
        }}
      />

      {sportPickerOpen ? (
        <View style={{ gap: BrandSpacing.sm, paddingTop: BrandSpacing.sm }}>
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
                  toSportLabelI18n(sport, t).toLowerCase() === sportQuery.trim().toLowerCase(),
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
            leading={<AppSymbol name="magnifyingglass" size={16} tintColor={palette.textMuted} />}
          />

          <View style={{ maxHeight: 208 }}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: BrandSpacing.sm,
                paddingTop: BrandSpacing.xs,
                paddingBottom: BrandSpacing.xs,
              }}
            >
              {filteredSports.length > 0 ? (
                filteredSports.map((sport) => {
                  const isSelected = draft.sport === sport;
                  return (
                    <ChoicePill
                      key={sport}
                      label={toSportLabelI18n(sport, t)}
                      selected={isSelected}
                      compact
                      backgroundColor={palette.surfaceAlt}
                      selectedBackgroundColor={palette.primary}
                      labelColor={palette.text}
                      selectedLabelColor={palette.onPrimary}
                      onPress={() => selectSport(sport)}
                    />
                  );
                })
              ) : (
                <ThemedText
                  type="micro"
                  style={{ color: palette.textMuted, paddingHorizontal: BrandSpacing.xs }}
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
  onOpenDate: () => void;
  onOpenStartTime: () => void;
  onOpenEndTime: () => void;
};

export function ScheduleSection({
  draft,
  locale,
  onOpenDate,
  onOpenStartTime,
  onOpenEndTime,
}: ScheduleSectionProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  return (
    <View style={{ gap: BrandSpacing.md }}>
      <ThemedText type="defaultSemiBold" style={{ color: palette.text }}>
        {t("jobsTab.form.schedule")}
      </ThemedText>

      <ChoicePill
        label={formatDateWithWeekday(draft.startTime, locale)}
        compact
        fullWidth
        icon={<AppSymbol name="calendar" size={15} tintColor={palette.primary} />}
        backgroundColor={palette.surfaceAlt}
        selectedBackgroundColor={palette.surfaceAlt}
        labelColor={palette.text}
        selectedLabelColor={palette.text}
        onPress={onOpenDate}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        <ChoicePill
          label={formatTime(draft.startTime, locale)}
          compact
          icon={<AppSymbol name="clock" size={15} tintColor={palette.primary} />}
          backgroundColor={palette.surfaceAlt}
          selectedBackgroundColor={palette.surfaceAlt}
          labelColor={palette.text}
          selectedLabelColor={palette.text}
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
            tintColor={palette.textMuted}
          />
        </View>

        <ChoicePill
          label={formatTime(draft.endTime, locale)}
          compact
          icon={<AppSymbol name="clock" size={15} tintColor={palette.primary} />}
          backgroundColor={palette.surfaceAlt}
          selectedBackgroundColor={palette.surfaceAlt}
          labelColor={palette.text}
          selectedLabelColor={palette.text}
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.lg }}>
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

type PostingOptionsSectionProps = {
  draft: StudioDraft;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>;
  supportedCapabilityTags: readonly string[];
};

export function PostingOptionsSection({
  draft,
  setDraft,
  supportedCapabilityTags,
}: PostingOptionsSectionProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  return (
    <View style={{ gap: BrandSpacing.lg }}>
      {supportedCapabilityTags.length > 0 ? (
        <View style={{ gap: BrandSpacing.md }}>
          <ThemedText type="defaultSemiBold" style={{ color: palette.text }}>
            Capability Requirements
          </ThemedText>
          <ThemedText type="micro" style={{ color: palette.textMuted }}>
            Mark required capabilities to hard-filter matches. Preferred tags are soft ranking only.
          </ThemedText>
          <View style={{ gap: BrandSpacing.sm }}>
            <ThemedText type="micro" style={{ color: palette.textMuted }}>
              Required
            </ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm }}>
              {supportedCapabilityTags.map((tag) => {
                const selected = draft.requiredCapabilityTags.includes(tag);
                return (
                  <ChoicePill
                    key={`required-${tag}`}
                    label={toCapabilityTagLabel(tag)}
                    selected={selected}
                    compact
                    backgroundColor={palette.surfaceAlt}
                    selectedBackgroundColor={palette.primary}
                    labelColor={palette.text}
                    selectedLabelColor={palette.onPrimary}
                    onPress={() =>
                      setDraft((current) => {
                        const nextRequired = selected
                          ? current.requiredCapabilityTags.filter((value) => value !== tag)
                          : [...current.requiredCapabilityTags, tag];
                        const nextPreferred = nextRequired.includes(tag)
                          ? current.preferredCapabilityTags.filter((value) => value !== tag)
                          : current.preferredCapabilityTags;
                        return {
                          ...current,
                          requiredCapabilityTags: nextRequired,
                          preferredCapabilityTags: nextPreferred,
                        };
                      })
                    }
                  />
                );
              })}
            </View>
          </View>
          <View style={{ gap: BrandSpacing.sm }}>
            <ThemedText type="micro" style={{ color: palette.textMuted }}>
              Preferred
            </ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm }}>
              {supportedCapabilityTags.map((tag) => {
                const disabled = draft.requiredCapabilityTags.includes(tag);
                const selected = draft.preferredCapabilityTags.includes(tag);
                return (
                  <ChoicePill
                    key={`preferred-${tag}`}
                    label={toCapabilityTagLabel(tag)}
                    selected={selected}
                    compact
                    backgroundColor={palette.surfaceAlt}
                    selectedBackgroundColor={palette.secondary}
                    labelColor={palette.text}
                    selectedLabelColor={palette.onPrimary}
                    onPress={() =>
                      !disabled &&
                      setDraft((current) => ({
                        ...current,
                        preferredCapabilityTags: selected
                          ? current.preferredCapabilityTags.filter((value) => value !== tag)
                          : [...current.preferredCapabilityTags, tag],
                      }))
                    }
                    disabled={disabled}
                  />
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ gap: BrandSpacing.md }}>
        <ThemedText type="defaultSemiBold" style={{ color: palette.text }}>
          {t("jobsTab.form.closeApplications")}
        </ThemedText>
        <ThemedText type="micro" style={{ color: palette.textMuted }}>
          {t("jobsTab.form.closeApplicationsDescription")}
        </ThemedText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm }}>
          <ChoicePill
            label={t("jobsTab.form.useStudioDefault")}
            selected={draft.expiryOverrideMinutes === undefined}
            compact
            backgroundColor={palette.surfaceAlt}
            selectedBackgroundColor={palette.primary}
            labelColor={palette.text}
            selectedLabelColor={palette.onPrimary}
            onPress={() =>
              setDraft((current) => ({
                ...current,
                expiryOverrideMinutes: undefined,
              }))
            }
          />
          {EXPIRY_OVERRIDE_PRESETS.map((minutes) => (
            <ChoicePill
              key={minutes}
              label={t("jobsTab.form.minutes", { value: minutes })}
              selected={draft.expiryOverrideMinutes === minutes}
              compact
              backgroundColor={palette.surfaceAlt}
              selectedBackgroundColor={palette.primary}
              labelColor={palette.text}
              selectedLabelColor={palette.onPrimary}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  expiryOverrideMinutes: minutes,
                }))
              }
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Boost Bonus Section ───────────────────────────────────────────────────────

type BoostBonusSectionProps = {
  draft: StudioDraft;
  setDraft: React.Dispatch<React.SetStateAction<StudioDraft>>;
};

function BoostSliderRow({
  value,
  onValueChange,
  accentColor,
}: {
  value: number;
  onValueChange: (value: number) => void;
  accentColor: string;
}) {
  const { color: palette } = useTheme();

  const SLIDER_WIDTH = 280;
  const THUMB_SIZE = 32;
  const TRACK_HEIGHT = 8;
  const CONTAINER_HEIGHT = 48;

  const minVal = BOOST_CUSTOM_MIN;
  const maxVal = BOOST_CUSTOM_MAX;
  const step = BOOST_CUSTOM_STEP;
  const totalSteps = (maxVal - minVal) / step;

  // Shared values
  const progress = useSharedValue((value - minVal) / (maxVal - minVal));
  const lastValue = useSharedValue(value);

  // Sync progress when value changes externally
  useEffect(() => {
    progress.value = withSpring((value - minVal) / (maxVal - minVal), {
      damping: 20,
      stiffness: 200,
    });
    lastValue.value = value;
  }, [value, progress, lastValue]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      const rawProg = Math.max(0, Math.min(1, e.x / SLIDER_WIDTH));
      progress.value = rawProg;
      // Calculate stepped value inline for worklet
      const stepped = Math.round(rawProg * totalSteps);
      const newValue = minVal + stepped * step;
      if (newValue !== lastValue.value) {
        lastValue.value = newValue;
        runOnJS(onValueChange)(newValue);
      }
    })
    .hitSlop({ top: 24, bottom: 24, left: 12, right: 12 });

  const tapGesture = Gesture.Tap().onEnd((e) => {
    "worklet";
    const rawProg = Math.max(0, Math.min(1, e.x / SLIDER_WIDTH));
    progress.value = withSpring(rawProg, { damping: 15 });
    const stepped = Math.round(rawProg * totalSteps);
    const newValue = minVal + stepped * step;
    runOnJS(triggerSelectionHaptic)();
    runOnJS(onValueChange)(newValue);
  });

  const composed = Gesture.Simultaneous(tapGesture, panGesture);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (SLIDER_WIDTH - THUMB_SIZE) }],
  }));

  return (
    <View style={{ alignItems: "center", gap: BrandSpacing.md }}>
      {/* Value display */}
      <Text
        style={{
          fontFamily: BrandType.display.fontFamily,
          fontSize: 48,
          fontWeight: "800",
          color: accentColor,
        }}
      >
        +₪{value}
      </Text>

      {/* Slider row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        <Text style={{ ...BrandType.caption, color: palette.textMuted }}>₪{minVal}</Text>

        <GestureDetector gesture={composed}>
          <View
            style={{
              width: SLIDER_WIDTH,
              height: CONTAINER_HEIGHT,
              justifyContent: "center",
            }}
          >
            {/* Track - vertically centered in container */}
            <View
              style={{
                height: TRACK_HEIGHT,
                borderRadius: TRACK_HEIGHT / 2,
                backgroundColor: palette.surfaceAlt,
              }}
            >
              <Animated.View
                style={[
                  {
                    height: "100%",
                    backgroundColor: accentColor,
                    borderRadius: TRACK_HEIGHT / 2,
                  },
                  fillStyle,
                ]}
              />
            </View>

            {/* Thumb - vertically centered on track */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: THUMB_SIZE,
                  height: THUMB_SIZE,
                  borderRadius: THUMB_SIZE / 2,
                  backgroundColor: palette.surface,
                  borderWidth: 4,
                  borderColor: accentColor,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                  // Center thumb vertically: (container - thumb) / 2
                  top: (CONTAINER_HEIGHT - THUMB_SIZE) / 2,
                },
                thumbStyle,
              ]}
            />
          </View>
        </GestureDetector>

        <Text style={{ ...BrandType.caption, color: palette.textMuted }}>₪{maxVal}</Text>
      </View>
    </View>
  );
}

export function BoostBonusSection({ draft, setDraft }: BoostBonusSectionProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  const isBoostEnabled = draft.boostPreset !== undefined || draft.boostCustomAmount !== undefined;
  const currentBonus =
    draft.boostCustomAmount ??
    (draft.boostPreset ? BOOST_PRESET_VALUES[draft.boostPreset] : BOOST_CUSTOM_DEFAULT);
  const accentColor = isBoostEnabled ? palette.secondary : palette.primary;

  const handleToggle = (enabled: boolean) => {
    setDraft((current) => ({
      ...current,
      boostPreset: enabled ? "small" : undefined,
      boostCustomAmount: enabled ? (current.boostCustomAmount ?? BOOST_CUSTOM_DEFAULT) : undefined,
    }));
  };

  const handleAmountChange = (amount: number) => {
    setDraft((current) => ({
      ...current,
      boostPreset: undefined,
      boostCustomAmount: amount,
    }));
  };

  const handleTriggerChange = (minutes: number | undefined) => {
    setDraft((current) => ({
      ...current,
      boostTriggerMinutes: minutes,
    }));
  };

  return (
    <View style={{ gap: BrandSpacing.md }}>
      {/* Header row */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
          <AppSymbol name="sparkles" size={18} tintColor={accentColor} />
          <ThemedText type="defaultSemiBold" style={{ color: palette.text }}>
            {t("jobsTab.form.boostOnBoard")}
          </ThemedText>
        </View>
        <KitSwitch value={isBoostEnabled} onValueChange={handleToggle} />
      </View>

      {/* Slider (shown when enabled) */}
      {isBoostEnabled && (
        <Animated.View entering={FadeIn.duration(150)}>
          <BoostSliderRow
            value={currentBonus}
            onValueChange={handleAmountChange}
            accentColor={accentColor}
          />

          {/* Time trigger pills */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BrandSpacing.sm,
              marginTop: BrandSpacing.md,
            }}
          >
            <AppSymbol name="clock" size={14} tintColor={palette.textMuted} />
            <View style={{ flexDirection: "row", gap: BrandSpacing.xs }}>
              <ChoicePill
                label="Auto"
                selected={draft.boostTriggerMinutes === undefined}
                compact
                backgroundColor={palette.surfaceAlt}
                selectedBackgroundColor={accentColor}
                labelColor={palette.text}
                selectedLabelColor={palette.onPrimary}
                onPress={() => handleTriggerChange(undefined)}
              />
              {BOOST_TRIGGER_MINUTES_OPTIONS.slice(0, 3).map((minutes) => (
                <ChoicePill
                  key={minutes}
                  label={`${minutes}m`}
                  selected={draft.boostTriggerMinutes === minutes}
                  compact
                  backgroundColor={palette.surfaceAlt}
                  selectedBackgroundColor={accentColor}
                  labelColor={palette.text}
                  selectedLabelColor={palette.onPrimary}
                  onPress={() => handleTriggerChange(minutes)}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      )}
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
      style={{ minHeight: BrandSpacing.multilineInputMinHeight, textAlignVertical: "top" }}
    />
  );
}

type SubmitBarProps = {
  draft: StudioDraft;
  isSubmitting: boolean;
  isBoostEnabled?: boolean;
  onPost: () => void;
};

export function SubmitBar({ draft, isSubmitting, isBoostEnabled, onPost }: SubmitBarProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  // Orange accent when boost is enabled
  const boostAccentColor = palette.secondary;
  const accentColor = isBoostEnabled ? boostAccentColor : palette.primary;
  const accentPressedColor = isBoostEnabled ? palette.secondary : palette.primaryPressed;

  return (
    <View style={{ marginTop: BrandSpacing.xl, paddingBottom: 40 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSubmitting ? t("jobsTab.actions.posting") : t("jobsTab.actions.post")}
        accessibilityState={{ disabled: isSubmitting || !draft.sport, busy: isSubmitting }}
        disabled={isSubmitting || !draft.sport}
        onPress={onPost}
        style={({ pressed }) => ({
          minHeight: BrandSpacing.controlLg,
          width: "100%",
          borderRadius: BrandRadius.medium,
          borderCurve: "continuous",
          backgroundColor:
            isSubmitting || !draft.sport
              ? accentPressedColor
              : pressed
                ? accentPressedColor
                : accentColor,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: BrandSpacing.sm,
          transform: [{ scale: pressed ? 0.992 : 1 }],
          // Add glow shadow when boost is enabled
          ...(isBoostEnabled
            ? {
                shadowColor: boostAccentColor,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 30,
                elevation: 8,
              }
            : {}),
        })}
      >
        <AppSymbol name="plus" size={18} tintColor={palette.onPrimary} />
        <Text
          style={{
            color: palette.onPrimary,
            fontSize: BrandType.body.fontSize,
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
  onChange: (_event: unknown, selectedDate?: Date) => void;
  onDone: () => void;
};

export function PickerDock({
  visible,
  value,
  mode,
  display: _display,
  minimumDate,
  onChange,
  onDone,
}: PickerDockProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  const presentation: "inline" | "dialog" =
    Platform.OS === "ios" || _display === "inline" ? "inline" : "dialog";

  return (
    <View
      style={{
        gap: BrandSpacing.md,
        paddingHorizontal: BrandSpacing.xl,
        paddingBottom: BrandSpacing.xl,
      }}
    >
      <DateTimePicker
        value={value}
        mode={mode}
        presentation={presentation}
        onValueChange={onChange}
        {...(minimumDate ? { minimumDate } : {})}
      />
      {Platform.OS === "ios" ? (
        <ActionButton label={t("common.done")} onPress={onDone} tone="secondary" />
      ) : null}
    </View>
  );
}
