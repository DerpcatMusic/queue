import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  measure,
  runOnUI,
} from "react-native-reanimated";
import { Box, HStack, Text } from "@/primitives";
import { useTheme } from "@/hooks/use-theme";
import { BrandSpacing, BrandRadius } from "@/constants/brand";

export type CardStatus = "complete" | "in_progress" | "action_required";

interface ComplianceCardProps {
  title: string;
  status: CardStatus;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const STATUS_LABELS: Record<CardStatus, string> = {
  complete: "Done",
  in_progress: "In progress",
  action_required: "Action required",
};

export function ComplianceCard({
  title,
  status,
  isExpanded,
  onToggle,
  children,
}: ComplianceCardProps) {
  const theme = useTheme();
  const heightValue = useSharedValue(0);
  const contentRef = React.useRef(null);

  const statusColor =
    status === "complete"
      ? theme.color.success
      : status === "in_progress"
        ? theme.color.warning
        : theme.color.danger;

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightValue.value,
    overflow: "hidden",
  }));

  const handleToggle = useCallback(() => {
    onToggle();
    runOnUI(() => {
      if (!isExpanded) {
        // Expanding — measure content height then animate
        const measured = measure(contentRef.current!);
        if (measured) {
          heightValue.value = withTiming(measured.height, { duration: 250 });
        }
      } else {
        // Collapsing
        heightValue.value = withTiming(0, { duration: 200 });
      }
    })();
  }, [isExpanded, onToggle, heightValue]);

  React.useEffect(() => {
    runOnUI(() => {
      if (isExpanded) {
        const measured = measure(contentRef.current!);
        if (measured) {
          heightValue.value = measured.height;
        }
      } else {
        heightValue.value = 0;
      }
    })();
  }, [isExpanded, heightValue]);

  return (
    <Box
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surfaceElevated,
          borderColor: isExpanded ? theme.color.primary : theme.color.border,
        },
      ]}
    >
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${title} — ${STATUS_LABELS[status]}`}
      >
        <HStack style={styles.header}>
          <HStack style={{ gap: BrandSpacing.md, alignItems: "center", flex: 1 }}>
            <Box
              style={[
                styles.statusDot,
                { backgroundColor: statusColor },
              ]}
            />
            <Text style={{ color: theme.color.text, fontWeight: "600", fontSize: 15 }}>
              {title}
            </Text>
          </HStack>
          <Text
            style={{ color: statusColor, fontSize: 12, fontWeight: "500" }}
          >
            {STATUS_LABELS[status]}
          </Text>
        </HStack>
      </Pressable>

      <Animated.View style={animatedStyle}>
        <View ref={contentRef} style={styles.content} collapsable={false}>
          {children}
        </View>
      </Animated.View>
    </Box>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BrandRadius.xl,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.md,
    alignItems: "center",
  },
  content: {
    paddingHorizontal: BrandSpacing.lg,
    paddingBottom: BrandSpacing.lg,
    gap: BrandSpacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
