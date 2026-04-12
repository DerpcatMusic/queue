import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Box, HStack, Text } from "@/primitives";
import { useTheme } from "@/hooks/use-theme";
import { BrandSpacing } from "@/constants/brand";
import type { CardStatus } from "./compliance-card";

interface ProgressStep {
  label: string;
  status: CardStatus;
  onPress: () => void;
}

interface ComplianceProgressProps {
  steps: ProgressStep[];
}

export function ComplianceProgress({ steps }: ComplianceProgressProps) {
  const theme = useTheme();

  return (
    <HStack style={styles.container}>
      {steps.map((step, index) => {
        const isActive = step.status !== "complete";
        const isDone = step.status === "complete";
        const dotColor = isDone
          ? theme.color.success
          : isActive
            ? theme.color.primary
            : theme.color.border;

        return (
          <React.Fragment key={step.label}>
            <Pressable
              onPress={step.onPress}
              accessibilityRole="button"
              accessibilityLabel={`Step ${index + 1}: ${step.label} — ${step.status}`}
              style={[styles.step, { flex: 1 }]}
            >
              <Box style={[styles.dot, { backgroundColor: dotColor }]} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isDone ? "600" : "400",
                  color: isDone ? theme.color.success : isActive ? theme.color.text : theme.color.textMuted,
                  marginTop: BrandSpacing.xs,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </Pressable>
            {index < steps.length - 1 && (
              <Box
                style={[
                  styles.connector,
                  {
                    backgroundColor:
                      isDone ? theme.color.success : theme.color.border,
                    alignSelf: "center",
                    marginTop: -BrandSpacing.sm,
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </HStack>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
    alignItems: "flex-start",
  },
  step: {
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connector: {
    height: 2,
    flex: 1,
    minWidth: 16,
  },
});
