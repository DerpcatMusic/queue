import { usePathname, useRouter } from "expo-router";
import {
  type ComponentProps,
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  I18nManager,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { getTopSheetAvailableHeight } from "@/components/layout/top-sheet.helpers";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { useMeasuredContentHeight } from "@/components/layout/use-measured-content-height";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing } from "@/constants/brand";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";

type ProfileSubpageSheetOptions = {
  title: string;
  routeMatchPath: string;
  rightAccessory?: React.ReactNode;
};

export type ProfileSubpageRouteConfig = {
  routeMatchPath: string;
  title: string;
};

type ProfileSubpageAccessoryContextValue = {
  accessories: Record<string, React.ReactNode | null | undefined>;
  setAccessory: (routeMatchPath: string, accessory: React.ReactNode | null) => void;
};

const ProfileSubpageAccessoryContext = createContext<ProfileSubpageAccessoryContextValue | null>(
  null,
);

const PROFILE_SUBPAGE_HEADER_HEIGHT = BrandSpacing.controlMd;
const PROFILE_SUBPAGE_EDGE_SLOT_MIN_WIDTH = BrandSpacing.controlMd - BrandSpacing.xs;
const PROFILE_SUBPAGE_SCROLL_TOP_SPACING = BrandSpacing.inset;
const PROFILE_SUBPAGE_SCROLL_BOTTOM_SPACING = BrandSpacing.insetRoomy;

function isProfileSubpageRouteActive(pathname: string | null, routeMatchPath: string) {
  if (!pathname) {
    return false;
  }
  return pathname === routeMatchPath || pathname.endsWith(routeMatchPath);
}

function ProfileSubpageSheetHeader({
  title,
  rightAccessory,
  onBack,
  accentColor,
}: {
  title: string;
  rightAccessory?: React.ReactNode;
  onBack: () => void;
  accentColor?: string;
}) {
  const palette = useBrand();
  const { t } = useTranslation();
  const isCustomAccent = Boolean(accentColor);
  const foregroundColor = isCustomAccent ? String(palette.onPrimary) : String(palette.text);

  return (
    <View
      className="flex-row items-center justify-between gap-sm"
      style={{ minHeight: PROFILE_SUBPAGE_HEADER_HEIGHT }}
    >
      <View style={styles.edgeSlot}>
        <IconButton
          size={PROFILE_SUBPAGE_EDGE_SLOT_MIN_WIDTH}
          tone={isCustomAccent ? "primarySubtle" : "secondary"}
          {...(isCustomAccent ? { backgroundColorOverride: String(palette.onPrimary) } : {})}
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          icon={
            <IconSymbol
              name="chevron.right"
              size={20}
              color={isCustomAccent ? String(accentColor) : foregroundColor}
              style={{
                transform: [{ rotate: I18nManager.isRTL ? "0deg" : "180deg" }],
              }}
            />
          }
        />
      </View>

      <View style={styles.titleSlot}>
        <ThemedText
          numberOfLines={1}
          type="sheetTitle"
          style={[styles.title, isCustomAccent ? { color: foregroundColor } : null]}
        >
          {title}
        </ThemedText>
      </View>

      <View style={[styles.edgeSlot, styles.edgeSlotEnd]}>{rightAccessory ?? null}</View>
    </View>
  );
}

export function useProfileSubpageSheet({
  title,
  routeMatchPath,
  rightAccessory,
}: ProfileSubpageSheetOptions) {
  const pathname = usePathname();
  const accessoryContext = useContext(ProfileSubpageAccessoryContext);
  const setAccessory = accessoryContext?.setAccessory;
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const isActiveRoute = isProfileSubpageRouteActive(pathname, routeMatchPath);

  useLayoutEffect(() => {
    if (!setAccessory) {
      return;
    }
    setAccessory(routeMatchPath, isActiveRoute ? (rightAccessory ?? null) : null);
    return () => {
      setAccessory(routeMatchPath, null);
    };
  }, [isActiveRoute, rightAccessory, routeMatchPath, setAccessory]);

  void title;

  return collapsedSheetHeight;
}

export function ProfileSubpageSheetProvider({ children }: PropsWithChildren) {
  const [accessories, setAccessories] = useState<
    Record<string, React.ReactNode | null | undefined>
  >({});
  const setAccessory = useCallback((routeMatchPath: string, accessory: React.ReactNode | null) => {
    setAccessories((current) => {
      if (current[routeMatchPath] === accessory) {
        return current;
      }
      return {
        ...current,
        [routeMatchPath]: accessory,
      };
    });
  }, []);

  const value = useMemo<ProfileSubpageAccessoryContextValue>(
    () => ({
      accessories,
      setAccessory,
    }),
    [accessories, setAccessory],
  );

  return (
    <ProfileSubpageAccessoryContext.Provider value={value}>
      {children}
    </ProfileSubpageAccessoryContext.Provider>
  );
}

