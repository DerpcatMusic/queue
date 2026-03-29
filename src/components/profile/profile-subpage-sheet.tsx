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
  View,
  type ViewStyle,
} from "react-native";
import { useCollapsedSheetHeight } from "@/components/layout/scroll-sheet-provider";
import { TabScreenScrollView } from "@/components/layout/tab-screen-scroll-view";
import { useGlobalTopSheet } from "@/components/layout/top-sheet-registry";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
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
  ownerId: string;
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
  const { t } = useTranslation();
  const theme = useTheme();
  const isCustomAccent = Boolean(accentColor);
  const foregroundColor = isCustomAccent
    ? theme.color.onPrimary
    : theme.color.text;

  return (
    <View style={styles.headerRow}>
      <View style={styles.edgeSlot}>
        <IconButton
          size={40}
          tone={isCustomAccent ? "primarySubtle" : "secondary"}
          {...(isCustomAccent
            ? { backgroundColorOverride: theme.color.surface }
            : {})}
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          icon={
            <IconSymbol
              name="chevron.right"
              size={20}
              color={foregroundColor}
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
          style={[
            styles.title,
            isCustomAccent ? { color: foregroundColor } : null,
          ]}
        >
          {title}
        </ThemedText>
      </View>

      <View style={[styles.edgeSlot, styles.edgeSlotEnd]}>
        {rightAccessory ?? null}
      </View>
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
  routes,
  ownerId,
}: ProfileSubpageSheetProviderProps) {
  const [accessories, setAccessories] = useState<
    Record<string, React.ReactNode | null | undefined>
  >({});
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
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

  const activeRoute = useMemo(
    () =>
      routes.find((route) =>
        isProfileSubpageRouteActive(pathname, route.routeMatchPath),
      ) ?? null,
    [pathname, routes],
  );

  const config = useMemo(() => {
    if (!activeRoute) {
      return null;
    }

    const isVerificationRoute =
      activeRoute.routeMatchPath === "/profile/identity-verification" ||
      activeRoute.routeMatchPath === "/profile/compliance";
    const isPaymentsRoute =
      activeRoute.routeMatchPath === "/profile/payments" ||
      activeRoute.routeMatchPath.endsWith("/profile/payments");
    const accentColor = isVerificationRoute
      ? theme.color.tertiary
      : isPaymentsRoute
        ? theme.color.success
        : theme.color.primary;

    return {
      stickyHeader: (
        <ProfileSubpageSheetHeader
          title={activeRoute.title}
          rightAccessory={accessories[activeRoute.routeMatchPath] ?? null}
          onBack={() => router.back()}
          {...(isVerificationRoute || isPaymentsRoute ? { accentColor } : {})}
        />
      ),
      padding: {
        vertical: isVerificationRoute ? 0 : BrandSpacing.sm,
        horizontal: BrandSpacing.lg,
      },
      steps: [0],
      initialStep: 0,
      draggable: false,
      expandable: false,
      collapsedHeightMode: "content" as const,
      backgroundColor: accentColor,
      topInsetColor: accentColor,
    };
  }, [
    activeRoute,
    accessories,
    router,
    theme.color.primary,
    theme.color.success,
    theme.color.tertiary,
  ]);

  useGlobalTopSheet("profile", config, ownerId);

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
