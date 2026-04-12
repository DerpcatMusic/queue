import type { ComponentProps } from "react";
import { memo } from "react";
import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { SPORT_GENRES } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";
import type { JobStatus } from "@/lib/status-tokens";
import { getJobStatusTokens } from "@/lib/status-tokens";
import { Box, Text } from "@/primitives";

/** Maps sport genre keys to SF Symbol names for sport-specific icons */
const SPORT_GENRE_ICONS: Record<string, ComponentProps<typeof IconSymbol>["name"]> = {
  pilates: "figure.pilates",
  yoga: "figure.yoga",
  barre_flexibility: "figure.flexibility",
  functional_strength: "dumbbell.fill",
  crossfit: "figure.crossfit",
  dance: "figure.dance",
  tennis: "tennis.racket",
  pickup_sports: "sportscourt",
  swimming: "figure.pool.swim",
  racket_sports: "tennis.racket",
  climbing: "figure.climbing",
  mindfulness: "brain.head.profile",
};

/** Returns the icon name for a sport genre key, falling back to a default */
function getSportGenreIcon(
  genreKey: string | undefined | null,
): ComponentProps<typeof IconSymbol>["name"] {
  if (!genreKey) return "flame.fill";
  return SPORT_GENRE_ICONS[genreKey] ?? "flame.fill";
}

/** Returns the first sport's genre icon from a list of sports */
function getFirstSportGenreIcon(
  sports: string[] | undefined,
): ComponentProps<typeof IconSymbol>["name"] {
  if (!sports || sports.length === 0) return "flame.fill";
  const firstSport = sports[0];
  const genreKey = SPORT_GENRES.find((genre) =>
    genre.sports.some((sport) => sport.key === firstSport),
  )?.key;
  return getSportGenreIcon(genreKey);
}

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
        borderRadius: BrandRadius.buttonSubtle,
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
        borderRadius: BrandRadius.buttonSubtle,
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
            : palette.surfaceMuted;
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
  icon: ComponentProps<typeof IconSymbol>["name"];
  done: boolean;
  onPress: () => void;
  /** Optional sports list used to derive sport-specific icon when id === 'sports' */
  sports?: string[];
};

export const HomeChecklistCard = memo(function HomeChecklistCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: HomeChecklistItem[];
}) {
  const { color: palette } = useTheme();
  const completedCount = items.filter((item) => item.done).length;
  const remainingCount = items.length - completedCount;
  const orderedItems = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Box style={{ padding: BrandSpacing.md, gap: BrandSpacing.sm }}>
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
              borderRadius: BrandRadius.buttonSubtle,
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
        {subtitle ? (
          <Text style={{ ...BrandType.caption, color: palette.textMuted }}>{subtitle}</Text>
        ) : null}
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
              backgroundColor: pressed ? palette.surfaceElevated : palette.surfaceMuted,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View style={{ position: "relative" }}>
              <IconSymbol
                name={item.id === "sports" ? getFirstSportGenreIcon(item.sports) : item.icon}
                size={22}
                color={palette.primary}
              />
              {item.done && (
                <View
                  style={{
                    position: "absolute",
                    bottom: -3,
                    right: -3,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: palette.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconSymbol name="checkmark" size={10} color={palette.surface} />
                </View>
              )}
            </View>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  ...BrandType.bodyStrong,
                  color: item.done ? palette.textMuted : palette.text,
                }}
              >
                {item.label}
              </Text>
            </Box>
            <IconSymbol name="chevron.right" size={16} color={palette.textMuted} />
          </Pressable>
        ))}
      </Box>
    </Box>
  );
});
