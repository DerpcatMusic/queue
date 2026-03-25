import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandRadius, BrandType } from "@/constants/brand";
import { useBrand } from "@/hooks/use-brand";
import type { QueueMapProps } from "./queue-map.types";
import { buildCoverageNodes, getResponseLabel, getZone } from "./queue-map.web.helpers";

export function QueueMap(props: QueueMapProps) {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
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
        backgroundColor: palette.surfaceAlt as string,
        padding: 20,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 28,
          borderCurve: "continuous",
          backgroundColor: palette.surface as string,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "space-between",
            padding: 22,
            backgroundColor: palette.surfaceAlt as string,
          }}
        >
          <View style={{ gap: 18 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ gap: 4, flex: 1 }}>
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.primary as string,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("mapTab.web.workspaceEyebrow")}
                </Text>
                <Text
                  style={{
                    fontFamily: "BarlowCondensed_800ExtraBold",
                    fontSize: 38,
                    lineHeight: 36,
                    letterSpacing: -1,
                    color: palette.text as string,
                  }}
                >
                  {t("mapTab.web.workspaceTitle")}
                </Text>
              </View>

              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.primary as string,
                }}
              >
                <AppSymbol name="map.fill" size={24} tintColor={palette.onPrimary as string} />
              </View>
            </View>

            <Text
              style={{
                ...BrandType.body,
                color: palette.textMuted as string,
                maxWidth: 560,
              }}
            >
              {t("mapTab.web.workspaceBody")}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              minHeight: 320,
              borderRadius: 28,
              borderCurve: "continuous",
              backgroundColor: palette.appBg as string,
              marginVertical: 18,
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
                    backgroundColor: palette.surface as string,
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
                    backgroundColor: palette.surface as string,
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
                  borderRadius: 36,
                  backgroundColor: palette.primarySubtle as string,
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
                  borderRadius: 28,
                  backgroundColor: palette.successSubtle as string,
                  transform: [{ rotate: "11deg" }],
                }}
              />
            </View>

            <View
              style={{
                position: "absolute",
                top: 18,
                left: 18,
                right: 18,
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View
                style={{
                  maxWidth: 320,
                  borderRadius: 22,
                  borderCurve: "continuous",
                  backgroundColor: palette.surface as string,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.primary as string,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("mapTab.web.currentFocus")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    ...BrandType.bodyStrong,
                    color: palette.text as string,
                  }}
                >
                  {focusedZone ? focusedZone.label[zoneLanguage] : t("mapTab.web.noFocusLocked")}
                </Text>
                <Text
                  style={{
                    ...BrandType.caption,
                    color: palette.textMuted as string,
                  }}
                >
                  {focusedZone ? t("mapTab.web.focusHelp") : t("mapTab.web.focusEmpty")}
                </Text>
              </View>

              <View
                style={{
                  borderRadius: 22,
                  borderCurve: "continuous",
                  backgroundColor: palette.primary as string,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  gap: 2,
                }}
              >
                <Text
                  style={{
                    ...BrandType.micro,
                    color: palette.onPrimary as string,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("mapTab.web.liveZones")}
                </Text>
                <Text
                  style={{
                    fontFamily: "BarlowCondensed_800ExtraBold",
                    fontSize: 30,
                    lineHeight: 28,
                    color: palette.onPrimary as string,
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
                ? (palette.primary as string)
                : node.selected
                  ? (palette.success as string)
                  : (palette.surface as string);
              const titleColor =
                node.focused || node.selected
                  ? (palette.onPrimary as string)
                  : (palette.text as string);
              const metaColor =
                node.focused || node.selected
                  ? (palette.surfaceAlt as string)
                  : (palette.textMuted as string);

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
                    borderRadius: 24,
                    borderCurve: "continuous",
                    backgroundColor: blockBackground,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    justifyContent: "space-between",
                    transform: [{ rotate: `${String(node.rotate)}deg` }],
                    borderWidth: pressed ? 1.5 : 1,
                    borderColor: node.focused
                      ? (palette.primaryPressed as string)
                      : node.selected
                        ? (palette.successSubtle as string)
                        : (palette.surfaceAlt as string),
                  })}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      ...BrandType.bodyStrong,
                      color: titleColor,
                    }}
                  >
                    {node.label}
                  </Text>
                  <View style={{ gap: 2 }}>
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
                    <Text style={{ ...BrandType.caption, color: metaColor }}>
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
                borderRadius: 24,
                borderCurve: "continuous",
                backgroundColor: palette.primary as string,
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 2,
              }}
            >
              <Text
                style={{
                  ...BrandType.micro,
                  color: palette.onPrimary as string,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {t("mapTab.web.canvasMode")}
              </Text>
              <Text
                style={{
                  fontFamily: "BarlowCondensed_800ExtraBold",
                  fontSize: 30,
                  lineHeight: 28,
                  color: palette.onPrimary as string,
                }}
              >
                {props.onPressZone ? t("mapTab.web.interactive") : t("mapTab.web.preview")}
              </Text>
            </View>

            <View
              style={{
                flex: 1.5,
                borderRadius: 24,
                borderCurve: "continuous",
                backgroundColor: palette.surface as string,
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 10,
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
                        backgroundColor: node.focused
                          ? (palette.primaryPressed as string)
                          : (palette.surfaceAlt as string),
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                      }}
                    >
                      <Text
                        style={{
                          ...BrandType.micro,
                          color: node.focused
                            ? (palette.onPrimary as string)
                            : (palette.text as string),
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
                    color: palette.textMuted as string,
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
