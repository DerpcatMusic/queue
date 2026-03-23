import type { ComponentProps } from "react";
import { Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
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
  palette: BrandPalette;
};

export function StatusPill({ label, status, palette }: StatusPillProps) {
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
        borderRadius: BrandRadius.buttonSubtle,
        borderCurve: "continuous",
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
        gap: BrandSpacing.sm,
        borderRadius: BrandRadius.pill,
        backgroundColor,
        paddingHorizontal: BrandSpacing.sm,
        paddingVertical: BrandSpacing.xs + 2,
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: BrandRadius.icon,
          backgroundColor: color,
        }}
      />
      <Text
        style={{
          ...BrandType.caption,
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
  palette: BrandPalette;
};

/** Label + value metric pair used in job cards. */
export function MetricCell({ align = "flex-start", icon, label, value, palette }: MetricCellProps) {
  return (
    <View style={{ gap: 3, alignItems: align }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        {icon ? <IconSymbol name={icon} size={12} color={palette.textMuted as string} /> : null}
        <Text
          style={{
            ...BrandType.caption,
            letterSpacing: 0.1,
            color: palette.textMuted as string,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        selectable
        style={{
          ...BrandType.bodyStrong,
          fontSize: BrandType.body.fontSize,
          lineHeight: 18,
          color: palette.text as string,
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
  palette: BrandPalette;
  tone?: "surface" | "accent" | "success" | "warning" | "danger";
  icon?: ComponentProps<typeof IconSymbol>["name"];
};

export function HomeSignalTile({
  label,
  value,
  detail,
  palette,
  tone = "surface",
  icon,
}: HomeSignalTileProps) {
  const backgroundColor =
    tone === "accent"
      ? (palette.primarySubtle as string)
      : tone === "success"
        ? (palette.successSubtle as string)
        : tone === "warning"
          ? (palette.warningSubtle as string)
          : tone === "danger"
            ? (palette.dangerSubtle as string)
            : (palette.surfaceElevated as string);
  const labelColor =
    tone === "accent"
      ? (palette.primary as string)
      : tone === "success"
        ? (palette.success as string)
        : tone === "warning"
          ? (palette.warning as string)
          : tone === "danger"
            ? (palette.danger as string)
            : (palette.textMuted as string);
  const valueColor = palette.text as string;

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: BrandRadius.cardSubtle,
        borderCurve: "continuous",
        backgroundColor,
        paddingHorizontal: BrandSpacing.md,
        paddingVertical: BrandSpacing.md - 2,
        gap: 3,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
        {icon ? <IconSymbol name={icon} size={13} color={labelColor} /> : null}
        <Text
          style={{
            ...BrandType.micro,
            color: labelColor,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          ...BrandType.title,
          fontSize: 21,
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
            ...BrandType.caption,
            color: labelColor,
          }}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
