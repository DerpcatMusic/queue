import { Pressable, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

type MapAction = {
  label: string;
  icon: string;
  onPress: () => void;
  variant?: "default" | "primary";
};

type MapTopSheetProps = {
  palette: BrandPalette;
  zoneCount: number;
  focusedZone?: string | null;
  hasChanges?: boolean;
  actions?: MapAction[];
};

export function MapTopSheet({
  palette,
  zoneCount,
  focusedZone,
  hasChanges = false,
  actions,
}: MapTopSheetProps) {
  const statusText = hasChanges
    ? `${zoneCount} zones selected`
    : zoneCount > 0
      ? `${zoneCount} live zones`
      : "No zones selected";

  const statusHighlight = hasChanges || zoneCount > 0;

  return (
    <View style={{ gap: BrandSpacing.md }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text
            style={{
              ...BrandType.title,
              color: palette.text as string,
            }}
          >
            Your Zones
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.sm }}>
            <Text
              style={{
                ...BrandType.body,
                color: statusHighlight ? palette.primary : (palette.textMuted as string),
                fontWeight: statusHighlight ? "600" : "400",
              }}
            >
              {statusText}
            </Text>
            {focusedZone && (
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.textMuted as string,
                }}
              >
                • {focusedZone}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Action Chips */}
      {actions && actions.length > 0 ? (
        <View style={{ flexDirection: "row", gap: BrandSpacing.sm, flexWrap: "wrap" }}>
          {actions.map((action, index) => {
            const isPrimary = action.variant === "primary";
            return (
              <Pressable
                key={`map-action-${index}`}
                onPress={action.onPress}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: isPrimary
                    ? (palette.primary as string)
                    : (palette.surfaceAlt as string),
                  borderRadius: BrandRadius.button,
                  borderCurve: "continuous",
                  borderWidth: isPrimary ? 0 : 1,
                  borderColor: isPrimary ? "transparent" : (palette.border as string),
                  paddingHorizontal: BrandSpacing.md,
                  paddingVertical: BrandSpacing.sm,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <IconSymbol
                  name={action.icon as any}
                  size={14}
                  color={isPrimary ? (palette.onPrimary as string) : (palette.textMuted as string)}
                />
                <Text
                  style={{
                    ...BrandType.caption,
                    color: isPrimary ? (palette.onPrimary as string) : (palette.text as string),
                    fontWeight: "600",
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
