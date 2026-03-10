import { Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandType } from "@/constants/brand";
import type { JobStatus } from "@/lib/status-tokens";
import { getJobStatusTokens } from "@/lib/status-tokens";

export const CONTENT_VERTICAL_PADDING = 20;

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
      ? { fg: palette.primary, bg: palette.primarySubtle, border: palette.primary }
      : getJobStatusTokens(status, palette);

  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: BrandRadius.pill,
        borderCurve: "continuous",
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: tokens.bg,
        borderColor: tokens.border,
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
        gap: 6,
        borderRadius: 999,
        backgroundColor,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
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
  label: string;
  value: string;
  palette: BrandPalette;
};

/** Label + value metric pair used in job cards. */
export function MetricCell({ align = "flex-start", label, value, palette }: MetricCellProps) {
  return (
    <View style={{ gap: 3, alignItems: align }}>
      <Text
        style={{
          ...BrandType.caption,
          letterSpacing: 0.1,
          color: palette.textMuted as string,
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          ...BrandType.bodyStrong,
          fontSize: 15,
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
