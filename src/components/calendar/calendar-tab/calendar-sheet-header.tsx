import { memo } from "react";
import { Box } from "@/primitives";
import { calendarSheetStyles } from "./calendar-date-utils";
import CalendarWeekPicker from "./calendar-week-picker";

type CalendarSheetHeaderProps = {
  selectedDay: string;
  todayKey: string;
};

function CalendarSheetHeader({ selectedDay, todayKey }: CalendarSheetHeaderProps) {
  return (
    <Box style={calendarSheetStyles.root}>
      <CalendarWeekPicker selectedDay={selectedDay} todayKey={todayKey} startDay={selectedDay} />
    </Box>
  );
}

export default memo(CalendarSheetHeader);
