import { useMemo } from "react";
import CalendarTabScreen from "@/components/calendar";
import { toDayKey } from "@/components/calendar/calendar-tab/calendar-date-utils";
import { useCalendarTabController } from "@/components/calendar/use-calendar-tab-controller";

export default function StudioCalendarTabRoute() {
  const controller = useCalendarTabController();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);

  return <CalendarTabScreen controller={controller} todayKey={todayKey} />;
}