export function ProfileSubpageSheetHost({
  routes,
  ownerId,
}: {
  routes: readonly ProfileSubpageRouteConfig[];
  ownerId: string;
}) {
  const palette = useBrand();
  const router = useRouter();
  const pathname = usePathname();
  const { safeBottom, safeTop } = useAppInsets();
  const { height: screenHeight } = useWindowDimensions();
  const accessoryContext = useContext(ProfileSubpageAccessoryContext);
  const { measuredHeight: headerMeasuredHeight, onLayout: onHeaderLayout } =
    useMeasuredContentHeight();

  const activeRoute = useMemo(
    () =>
      routes.find((route) => isProfileSubpageRouteActive(pathname, route.routeMatchPath)) ?? null,
    [pathname, routes],
  );

  const config = useMemo(() => {
    if (!activeRoute) {
      return null;
    }

    const isDiditRoute = activeRoute.routeMatchPath === "/profile/identity-verification";
    const isPaymentsRoute =
      activeRoute.routeMatchPath === "/profile/payments" ||
      activeRoute.routeMatchPath.endsWith("/profile/payments");
    const accentColor = isDiditRoute
      ? palette.didit.accent
      : isPaymentsRoute
        ? palette.payments.accent
        : (palette.primary as string);

    return {
      stickyHeader: (
        <View onLayout={onHeaderLayout}>
          <ProfileSubpageSheetHeader
            title={activeRoute.title}
            rightAccessory={accessoryContext?.accessories[activeRoute.routeMatchPath] ?? null}
            onBack={() => router.back()}
            {...(isDiditRoute || isPaymentsRoute ? { accentColor } : {})}
          />
        </View>
      ),
      padding: {
        vertical: BrandSpacing.stackTight,
        horizontal: BrandSpacing.inset,
      },
      steps: [
        Math.max(
          0.12,
          (safeTop +
            (headerMeasuredHeight > 0 ? headerMeasuredHeight : PROFILE_SUBPAGE_HEADER_HEIGHT) +
            BrandSpacing.stackTight * 2) /
            Math.max(1, getTopSheetAvailableHeight(screenHeight, safeTop, safeBottom)),
        ),
      ],
      initialStep: 0,
      draggable: false,
      expandable: false,
      backgroundColor: accentColor,
      topInsetColor: accentColor,
    };
  }, [
    activeRoute,
    accessoryContext?.accessories,
    headerMeasuredHeight,
    onHeaderLayout,
    palette.primary,
    palette.didit.accent,
    palette.payments.accent,
    router,
    safeBottom,
    safeTop,
    screenHeight,
  ]);

  useGlobalTopSheet("profile", config, ownerId);

  return null;
}

type ProfileSubpageScrollViewProps = Omit<
  ComponentProps<typeof TabScreenScrollView>,
  "contentContainerStyle"
> & {
  contentContainerStyle?: StyleProp<ViewStyle>;
  topSpacing?: number;
  bottomSpacing?: number;
};

export function ProfileSubpageScrollView({
  contentContainerStyle,
  topSpacing = PROFILE_SUBPAGE_SCROLL_TOP_SPACING,
  bottomSpacing = PROFILE_SUBPAGE_SCROLL_BOTTOM_SPACING,
  ...props
}: ProfileSubpageScrollViewProps) {
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const { safeBottom } = useAppInsets();

  return (
    <TabScreenScrollView
      {...props}
      contentContainerStyle={[
        {
          paddingTop: collapsedSheetHeight + topSpacing,
          paddingBottom: bottomSpacing + safeBottom,
        },
        contentContainerStyle,
      ]}
    />
  );
}

export function ProfileIndexScrollView({
  contentContainerStyle,
  topSpacing = PROFILE_SUBPAGE_SCROLL_TOP_SPACING,
  bottomSpacing = PROFILE_SUBPAGE_SCROLL_BOTTOM_SPACING,
  ...props
}: ProfileSubpageScrollViewProps) {
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const { safeBottom } = useAppInsets();

  return (
    <TabScreenScrollView
      {...props}
      contentContainerStyle={[
        {
          paddingTop: collapsedSheetHeight + topSpacing,
          paddingBottom: bottomSpacing + safeBottom,
        },
        contentContainerStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  edgeSlot: {
    minWidth: PROFILE_SUBPAGE_EDGE_SLOT_MIN_WIDTH,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  edgeSlotEnd: {
    alignItems: "flex-end",
  },
  titleSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  title: {
    textAlign: "center",
  },
});
