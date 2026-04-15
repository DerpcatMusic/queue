import { Pressable, StyleSheet, View } from "react-native";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box, HStack, Text } from "@/primitives";

export type CardStatus = "complete" | "in_progress" | "action_required";

interface ComplianceCardProps {
  title: string;
  status: CardStatus;
  onPress?: () => void;
  children: React.ReactNode;
}

const STATUS_LABELS: Record<CardStatus, string> = {
  complete: "Done",
  in_progress: "In progress",
  action_required: "Action required",
};

export function ComplianceCard({ title, status, onPress, children }: ComplianceCardProps) {
  const theme = useTheme();

  const statusColor =
    status === "complete"
      ? theme.color.success
      : status === "in_progress"
        ? theme.color.warning
        : theme.color.danger;

  return (
    <Box
      style={[
        styles.card,
        {
          backgroundColor: theme.color.surfaceElevated,
          borderColor: theme.color.border,
        },
      ]}
    >
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title} — ${STATUS_LABELS[status]}`}
      >
        <HStack style={styles.header}>
          <HStack style={{ gap: BrandSpacing.md, alignItems: "center", flex: 1 }}>
            <Box style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={{ color: theme.color.text, fontWeight: "600", fontSize: 15 }}>
              {title}
            </Text>
          </HStack>
          <Text style={{ color: statusColor, fontSize: 12, fontWeight: "500" }}>
            {STATUS_LABELS[status]}
          </Text>
        </HStack>
      </Pressable>

      <View style={styles.content}>{children}</View>
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
