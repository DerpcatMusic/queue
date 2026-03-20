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
import { I18nManager, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
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
}: {
  title: string;
  rightAccessory?: React.ReactNode;
  onBack: () => void;
}) {
  const palette = useBrand();
  const { t } = useTranslation();

  return (
    <View style={styles.headerRow}>
      <View style={styles.edgeSlot}>
        <IconButton
          size={40}
          tone="secondary"
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          icon={
            <IconSymbol
              name="chevron.right"
              size={20}
              color={String(palette.text)}
              style={{
                transform: [{ rotate: I18nManager.isRTL ? "0deg" : "180deg" }],
              }}
            />
          }
        />
      </View>

      <View style={styles.titleSlot}>
        <ThemedText numberOfLines={1} type="sheetTitle" style={styles.title}>
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
  const collapsedSheetHeight = useCollapsedSheetHeight();
  const isActiveRoute = isProfileSubpageRouteActive(pathname, routeMatchPath);

  useLayoutEffect(() => {
    if (!accessoryContext) {
      return;
    }
    accessoryContext.setAccessory(routeMatchPath, isActiveRoute ? (rightAccessory ?? null) : null);
    return () => {
      accessoryContext.setAccessory(routeMatchPath, null);
    };
  }, [accessoryContext, isActiveRoute, rightAccessory, routeMatchPath]);

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
  const accessoryContext = useContext(ProfileSubpageAccessoryContext);

  const activeRoute = useMemo(
    () =>
      routes.find((route) => isProfileSubpageRouteActive(pathname, route.routeMatchPath)) ?? null,
    [pathname, routes],
  );

  const config = useMemo(() => {
    if (!activeRoute) {
      return null;
    }

    return {
      stickyHeader: (
        <ProfileSubpageSheetHeader
          title={activeRoute.title}
          rightAccessory={accessoryContext?.accessories[activeRoute.routeMatchPath] ?? null}
          onBack={() => router.back()}
        />
      ),
      padding: {
        vertical: BrandSpacing.sm,
        horizontal: BrandSpacing.lg,
      },
      steps: [0.12],
      initialStep: 0,
      draggable: false,
      expandable: false,
      backgroundColor: palette.primary as string,
      topInsetColor: palette.primary as string,
    };
  }, [activeRoute, accessoryContext?.accessories, palette.primary, router]);

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
  topSpacing = BrandSpacing.lg,
  bottomSpacing = BrandSpacing.xl,
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
  topSpacing = BrandSpacing.lg,
  bottomSpacing = BrandSpacing.xl,
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
          paddingHorizontal: 0,
        },
        contentContainerStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  headerRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.sm,
  },
  edgeSlot: {
    minWidth: 40,
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
