import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import {
  getSportGenreKey,
  SPORT_GENRES,
  isSportType,
  SPORT_TYPES,
  toSportLabel,
} from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";

type SportsMultiSelectProps = {
  selectedSports: string[];
  onToggleSport: (sport: string) => void;
  searchPlaceholder: string;
  title: string;
  emptyHint: string;
  defaultOpen?: boolean;
  variant?: "card" | "content";
};

const SPORTS_HEADER_HORIZONTAL_PADDING = BrandSpacing.lg;
const SPORTS_HEADER_VERTICAL_PADDING = BrandSpacing.componentPadding;
const SPORTS_HEADER_BADGE_HORIZONTAL_PADDING = BrandSpacing.sm;
const SPORTS_HEADER_BADGE_VERTICAL_PADDING = BrandSpacing.xs;
const SPORTS_PANEL_HORIZONTAL_PADDING = BrandSpacing.componentPadding;
const SPORTS_PANEL_BOTTOM_PADDING = BrandSpacing.componentPadding;
const SPORTS_PANEL_GAP = BrandSpacing.md;
const SPORTS_SECTION_GAP = BrandSpacing.sm;
const SPORTS_RESULT_ROW_MIN_HEIGHT = BrandSpacing.controlLg + BrandSpacing.xs;
const SPORTS_RESULT_ROW_PADDING_HORIZONTAL = BrandSpacing.md;
const SPORTS_RESULT_ROW_PADDING_VERTICAL = BrandSpacing.md;
const SPORTS_RESULT_ROW_GAP = BrandSpacing.md;
const SPORTS_RESULT_EMPTY_GAP = BrandSpacing.xs;
const SPORTS_SELECTED_SPORT_GAP = BrandSpacing.xs / 2;
const SPORTS_RESULTS_MAX_HEIGHT = 260;
const SPORTS_GENRE_GROUP_GAP = BrandSpacing.md;

