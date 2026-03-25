import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing } from "@/constants/brand";

type JobsSectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function JobsSectionHeader({ title, subtitle }: JobsSectionHeaderProps) {
  return (
    <View style={{ gap: BrandSpacing.xs / 2, paddingHorizontal: BrandSpacing.xs }}>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="meta" className="text-muted">
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}
