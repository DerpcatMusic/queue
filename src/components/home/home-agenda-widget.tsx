import type { TFunction } from "i18next";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { HomeSectionHeading, HomeSurface } from "@/components/home/home-dashboard-layout";
import { getRelativeTimeLabel } from "@/components/home/home-shared";
import { BrandSpacing } from "@/constants/brand";
import { toSportLabel } from "@/convex/constants";
import { useTheme } from "@/hooks/use-theme";

type AgendaItem = {
  id: string;
  sport: string;
  name: string;
  startTime: number;
  zone: string;
};

type HomeAgendaWidgetProps = {
  items: AgendaItem[];
  t: TFunction;
  locale: string;
  maxItems?: number;
  maxHeight?: number;
  heading: string;
  emptyLabel?: string;
  onPressAll?: () => void;
};

const GROUP_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

function formatGroupDate(epochMs: number, locale: string): string {
  return new Date(epochMs).toLocaleDateString(locale, GROUP_DATE_FORMAT);
}

function formatTime(epochMs: number, locale: string): string {
  return new Date(epochMs).toLocaleTimeString(locale, TIME_FORMAT);
}

export function HomeAgendaWidget({
  items,
  t,
  locale,
  maxItems = 3,
  maxHeight,
  heading,
  emptyLabel,
  onPressAll,
}: HomeAgendaWidgetProps) {
  const { color: palette } = useTheme();
  const now = useMemo(() => Date.now(), []);

  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, []);

  const sorted = useMemo(() => items.slice().sort((a, b) => a.startTime - b.startTime), [items]);

  const todayItems = useMemo(
    () => sorted.filter((s) => s.startTime <= todayEnd),
    [sorted, todayEnd],
  );

  const upcomingItems = useMemo(
    () => sorted.filter((s) => s.startTime > todayEnd).slice(0, maxItems),
    [sorted, todayEnd, maxItems],
  );

  const visibleItems = useMemo(() => {
    const combined = [...todayItems, ...upcomingItems];
    return combined.slice(0, maxItems);
  }, [todayItems, upcomingItems, maxItems]);

  if (visibleItems.length === 0) {
    return (
      <HomeSurface
        style={{
          padding: BrandSpacing.lg,
          gap: BrandSpacing.sm,
        }}
      >
        <HomeSectionHeading title={heading} />
        <Text
          style={{
            fontFamily: "Manrope_400Regular",
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 19,
            color: palette.textMuted,
          }}
        >
          {emptyLabel ?? t("home.agenda.empty")}
        </Text>
      </HomeSurface>
    );
  }

  return (
    <View>
      <HomeSurface
        style={{
          padding: BrandSpacing.lg,
          gap: 0,
        }}
      >
        <HomeSectionHeading title={heading} />

        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={maxHeight ? { maxHeight } : undefined}
          contentContainerStyle={{ gap: 0 }}
        >
          {visibleItems.map((item, index) => {
            const isToday = item.startTime <= todayEnd;
            const relativeTime = getRelativeTimeLabel(item.startTime, now, locale);

            return (
              <View key={item.id}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: BrandSpacing.sm,
                    gap: BrandSpacing.md,
                    borderBottomWidth: index < visibleItems.length - 1 ? 1 : 0,
                    borderBottomColor: palette.border,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      alignItems: "flex-end",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Lexend_600SemiBold",
                        fontSize: 15,
                        fontWeight: "600",
                        lineHeight: 18,
                        color: palette.text,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatTime(item.startTime, locale)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope_400Regular",
                        fontSize: 10,
                        fontWeight: "400",
                        lineHeight: 14,
                        color: palette.textMuted,
                      }}
                    >
                      {isToday ? relativeTime : formatGroupDate(item.startTime, locale)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 15,
                        fontWeight: "600",
                        lineHeight: 22,
                        color: palette.text,
                      }}
                      numberOfLines={1}
                    >
                      {toSportLabel(item.sport as never)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope_400Regular",
                        fontSize: 14,
                        fontWeight: "400",
                        lineHeight: 19,
                        color: palette.textMuted,
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 20,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: isToday ? palette.primary : palette.textMicro,
                      }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {onPressAll ? (
          <View
            style={{
              marginTop: BrandSpacing.sm,
              alignItems: "flex-end",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_400Regular",
                fontSize: 13,
                fontWeight: "400",
                lineHeight: 18,
                color: palette.primary,
              }}
              onPress={onPressAll}
            >
              {t("home.agenda.viewAll")}
            </Text>
          </View>
        ) : null}
      </HomeSurface>
    </View>
  );
}
