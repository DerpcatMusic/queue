import { type ComponentProps, memo } from "react";
import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ActionButton } from "@/components/ui/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitStatusBadge } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { BorderWidth } from "@/lib/design-system";
import { Box, Text } from "@/primitives";

export type StudioPublishChecklistItem = {
  id: string;
  label: string;
  description?: string;
  icon: ComponentProps<typeof IconSymbol>["name"];
  done: boolean;
  onPress?: () => void;
};

export type StudioPublishChecklistProps = {
  title: string;
  subtitle?: string;
  summary?: string;
  statusLabel: string;
  ready: boolean;
  readyActionLabel: string;
  blockedActionLabel: string;
  onReadyAction: () => void;
  onBlockedAction: () => void;
  items: StudioPublishChecklistItem[];
};

const s = StyleSheet.create((theme) => ({
  card: {
    borderRadius: BrandRadius.soft,
    borderCurve: "continuous",
    borderWidth: BorderWidth.thin,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surfaceElevated,
    padding: BrandSpacing.md,
    gap: BrandSpacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandSpacing.sm,
  },
  subtitle: {
    ...BrandType.caption,
    color: theme.color.textMuted,
  },
  summary: {
    ...BrandType.caption,
    color: theme.color.textMuted,
  },
  items: {
    gap: BrandSpacing.sm,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm,
    padding: BrandSpacing.sm,
    borderRadius: BrandRadius.medium,
    borderCurve: "continuous",
    backgroundColor: theme.color.surfaceMuted,
  },
  itemPressed: {
    opacity: 0.88,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surfaceElevated,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemLabel: {
    ...BrandType.bodyMedium,
    color: theme.color.text,
  },
  itemDescription: {
    ...BrandType.micro,
    color: theme.color.textMuted,
  },
  footer: {
    gap: BrandSpacing.xs,
  },
}));

export const StudioPublishChecklistCard = memo(function StudioPublishChecklistCard({
  title,
  subtitle,
  summary,
  statusLabel,
  ready,
  readyActionLabel,
  blockedActionLabel,
  onReadyAction,
  onBlockedAction,
  items,
}: StudioPublishChecklistProps) {
  const { color: palette } = useTheme();
  const orderedItems = [...items].sort((left, right) => Number(left.done) - Number(right.done));

  return (
    <Box style={s.card}>
      <Box style={s.titleRow}>
        <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
          <Text style={{ ...BrandType.headingItalic, color: palette.primary }}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </Box>
        <KitStatusBadge label={statusLabel} tone={ready ? "success" : "warning"} showDot />
      </Box>

      {summary ? <Text style={s.summary}>{summary}</Text> : null}

      <View style={s.items}>
        {orderedItems.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole={item.onPress ? "button" : "text"}
            accessibilityLabel={item.label}
            onPress={item.onPress}
            disabled={!item.onPress}
            style={({ pressed }) => [s.item, pressed && item.onPress ? s.itemPressed : null]}
          >
            <View style={s.itemIcon}>
              <IconSymbol
                name={item.icon}
                size={17}
                color={item.done ? palette.success : palette.primary}
              />
            </View>
            <Box style={s.itemText}>
              <Text style={s.itemLabel}>{item.label}</Text>
              {item.description ? <Text style={s.itemDescription}>{item.description}</Text> : null}
            </Box>
            <KitStatusBadge
              label={item.done ? "Done" : "Open"}
              tone={item.done ? "success" : "warning"}
              showDot
            />
          </Pressable>
        ))}
      </View>

      <ActionButton
        label={ready ? readyActionLabel : blockedActionLabel}
        fullWidth
        tone={ready ? "primary" : "secondary"}
        onPress={ready ? onReadyAction : onBlockedAction}
      />
    </Box>
  );
});
