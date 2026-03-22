import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBrand } from "@/hooks/use-brand";
import {
  calendarSheetStyles,
  formatMonthYear,
  formatSelectedDayLabel,
} from "./calendar-date-utils";

type CalendarSheetHeaderProps = {
  canShowGoogleAgenda: boolean;
  selectedDay: string;
  selectedDayIsToday: boolean;
  showExternalCalendarItems: boolean;
  onTodayPress: () => void;
  onToggleExternalCalendarItems: () => void;
};

function CalendarSheetHeader({
  canShowGoogleAgenda,
  selectedDay,
  selectedDayIsToday,
  showExternalCalendarItems,
  onTodayPress,
  onToggleExternalCalendarItems,
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
            {formatSelectedDayLabel(selectedDay, i18n.language)}
          </Text>
          <Text
            style={[
              calendarSheetStyles.subtitle,
              {
                color: palette.onPrimary as string,
              },
            ]}
          >
            {formatMonthYear(selectedDay, i18n.language)}
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
          {canShowGoogleAgenda ? (
            <IconButton
              accessibilityLabel={t("calendarTab.filters.button")}
              onPress={onToggleExternalCalendarItems}
              tone={showExternalCalendarItems ? "primary" : "secondary"}
              size={52}
              icon={
                <IconSymbol
                  name={showExternalCalendarItems ? "calendar.badge.minus" : "calendar.badge.plus"}
                  size={20}
                  color={
                    showExternalCalendarItems
                      ? (palette.onPrimary as string)
                      : (palette.text as string)
                  }
                />
              }
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default memo(CalendarSheetHeader);
