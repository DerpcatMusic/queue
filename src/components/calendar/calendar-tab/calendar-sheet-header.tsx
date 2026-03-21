import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitChip } from "@/components/ui/kit/kit-chip";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import type {
  CalendarVisibilityFilterKey,
  CalendarVisibilityFilters,
} from "../calendar-controller-helpers";
import {
  calendarSheetStyles,
  formatMonthYear,
  formatSelectedDayLabel,
} from "./calendar-date-utils";

type CalendarSheetHeaderProps = {
  canShowGoogleAgenda: boolean;
  selectedDay: string;
  selectedLessonCount: number;
  selectedDayIsToday: boolean;
  showCalendarFilters: boolean;
  showDatePicker: boolean;
  visibilityFilters: CalendarVisibilityFilters;
  onToggleFilters: () => void;
  onTodayPress: () => void;
  onChooseDatePress: () => void;
  onToggleVisibilityFilter: (key: CalendarVisibilityFilterKey) => void;
};

function CalendarSheetHeader({
  canShowGoogleAgenda,
  selectedDay,
  selectedLessonCount,
  selectedDayIsToday,
  showCalendarFilters,
  showDatePicker,
  visibilityFilters,
  onToggleFilters,
  onTodayPress,
  onChooseDatePress,
  onToggleVisibilityFilter,
}: CalendarSheetHeaderProps) {
  const { t, i18n } = useTranslation();
  const palette = useBrand();

  return (
    <View style={calendarSheetStyles.root}>
      <View style={calendarSheetStyles.titleRow}>
        <View style={calendarSheetStyles.titleColumn}>
          <Text
            style={[
              calendarSheetStyles.title,
              {
                color: palette.onPrimary as string,
              },
            ]}
          >
            {formatMonthYear(selectedDay, i18n.language)}
          </Text>
          <Text
            style={[
              calendarSheetStyles.subtitle,
              {
                color: palette.onPrimary as string,
              },
            ]}
          >
            {formatSelectedDayLabel(selectedDay, i18n.language)}
          </Text>
        </View>
        <View style={calendarSheetStyles.actionsColumn}>
          {selectedDayIsToday ? null : (
            <ActionButton
              label={t("common.today")}
              onPress={onTodayPress}
              palette={palette}
              tone="secondary"
            />
          )}
          <ActionButton
            label={showDatePicker ? t("common.done") : t("calendarTab.header.chooseDate")}
            onPress={onChooseDatePress}
            palette={palette}
            tone="secondary"
          />
        </View>
      </View>

      <View
        style={[
          calendarSheetStyles.summaryRow,
          {
            borderColor: palette.border as string,
          },
        ]}
      >
        <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
          {formatSelectedDayLabel(selectedDay, i18n.language)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {canShowGoogleAgenda ? (
            <IconButton
              accessibilityLabel={t("calendarTab.filters.button")}
              onPress={onToggleFilters}
              tone={showCalendarFilters ? "primary" : "secondary"}
              size={42}
              icon={
                <IconSymbol
                  name="line.3.horizontal.decrease.circle"
                  size={18}
                  color={
                    showCalendarFilters
                      ? (palette.onPrimary as string)
                      : (palette.textMuted as string)
                  }
                />
              }
            />
          ) : null}
          <View
            style={[
              calendarSheetStyles.summaryCountPill,
              {
                backgroundColor:
                  selectedLessonCount > 0
                    ? (palette.primarySubtle as string)
                    : (palette.surface as string),
              },
            ]}
          >
            <Text
              style={{
                ...BrandType.micro,
                fontVariant: ["tabular-nums"],
                color:
                  selectedLessonCount > 0
                    ? (palette.primary as string)
                    : (palette.textMuted as string),
              }}
            >
              {selectedLessonCount === 1
                ? t("calendarTab.agenda.oneEvent")
                : t("calendarTab.agenda.eventCount", { count: selectedLessonCount })}
            </Text>
          </View>
        </View>
      </View>

      {canShowGoogleAgenda && showCalendarFilters ? (
        <View style={{ gap: 8 }}>
          <Text style={{ ...BrandType.micro, color: palette.textMuted as string }}>
            {t("calendarTab.filters.show")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.sm }}>
            <KitChip
              label={t("calendarTab.filters.lessons")}
              selected={visibilityFilters.queueLessons}
              onPress={() => onToggleVisibilityFilter("queueLessons")}
            />
            <KitChip
              label={t("calendarTab.filters.timed")}
              selected={visibilityFilters.timedCalendarEvents}
              onPress={() => onToggleVisibilityFilter("timedCalendarEvents")}
            />
            <KitChip
              label={t("calendarTab.filters.allDay")}
              selected={visibilityFilters.allDayCalendarEvents}
              onPress={() => onToggleVisibilityFilter("allDayCalendarEvents")}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default memo(CalendarSheetHeader);
