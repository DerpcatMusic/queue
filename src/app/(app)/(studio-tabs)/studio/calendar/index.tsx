import { useMemo } from "react";
import CalendarTabScreen from "@/components/calendar";
import { toDayKey } from "@/components/calendar/calendar-tab/calendar-date-utils";
import { useCalendarTabController } from "@/components/calendar/use-calendar-tab-controller";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function StudioCalendarTabRoute() {
  const controller = useCalendarTabController();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);

  const descriptorBody = <CalendarTabScreen controller={controller} todayKey={todayKey} />;
  useTabSceneDescriptor({ tabId: "calendar", body: descriptorBody, insetTone: "sheet" });

  return descriptorBody;
}
