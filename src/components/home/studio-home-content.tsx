import { memo } from "react";
import { Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import type { HomeChecklistItem } from "@/components/home/home-shared";
import { useScrollSheetBindings } from "@/components/layout/scroll-sheet-provider";
import { TabSceneTransition } from "@/components/layout/tab-scene-transition";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SkeletonLine } from "@/components/ui/skeleton";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useContentReveal } from "@/hooks/use-content-reveal";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";

type StudioHomeContentProps = {
  isLoading: boolean;
  setupItems: HomeChecklistItem[];
};

function getItemTone(id: string) {
  switch (id) {
    case "publishing":
      return "primary";
    case "profile":
      return "secondary";
    case "branch":
      return "success";
    default:
      return "primary";
  }
}

function StudioSetupList({
  title,
  items,
}: {
  title: string;
  items: HomeChecklistItem[];
}) {
  const { color: palette } = useTheme();
  const completedCount = items.filter((item) => item.done).length;
  const orderedItems = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Box style={{ gap: BrandSpacing.sm }}>
      <Box style={{ gap: BrandSpacing.xs }}>
        <Box style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: BrandSpacing.sm }}>
          <Text
            style={{
              ...BrandType.headingDisplay,
              color: palette.text,
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
              backgroundColor: palette.primarySubtle,
            }}
          >
            <Text
              style={{
                ...BrandType.micro,
                color: palette.primary,
                fontWeight: "700",
              }}
            >
              {`${completedCount}/${items.length}`}
            </Text>
          </Box>
        </Box>
      </Box>

      <Box style={{ gap: BrandSpacing.sm }}>
        {orderedItems.map((item) => {
          const tone = getItemTone(item.id);
          const iconColor =
            tone === "secondary"
              ? palette.secondary
              : tone === "success"
                ? palette.success
                : palette.primary;
          const iconBg =
            tone === "secondary"
              ? palette.secondarySubtle
              : tone === "success"
                ? palette.successSubtle
                : palette.primarySubtle;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={item.onPress}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.md,
                borderRadius: BrandRadius.card,
                borderCurve: "continuous",
                backgroundColor: pressed ? palette.surface : palette.surfaceElevated,
                borderWidth: 1,
                borderColor: palette.border,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Box
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: item.done ? palette.successSubtle : iconBg,
                }}
              >
                <IconSymbol
                  name={item.done ? "checkmark" : item.icon}
                  size={16}
                  color={item.done ? palette.success : iconColor}
                />
              </Box>
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
          );
        })}
      </Box>
    </Box>
  );
}

function SkeletonStudioHome() {
  const { color: palette } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
      <Box style={{ padding: BrandSpacing.lg, gap: BrandSpacing.sm }}>
        <Box style={{ gap: BrandSpacing.xs }}>
          <Box style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: BrandSpacing.sm }}>
            <SkeletonLine width={110} height={28} />
            <SkeletonLine width={42} height={22} radius={11} />
          </Box>
        </Box>

        <Box style={{ gap: BrandSpacing.sm }}>
          {[1, 2, 3].map((index) => (
            <Box
              key={index}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BrandSpacing.md,
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.md,
                borderRadius: BrandRadius.card,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceElevated,
                borderWidth: 1,
                borderColor: palette.border,
                opacity: index === 1 ? 1 : 0.92,
              }}
            >
              <SkeletonLine width={32} height={32} radius={16} />
              <Box style={{ flex: 1, gap: BrandSpacing.xxs }}>
                <SkeletonLine width="56%" height={16} />
              </Box>
              <SkeletonLine width={16} height={16} radius={8} />
            </Box>
          ))}
        </Box>
      </Box>
    </Animated.View>
  );
}

export function StudioHomeContent({ isLoading, setupItems }: StudioHomeContentProps) {
  const { scrollRef, onScroll } = useScrollSheetBindings();
  const { animatedStyle } = useContentReveal(isLoading);

  if (isLoading) {
    return <SkeletonStudioHome />;
  }

  return (
    <TabSceneTransition>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <Box collapsable={false} style={{ flex: 1 }}>
          <TabScreenScrollView
            animatedRef={scrollRef}
            onScroll={onScroll}
            routeKey="studio/index"
            style={{ flex: 1 }}
            topInsetTone="sheet"
            sheetInsets={{
              topSpacing: BrandSpacing.xl,
              bottomSpacing: BrandSpacing.section,
              horizontalPadding: BrandSpacing.insetRoomy,
            }}
          >
            <Box style={{ paddingTop: BrandSpacing.xs }}>
              <StudioSetupList title="Setup" items={setupItems} />
            </Box>
          </TabScreenScrollView>
        </Box>
      </Animated.View>
    </TabSceneTransition>
  );
}

export default memo(StudioHomeContent);
