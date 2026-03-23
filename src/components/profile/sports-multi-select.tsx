import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
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
  variant?: "card" | "content";
};

export function SportsMultiSelect({
  palette,
  selectedSports,
  onToggleSport,
  searchPlaceholder,
  title,
  emptyHint,
  defaultOpen = false,
  variant = "card",
}: SportsMultiSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const isCardVariant = variant === "card";

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

  const panel = (
    <View style={[styles.panel, isCardVariant ? null : styles.panelContentOnly]}>
      <NativeSearchField value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
      {selectedSportsList.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted as string }]}>
            {t("profile.sports.selectedLabel")}
          </Text>
          <View style={styles.resultsList}>
            {selectedSportsList.map((sport) => (
              <Pressable
                key={`selected-${sport}`}
                accessibilityRole="button"
                onPress={() => onToggleSport(sport)}
                style={({ pressed }) => [
                  styles.resultRow,
                  {
                    backgroundColor: palette.primarySubtle as string,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.resultTitle, { color: palette.text as string }]}>
                    {isSportType(sport) ? toSportLabel(sport) : sport}
                  </Text>
                  <Text style={[styles.resultMeta, { color: palette.primary as string }]}>
                    {t("profile.sports.selectedBody")}
                  </Text>
                </View>
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={18}
                  color={palette.primary as string}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textMuted as string }]}>
          {query.trim().length > 0
            ? t("profile.sports.matchingLabel")
            : t("profile.sports.allLabel")}
        </Text>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultsList}
          style={styles.resultsViewport}
        >
          {availableSportsList.length > 0 ? (
            availableSportsList.map((sport) => (
              <Pressable
                key={sport}
                accessibilityRole="button"
                onPress={() => onToggleSport(sport)}
                style={({ pressed }) => [
                  styles.resultRow,
                  {
                    backgroundColor: palette.surface as string,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text style={[styles.resultTitle, { color: palette.text as string }]}>
                  {toSportLabel(sport)}
                </Text>
                <IconSymbol name="plus.circle.fill" size={18} color={palette.textMuted as string} />
              </Pressable>
            ))
          ) : (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: palette.surfaceElevated as string,
                },
              ]}
            >
              <Text style={[styles.resultTitle, { color: palette.text as string }]}>
                {t("profile.sports.emptyTitle")}
              </Text>
              <Text style={[styles.resultMeta, { color: palette.textMuted as string }]}>
                {t("profile.sports.emptyBody")}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );

  if (!isCardVariant) {
    return panel;
  }

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: palette.surfaceElevated as string,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => setIsOpen((value) => !value)}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.82 : 1 }]}
      >
        <View style={styles.headerTextBlock}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {selectedSports.length > 0
              ? t("profile.settings.sports.selected", { count: selectedSports.length })
              : emptyHint}
          </ThemedText>
        </View>
        <View
          style={[
            styles.headerBadge,
            {
              backgroundColor: isOpen
                ? (palette.primary as string)
                : (palette.surfaceElevated as string),
            },
          ]}
        >
          <Text
            style={{
              ...BrandType.bodyMedium,
              color: isOpen ? (palette.onPrimary as string) : (palette.textMuted as string),
              includeFontPadding: false,
            }}
          >
            {isOpen ? t("profile.sports.done") : t("profile.sports.edit")}
          </Text>
        </View>
      </Pressable>

      {isOpen ? panel : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: BrandRadius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: BrandSpacing.lg, // 16px
    paddingVertical: BrandSpacing.md + 2, // 14px
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
  },
  headerTextBlock: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  headerBadge: {
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.sm + 2, // 10px
    paddingVertical: BrandSpacing.xs + 2, // 6px
  },
  panel: {
    paddingHorizontal: BrandSpacing.componentPadding, // 14px
    paddingBottom: BrandSpacing.componentPadding, // 14px
    gap: BrandSpacing.md,
  },
  panelContentOnly: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  section: {
    gap: BrandSpacing.sm,
  },
  sectionLabel: {
    ...BrandType.micro,
    letterSpacing: BrandType.micro.letterSpacing,
    textTransform: "uppercase",
  },
  resultsViewport: {
    maxHeight: 260,
  },
  resultsList: {
    gap: BrandSpacing.sm,
  },
  resultRow: {
    minHeight: BrandSpacing.iconContainer + 18, // 56px - touch target friendly
    borderRadius: BrandRadius.cardSubtle, // card - 6 = 18px
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
  },
  resultTitle: {
    ...BrandType.bodyStrong,
  },
  resultMeta: {
    ...BrandType.micro,
  },
  emptyState: {
    borderRadius: BrandRadius.cardSubtle,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    gap: BrandSpacing.xs,
  },
});
