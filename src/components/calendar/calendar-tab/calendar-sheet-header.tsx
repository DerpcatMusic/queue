import { memo } from "react";
import { View } from "react-native";
import { calendarSheetStyles } from "./calendar-date-utils";
import CalendarWeekPicker from "./calendar-week-picker";

type CalendarSheetHeaderProps = {
  selectedDay: string;
  todayKey: string;
};

function CalendarSheetHeader({ selectedDay, todayKey }: CalendarSheetHeaderProps) {
  return (
    <View style={calendarSheetStyles.root}>
      <CalendarWeekPicker
        selectedDay={selectedDay}
        todayKey={todayKey}
        startDay={selectedDay}
      />
    </View>
  );
}

export default memo(CalendarSheetHeader);
