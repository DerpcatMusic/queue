import { useBrand } from "@/hooks/use-brand";
import type { EventItem } from "@howljs/calendar-kit";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

export interface CustomEventItem extends EventItem {
  location?: string;
  opacity?: number;
}

interface TimelineEventProps {
  event: CustomEventItem;
}

export function TimelineEvent({ event }: TimelineEventProps) {
  const palette = useBrand();

  const backgroundColor = event.color ?? palette.surface;
  const textColor = event.titleColor ?? palette.text;
  const borderColor = event.color ?? palette.border;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor,
          opacity: event.opacity ?? 1,
        },
      ]}
    >
      <View style={[styles.accentStripe, { backgroundColor: textColor }]} />
      <View style={styles.content}>
        <Animated.Text
          style={[styles.title, { color: textColor }]}
          numberOfLines={2}
        >
          {event.title}
        </Animated.Text>
        {!!event.location && (
          <Animated.Text
            style={[styles.location, { color: textColor, opacity: 0.8 }]}
            numberOfLines={1}
          >
            {event.location}
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  accentStripe: {
    width: 4,
    height: "100%",
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  location: {
    fontSize: 10,
    fontWeight: "500",
    lineHeight: 12,
  },
});
