import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/hooks/use-brand";

type JobsSectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function JobsSectionHeader({ title, subtitle }: JobsSectionHeaderProps) {
  const palette = useBrand();

  return (
    <View style={{ gap: 2, paddingHorizontal: 4 }}>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="meta" style={{ color: palette.textMuted }}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}
