import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBrand } from "@/hooks/use-brand";
import {
  calendarSheetStyles,
  formatSelectedDayDate,
  formatSelectedDayLabel,
} from "./calendar-date-utils";

type CalendarSheetHeaderProps = {
  canShowGoogleAgenda: boolean;
  selectedDay: string;
  showExternalCalendarItems: boolean;
  onToggleExternalCalendarItems: () => void;
};

function CalendarSheetHeader({
  canShowGoogleAgenda,
  selectedDay,
  showExternalCalendarItems,
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
            {formatSelectedDayDate(selectedDay, i18n.language)}
          </Text>
        </View>
        <View style={calendarSheetStyles.actionsColumn}>
          {canShowGoogleAgenda ? (
            <ActionButton
              accessibilityLabel={t("calendarTab.filters.button")}
              onPress={onToggleExternalCalendarItems}
              palette={palette}
              tone="secondary"
              shape="square"
              size="lg"
              icon={
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  <IconSymbol
                    name={showExternalCalendarItems ? "xmark.circle.fill" : "plus.circle.fill"}
                    size={20}
                    color={
                      showExternalCalendarItems
                        ? (palette.primary as string)
                        : (palette.textMuted as string)
                    }
                  />
                  <Text
                    style={{
                      ...calendarSheetStyles.googleBadge,
                      color: showExternalCalendarItems
                        ? (palette.primary as string)
                        : (palette.textMuted as string),
                    }}
                  >
                    {t("calendarTab.timeline.googleBadge")}
                  </Text>
                </View>
              }
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default memo(CalendarSheetHeader);
