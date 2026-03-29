import { usePathname } from "expo-router";
import { useRouter } from "expo-router";
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
import { type StyleProp, type ViewStyle, View } from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import {
  createContentDrivenTopSheetConfig,
  useGlobalTopSheet,
} from "@/components/layout/top-sheet-registry";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandType } from "@/constants/brand";
import { BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";

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
  setAccessory: (
    routeMatchPath: string,
    accessory: React.ReactNode | null,
  ) => void;
};

type ProfileSubpageSheetProviderProps = PropsWithChildren<{
  routes: readonly ProfileSubpageRouteConfig[];
}>;

const ProfileSubpageAccessoryContext =
  createContext<ProfileSubpageAccessoryContextValue | null>(null);

function isProfileSubpageRouteActive(
  pathname: string | null,
  routeMatchPath: string,
) {
  if (!pathname) {
    return false;
  }
  return pathname === routeMatchPath || pathname.endsWith(routeMatchPath);
}

export function useProfileSubpageSheet({
  title,
  routeMatchPath,
  rightAccessory,
}: ProfileSubpageSheetOptions) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const accessoryContext = useContext(ProfileSubpageAccessoryContext);
  const setAccessory = accessoryContext?.setAccessory;
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const isActiveRoute = isProfileSubpageRouteActive(pathname, routeMatchPath);

  const subpageSheetConfig = useMemo(
    () =>
      isActiveRoute
        ? createContentDrivenTopSheetConfig({
            stickyHeader: (
              <View
                style={{
                  paddingHorizontal: BrandSpacing.inset,
                  paddingTop: BrandSpacing.sm,
                  paddingBottom: BrandSpacing.md,
                  gap: BrandSpacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: BrandSpacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: BrandSpacing.sm,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <IconButton
                      accessibilityLabel="Go back"
                      onPress={() => router.back()}
                      tone="secondary"
                      size={36}
                      icon={
                        <IconSymbol
                          name="chevron.left"
                          size={18}
                          color={theme.color.onPrimary}
                        />
                      }
                    />
                    <ThemedText
                      numberOfLines={1}
                      style={[
                        BrandType.title,
                        {
                          color: theme.color.onPrimary,
                          flexShrink: 1,
                        },
                      ]}
                    >
                      {title}
                    </ThemedText>
                  </View>
                  {rightAccessory ? <View>{rightAccessory}</View> : null}
                </View>
              </View>
            ),
            padding: {
              vertical: 0,
              horizontal: 0,
            },
            backgroundColor: theme.color.tertiary,
            topInsetColor: theme.color.tertiary,
          })
        : null,
    [isActiveRoute, rightAccessory, router, theme.color.onPrimary, theme.color.tertiary, title],
  );

  useGlobalTopSheet("profile", subpageSheetConfig, `profile-subpage:${routeMatchPath}`);

  useLayoutEffect(() => {
    if (!setAccessory) {
      return;
    }
    setAccessory(
      routeMatchPath,
      isActiveRoute ? (rightAccessory ?? null) : null,
    );
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
  const setAccessory = useCallback(
    (routeMatchPath: string, accessory: React.ReactNode | null) => {
      setAccessories((current) => {
        if (current[routeMatchPath] === accessory) {
          return current;
        }
        return {
          ...current,
          [routeMatchPath]: accessory,
        };
      });
    },
    [],
  );

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
  ...props
}: ProfileSubpageScrollViewProps) {
  return (
    <TabScreenScrollView
      {...props}
      contentContainerStyle={contentContainerStyle}
      sheetInsets={{ topSpacing, bottomSpacing }}
    />
  );
}

export function ProfileIndexScrollView({
  contentContainerStyle,
  topSpacing = BrandSpacing.lg,
  bottomSpacing = BrandSpacing.xl,
  ...props
}: ProfileSubpageScrollViewProps) {
  return (
    <TabScreenScrollView
      {...props}
      contentContainerStyle={contentContainerStyle}
      sheetInsets={{ topSpacing, bottomSpacing, horizontalPadding: 0 }}
    />
  );
}
