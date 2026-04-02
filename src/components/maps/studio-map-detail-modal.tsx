import { useTranslation } from "react-i18next";
import { Modal, Pressable, View } from "react-native";
import type { StudioMapMarker } from "@/components/maps/queue-map.types";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { KitSurface } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandSpacing, BrandType } from "@/constants/brand";
import { getZoneLabel } from "@/constants/zones";
import { useAppInsets } from "@/hooks/use-app-insets";
import { useTheme } from "@/hooks/use-theme";

type StudioMapDetailModalProps = {
  studio: StudioMapMarker | null;
  zoneLanguage: "en" | "he";
  onClose: () => void;
  onOpenStudio: (studioId: string) => void;
};

export function StudioMapDetailModal({
  studio,
  zoneLanguage,
  onClose,
  onOpenStudio,
}: StudioMapDetailModalProps) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const { overlayBottom } = useAppInsets();

  if (!studio) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.36)",
          paddingHorizontal: BrandSpacing.lg,
          paddingTop: BrandSpacing.xxl,
          paddingBottom: overlayBottom + BrandSpacing.xxl,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KitSurface tone="sheet" style={{ gap: BrandSpacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
            <ProfileAvatar
              imageUrl={studio.logoImageUrl}
              fallbackName={studio.studioName}
              size={BrandSpacing.avatarMd}
              roundedSquare={false}
              fallbackIcon="building.2.fill"
            />
            <View style={{ flex: 1, gap: BrandSpacing.xs }}>
              <ThemedText type="cardTitle">{studio.studioName}</ThemedText>
              <ThemedText type="meta" style={{ color: color.textMuted }}>
                {getZoneLabel(studio.zone, zoneLanguage)}
              </ThemedText>
            </View>
          </View>

          {studio.address ? (
            <View style={{ gap: BrandSpacing.xs }}>
              <ThemedText type="micro" style={{ color: color.textMuted }}>
                {t("mapTab.mobile.studioAddress", { defaultValue: "Address" })}
              </ThemedText>
              <ThemedText type="body">{studio.address}</ThemedText>
            </View>
          ) : null}

          <View
            style={{
              borderRadius: 18,
              borderCurve: "continuous",
              paddingHorizontal: BrandSpacing.md,
              paddingVertical: BrandSpacing.sm,
              backgroundColor: color.surfaceAlt,
              gap: BrandSpacing.xs,
            }}
          >
            <ThemedText type="micro" style={{ color: color.textMuted }}>
              {t("mapTab.mobile.studioHintTitle", { defaultValue: "Studio on this map" })}
            </ThemedText>
            <ThemedText style={{ ...BrandType.caption, color: color.text }}>
              {t("mapTab.mobile.studioHintBody", {
                defaultValue: "Tap through to see the studio profile and any open jobs.",
              })}
            </ThemedText>
          </View>

          <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label={t("mapTab.mobile.closeStudioModal", { defaultValue: "Close" })}
                onPress={onClose}
                tone="secondary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label={t("mapTab.mobile.openStudioProfile", { defaultValue: "Open studio" })}
                onPress={() => onOpenStudio(studio.studioId)}
              />
            </View>
          </View>
        </KitSurface>
      </View>
    </Modal>
  );
}
