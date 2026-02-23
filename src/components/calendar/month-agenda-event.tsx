import { useBrand } from "@/hooks/use-brand";
import { hexToRgba } from "@/lib/calendar-utils";
import type { EventItem } from "@howljs/calendar-kit";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

export function MonthAgendaEvent({ event }: { event: EventItem }) {
  const { i18n } = useTranslation();
  const palette = useBrand();
  const locale = i18n.language || "en";

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale],
  );

  const startDate = new Date(event.start.dateTime ?? 0);
  const endDate = new Date(event.end.dateTime ?? 0);
  const eventTimeRange =
    Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())
      ? ""
      : `${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;

  const eventColor =
    typeof event.color === "string"
      ? event.color
      : palette.calendar.accentSubtle;
  const eventTitleColor =
    typeof event.titleColor === "string" ? event.titleColor : palette.text;

  return (
    <View
      style={[
        styles.monthAgendaEvent,
        {
          backgroundColor: eventColor,
          borderColor: hexToRgba(
            eventTitleColor as string,
            0.2,
          ),
        },
      ]}
    >
      <Animated.Text
        style={[
          styles.monthAgendaEventTitle,
          {
            color: eventTitleColor,
          },
        ]}
        numberOfLines={1}
      >
        {event.title}
      </Animated.Text>
      {eventTimeRange ? (
        <Animated.Text
          style={[
            styles.monthAgendaEventTime,
            {
              color: hexToRgba(
                eventTitleColor as string,
                0.78,
              ),
            },
          ]}
        >
          {eventTimeRange}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  monthAgendaEvent: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  monthAgendaEventTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  monthAgendaEventTime: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    lineHeight: 17,
  },
});
