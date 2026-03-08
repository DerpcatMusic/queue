import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitChip, KitPressable } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandRadius } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import { isSportType, SPORT_TYPES, toSportLabel } from "@/convex/constants";

type SportsMultiSelectProps = {
  palette: BrandPalette;
  selectedSports: string[];
  onToggleSport: (sport: string) => void;
  searchPlaceholder: string;
  title: string;
  emptyHint: string;
};

export function SportsMultiSelect({
  palette,
  selectedSports,
  onToggleSport,
  searchPlaceholder,
  title,
  emptyHint,
}: SportsMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [query, setQuery] = useState("");

  const filteredSports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return SPORT_TYPES;
    }
    return SPORT_TYPES.filter((sport) => toSportLabel(sport).toLowerCase().includes(normalized));
  }, [query]);

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: palette.surfaceAlt,
          borderColor: palette.border,
        },
      ]}
    >
      <KitPressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => setIsOpen((value) => !value)}
        style={styles.header}
      >
        <View style={styles.headerTextBlock}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {selectedSports.length > 0 ? `${String(selectedSports.length)} selected` : emptyHint}
          </ThemedText>
        </View>
        <IconSymbol
          name={isOpen ? "chevron.up" : "chevron.down"}
          size={14}
          color={palette.textMuted}
        />
      </KitPressable>

      {isOpen ? (
        <View style={styles.panel}>
          <NativeSearchField
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
          />
          {selectedSports.length > 0 ? (
            <View style={styles.chips}>
              {selectedSports.map((sport) => (
                <KitChip
                  key={`selected-${sport}`}
                  label={isSportType(sport) ? toSportLabel(sport) : sport}
                  selected
                  onPress={() => onToggleSport(sport)}
                />
              ))}
            </View>
          ) : null}
          <View style={styles.chips}>
            {filteredSports.map((sport) => (
              <KitChip
                key={sport}
                label={toSportLabel(sport)}
                selected={selectedSports.includes(sport)}
                onPress={() => onToggleSport(sport)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    gap: 2,
  },
  panel: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
