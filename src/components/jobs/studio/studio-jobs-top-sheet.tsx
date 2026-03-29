import type { TFunction } from "i18next";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitDisclosureButtonGroup, type KitDisclosureButtonGroupOption } from "@/components/ui/kit";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import type { StudioJobsTimeFilter } from "./use-studio-feed-controller";

type StudioJobsTopSheetHeaderProps = {
  currentFilter: StudioJobsTimeFilter;
  isFilterExpanded: boolean;
  notificationsEnabled: boolean;
  isTogglingNotifications: boolean;
  onChangeFilter: (value: StudioJobsTimeFilter) => void;
  onToggleFilter: () => void;
  onToggleNotifications: () => void;
  t: TFunction;
};

export const StudioJobsTopSheetHeader = memo(function StudioJobsTopSheetHeader({
  currentFilter,
  isFilterExpanded,
  notificationsEnabled,
  isTogglingNotifications,
  onChangeFilter,
  onToggleFilter,
  onToggleNotifications,
  t,
}: StudioJobsTopSheetHeaderProps) {
  const theme = useTheme();
  const filterOptions: readonly KitDisclosureButtonGroupOption<StudioJobsTimeFilter>[] = [
    { value: "all", label: t("jobsTab.studioFeed.filterAllShort") },
    { value: "active", label: t("jobsTab.studioFeed.filterActive") },
    { value: "past", label: t("jobsTab.studioFeed.filterPast") },
  ];

  return (
    <View style={styles.headerRow}>
      <IconButton
        size={42}
        tone="primarySubtle"
        accessibilityLabel={
          notificationsEnabled
            ? t("jobsTab.studioFeed.disableNotifications")
            : t("jobsTab.studioFeed.enableNotifications")
        }
        disabled={isTogglingNotifications}
        onPress={onToggleNotifications}
        icon={
          <IconSymbol
            name={notificationsEnabled ? "bell.fill" : "bell.slash.fill"}
            size={18}
            color={theme.color.onPrimary}
          />
        }
      />

      <KitDisclosureButtonGroup
        accessibilityLabel={t("jobsTab.studioFeed.filterAccessibilityLabel")}
        expanded={isFilterExpanded}
        onToggleExpanded={onToggleFilter}
        showTriggerWhenExpanded={false}
        style={{ flexShrink: 0, minWidth: 0 }}
        options={filterOptions}
        value={currentFilter}
        onChange={onChangeFilter}
        triggerIcon={
          <IconSymbol
            name="line.3.horizontal.decrease.circle"
            size={18}
            color={theme.color.onPrimary}
          />
        }
        size="sm"
        railColor={theme.color.primaryPressed}
        selectedColor={theme.color.primarySubtle}
        labelColor={theme.color.onPrimary}
        selectedLabelColor={theme.color.onPrimary}
        dividerColor={theme.color.primary}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  headerRow: {
    minHeight: BrandSpacing.controlMd,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
    width: "100%",
  },
});
