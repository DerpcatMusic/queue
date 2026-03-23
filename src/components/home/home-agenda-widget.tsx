import type { TFunction } from "i18next";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { HomeSectionHeading, HomeSurface } from "@/components/home/home-dashboard-layout";
import { getRelativeTimeLabel } from "@/components/home/home-shared";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { toSportLabel } from "@/convex/constants";

const TIME_WIDTH = 56;

type AgendaItem = {
  id: string;
  sport: string;
  name: string;
  startTime: number;
  zone: string;
};

type HomeAgendaWidgetProps = {
  items: AgendaItem[];
  palette: BrandPalette;
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
  palette,
  t,
  locale,
  maxItems = 3,
  maxHeight,
  heading,
  emptyLabel,
  onPressAll,
}: HomeAgendaWidgetProps) {
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
        palette={palette}
        style={{
          padding: BrandSpacing.lg,
          gap: 8,
        }}
      >
        <HomeSectionHeading title={heading} palette={palette} />
        <Text
          style={{
            ...BrandType.caption,
            color: palette.textMuted as string,
          }}
        >
          {emptyLabel ?? t("home.agenda.empty")}
        </Text>
      </HomeSurface>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(180).duration(320)}>
      <HomeSurface
        palette={palette}
        style={{
          padding: BrandSpacing.lg,
          gap: 0,
        }}
      >
        <HomeSectionHeading title={heading} palette={palette} />

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
              <Animated.View
                key={item.id}
                entering={FadeInUp.delay(220 + index * 40)
                  .duration(240)
                  .springify()
                  .damping(18)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: BrandSpacing.sm + 2,
                    gap: BrandSpacing.md,
                    borderBottomWidth: index < visibleItems.length - 1 ? 1 : 0,
                    borderBottomColor: (palette.border as string) ?? "rgba(0,0,0,0.06)",
                  }}
                >
                  <View
                    style={{
                      width: TIME_WIDTH,
                      alignItems: "flex-end",
                    }}
                  >
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        color: palette.text as string,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatTime(item.startTime, locale)}
                    </Text>
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: palette.textMuted as string,
                      }}
                    >
                      {isToday ? relativeTime : formatGroupDate(item.startTime, locale)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        color: palette.text as string,
                      }}
                      numberOfLines={1}
                    >
                      {toSportLabel(item.sport as never)}
                    </Text>
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: palette.textMuted as string,
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
                        borderRadius: BrandRadius.icon,
                        backgroundColor: isToday
                          ? (palette.primary as string)
                          : (palette.textMuted as string),
                        opacity: isToday ? 1 : 0.3,
                      }}
                    />
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>

        {onPressAll ? (
          <View
            style={{
              marginTop: 8,
              alignItems: "flex-end",
            }}
          >
            <Text
              style={{
                ...BrandType.caption,
                color: palette.primary as string,
              }}
              onPress={onPressAll}
            >
              {t("home.agenda.viewAll")}
            </Text>
          </View>
        ) : null}
      </HomeSurface>
    </Animated.View>
  );
}
