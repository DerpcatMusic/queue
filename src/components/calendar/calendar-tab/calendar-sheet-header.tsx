import { memo } from "react";
import { View } from "react-native";
import { addDays } from "../calendar-controller-helpers";
import { calendarSheetStyles } from "./calendar-date-utils";
import CalendarWeekPicker from "./calendar-week-picker";

type CalendarSheetHeaderProps = {
  selectedDay: string;
  todayKey: string;
};

function CalendarSheetHeader({ selectedDay, todayKey }: CalendarSheetHeaderProps) {

  // Calculate the week start (Monday) for the selected day
  // This is a simple implementation - we find the Monday of the week
  const selectedDate = new Date(selectedDay + "T00:00:00");
  const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  // Convert to Monday-based index (0 = Monday)
  const mondayBasedIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStartDay = addDays(selectedDay, -mondayBasedIndex);

  return (
    <View style={calendarSheetStyles.root}>
      <CalendarWeekPicker
        selectedDay={selectedDay}
        todayKey={todayKey}
        weekStartDay={weekStartDay}
      />
    </View>
  );
}

export default memo(CalendarSheetHeader);
