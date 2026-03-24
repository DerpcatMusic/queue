import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BrandSpacing } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";

type JobsSectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function JobsSectionHeader({ title, subtitle }: JobsSectionHeaderProps) {
  const palette = useBrand();

  return (
    <View style={{ gap: BrandSpacing.xs / 2, paddingHorizontal: BrandSpacing.xs }}>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="meta" style={{ color: palette.textMuted }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}
