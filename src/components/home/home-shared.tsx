import type { ComponentProps } from "react";
import { Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import type { JobStatus } from "@/lib/status-tokens";
import { getJobStatusTokens } from "@/lib/status-tokens";

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

export function StatusPill({ label, status }: StatusPillProps) {
  const { color: palette } = useTheme();
  const tokens =
    status === "upcoming"
      ? {
          fg: palette.primary,
          bg: palette.primarySubtle,
        }
      : getJobStatusTokens(status, palette);

  return (
    <View
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
    </View>
  );
}

// ─── Jobs-list shared components ──────────────────────────────────────────────

type DotStatusPillProps = {
  backgroundColor: string;
  color: string;
  label: string;
};

/** Colored-dot status pill used in job cards. */
export function DotStatusPill({ backgroundColor, color, label }: DotStatusPillProps) {
  return (
    <View
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
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: BrandRadius.pill,
          backgroundColor: color,
        }}
      />
      <Text
        style={{
          fontFamily: "Manrope_400Regular",
          fontSize: 14,
          fontWeight: "400",
          lineHeight: 19,
          letterSpacing: 0.1,
          color,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

type MetricCellProps = {
  align?: "flex-start" | "flex-end";
  icon?: ComponentProps<typeof IconSymbol>["name"];
  label: string;
  value: string;
};

/** Label + value metric pair used in job cards. */
export function MetricCell({ align = "flex-start", icon, label, value }: MetricCellProps) {
  const { color: palette } = useTheme();
  return (
    <View style={{ gap: BrandSpacing.xs, alignItems: align }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        {icon ? <IconSymbol name={icon} size={12} color={palette.textMuted} /> : null}
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            letterSpacing: 0.1,
            color: palette.textMuted,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        selectable
        style={{
          fontFamily: "Manrope_600SemiBold",
          fontSize: 16,
          fontWeight: "600",
          lineHeight: 18,
          color: palette.text,
          textAlign: align === "flex-end" ? "right" : "left",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

type HomeSignalTileProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "surface" | "accent" | "success" | "warning" | "danger";
  icon?: ComponentProps<typeof IconSymbol>["name"];
};

export function HomeSignalTile({
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
            : palette.surfaceElevated;
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
    <View
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        {icon ? <IconSymbol name={icon} size={13} color={labelColor} /> : null}
        <Text
          style={{
            fontFamily: "Manrope_500Medium",
            fontSize: 12,
            fontWeight: "500",
            letterSpacing: 0.6,
            lineHeight: 16,
            color: labelColor,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: "Lexend_500Medium",
          fontSize: 21,
          fontWeight: "500",
          letterSpacing: -0.24,
          lineHeight: 23,
          color: valueColor,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {detail ? (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: labelColor,
          }}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