export function SportsMultiSelect({
  selectedSports,
  onToggleSport,
  searchPlaceholder,
  title,
  emptyHint,
  defaultOpen = false,
  variant = "card",
}: SportsMultiSelectProps) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const isCardVariant = variant === "card";

  const filteredSports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return SPORT_TYPES;
    }
    return SPORT_TYPES.filter((sport) =>
      toSportLabel(sport).toLowerCase().includes(normalized),
    );
  }, [query]);

  const selectedSportsList = useMemo(
    () => SPORT_TYPES.filter((sport) => selectedSports.includes(sport)),
    [selectedSports],
  );

  const availableSportsList = useMemo(
    () => filteredSports.filter((sport) => !selectedSports.includes(sport)),
    [filteredSports, selectedSports],
  );

  const availableSportGroups = useMemo(
    () =>
      SPORT_GENRES.map((genre) => ({
        key: genre.key,
        label: genre.label,
        sports: availableSportsList.filter(
          (sport) => getSportGenreKey(sport) === genre.key,
        ),
      })).filter((group) => group.sports.length > 0),
    [availableSportsList],
  );

  const panel = (
    <View
      style={[styles.panel, isCardVariant ? null : styles.panelContentOnly]}
    >
      <NativeSearchField
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
      />

      {selectedSportsList.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
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
                    backgroundColor: palette.primarySubtle,
                    transform: [{ scale: pressed ? 0.992 : 1 }],
                  },
                ]}
              >
                <View style={{ flex: 1, gap: SPORTS_SELECTED_SPORT_GAP }}>
                  <Text style={[styles.resultTitle, { color: palette.text }]}>
                    {isSportType(sport) ? toSportLabel(sport) : sport}
                  </Text>
                  <Text style={[styles.resultMeta, { color: palette.primary }]}>
                    {t("profile.sports.selectedBody")}
                  </Text>
                </View>
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={18}
                  color={palette.primary}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
          {query.trim().length > 0
            ? t("profile.sports.matchingLabel")
            : t("profile.sports.allLabel")}
        </Text>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.genreGroupList}
          style={styles.resultsViewport}
        >
          {availableSportGroups.length > 0 ? (
            availableSportGroups.map((group) => (
              <View key={group.key} style={styles.genreGroup}>
                <Text style={[styles.genreLabel, { color: palette.textMuted }]}>
                  {group.label}
                </Text>
                <View style={styles.resultsList}>
                  {group.sports.map((sport) => (
                    <Pressable
                      key={sport}
                      accessibilityRole="button"
                      onPress={() => onToggleSport(sport)}
                      style={({ pressed }) => [
                        styles.resultRow,
                        {
                          backgroundColor: palette.surface,
                          transform: [{ scale: pressed ? 0.992 : 1 }],
                        },
                      ]}
                    >
                      <Text
                        style={[styles.resultTitle, { color: palette.text }]}
                      >
                        {toSportLabel(sport)}
                      </Text>
                      <IconSymbol
                        name="plus.circle.fill"
                        size={18}
                        color={palette.textMuted}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: palette.surfaceElevated },
              ]}
            >
              <Text style={[styles.resultTitle, { color: palette.text }]}>
                {t("profile.sports.emptyTitle")}
              </Text>
              <Text style={[styles.resultMeta, { color: palette.textMuted }]}>
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
    <View style={[styles.shell, { backgroundColor: palette.surfaceElevated }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => setIsOpen((value) => !value)}
        style={({ pressed }) => [
          styles.header,
          { transform: [{ scale: pressed ? 0.992 : 1 }] },
        ]}
      >
        <View style={styles.headerTextBlock}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          <ThemedText type="caption" style={{ color: palette.textMuted }}>
            {selectedSports.length > 0
              ? t("profile.settings.sports.selected", {
                  count: selectedSports.length,
                })
              : emptyHint}
          </ThemedText>
        </View>
        <View
          style={[
            styles.headerBadge,
            {
              backgroundColor: isOpen
                ? palette.primary
                : palette.surfaceElevated,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: "Manrope_500Medium",
              fontSize: 16,
              fontWeight: "500",
              lineHeight: 22,
              color: isOpen ? palette.onPrimary : palette.textMuted,
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
    borderRadius: BrandRadius.soft,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: SPORTS_HEADER_HORIZONTAL_PADDING,
    paddingVertical: SPORTS_HEADER_VERTICAL_PADDING,
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
    paddingHorizontal: SPORTS_HEADER_BADGE_HORIZONTAL_PADDING,
    paddingVertical: SPORTS_HEADER_BADGE_VERTICAL_PADDING,
  },
  panel: {
    paddingHorizontal: SPORTS_PANEL_HORIZONTAL_PADDING,
    paddingBottom: SPORTS_PANEL_BOTTOM_PADDING,
    gap: SPORTS_PANEL_GAP,
  },
  panelContentOnly: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  section: {
    gap: SPORTS_SECTION_GAP,
  },
  sectionLabel: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.2,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  resultsViewport: {
    maxHeight: SPORTS_RESULTS_MAX_HEIGHT,
  },
  resultsList: {
    gap: SPORTS_SECTION_GAP,
  },
  genreGroupList: {
    gap: SPORTS_GENRE_GROUP_GAP,
  },
  genreGroup: {
    gap: SPORTS_SECTION_GAP,
  },
  genreLabel: {
    fontFamily: "Manrope_700Bold",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.24,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  resultRow: {
    minHeight: SPORTS_RESULT_ROW_MIN_HEIGHT,
    borderRadius: BrandRadius.medium,
    borderCurve: "continuous",
    paddingHorizontal: SPORTS_RESULT_ROW_PADDING_HORIZONTAL,
    paddingVertical: SPORTS_RESULT_ROW_PADDING_VERTICAL,
    flexDirection: "row",
    alignItems: "center",
    gap: SPORTS_RESULT_ROW_GAP,
  },
  resultTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  resultMeta: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  emptyState: {
    borderRadius: BrandRadius.medium,
    borderCurve: "continuous",
    paddingHorizontal: SPORTS_RESULT_ROW_PADDING_HORIZONTAL,
    paddingVertical: SPORTS_RESULT_ROW_PADDING_VERTICAL,
    gap: SPORTS_RESULT_EMPTY_GAP,
  },
});
