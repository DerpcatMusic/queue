import { Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

type JobsSectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function JobsSectionHeader({ title, subtitle }: JobsSectionHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        gap: BrandSpacing.xs,
        paddingHorizontal: BrandSpacing.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        <View
          style={{
            width: theme.spacing.statusDot,
            height: theme.spacing.statusDot,
            borderRadius: BrandRadius.full,
            backgroundColor: theme.jobs.signal,
          }}
        />
        <Text style={[theme.typography.radarLabel, { color: theme.color.textMuted }]}>
          Radar feed
        </Text>
      </View>
      <ThemedText type="sectionTitle" style={{ color: theme.color.text }}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="meta" style={{ color: theme.color.textMuted }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}
