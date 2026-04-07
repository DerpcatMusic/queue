import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Text } from "@/primitives";
import type { QueueMapProps } from "./queue-map.types";
import { buildCoverageNodes, getResponseLabel, getZone } from "./queue-map.web.helpers";

export function QueueMap(props: QueueMapProps) {
  const { t, i18n } = useTranslation();
  const { color: palette } = useTheme();
  const zoneLanguage = (i18n.resolvedLanguage ?? "en").toLowerCase().startsWith("he") ? "he" : "en";
  const responseLabels = useMemo(
    () => ({
      instant: t("mapTab.web.instant"),
      thirtySeconds: t("mapTab.web.thirtySeconds"),
      oneMinute: t("mapTab.web.oneMinute"),
      ninetySeconds: t("mapTab.web.ninetySeconds"),
    }),
    [t],
  );
  const selectedCount = props.selectedZoneIds.length;
  const coverageNodes = useMemo(
    () => buildCoverageNodes(props.selectedZoneIds, props.focusZoneId),
    [props.focusZoneId, props.selectedZoneIds],
  );
  const focusedZone = useMemo(
    () => (props.focusZoneId ? (getZone(props.focusZoneId) ?? null) : null),
    [props.focusZoneId],
  );
  const selectedPreview = coverageNodes.filter((node) => node.selected).slice(0, 4);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surfaceAlt,
        padding: BrandSpacing.insetComfort,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: BrandRadius.mapOverlay,
          borderCurve: "continuous",
          backgroundColor: palette.surface,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "space-between",
            padding: BrandSpacing.insetRoomy,
            backgroundColor: palette.surfaceAlt,
          }}
        >
          <View style={{ gap: 18 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: BrandSpacing.md,
              }}
            >
              <View style={{ gap: BrandSpacing.xs, flex: 1 }}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.primary,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("mapTab.web.workspaceEyebrow")}
                </Text>
                <Text
                  style={{
                    ...BrandType.hero,
                    color: palette.text,
                  }}
                >
                  {t("mapTab.web.workspaceTitle")}
                </Text>
              </View>

              <View
                style={{
                  width: BrandSpacing.avatarXl,
                  height: BrandSpacing.avatarXl,
                  borderRadius: BrandRadius.mapMarker,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.primary,
                }}
              >
                <AppSymbol name="map.fill" size={24} tintColor={palette.onPrimary} />
              </View>
            </View>

            <Text
              style={{
                ...BrandType.body,
                color: palette.textMuted,
                maxWidth: 560,
              }}
            >
              {t("mapTab.web.workspaceBody")}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              minHeight: BrandSpacing.mapCanvasMinHeight,
              borderRadius: BrandRadius.mapOverlay,
              borderCurve: "continuous",
              backgroundColor: palette.appBg,
              marginVertical: BrandSpacing.insetSoft,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                inset: 0,
              }}
            >
              {[0, 1, 2, 3, 4].map((row) => (
                <View
                  key={`row-${String(row)}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${14 + row * 18}%` as `${number}%`,
                    height: 1,
                    backgroundColor: palette.surface,
                  }}
                />
              ))}
              {[0, 1, 2, 3, 4, 5].map((column) => (
                <View
                  key={`column-${String(column)}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${8 + column * 15}%` as `${number}%`,
                    width: 1,
                    backgroundColor: palette.surface,
                  }}
                />
              ))}
              <View
                style={{
                  position: "absolute",
                  left: "18%" as never,
                  top: "10%" as never,
                  width: "52%" as never,
                  height: "72%" as never,
                  borderRadius: BrandRadius.mapHighlight,
                  backgroundColor: palette.primarySubtle,
                  transform: [{ rotate: "-10deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  right: "-6%" as never,
                  top: "22%" as never,
                  width: "32%" as never,
                  height: "48%" as never,
                  borderRadius: BrandRadius.mapOverlay,
                  backgroundColor: palette.successSubtle,
                  transform: [{ rotate: "11deg" }],
                }}
              />
            </View>

            <View
              style={{
                position: "absolute",
                top: BrandSpacing.insetSoft,
                left: BrandSpacing.insetSoft,
                right: BrandSpacing.insetSoft,
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: BrandSpacing.md,
              }}
            >
              <View
                style={{
                  maxWidth: 320,
                  borderRadius: BrandRadius.mapMarker,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface,
                  paddingHorizontal: BrandSpacing.componentPadding,
                  paddingVertical: BrandSpacing.md,
                  gap: BrandSpacing.xs,
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.primary,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("mapTab.web.currentFocus")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    ...BrandType.bodyMedium,
                    color: palette.text,
                  }}
                >
                  {focusedZone ? focusedZone.label[zoneLanguage] : t("mapTab.web.noFocusLocked")}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted,
                  }}
                >
                  {focusedZone ? t("mapTab.web.focusHelp") : t("mapTab.web.focusEmpty")}
                </Text>
              </View>

              <View
                style={{
                  borderRadius: BrandRadius.mapMarker,
                  borderCurve: "continuous",
                  backgroundColor: palette.primary,
                  paddingHorizontal: BrandSpacing.componentPadding,
                  paddingVertical: BrandSpacing.md,
                  gap: BrandSpacing.xs,
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.onPrimary,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("mapTab.web.liveZones")}
                </Text>
                <Text
                  style={{
                    ...BrandType.heroSmall,
                    color: palette.onPrimary,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {String(selectedCount)}
                </Text>
              </View>
            </View>

            {coverageNodes.map((node) => {
              const isEditable = typeof props.onPressZone === "function";
              const blockBackground = node.focused
                ? palette.primary
                : node.selected
                  ? palette.success
                  : palette.surface;
              const titleColor = node.focused || node.selected ? palette.onPrimary : palette.text;
              const metaColor =
                node.focused || node.selected ? palette.surfaceAlt : palette.textMuted;

              return (
                <Pressable
                  key={node.zoneId}
                  accessibilityRole={isEditable ? "button" : undefined}
                  disabled={!isEditable}
                  onPress={() => props.onPressZone?.(node.zoneId)}
                  style={({ pressed }) => ({
                    position: "absolute",
                    left: `${node.left}%` as `${number}%`,
                    top: `${node.top}%` as `${number}%`,
                    width: `${node.width}%` as `${number}%`,
                    height: `${node.height}%` as `${number}%`,
                    borderRadius: BrandRadius.soft,
                    borderCurve: "continuous",
                    backgroundColor: blockBackground,
                    paddingHorizontal: BrandSpacing.md,
                    paddingVertical: BrandSpacing.md,
                    justifyContent: "space-between",
                    transform: [{ rotate: `${String(node.rotate)}deg` }],
                    borderWidth: pressed ? 1.5 : 1,
                    borderColor: node.focused
                      ? palette.primaryPressed
                      : node.selected
                        ? palette.successSubtle
                        : palette.surfaceAlt,
                  })}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      ...BrandType.bodyMedium,
                      color: titleColor,
                    }}
                  >
                    {node.label}
                  </Text>
                  <View style={{ gap: BrandSpacing.xs }}>
                    <Text
                      style={{
                        ...BrandType.micro,
                        color: metaColor,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      {node.focused
                        ? t("mapTab.web.focused")
                        : node.selected
                          ? t("mapTab.web.liveTerritory")
                          : t("mapTab.web.referenceZone")}
                    </Text>
                    <Text
                      style={{
                        ...BrandType.caption,
                        color: metaColor,
                      }}
                    >
                      {isEditable
                        ? node.selected
                          ? t("mapTab.web.tapToRemove")
                          : t("mapTab.web.tapToAdd")
                        : getResponseLabel(node.seconds, responseLabels)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              gap: 14,
            }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: BrandRadius.soft,
                borderCurve: "continuous",
                backgroundColor: palette.primary,
                paddingHorizontal: BrandSpacing.lg,
                paddingVertical: BrandSpacing.component,
                gap: BrandSpacing.xs,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {t("mapTab.web.canvasMode")}
              </Text>
              <Text
                style={{
                  ...BrandType.heroSmall,
                  color: palette.onPrimary,
                }}
              >
                {props.onPressZone ? t("mapTab.web.interactive") : t("mapTab.web.preview")}
              </Text>
            </View>

            <View
              style={{
                flex: 1.5,
                borderRadius: BrandRadius.soft,
                borderCurve: "continuous",
                backgroundColor: palette.surface,
                paddingHorizontal: BrandSpacing.lg,
                paddingVertical: BrandSpacing.component,
                gap: BrandSpacing.stackDense,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.textMuted,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {t("mapTab.web.territorySnapshot")}
              </Text>

              {selectedPreview.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {selectedPreview.map((node) => (
                    <View
                      key={node.zoneId}
                      style={{
                        borderRadius: BrandRadius.pill,
                        borderCurve: "continuous",
                        backgroundColor: node.focused ? palette.primaryPressed : palette.surfaceAlt,
                        paddingHorizontal: BrandSpacing.sm,
                        paddingVertical: BrandSpacing.stackMicro,
                      }}
                    >
                      <Text
                        style={{
                          ...BrandType.micro,
                          color: node.focused ? palette.onPrimary : palette.text,
                        }}
                      >
                        {node.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted,
                  }}
                >
                  {t("mapTab.web.emptySnapshot")}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
