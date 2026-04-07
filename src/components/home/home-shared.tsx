import type { ComponentProps } from "react";
import { memo } from "react";
import { Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import type { JobStatus } from "@/lib/status-tokens";
import { getJobStatusTokens } from "@/lib/status-tokens";
import { Box, Text } from "@/primitives";

export const CONTENT_VERTICAL_PADDING = BrandSpacing.lg;

type IntlWithOptionalRelativeTimeFormat = typeof Intl & {
  RelativeTimeFormat?: typeof Intl.RelativeTimeFormat;
};
type RelativeUnit = "minute" | "hour" | "day";

function getRelativeTimeFormatter(locale: string) {
  const ctor = (Intl as IntlWithOptionalRelativeTimeFormat).RelativeTimeFormat;
  if (typeof ctor !== "function") return null;
  try {
    return new ctor(locale, { numeric: "auto" });
  } catch {
    return null;
  }
}

function formatRelativeFallback(targetTime: number, deltaDays: number, locale: string) {
  if (Math.abs(deltaDays) < 1) {
    return new Date(targetTime).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return new Date(targetTime).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export function getRelativeTimeLabel(targetTime: number, now: number, locale: string) {
  const formatter = getRelativeTimeFormatter(locale);
  const deltaMs = targetTime - now;
  const deltaMinutesRaw = deltaMs / (60 * 1000);
  const deltaMinutes =
    deltaMinutesRaw < 0 ? Math.ceil(deltaMinutesRaw) : Math.floor(deltaMinutesRaw);
  const fmt = (value: number, unit: RelativeUnit, deltaDays: number) =>
    formatter?.format(value, unit) ?? formatRelativeFallback(targetTime, deltaDays, locale);

  if (Math.abs(deltaMinutes) < 60) return fmt(deltaMinutes, "minute", deltaMinutes / (60 * 24));

  const deltaHoursRaw = deltaMinutes / 60;
  const deltaHours = deltaHoursRaw < 0 ? Math.ceil(deltaHoursRaw) : Math.floor(deltaHoursRaw);
  if (Math.abs(deltaHours) < 48) return fmt(deltaHours, "hour", deltaHours / 24);

  const deltaDaysRaw = deltaHours / 24;
  const deltaDays = deltaDaysRaw < 0 ? Math.ceil(deltaDaysRaw) : Math.floor(deltaDaysRaw);
  return fmt(deltaDays, "day", deltaDays);
}

type StatusPillProps = {
  label: string;
  status: JobStatus | "upcoming";
};

export const StatusPill = memo(function StatusPill({ label, status }: StatusPillProps) {
  const { color: palette } = useTheme();
  const tokens =
    status === "upcoming"
      ? {
          fg: palette.primary,
          bg: palette.primarySubtle,
        }
      : getJobStatusTokens(status, palette);

  return (
    <Box
      style={{
        borderCurve: "continuous",
        borderRadius: BrandRadius.pill,
        paddingHorizontal: BrandSpacing.sm,
        paddingVertical: BrandSpacing.xs,
        backgroundColor: tokens.bg,
      }}
    >
      <ThemedText type="micro" style={{ color: tokens.fg }}>
        {label}
      </ThemedText>
    </Box>
  );
});

// ─── Jobs-list shared components ──────────────────────────────────────────────

type DotStatusPillProps = {
  backgroundColor: string;
  color: string;
  label: string;
};

/** Colored-dot status pill used in job cards. */
export const DotStatusPill = memo(function DotStatusPill({
  backgroundColor,
  color,
  label,
}: DotStatusPillProps) {
  return (
    <Box
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BrandRadius.pill,
        paddingHorizontal: BrandSpacing.sm,
        paddingVertical: BrandSpacing.xs,
        gap: BrandSpacing.xs,
        backgroundColor,
      }}
    >
      <Box
        style={{
          width: 7,
          height: 7,
          borderRadius: BrandRadius.pill,
          backgroundColor: color,
        }}
      />
      <Text style={{ ...BrandType.caption, letterSpacing: 0.1, color }}>{label}</Text>
    </Box>
  );
});

type MetricCellProps = {
  align?: "flex-start" | "flex-end";
  icon?: ComponentProps<typeof IconSymbol>["name"];
  label: string;
  value: string;
};

/** Label + value metric pair used in job cards. */
export const MetricCell = memo(function MetricCell({
  align = "flex-start",
  icon,
  label,
  value,
}: MetricCellProps) {
  const { color: palette } = useTheme();
  return (
    <Box style={{ gap: BrandSpacing.xs, alignItems: align }}>
      <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        {icon ? <IconSymbol name={icon} size={12} color={palette.textMuted} /> : null}
        <Text
          style={{
            ...BrandType.caption,
            letterSpacing: 0.1,
            color: palette.textMuted,
          }}
        >
          {label}
        </Text>
      </Box>
      <Text
        selectable
        style={{
          ...BrandType.bodyStrong,
          lineHeight: 22,
          color: palette.text,
          textAlign: "auto",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </Box>
  );
});

type HomeSignalTileProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "surface" | "accent" | "success" | "warning" | "danger";
  icon?: ComponentProps<typeof IconSymbol>["name"];
};

export const HomeSignalTile = memo(function HomeSignalTile({
  label,
  value,
  detail,
  tone = "surface",
  icon,
}: HomeSignalTileProps) {
  const { color: palette } = useTheme();
  const backgroundColor =
    tone === "accent"
      ? palette.primarySubtle
      : tone === "success"
        ? palette.successSubtle
        : tone === "warning"
          ? palette.warningSubtle
          : tone === "danger"
            ? palette.dangerSubtle
            : palette.surfaceAlt;
  const labelColor =
    tone === "accent"
      ? palette.primary
      : tone === "success"
        ? palette.success
        : tone === "warning"
          ? palette.warning
          : tone === "danger"
            ? palette.danger
            : palette.textMuted;
  const valueColor = palette.text;

  return (
    <Box
      style={{
        minWidth: 0,
        flex: 1,
        gap: BrandSpacing.xs,
        borderRadius: BrandRadius.medium,
        borderCurve: "continuous",
        paddingHorizontal: BrandSpacing.controlX,
        paddingVertical: BrandSpacing.controlY,
        backgroundColor,
      }}
    >
      <Box style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        {icon ? <IconSymbol name={icon} size={13} color={labelColor} /> : null}
        <Text
          style={{
            ...BrandType.microItalic,
            color: labelColor,
          }}
        >
          {label}
        </Text>
      </Box>
      <Text
        numberOfLines={1}
        style={{
          ...BrandType.headingItalic,
          color: valueColor,
          fontVariant: ["tabular-nums"],
          transform: [{ skewX: "-5deg" }],
        }}
      >
        {value}
      </Text>
      {detail ? (
        <Text
          numberOfLines={1}
          style={{
            ...BrandType.caption,
            color: labelColor,
          }}
        >
          {detail}
        </Text>
      ) : null}
    </Box>
  );
});

export type HomeChecklistItem = {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  onPress: () => void;
};

export const HomeChecklistCard = memo(function HomeChecklistCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: HomeChecklistItem[];
}) {
  const { color: palette } = useTheme();
  const completedCount = items.filter((item) => item.done).length;
  const remainingCount = items.length - completedCount;
  const orderedItems = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Box
      style={{
        borderRadius: BrandRadius.card,
        borderCurve: "continuous",
        backgroundColor: palette.surface,
        padding: BrandSpacing.md,
        gap: BrandSpacing.sm,
      }}
    >
      <Box style={{ gap: BrandSpacing.xs }}>
        <Box
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: BrandSpacing.stack,
          }}
        >
          <Text
            style={{
              ...BrandType.headingItalic,
              fontSize: 14,
              color: palette.primary,
              transform: [{ skewX: "-5deg" }],
            }}
          >
            {title}
          </Text>
          <Box
            style={{
              borderRadius: BrandRadius.pill,
              borderCurve: "continuous",
              paddingHorizontal: BrandSpacing.sm,
              paddingVertical: BrandSpacing.xs,
              backgroundColor:
                remainingCount === 0 ? palette.tertiarySubtle : palette.primarySubtle,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: remainingCount === 0 ? palette.tertiary : palette.primary,
                fontWeight: "600",
              }}
            >
              {`${completedCount}/${items.length}`}
            </Text>
          </Box>
        </Box>
        <Text style={{ ...BrandType.caption, color: palette.textMuted }}>{subtitle}</Text>
      </Box>

      <Box style={{ gap: BrandSpacing.sm }}>
        {orderedItems.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                minWidth: 0,
                borderRadius: BrandRadius.medium,
                borderCurve: "continuous",
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.sm,
                backgroundColor: item.done
                  ? palette.surface
                  : pressed
                    ? palette.surfaceElevated
                    : palette.surfaceAlt,
                borderWidth: 0,
                borderColor: "transparent",
                opacity: pressed ? 0.92 : 1,
              })}
          >
            <Box
              style={{
                width: BrandSpacing.iconContainer,
                height: BrandSpacing.iconContainer,
                borderRadius: BrandRadius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: item.done ? palette.tertiarySubtle : palette.primarySubtle,
              }}
            >
              <IconSymbol
                name={item.done ? "circle.fill" : "circle"}
                size={15}
                color={item.done ? palette.tertiary : palette.primary}
              />
            </Box>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  ...BrandType.bodyStrong,
                  color: palette.text,
                }}
              >
                {item.label}
              </Text>
            </Box>
            {item.done ? null : (
              <IconSymbol name="chevron.right" size={16} color={palette.textMuted} />
            )}
          </Pressable>
        ))}
      </Box>
    </Box>
  );
});
