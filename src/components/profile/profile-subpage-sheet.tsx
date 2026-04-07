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
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import {
  createContentDrivenTopSheetConfig,
  useGlobalTopSheet,
} from "@/components/layout/top-sheet-registry";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { FontFamily } from "@/lib/design-system";

const PROFILE_SUBPAGE_HEADER_SIDE_WIDTH = 44;
const PROFILE_SUBPAGE_HEADER_TITLE_GUTTER = BrandSpacing.md;

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

type ProfileSubpageSheetProviderProps = PropsWithChildren<{
  routes: readonly ProfileSubpageRouteConfig[];
}>;

const ProfileSubpageAccessoryContext = createContext<ProfileSubpageAccessoryContextValue | null>(
  null,
);

function isProfileSubpageRouteActive(pathname: string | null, routeMatchPath: string) {
  if (!pathname) {
    return false;
  }
  // Check if pathname has a role prefix but routeMatchPath doesn't
  // This allows /instructor/profile/sports to match routeMatchPath /profile/sports
  const pathnameHasRolePrefix = /^\/(instructor|studio)\//.test(pathname);
  const routeMatchPathHasRolePrefix = /^\/(instructor|studio)\//.test(routeMatchPath);

  if (pathnameHasRolePrefix && !routeMatchPathHasRolePrefix) {
    const strippedPathname = pathname.replace(/^\/(instructor|studio)\//, "/");
    return strippedPathname === routeMatchPath || strippedPathname.startsWith(`${routeMatchPath}/`);
  }

  return pathname === routeMatchPath || pathname.startsWith(`${routeMatchPath}/`);
}

export function useProfileSubpageSheet({
  title,
  routeMatchPath,
  rightAccessory,
}: ProfileSubpageSheetOptions) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const { i18n } = useTranslation();
  const accessoryContext = useContext(ProfileSubpageAccessoryContext);
  const setAccessory = accessoryContext?.setAccessory;
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const isActiveRoute = isProfileSubpageRouteActive(pathname, routeMatchPath);
  const isHebrew = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he");
  const titleFontFamily = isHebrew ? FontFamily.kanitBold : FontFamily.displayBold;
  const [rightAccessoryWidth, setRightAccessoryWidth] = useState(PROFILE_SUBPAGE_HEADER_SIDE_WIDTH);
  const titleHorizontalInset =
    Math.max(PROFILE_SUBPAGE_HEADER_SIDE_WIDTH, rightAccessoryWidth) +
    PROFILE_SUBPAGE_HEADER_TITLE_GUTTER;

  const handleRightAccessoryLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.max(
      PROFILE_SUBPAGE_HEADER_SIDE_WIDTH,
      Math.ceil(event.nativeEvent.layout.width),
    );
    setRightAccessoryWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  const subpageSheetConfig = useMemo(
    () =>
      isActiveRoute
        ? createContentDrivenTopSheetConfig({
            stickyHeader: (
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderRow}>
                  <View style={styles.sheetHeaderSide("start")}>
                    <IconButton
                      accessibilityLabel="Go back"
                      onPress={() => router.back()}
                      tone="secondary"
                      size={36}
                      icon={<IconSymbol name="chevron.left" size={18} color={theme.color.text} />}
                    />
                  </View>
                  <View
                    pointerEvents="none"
                    style={styles.sheetHeaderTitleSlot(titleHorizontalInset)}
                  >
                    <ThemedText
                      numberOfLines={1}
                      style={[
                        BrandType.title,
                        styles.sheetHeaderTitle(theme.color.text, titleFontFamily),
                      ]}
                    >
                      {title}
                    </ThemedText>
                  </View>
                  <View onLayout={handleRightAccessoryLayout} style={styles.sheetHeaderSide("end")}>
                    {rightAccessory}
                  </View>
                </View>
              </View>
            ),
            padding: {
              vertical: 0,
              horizontal: 0,
            },
            backgroundColor: theme.color.appBg,
            topInsetColor: theme.color.appBg,
          })
        : null,
    [
      isActiveRoute,
      rightAccessory,
      router,
      theme.color.text,
      theme.color.appBg,
      title,
      titleFontFamily,
      titleHorizontalInset,
      handleRightAccessoryLayout,
    ],
  );

  useGlobalTopSheet("profile", subpageSheetConfig, `profile-subpage:${routeMatchPath}`, {
    routeMatchPath,
  });

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

export function ProfileSubpageSheetProvider({
  children,
  routes: _routes,
}: ProfileSubpageSheetProviderProps) {
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
  topSpacing = BrandSpacing.lg,
  bottomSpacing = BrandSpacing.xl,
  topInsetTone = "sheet",
  ...props
}: ProfileSubpageScrollViewProps) {
  return (
    <TabScreenScrollView
      {...props}
      topInsetTone={topInsetTone}
      contentContainerStyle={contentContainerStyle}
      sheetInsets={{ topSpacing, bottomSpacing }}
    />
  );
}

export function ProfileIndexScrollView({
  contentContainerStyle,
  topSpacing = 0,
  bottomSpacing = BrandSpacing.xl,
  topInsetTone = "sheet",
  ...props
}: ProfileSubpageScrollViewProps) {
  return (
    <TabScreenScrollView
      {...props}
      topInsetTone={topInsetTone}
      contentContainerStyle={contentContainerStyle}
      sheetInsets={{ topSpacing, bottomSpacing, horizontalPadding: 0 }}
    />
  );
}

const styles = StyleSheet.create(() => ({
  sheetHeader: {
    paddingHorizontal: BrandSpacing.inset,
    paddingTop: BrandSpacing.sm,
    paddingBottom: BrandSpacing.md,
  },
  sheetHeaderRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  sheetHeaderSide: (side: "start" | "end") => ({
    minWidth: PROFILE_SUBPAGE_HEADER_SIDE_WIDTH,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    ...(side === "start" ? { alignSelf: "flex-start" } : { alignSelf: "flex-end" }),
  }),
  sheetHeaderTitleSlot: (horizontalInset: number) => ({
    position: "absolute",
    left: horizontalInset,
    right: horizontalInset,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  }),
  sheetHeaderTitle: (color: string, fontFamily: string) => ({
    color,
    width: "100%",
    textAlign: "center",
    fontFamily,
    fontWeight: "700",
  }),
}));
