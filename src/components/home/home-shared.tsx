import { ThemedText } from "@/components/themed-text";
import { KitList, KitListItem } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import type { BrandPalette } from "@/constants/brand";
import { getJobStatusTokens } from "@/lib/status-tokens";
import type { JobStatus } from "@/lib/status-tokens";
import { AppSymbol } from "@/components/ui/app-symbol";
import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

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
  const deltaMinutes = deltaMinutesRaw < 0 ? Math.ceil(deltaMinutesRaw) : Math.floor(deltaMinutesRaw);
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

function formatCount(value: number): string {
  if (value >= 100) return "99+";
  return String(value);
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

type HeroMetricProps = {
  label: string;
  value: number;
  palette: BrandPalette;
};

function HeroMetric({ label, value, palette }: HeroMetricProps) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <ThemedText
        selectable
        style={{
          color: palette.text,
          fontSize: 28,
          lineHeight: 30,
          letterSpacing: -0.4,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatCount(value)}
      </ThemedText>
      <ThemedText type="micro" style={{ color: palette.textMuted }}>
        {label}
      </ThemedText>
    </View>
  );
}

type HeroBlockProps = {
  title: string;
  subtitle: string;
  palette: BrandPalette;
  metrics: { label: string; value: number }[];
};

export function HeroBlock({ title, subtitle, palette, metrics }: HeroBlockProps) {
  return (
    <Animated.View
      entering={FadeInUp.delay(40).duration(360).springify()}
      style={{ paddingHorizontal: BrandSpacing.xs, gap: BrandSpacing.md, paddingTop: 10 }}
    >
      <View style={{ gap: BrandSpacing.xs }}>
        <ThemedText type="micro" style={{ color: palette.textMuted }}>
          {subtitle}
        </ThemedText>
        <ThemedText
          type="heading"
          style={{ fontSize: 34, lineHeight: 38, letterSpacing: -0.4, fontWeight: "600" }}
        >
          {title}
        </ThemedText>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {metrics.map((metric, index) => (
          <View
            key={`${metric.label}-${index}`}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}
          >
            <HeroMetric label={metric.label} value={metric.value} palette={palette} />
            {index < metrics.length - 1 ? (
              <View style={{ width: 1, alignSelf: "stretch", backgroundColor: palette.border }} />
            ) : null}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

type PrimaryActionCardProps = {
  title: string;
  subtitle: string;
  icon: "briefcase.fill" | "calendar.circle.fill";
  onPress: () => void;
  palette: BrandPalette;
};

export function PrimaryActionCard({
  title,
  subtitle,
  icon,
  onPress,
  palette,
}: PrimaryActionCardProps) {
  return (
    <Animated.View entering={FadeInUp.delay(100).duration(360).springify()}>
      <KitList inset>
        <KitListItem
          title={title}
          leading={
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: palette.primarySubtle,
              }}
            >
              <AppSymbol name={icon} tintColor={palette.primary} />
            </View>
          }
          accessory={<AppSymbol name="chevron.right" tintColor={palette.textMuted} />}
          onPress={onPress}
        >
          <ThemedText
            type="caption"
            style={{ color: palette.primary, marginTop: 4, fontWeight: "500" }}
          >
            {subtitle}
          </ThemedText>
        </KitListItem>
      </KitList>
    </Animated.View>
  );
}

