import BottomSheet, {
  type BottomSheetBackgroundProps,
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { Redirect } from "expo-router";
import {
  type RefObject,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { TabOverlayAnchor } from "@/components/layout/tab-overlay-anchor";
import { TabScreenRoot } from "@/components/layout/tab-screen-root";
import { LoadingScreen } from "@/components/loading-screen";
import { QueueMap } from "@/components/maps/queue-map";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitButton, KitPressable } from "@/components/ui/kit";
import { NativeSearchField } from "@/components/ui/native-search-field";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { ZONE_OPTIONS, type ZoneOption } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useBrand } from "@/hooks/use-brand";

const MAX_ZONES = 25;

export default function MapTabScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { overlayBottom, safeTop } = useAppInsets();
  const isFocused = useIsFocused();
  const zoneLanguage = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he") ? "he" : "en";
  const currentUser = useQuery(api.users.getCurrentUser);
  const remoteZones = useQuery(
    api.instructorZones.getMyInstructorZones,
    currentUser?.role === "instructor" ? {} : "skip",
  );
  const saveZones = useMutation(api.instructorZones.setMyInstructorZones);

  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneModeActive, setZoneModeActive] = useState(false);
  const [, setSheetIndex] = useState(-1);
  const [zoneSearch, setZoneSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const zoneSheetRef = useRef<BottomSheet>(null);
  const noopMapPress = useCallback(() => {}, []);
  const handleRecenter = useCallback(() => {
    const nextFocusZoneId = focusZoneId ?? selectedZoneIds[0] ?? remoteZones?.zoneIds?.[0] ?? null;
    if (!nextFocusZoneId) return;
    setFocusZoneId(nextFocusZoneId);
  }, [focusZoneId, remoteZones?.zoneIds, selectedZoneIds]);

  useEffect(() => {
    if (!remoteZones) return;
    setSelectedZoneIds(remoteZones.zoneIds ?? []);
  }, [remoteZones]);

  const toggleZone = useCallback(
    (zoneId: string) => {
      if (Platform.OS === "ios") {
        void Haptics.selectionAsync();
      }
      setSaveError(null);
      setSelectedZoneIds((current) => {
        if (current.includes(zoneId)) {
          const next = current.filter((id) => id !== zoneId);
          if (focusZoneId === zoneId) {
            setFocusZoneId(next[0] ?? null);
          }
          return next;
        }
        if (current.length >= MAX_ZONES) {
          setSaveError(
            t("mapTab.errors.maxZones", {
              max: MAX_ZONES,
              defaultValue: `You can select up to ${String(MAX_ZONES)} zones.`,
            }),
          );
          return current;
        }
        setFocusZoneId(zoneId);
        return [...current, zoneId];
      });
    },
    [focusZoneId, t],
  );

  const persistedZoneIds = remoteZones?.zoneIds ?? [];

  const hasChanges = useMemo(() => {
    if (persistedZoneIds.length !== selectedZoneIds.length) return true;
    const currentSet = new Set(selectedZoneIds);
    return persistedZoneIds.some((id) => !currentSet.has(id));
  }, [persistedZoneIds, selectedZoneIds]);
  const deferredSelectedZoneIds = useDeferredValue(selectedZoneIds);
  const deferredSelectedZoneSet = useMemo(
    () => new Set(deferredSelectedZoneIds),
    [deferredSelectedZoneIds],
  );
  const deferredZoneSearch = useDeferredValue(zoneSearch);
  const filteredZones = useMemo(() => {
    const q = deferredZoneSearch.trim().toLowerCase();
    if (!q) return ZONE_OPTIONS;
    return ZONE_OPTIONS.filter((zone) => {
      const label = zone.label[zoneLanguage].toLowerCase();
      const fallback = zone.label.en.toLowerCase();
      const id = zone.id.toLowerCase();
      return label.includes(q) || fallback.includes(q) || id.includes(q);
    });
  }, [deferredZoneSearch, zoneLanguage]);
  const selectedZones = useMemo(
    () => ZONE_OPTIONS.filter((zone) => deferredSelectedZoneSet.has(zone.id)),
    [deferredSelectedZoneSet],
  );
  const focusedZone = useMemo(
    () => ZONE_OPTIONS.find((zone) => zone.id === focusZoneId) ?? null,
    [focusZoneId],
  );
  const pendingChangeCount = useMemo(() => {
    const persistedSet = new Set(persistedZoneIds);
    const selectedSet = new Set(selectedZoneIds);
    let delta = 0;

    for (const zoneId of selectedSet) {
      if (!persistedSet.has(zoneId)) delta += 1;
    }
    for (const zoneId of persistedSet) {
      if (!selectedSet.has(zoneId)) delta += 1;
    }

    return delta;
  }, [persistedZoneIds, selectedZoneIds]);
  const sheetSnapPoints = useMemo(() => ["24%", "82%"], []);

  const openZoneEditor = useCallback(() => {
    setSaveError(null);
    setZoneModeActive(true);
    setSheetIndex(1);
    zoneSheetRef.current?.snapToIndex(1);
  }, []);

  const handleDiscardChanges = useCallback(() => {
    setSelectedZoneIds(persistedZoneIds);
    setFocusZoneId(persistedZoneIds[0] ?? null);
    setSaveError(null);
    setZoneModeActive(false);
    setSheetIndex(-1);
    setZoneSearch("");
    zoneSheetRef.current?.close();
  }, [persistedZoneIds]);

  const handleSaveZones = useCallback(async () => {
    const nextZoneIds = [...selectedZoneIds];
    const shouldSave = hasChanges;
    if (shouldSave && isSaving) return;

    if (!shouldSave) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveZones({ zoneIds: nextZoneIds });
      setFocusZoneId(nextZoneIds[0] ?? null);
      setZoneModeActive(false);
      setSheetIndex(-1);
      setZoneSearch("");
      zoneSheetRef.current?.close();
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message ? error.message : t("mapTab.errors.failedToSave"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, isSaving, saveZones, selectedZoneIds, t]);

  const backgroundComponent = useCallback(
    ({ style }: BottomSheetBackgroundProps) => (
      <Animated.View style={[style, { backgroundColor: "transparent" }]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderCurve: "continuous",
            },
          ]}
        />
      </Animated.View>
    ),
    [palette],
  );

  if (currentUser === undefined) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Redirect href="/sign-in" />;
  }

  if (currentUser.role !== "instructor") {
    return <Redirect href="/studio" />;
  }

  if (remoteZones === undefined) {
    return <LoadingScreen label={t("mapTab.loading", { defaultValue: "Loading map..." })} />;
  }

  if (Platform.OS === "web") {
    return (
      <TabScreenRoot mode="static" style={{ backgroundColor: palette.surface as string }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 22,
            paddingTop: 22,
            paddingBottom: 22,
            gap: 18,
          }}
        >
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View
              style={{
                flex: 1,
                borderRadius: 30,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceAlt as string,
                paddingHorizontal: 18,
                paddingVertical: 18,
                gap: 6,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.primary as string,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                }}
              >
                Coverage workspace
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 42,
                  lineHeight: 38,
                  letterSpacing: -1,
                  color: palette.text as string,
                }}
              >
                Shape your hiring radius
              </Text>
              <Text style={{ ...BrandType.body, color: palette.textMuted as string }}>
                Desktop mode keeps coverage editing, search, and saving in one command lane.
              </Text>
            </View>

            <View
              style={{
                width: 320,
                borderRadius: 30,
                borderCurve: "continuous",
                backgroundColor: palette.primary as string,
                paddingHorizontal: 18,
                paddingVertical: 18,
                gap: 8,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  opacity: 0.78,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                }}
              >
                Coverage state
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 34,
                  lineHeight: 32,
                  letterSpacing: -0.8,
                  color: palette.onPrimary as string,
                }}
              >
                {hasChanges ? `${String(pendingChangeCount)} staged` : "Live"}
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.onPrimary as string,
                  opacity: 0.86,
                }}
              >
                {hasChanges
                  ? "You have unsaved zone edits ready to publish."
                  : "Coverage is synced and ready to use."}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.14)",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 2,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.onPrimary as string,
                      opacity: 0.72,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    Live zones
                  </Text>
                  <Text
                    style={{
                      ...BrandType.bodyStrong,
                      color: palette.onPrimary as string,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {String(persistedZoneIds.length)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1.25,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.14)",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 2,
                  }}
                >
                  <Text
                    style={{
                      ...BrandType.micro,
                      color: palette.onPrimary as string,
                      opacity: 0.72,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    Focus
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      ...BrandType.bodyStrong,
                      color: palette.onPrimary as string,
                    }}
                  >
                    {focusedZone ? focusedZone.label[zoneLanguage] : "Auto"}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: "auto" }}>
                <KitButton
                  label={isSaving ? "Saving" : "Save coverage"}
                  onPress={() => {
                    void handleSaveZones();
                  }}
                  disabled={!hasChanges || isSaving}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  style={{ backgroundColor: palette.onPrimary as string }}
                />
                <KitButton
                  label="Reset to live"
                  onPress={handleDiscardChanges}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  disabled={!hasChanges || isSaving}
                  style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                />
              </View>
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 0, flexDirection: "row", gap: 18 }}>
            <View
              style={{
                flex: 1.45,
                minWidth: 0,
                borderRadius: 34,
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: palette.surfaceAlt as string,
              }}
            >
              <QueueMap
                mode="zoneSelect"
                pin={null}
                selectedZoneIds={selectedZoneIds}
                focusZoneId={focusZoneId}
                onPressZone={toggleZone}
                onPressMap={noopMapPress}
                onUseGps={handleRecenter}
                showGpsButton={false}
              />
            </View>

            <View
              style={{
                width: 360,
                borderRadius: 34,
                borderCurve: "continuous",
                backgroundColor: palette.surfaceAlt as string,
                paddingHorizontal: 16,
                paddingVertical: 16,
                gap: 14,
              }}
            >
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    ...BrandType.heading,
                    fontSize: 26,
                    color: palette.text as string,
                  }}
                >
                  Coverage command
                </Text>
                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  Search, stage, and trim your live coverage without leaving the map workspace.
                </Text>
              </View>

              <View
                style={{
                  borderRadius: 24,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 18,
                      borderCurve: "continuous",
                      backgroundColor: palette.surfaceAlt as string,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      gap: 2,
                    }}
                  >
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: palette.textMuted as string,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      Pending
                    </Text>
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        color: palette.text as string,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {String(pendingChangeCount)}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 18,
                      borderCurve: "continuous",
                      backgroundColor: palette.surfaceAlt as string,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      gap: 2,
                    }}
                  >
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: palette.textMuted as string,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      Limit
                    </Text>
                    <Text
                      style={{
                        ...BrandType.bodyStrong,
                        color: palette.text as string,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {String(MAX_ZONES - selectedZoneIds.length)} left
                    </Text>
                  </View>
                </View>

                <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                  {focusedZone
                    ? `${focusedZone.label[zoneLanguage]} is pinned as the current focus on the coverage board.`
                    : "Select a zone in the rail to focus it on the coverage board."}
                </Text>
              </View>

              <NativeSearchField
                value={zoneSearch}
                onChangeText={setZoneSearch}
                placeholder={t("mapTab.searchPlaceholder")}
                clearAccessibilityLabel={t("common.clear", { defaultValue: "Clear" })}
              />

              {saveError ? (
                <View
                  style={{
                    borderRadius: 20,
                    borderCurve: "continuous",
                    backgroundColor: palette.dangerSubtle as string,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ ...BrandType.caption, color: palette.danger as string }}>
                    {saveError}
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Live territory
                </Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                >
                  {selectedZones.length === 0 ? (
                    <View
                      style={{
                        borderRadius: 22,
                        borderCurve: "continuous",
                        backgroundColor: palette.surface as string,
                        paddingHorizontal: 14,
                        paddingVertical: 16,
                        gap: 4,
                      }}
                    >
                      <Text style={{ ...BrandType.bodyStrong, color: palette.text as string }}>
                        No territory staged
                      </Text>
                      <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
                        Use search or the coverage board to build your next live territory.
                      </Text>
                    </View>
                  ) : (
                    selectedZones.map((zone) => (
                      <KitPressable
                        key={zone.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setFocusZoneId(zone.id);
                        }}
                        style={{
                          borderRadius: 22,
                          borderCurve: "continuous",
                          backgroundColor:
                            focusZoneId === zone.id
                              ? (palette.primary as string)
                              : (palette.surface as string),
                          paddingHorizontal: 14,
                          paddingVertical: 14,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={{
                                ...BrandType.bodyStrong,
                                color:
                                  focusZoneId === zone.id
                                    ? (palette.onPrimary as string)
                                    : (palette.text as string),
                              }}
                            >
                              {zone.label[zoneLanguage]}
                            </Text>
                            <Text
                              style={{
                                ...BrandType.micro,
                                color:
                                  focusZoneId === zone.id
                                    ? "rgba(255,255,255,0.72)"
                                    : (palette.textMuted as string),
                              }}
                            >
                              {focusZoneId === zone.id ? "Focused on canvas" : "Tap to focus"}
                            </Text>
                          </View>
                          <KitPressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${zone.label[zoneLanguage]}`}
                            onPress={() => toggleZone(zone.id)}
                            style={{
                              borderRadius: 999,
                              backgroundColor:
                                focusZoneId === zone.id
                                  ? "rgba(255,255,255,0.14)"
                                  : (palette.surfaceAlt as string),
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                            }}
                          >
                            <IconSymbol
                              name="minus"
                              size={14}
                              color={
                                focusZoneId === zone.id
                                  ? (palette.onPrimary as string)
                                  : (palette.text as string)
                              }
                            />
                          </KitPressable>
                        </View>
                      </KitPressable>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={{ gap: 10, flex: 1, minHeight: 0 }}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.textMuted as string,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Coverage atlas
                </Text>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                >
                  {filteredZones.map((zone) => {
                    const selected = deferredSelectedZoneSet.has(zone.id);
                    return (
                      <KitPressable
                        key={zone.id}
                        accessibilityRole="button"
                        onPress={() => toggleZone(zone.id)}
                        style={{
                          borderRadius: 20,
                          borderCurve: "continuous",
                          backgroundColor: selected
                            ? (palette.primary as string)
                            : (palette.surface as string),
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <Text
                            style={{
                              ...BrandType.bodyStrong,
                              color: selected
                                ? (palette.onPrimary as string)
                                : (palette.text as string),
                            }}
                          >
                            {zone.label[zoneLanguage]}
                          </Text>
                          <Text
                            style={{
                              ...BrandType.micro,
                              color: selected
                                ? "rgba(255,255,255,0.72)"
                                : (palette.textMuted as string),
                            }}
                          >
                            {selected ? "Live" : "Add"}
                          </Text>
                        </View>
                      </KitPressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </TabScreenRoot>
    );
  }

  return (
    <TabScreenRoot mode="static" style={{ backgroundColor: palette.appBg }}>
      {isFocused ? (
        <>
          <QueueMap
            mode="zoneSelect"
            pin={null}
            selectedZoneIds={selectedZoneIds}
            focusZoneId={focusZoneId}
            {...(zoneModeActive ? { onPressZone: toggleZone } : {})}
            onPressMap={noopMapPress}
            onUseGps={handleRecenter}
            showGpsButton
          />

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: safeTop + 16,
              left: BrandSpacing.lg,
              right: BrandSpacing.lg,
              zIndex: 30,
            }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                maxWidth: 260,
                borderRadius: 24,
                borderCurve: "continuous",
                backgroundColor: zoneModeActive
                  ? (palette.primary as string)
                  : (palette.surface as string),
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 4,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: zoneModeActive
                    ? (palette.onPrimary as string)
                    : (palette.primary as string),
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  opacity: zoneModeActive ? 0.78 : 1,
                }}
              >
                {zoneModeActive ? "Editing coverage" : "Coverage live"}
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 28,
                  lineHeight: 26,
                  letterSpacing: -0.6,
                  color: zoneModeActive ? (palette.onPrimary as string) : (palette.text as string),
                }}
              >
                {String(selectedZoneIds.length)} active zones
              </Text>
              <Text
                style={{
                  ...BrandType.caption,
                  color: zoneModeActive ? "rgba(255,255,255,0.78)" : (palette.textMuted as string),
                }}
              >
                {zoneModeActive
                  ? hasChanges
                    ? `${String(pendingChangeCount)} staged edits ready to save.`
                    : "Tap the map or list to stage coverage changes."
                  : "Open edit mode to add or trim your territory."}
              </Text>
            </View>
          </View>

          {saveError ? (
            <TabOverlayAnchor side="left" offset={BrandSpacing.lg}>
              <View
                style={{
                  maxWidth: 280,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: palette.dangerSubtle,
                }}
              >
                <ThemedText selectable style={{ color: palette.danger }}>
                  {saveError}
                </ThemedText>
              </View>
            </TabOverlayAnchor>
          ) : null}

          <BottomSheet
            ref={zoneSheetRef as RefObject<BottomSheet>}
            index={zoneModeActive ? 1 : -1}
            snapPoints={sheetSnapPoints}
            enablePanDownToClose={false}
            enableContentPanningGesture
            keyboardBehavior="extend"
            android_keyboardInputMode="adjustResize"
            backgroundComponent={backgroundComponent}
            onChange={(index) => {
              if (index < 0) {
                setZoneModeActive(false);
                setSheetIndex(-1);
                setZoneSearch("");
                setSaveError(null);
                return;
              }
              setSheetIndex(index);
            }}
          >
            <View style={styles.sheetContent}>
              <View style={styles.sheetHeader}>
                <ThemedText
                  style={{
                    fontSize: 24,
                    fontWeight: "600",
                    color: palette.text,
                    letterSpacing: -0.2,
                  }}
                >
                  Edit coverage
                </ThemedText>
                <ThemedText
                  style={{
                    marginTop: 4,
                    color: palette.textMuted,
                    fontSize: 13,
                  }}
                >
                  {hasChanges
                    ? `${String(pendingChangeCount)} edits staged across your territory.`
                    : "Choose the zones you want live on the map."}
                </ThemedText>
              </View>
              <View style={styles.searchWrap}>
                <View
                  style={[
                    styles.searchInputShell,
                    {
                      backgroundColor: palette.surfaceAlt,
                    },
                  ]}
                >
                  <IconSymbol name="magnifyingglass" size={16} color={palette.textMuted} />
                  <BottomSheetTextInput
                    value={zoneSearch}
                    onChangeText={setZoneSearch}
                    placeholder={t("mapTab.searchPlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    clearButtonMode="while-editing"
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.searchInput, { color: palette.text }]}
                  />
                  {zoneSearch.length > 0 ? (
                    <KitPressable
                      accessibilityRole="button"
                      accessibilityLabel={t("common.clear", { defaultValue: "Clear" })}
                      hitSlop={8}
                      onPress={() => setZoneSearch("")}
                      rippleRadius={16}
                    >
                      <IconSymbol name="xmark.circle.fill" size={16} color={palette.textMuted} />
                    </KitPressable>
                  ) : null}
                </View>
              </View>
              {saveError ? (
                <ThemedText selectable style={{ color: palette.danger, paddingHorizontal: 24 }}>
                  {saveError}
                </ThemedText>
              ) : null}
              <BottomSheetFlatList<ZoneOption>
                data={filteredZones}
                keyExtractor={(item: ZoneOption) => item.id}
                contentContainerStyle={styles.zoneListContent}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews
                initialNumToRender={20}
                maxToRenderPerBatch={28}
                windowSize={9}
                updateCellsBatchingPeriod={16}
                renderItem={({ item }: { item: ZoneOption }) => {
                  const selected = deferredSelectedZoneSet.has(item.id);
                  return (
                    <KitPressable
                      onPress={() => toggleZone(item.id)}
                      style={[
                        styles.zoneRow,
                        {
                          backgroundColor: selected ? palette.primary : palette.surfaceAlt,
                        },
                      ]}
                    >
                      <ThemedText
                        numberOfLines={1}
                        style={{
                          color: selected ? palette.onPrimary : palette.text,
                          fontSize: 15,
                          fontWeight: "500",
                          letterSpacing: -0.1,
                        }}
                      >
                        {item.label[zoneLanguage]}
                      </ThemedText>
                      <ThemedText
                        style={{
                          color: selected ? "rgba(255,255,255,0.72)" : palette.textMuted,
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: 0.7,
                        }}
                      >
                        {selected ? "Live" : "Add"}
                      </ThemedText>
                    </KitPressable>
                  );
                }}
              />
            </View>
          </BottomSheet>

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: BrandSpacing.lg,
              right: BrandSpacing.lg,
              bottom: overlayBottom,
              zIndex: 30,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              {zoneModeActive ? (
                <>
                  <KitButton
                    label="Cancel"
                    onPress={handleDiscardChanges}
                    disabled={isSaving}
                    variant="secondary"
                    fullWidth={false}
                    leadingIcon={<IconSymbol name="xmark" size={16} color={palette.text} />}
                    style={{ backgroundColor: palette.surface as string }}
                  />
                  <KitButton
                    label={isSaving ? "Saving" : "Save coverage"}
                    onPress={() => {
                      void handleSaveZones();
                    }}
                    disabled={!hasChanges || isSaving}
                    fullWidth={false}
                    leadingIcon={
                      <IconSymbol name="checkmark" size={16} color={palette.onPrimary} />
                    }
                  />
                </>
              ) : (
                <KitButton
                  label="Edit coverage"
                  onPress={openZoneEditor}
                  fullWidth={false}
                  leadingIcon={
                    <IconSymbol name="slider.horizontal.3" size={16} color={palette.onPrimary} />
                  }
                />
              )}
            </View>
          </View>
        </>
      ) : null}
    </TabScreenRoot>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
    paddingTop: 16,
  },
  sheetHeader: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  searchInputShell: {
    minHeight: 44,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    fontSize: 16,
  },
  zoneListContent: {
    paddingBottom: 48,
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 18,
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
