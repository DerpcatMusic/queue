import { Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitButton, KitSurface } from "@/components/ui/kit";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandType } from "@/constants/brand";

export type ProfileSetupAction = {
  label: string;
  onPress: () => void;
};

export type ProfileReadinessBannerProps = {
  palette: BrandPalette;
  primaryAction: ProfileSetupAction | null;
  statusLabel: string;
  subtitleLabel: string;
};

export function ProfileReadinessBanner({
  palette,
  primaryAction,
  statusLabel,
  subtitleLabel,
}: ProfileReadinessBannerProps) {
  return (
    <View style={{ paddingHorizontal: 24 }}>
      <KitSurface
        tone="base"
        style={{
          padding: 20,
          borderRadius: BrandRadius.card,
          borderCurve: "continuous",
          gap: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: primaryAction
                ? (palette.warningSubtle as string)
                : (palette.successSubtle as string),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconSymbol
              name={primaryAction ? "exclamationmark.circle.fill" : "checkmark.seal.fill"}
              size={22}
              color={primaryAction ? palette.warning : palette.success}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ ...BrandType.title, color: palette.text as string }}>
              {statusLabel}
            </Text>
            <Text style={{ ...BrandType.caption, color: palette.textMuted as string }}>
              {subtitleLabel}
            </Text>
          </View>
        </View>
        {primaryAction ? (
          <KitButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            size="sm"
            style={{ width: "100%" }}
          />
        ) : null}
      </KitSurface>
    </View>
  );
}
