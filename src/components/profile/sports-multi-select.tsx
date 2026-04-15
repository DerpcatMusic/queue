import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

import { Text } from "@/primitives";
import { BrandRadius, BrandSpacing, BrandType, FontFamily } from "@/constants/brand";
import { getSportGenreKey, SPORT_GENRES, SPORT_TYPES } from "@/convex/constants";
import { toSportLabelI18n } from "@/lib/sport-i18n";
import { NativeSearchField } from "@/components/ui/native-search-field";

type SportsMultiSelectProps = {
  selectedSports: string[];
  onToggleSport: (sport: string) => void;
  searchPlaceholder: string;
  title: string;
  emptyHint: string;
  defaultOpen?: boolean;
  variant?: "card" | "content";
  hasUnsavedChanges?: boolean;
};

type GenrePalette = {
  surface: string;
  border: string;
  text: string;
};

export function SportsMultiSelect({
  selectedSports,
  onToggleSport,
  searchPlaceholder,
  title,
  emptyHint,
  defaultOpen = false,
  variant = "card",
  hasUnsavedChanges = false,
}: SportsMultiSelectProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const isCardVariant = variant === "card";

  const selectedSportsList = useMemo(
    () => SPORT_TYPES.filter((sport) => selectedSports.includes(sport)),
    [selectedSports],
  );

  const availableSportsList = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? SPORT_TYPES.filter((sport) => toSportLabelI18n(sport, t).toLowerCase().includes(normalized))
      : SPORT_TYPES;
    return filtered.filter((sport) => !selectedSports.includes(sport));
  }, [query, selectedSports, t]);

  const availableSportGroups = useMemo(
    () =>
      SPORT_GENRES.map((genre) => ({
        key: genre.key,
        label: genre.label,
        sports: availableSportsList.filter((sport) => getSportGenreKey(sport) === genre.key),
      })).filter((group) => group.sports.length > 0),
    [availableSportsList],
  );

  const stickySections = useMemo(() => {
    const nodes: Array<{ key: string; sticky?: boolean; node: ReactNode }> = [];

    nodes.push({
      key: "search",
      sticky: true,
      node: (
        <View style={[styles.stickyBlock, { backgroundColor: theme.color.surface }]}>
          <NativeSearchField
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
          />
          {hasUnsavedChanges ? (
            <View style={[styles.unsavedBadge, { backgroundColor: theme.color.primarySubtle }]}>
              <Text style={[styles.unsavedBadgeText, { color: theme.color.primary }]}>
                {t("profile.sports.stateUnsaved")}
              </Text>
            </View>
          ) : null}
        </View>
      ),
    });

    if (selectedSportsList.length > 0) {
      nodes.push({
        key: "selected",
        sticky: true,
        node: (
          <View style={[styles.stickyBlock, { backgroundColor: theme.color.surface }]}>
            <Text style={[styles.sectionLabel, { color: theme.color.textMuted }]}>
              {t("profile.sports.selectedLabel")}
            </Text>
            <View style={styles.chipGrid}>
              {selectedSportsList.map((sport) => {
                const palette = getPaletteForSport(sport, theme);
                return (
                  <Pressable
                    key={`selected-${sport}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true }}
                    onPress={() => onToggleSport(sport)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        transform: [{ scale: pressed ? 0.992 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: theme.color.text }]}>
                      {toSportLabelI18n(sport, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ),
      });
    }

    if (availableSportGroups.length === 0) {
      nodes.push({
        key: "empty",
        node: (
          <View
            style={[
              styles.emptyState,
              theme.shadow.subtle,
              { backgroundColor: theme.color.surfaceElevated },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.color.text }]}>
              {t("profile.sports.emptyTitle")}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.color.textMuted }]}>
              {t("profile.sports.emptyBody")}
            </Text>
          </View>
        ),
      });
    } else {
      for (const group of availableSportGroups) {
        const palette = getPaletteForGenreKey(group.key, theme);
        nodes.push({
          key: `header-${group.key}`,
          sticky: true,
          node: (
            <View style={[styles.genreHeader, { backgroundColor: theme.color.surface }]}>
              <Text
                style={[BrandType.headingItalic, styles.genreHeaderText, { color: palette.text }]}
              >
                {t(`sports.${group.key}`, { defaultValue: group.label })}
              </Text>
            </View>
          ),
        });

        nodes.push({
          key: `grid-${group.key}`,
          node: (
            <View style={styles.chipGrid}>
              {group.sports.map((sport) => {
                const sportPalette = getPaletteForSport(sport, theme);
                return (
                  <Pressable
                    key={sport}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: false }}
                    onPress={() => onToggleSport(sport)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: sportPalette.surface,
                        borderColor: sportPalette.border,
                        transform: [{ scale: pressed ? 0.992 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: theme.color.text }]}>
                      {toSportLabelI18n(sport, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ),
        });
      }
    }

    const stickyIndices = nodes.flatMap((node, index) => (node.sticky ? [index] : []));

    return {
      children: nodes.map((node) => <View key={node.key}>{node.node}</View>),
      stickyIndices,
    };
  }, [
    availableSportGroups,
    hasUnsavedChanges,
    onToggleSport,
    query,
    searchPlaceholder,
    selectedSportsList,
    t,
    theme,
  ]);

  const content = (
    <View style={styles.panel}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollViewport}
      >
        {stickySections.children}
      </ScrollView>
    </View>
  );

  if (!isCardVariant) {
    return (
      <View style={[styles.contentRoot, { backgroundColor: theme.color.surface }]}>{content}</View>
    );
  }

  return (
    <View
      style={[styles.shell, theme.shadow.subtle, { backgroundColor: theme.color.surfaceElevated }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => setIsOpen((value) => !value)}
        style={({ pressed }) => [styles.header, { transform: [{ scale: pressed ? 0.992 : 1 }] }]}
      >
        <View style={styles.headerTextBlock}>
          <Text style={[styles.headerTitle, { color: theme.color.text }]}>{title}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.color.textMuted }]}>
            {selectedSports.length > 0
              ? t("profile.settings.sports.selected", { count: selectedSports.length })
              : emptyHint}
          </Text>
        </View>
        <View
          style={[
            styles.headerBadge,
            { backgroundColor: isOpen ? theme.color.primary : theme.color.surfaceMuted },
          ]}
        >
          <Text
            style={[
              styles.headerBadgeText,
              { color: isOpen ? theme.color.onPrimary : theme.color.textMuted },
            ]}
          >
            {isOpen ? t("profile.sports.done") : t("profile.sports.edit")}
          </Text>
        </View>
      </Pressable>

      {isOpen ? content : null}
    </View>
  );
}

function getPaletteForGenreKey(
  genreKey: string,
  theme: { sportsGenre: Record<string, GenrePalette> },
) {
  return theme.sportsGenre[genreKey] ?? theme.sportsGenre.performance;
}

function getPaletteForSport(
  sport: string,
  theme: { sportsGenre: Record<string, GenrePalette> },
): GenrePalette {
  const genreKey = getSportGenreKey(sport);
  return genreKey ? getPaletteForGenreKey(genreKey, theme) : theme.sportsGenre.performance;
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: BrandRadius.soft,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.componentPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
  },
  headerTextBlock: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "italic",
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  headerSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  headerBadge: {
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.xs,
  },
  headerBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  contentRoot: {
    flex: 1,
  },
  panel: {
    flex: 1,
    paddingBottom: BrandSpacing.lg,
    minHeight: 0,
  },
  scrollViewport: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    gap: BrandSpacing.md,
    paddingBottom: BrandSpacing.xxl * 2,
  },
  stickyBlock: {
    gap: BrandSpacing.sm,
    paddingBottom: BrandSpacing.sm,
    paddingTop: BrandSpacing.xs,
  },
  unsavedBadge: {
    alignSelf: "flex-start",
    borderRadius: BrandRadius.pill,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.xs,
  },
  unsavedBadgeText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  genreHeader: {
    paddingTop: BrandSpacing.xs,
    paddingBottom: BrandSpacing.xs,
  },
  genreHeaderText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  chip: {
    width: "48%",
    minHeight: 58,
    borderRadius: BrandRadius.medium,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: BrandSpacing.lg,
    paddingVertical: BrandSpacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
    textAlign: "center",
  },
  emptyState: {
    borderRadius: BrandRadius.medium,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.md,
    gap: BrandSpacing.xs,
  },
  emptyTitle: {
    fontFamily: FontFamily.bodyStrong,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  emptyBody: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
});
