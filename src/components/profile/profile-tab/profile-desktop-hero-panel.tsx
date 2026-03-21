import { memo } from "react";
import { Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { KitStatusBadge } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandType } from "@/constants/brand";
import type { ProfileHeroAction } from "./profile-hero-utils";

type ProfileDesktopHeroPanelProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  palette: BrandPalette;
  summary: string;
  statusLabel: string;
  statusTone?: "neutral" | "success" | "warning";
  metaLabel?: string | undefined;
  primaryAction: ProfileHeroAction;
  secondaryAction?: ProfileHeroAction | undefined;
};

export const ProfileDesktopHeroPanel = memo(function ProfileDesktopHeroPanel({
  profileName,
  roleLabel,
  profileImageUrl,
  palette,
  summary,
  statusLabel,
  statusTone = "neutral",
  metaLabel,
  primaryAction,
  secondaryAction,
}: ProfileDesktopHeroPanelProps) {
  return (
    <View
      style={{
        borderRadius: 34,
        borderCurve: "continuous",
        backgroundColor: palette.surface as string,
        paddingHorizontal: 22,
        paddingVertical: 22,
        gap: 18,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          palette={palette}
          size={84}
          roundedSquare
        />
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            style={{
              ...BrandType.micro,
              color: palette.textMicro as string,
              letterSpacing: 0.2,
            }}
          >
            {roleLabel}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              ...BrandType.display,
              fontSize: 34,
              lineHeight: 38,
              letterSpacing: -0.6,
              color: palette.text as string,
            }}
          >
            {profileName}
          </Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <KitStatusBadge
          label={statusLabel}
          tone={
            statusTone === "success" ? "success" : statusTone === "warning" ? "warning" : "neutral"
          }
          showDot
        />
        {summary ? (
          <Text
            style={{
              ...BrandType.body,
              color: palette.textMuted as string,
            }}
          >
            {summary}
          </Text>
        ) : null}
        {metaLabel ? (
          <Text
            style={{
              ...BrandType.caption,
              color: palette.textMicro as string,
            }}
          >
            {metaLabel}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            palette={palette}
            fullWidth
          />
        </View>
        {secondaryAction ? (
          <View style={{ flex: 1 }}>
            <ActionButton
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              palette={palette}
              tone="secondary"
              fullWidth
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});
