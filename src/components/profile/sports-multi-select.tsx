import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitButton, KitPressable } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { isSportType, SPORT_TYPES, toSportLabel } from "@/convex/constants";

type SportsMultiSelectProps = {
  palette: BrandPalette;
  selectedSports: string[];
  onToggleSport: (sport: string) => void;
  searchPlaceholder: string;
  title: string;
  emptyHint: string;
  defaultOpen?: boolean;
};

export function SportsMultiSelect({
  palette,
  selectedSports,
  onToggleSport,
  searchPlaceholder,
  title,
  emptyHint,
  defaultOpen = false,
}: SportsMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");

  const filteredSports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return SPORT_TYPES;
    }
    return SPORT_TYPES.filter((sport) => toSportLabel(sport).toLowerCase().includes(normalized));
  }, [query]);
  const selectedSportsList = useMemo(
    () => SPORT_TYPES.filter((sport) => selectedSports.includes(sport)),
    [selectedSports],
  );
  const availableSportsList = useMemo(
    () => filteredSports.filter((sport) => !selectedSports.includes(sport)),
    [filteredSports, selectedSports],
  );

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
        <KitButton
          label={isOpen ? "Done" : "Edit"}
          onPress={() => setIsOpen((value) => !value)}
          variant="ghost"
          size="sm"
          fullWidth={false}
        />
      </KitPressable>

      {isOpen ? (
        <View style={styles.panel}>
          <NativeSearchField
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
          />
          {selectedSportsList.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textMuted as string }]}>
                Selected sports
              </Text>
              <View style={styles.resultsList}>
                {selectedSportsList.map((sport) => (
                  <KitPressable
                    key={`selected-${sport}`}
                    accessibilityRole="button"
                    onPress={() => onToggleSport(sport)}
                    style={[styles.resultRow, { backgroundColor: palette.primarySubtle as string }]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.resultTitle, { color: palette.text as string }]}>
                        {isSportType(sport) ? toSportLabel(sport) : sport}
                      </Text>
                      <Text style={[styles.resultMeta, { color: palette.primary as string }]}>
                        Added to your teaching profile
                      </Text>
                    </View>
                    <IconSymbol
                      name="checkmark.circle.fill"
                      size={18}
                      color={palette.primary as string}
                    />
                  </KitPressable>
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.textMuted as string }]}>
              {query.trim().length > 0 ? "Matching sports" : "All sports"}
            </Text>
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
              style={styles.resultsViewport}
            >
              {availableSportsList.length > 0 ? (
                availableSportsList.map((sport) => (
                  <KitPressable
                    key={sport}
                    accessibilityRole="button"
                    onPress={() => onToggleSport(sport)}
                    style={[styles.resultRow, { backgroundColor: palette.surface as string }]}
                  >
                    <Text style={[styles.resultTitle, { color: palette.text as string }]}>
                      {toSportLabel(sport)}
                    </Text>
                    <IconSymbol
                      name="plus.circle.fill"
                      size={18}
                      color={palette.textMuted as string}
                    />
                  </KitPressable>
                ))
              ) : (
                <View
                  style={[
                    styles.emptyState,
                    {
                      backgroundColor: palette.surface as string,
                      borderColor: palette.border as string,
                    },
                  ]}
                >
                  <Text style={[styles.resultTitle, { color: palette.text as string }]}>
                    No matching sports
                  </Text>
                  <Text style={[styles.resultMeta, { color: palette.textMuted as string }]}>
                    Try a different sport name.
                  </Text>
                </View>
              )}
            </ScrollView>
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
  section: {
    gap: 8,
  },
  sectionLabel: {
    ...BrandType.micro,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  resultsViewport: {
    maxHeight: 260,
  },
  resultsList: {
    gap: 8,
  },
  resultRow: {
    minHeight: 56,
    borderRadius: BrandRadius.card - 6,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resultTitle: {
    ...BrandType.bodyStrong,
  },
  resultMeta: {
    ...BrandType.micro,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: BrandRadius.card - 6,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    gap: 4,
  },
});
