import { useMemo } from "react";
import CalendarTabScreen from "@/components/calendar";
import CalendarSheetHeader from "@/components/calendar/calendar-tab/calendar-sheet-header";
import { toDayKey } from "@/components/calendar/calendar-tab/calendar-date-utils";
import { useCalendarTabController } from "@/components/calendar/use-calendar-tab-controller";
import { useTheme } from "@/hooks/use-theme";
import { useTabSceneDescriptor } from "@/modules/navigation/role-tabs-layout";

export default function StudioCalendarTabRoute() {
  const theme = useTheme();
  const controller = useCalendarTabController();
  const todayKey = useMemo(() => toDayKey(Date.now()), []);

  const sheetContent = useMemo(
    () => (
      <CalendarSheetHeader
        selectedDay={controller.selectedDay}
        todayKey={todayKey}
      />
    ),
    [controller.selectedDay, todayKey],
  );

  const sheetConfig = useMemo(
    () => ({
      render: () => ({
        children: sheetContent,
      }),
      steps: [0] as const,
      initialStep: 0,
      collapsedHeightMode: "content" as const,
      padding: {
        vertical: 0,
        horizontal: 0,
      },
      backgroundColor: theme.color.surfaceAlt,
      topInsetColor: theme.color.surfaceAlt,
    }),
    [sheetContent, theme.color.surfaceAlt],
  );

  const descriptorBody = <CalendarTabScreen controller={controller} todayKey={todayKey} />;

  const descriptor = useMemo(
    () => ({
      tabId: "calendar" as const,
      body: descriptorBody,
      sheetConfig,
      insetTone: "sheet" as const,
    }),
    [descriptorBody, sheetConfig],
  );

  useTabSceneDescriptor(descriptor);

  return descriptorBody;
}
