import { api } from "@/convex/_generated/api";
import { InstructorZonesMap } from "@/components/maps/instructor-zones-map";
import { LoadingScreen } from "@/components/loading-screen";
import { ThemedText } from "@/components/themed-text";
import { BrandSurface } from "@/components/ui/brand-surface";
import { ExpressiveFab } from "@/components/ui/expressive";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Brand } from "@/constants/brand";
import { ZONE_OPTIONS } from "@/constants/zones";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNativeTabLayout } from "@/hooks/use-native-tab-layout";
import { useMutation, useQuery } from "convex/react";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_ZONES = 25;
const MAX_DROPDOWN_ZONES = 12;
const MAX_PREVIEW_ZONES = 20;
const ZONE_OPTIONS_BY_ID = new Map(
  ZONE_OPTIONS.map((zoneOption) => [zoneOption.id, zoneOption] as const),
);

const MAP_ERROR_TO_TRANSLATION_KEY: Record<string, string> = {
  "At least one zone is required": "mapTab.errors.selectAtLeastOneZone",
  "Invalid zone id": "mapTab.errors.invalidZone",
  "Too many zones selected": "mapTab.errors.tooManyZones",
};

function getMapErrorMessage(message: string, t: (key: string) => string) {
  const mappedKey = MAP_ERROR_TO_TRANSLATION_KEY[message];
  return mappedKey ? t(mappedKey) : message;
}

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme() ?? "light";
  const palette = Brand[colorScheme];
  const insets = useSafeAreaInsets();
  const tabLayout = useNativeTabLayout();
  const language = i18n.resolvedLanguage?.startsWith("he") ? "he" : "en";
  const isRtl = i18n.dir(i18n.resolvedLanguage) === "rtl";
  const isExpoGoNative =
    Platform.OS !== "web" && Constants.appOwnership === "expo";

  const currentUser = useQuery(api.users.getCurrentUser);
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isZoneModeEnabled, setIsZoneModeEnabled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const panelProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!remoteZones || isDirty) return;
    const sanitizedZoneIds = remoteZones.zoneIds.filter((zoneId) =>
      ZONE_OPTIONS_BY_ID.has(zoneId),
    );
    setSelectedZoneIds(sanitizedZoneIds);
    if (sanitizedZoneIds.length !== remoteZones.zoneIds.length) {
      setIsDirty(true);
    }
  }, [isDirty, remoteZones]);

  useEffect(() => {
    Animated.spring(panelProgress, {
      toValue: isZoneModeEnabled ? 1 : 0,
      useNativeDriver: true,
      damping: 19,
      stiffness: 220,
      mass: 0.8,
    }).start();

    if (!isZoneModeEnabled) {
      setIsDropdownOpen(false);
      setIsPanelExpanded(false);
      setZoneSearch("");
    }
  }, [isZoneModeEnabled, panelProgress]);

  const filteredZones = useMemo(() => {
    const query = zoneSearch.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return ZONE_OPTIONS.filter((zone) => {
      const localizedName = zone.label[language].toLowerCase();
      const englishName = zone.label.en.toLowerCase();
      return (
        localizedName.includes(query) ||
        englishName.includes(query) ||
        zone.id.includes(query)
      );
    }).slice(0, 180);
  }, [language, zoneSearch]);

  const selectedSet = useMemo(
    () => new Set(selectedZoneIds),
    [selectedZoneIds],
  );

  const selectedZoneOptions = useMemo(
    () =>
      selectedZoneIds
        .map((zoneId) => ZONE_OPTIONS_BY_ID.get(zoneId))
        .filter((zoneOption): zoneOption is (typeof ZONE_OPTIONS)[number] =>
          Boolean(zoneOption),
        ),
    [selectedZoneIds],
  );

  const orderedDropdownZones = useMemo(() => {
    const query = zoneSearch.trim();
    if (query.length > 0) {
      return filteredZones.slice(0, isPanelExpanded ? 80 : MAX_DROPDOWN_ZONES);
    }

    if (!isPanelExpanded) {
      return [];
    }

    const unselected = ZONE_OPTIONS.filter((zone) => !selectedSet.has(zone.id));
    return [...selectedZoneOptions, ...unselected].slice(0, 120);
  }, [filteredZones, isPanelExpanded, selectedSet, selectedZoneOptions, zoneSearch]);

  const previewZoneIds = useMemo(
    () =>
      isZoneModeEnabled && zoneSearch.trim().length > 0
        ? filteredZones.slice(0, MAX_PREVIEW_ZONES).map((zone) => zone.id)
        : [],
    [filteredZones, isZoneModeEnabled, zoneSearch],
  );

  const panelPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          isZoneModeEnabled &&
          Math.abs(gestureState.dy) > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dy > 24) {
            setIsPanelExpanded(true);
            setIsDropdownOpen(true);
          }
          if (gestureState.dy < -22) {
            setIsPanelExpanded(false);
            if (!zoneSearch.trim()) {
              setIsDropdownOpen(false);
            }
          }
        },
      }),
    [isZoneModeEnabled, zoneSearch],
  );

  if (currentUser === undefined) {
    return <LoadingScreen label={t("mapTab.loading")} />;
  }

  if (currentUser === null) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/" />;
  }

  if (remoteZones === undefined) {
    return <LoadingScreen label={t("mapTab.loading")} />;
  }

  const toggleZone = (zoneId: string) => {
    setErrorMessage(null);
    setSelectedZoneIds((current) => {
      if (current.includes(zoneId)) {
        setIsDirty(true);
        return current.filter((id) => id !== zoneId);
      }
      if (current.length >= MAX_ZONES) {
        setErrorMessage(t("mapTab.errors.tooManyZones"));
        return current;
      }
      setIsDirty(true);
      return [...current, zoneId];
    });
  };

  const getSanitizedSelection = () => {
    return [...new Set(selectedZoneIds.map((zoneId) => zoneId.trim()))].filter(
      (zoneId) => ZONE_OPTIONS_BY_ID.has(zoneId),
    );
  };

  const persistSelection = async () => {
    const zoneIds = getSanitizedSelection();
    if (zoneIds.length !== selectedZoneIds.length) {
      setSelectedZoneIds(zoneIds);
      setIsDirty(true);
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveZones({ zoneIds });
      setIsDirty(false);
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("mapTab.errors.failedToSave");
      setErrorMessage(getMapErrorMessage(message, t));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const closeZoneMode = () => {
    const run = async () => {
      if (isDirty) {
        const ok = await persistSelection();
        if (!ok) return;
      }
      setIsZoneModeEnabled(false);
    };
    void run();
  };

  const panelTranslateY = panelProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0],
  });

  const shouldRenderList =
    isDropdownOpen && (isPanelExpanded || zoneSearch.trim().length > 0);

  return (
    <View style={[styles.screen, { backgroundColor: palette.appBg }]}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <View style={styles.mapWrap}>
        <View
          pointerEvents="none"
          style={[
            styles.topStatusScrim,
            {
              height: insets.top,
              backgroundColor: colorScheme === "dark" ? "#000000" : "#ffffff",
            },
          ]}
        />
        {isExpoGoNative ? (
          <View
            style={[
              styles.expoGoWrap,
              { paddingTop: insets.top, paddingBottom: tabLayout.bottomInset },
            ]}
          >
            <BrandSurface tone="alt">
              <ThemedText type="defaultSemiBold">
                {t("mapTab.devBuildRequiredTitle")}
              </ThemedText>
              <ThemedText style={{ color: palette.textMuted }}>
                {t("mapTab.devBuildRequiredBody")}
              </ThemedText>
            </BrandSurface>
          </View>
        ) : (
          <>
            <InstructorZonesMap
              zoneMode={isZoneModeEnabled}
              selectedZoneIds={selectedZoneIds}
              previewZoneIds={previewZoneIds}
              focusZoneId={null}
              onPressZone={toggleZone}
            />

            <Animated.View
              pointerEvents={isZoneModeEnabled ? "auto" : "none"}
              style={[
                styles.topOverlay,
                {
                  paddingTop: insets.top,
                  opacity: panelProgress,
                  transform: [{ translateY: panelTranslateY }],
                },
              ]}
            >
              <View
                style={[
                  styles.topPanel,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <View style={styles.panelHeader}>
                  <View
                    style={styles.dragHandleWrap}
                    {...panelPanResponder.panHandlers}
                  >
                    <View
                      style={[
                        styles.dragHandle,
                        { backgroundColor: palette.borderStrong },
                      ]}
                    />
                    <ThemedText type="defaultSemiBold" numberOfLines={1}>
                      {t("mapTab.zoneModeOn")}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: palette.textMuted, fontSize: 12 }}>
                    {selectedZoneIds.length}/{MAX_ZONES}
                  </ThemedText>
                </View>

                <View style={styles.searchRow}>
                  <TextInput
                    value={zoneSearch}
                    onChangeText={(value) => {
                      setZoneSearch(value);
                      setIsDropdownOpen(value.trim().length > 0 || isPanelExpanded);
                    }}
                    onFocus={() => {
                      setIsDropdownOpen(zoneSearch.trim().length > 0 || isPanelExpanded);
                    }}
                    placeholder={t("mapTab.searchPlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    style={[
                      styles.searchInput,
                      { borderColor: palette.border, color: palette.text },
                    ]}
                  />
                  <Pressable
                    style={[
                      styles.dropdownToggle,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.surface,
                      },
                    ]}
                    onPress={() => {
                      if (!isPanelExpanded) {
                        setIsPanelExpanded(true);
                        setIsDropdownOpen(true);
                        return;
                      }
                      setIsDropdownOpen((current) => !current);
                    }}
                  >
                    <ThemedText type="defaultSemiBold">
                      {isDropdownOpen ? t("mapTab.hide") : t("mapTab.show")}
                    </ThemedText>
                  </Pressable>
                </View>

                {shouldRenderList ? (
                  <View
                    style={[
                      styles.dropdown,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.surface,
                        maxHeight: isPanelExpanded ? 320 : 180,
                      },
                    ]}
                  >
                    {orderedDropdownZones.length === 0 ? (
                      <ThemedText style={{ color: palette.textMuted }}>
                        {t("mapTab.noMatchingZones")}
                      </ThemedText>
                    ) : (
                      orderedDropdownZones.map((zone) => {
                        const isSelected = selectedZoneIds.includes(zone.id);
                        return (
                          <Pressable
                            key={zone.id}
                            style={[
                              styles.dropdownItem,
                              {
                                borderColor: isSelected
                                  ? palette.primary
                                  : palette.border,
                                backgroundColor: isSelected
                                  ? palette.surfaceAlt
                                  : palette.surface,
                              },
                            ]}
                            onPress={() => {
                              toggleZone(zone.id);
                            }}
                          >
                            <ThemedText type="defaultSemiBold" numberOfLines={1}>
                              {zone.label[language]}
                            </ThemedText>
                            <ThemedText
                              style={{ color: palette.textMuted, fontSize: 12 }}
                              numberOfLines={1}
                            >
                              {zone.id} | {zone.seconds}s
                            </ThemedText>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                ) : (
                  <ThemedText style={{ color: palette.textMuted, fontSize: 12 }}>
                    {t("mapTab.typeToSearchHint")}
                  </ThemedText>
                )}

                {errorMessage ? (
                  <ThemedText style={{ color: palette.danger }} numberOfLines={2}>
                    {errorMessage}
                  </ThemedText>
                ) : null}
              </View>
            </Animated.View>

            <ExpressiveFab
              selected={isZoneModeEnabled}
              disabled={isSaving}
              {...(selectedZoneIds.length > 0
                ? { badgeLabel: String(selectedZoneIds.length) }
                : {})}
              style={[
                styles.selectFab,
                {
                  bottom: tabLayout.bottomOverlayInset,
                  [isRtl ? "left" : "right"]: 16,
                  opacity: isSaving ? 0.72 : 1,
                },
              ]}
              onPress={() => {
                if (isZoneModeEnabled) {
                  closeZoneMode();
                  return;
                }
                setErrorMessage(null);
                setIsZoneModeEnabled(true);
              }}
              icon={
                <IconSymbol
                  name={
                    isZoneModeEnabled
                      ? "checkmark.circle.fill"
                      : "slider.horizontal.3"
                  }
                  size={24}
                  color={isZoneModeEnabled ? palette.onPrimary : palette.text}
                />
              }
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  mapWrap: {
    flex: 1,
  },
  topStatusScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  expoGoWrap: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
  },
  topPanel: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  dragHandleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 28,
  },
  dragHandle: {
    width: 30,
    height: 4,
    borderRadius: 999,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  dropdownToggle: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 8,
    gap: 8,
  },
  dropdownItem: {
    borderWidth: 1,
    borderRadius: 10,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
  },
  selectFab: {
    position: "absolute",
    overflow: "visible",
    zIndex: 12,
  },
});
