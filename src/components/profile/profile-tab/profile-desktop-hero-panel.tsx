import { memo } from "react";
import { Text, View } from "react-native";
import { ActionButton } from "@/components/ui/action-button";
import { KitStatusBadge } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import type { ProfileHeroAction } from "./profile-hero-utils";

type ProfileDesktopHeroPanelProps = {
  profileName: string;
  roleLabel: string;
  profileImageUrl?: string | null | undefined;
  summary: string;
  statusLabel: string;
  statusTone?: "neutral" | "success" | "warning";
  metaLabel?: string | undefined;
  primaryAction: ProfileHeroAction;
  secondaryAction?: ProfileHeroAction | undefined;
  onOpenSwitcher?: () => void;
  switcherActionLabel?: string;
};

export const ProfileDesktopHeroPanel = memo(function ProfileDesktopHeroPanel({
  profileName,
  roleLabel,
  profileImageUrl,
  summary,
  statusLabel,
  statusTone = "neutral",
  metaLabel,
  primaryAction,
  secondaryAction,
  onOpenSwitcher,
  switcherActionLabel,
}: ProfileDesktopHeroPanelProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        borderRadius: BrandRadius.soft,
        borderCurve: "continuous",
        backgroundColor: theme.color.surface,
        paddingHorizontal: BrandSpacing.xl,
        paddingVertical: BrandSpacing.xl,
        gap: BrandSpacing.lg,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.componentPadding }}
      >
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          size={BrandSpacing.iconContainerLarge + BrandSpacing.xs + BrandSpacing.xs / 2}
          roundedSquare
        />
        <View style={{ flex: 1, gap: BrandSpacing.xs }}>
          <Text
            style={{
              ...BrandType.micro,
              color: theme.color.textMicro,
            }}
          >
            {roleLabel}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              ...BrandType.headingDisplay,
              color: theme.color.text,
            }}
          >
            {profileName}
          </Text>
        </View>
      </View>

      <View style={{ gap: BrandSpacing.sm }}>
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
              color: theme.color.textMuted,
            }}
          >
            {summary}
          </Text>
        ) : null}
        {metaLabel ? (
          <Text
            style={{
              ...BrandType.caption,
              color: theme.color.textMicro,
            }}
          >
            {metaLabel}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
        <View style={{ flex: 1 }}>
          <ActionButton label={primaryAction.label} onPress={primaryAction.onPress} fullWidth />
        </View>
        {onOpenSwitcher ? (
          <View style={{ flex: 1 }}>
            <ActionButton
              label={switcherActionLabel ?? "Switch account"}
              onPress={onOpenSwitcher}
              tone="secondary"
              fullWidth
            />
          </View>
        ) : null}
        {secondaryAction ? (
          <View style={{ flex: 1 }}>
            <ActionButton
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              tone="secondary"
              fullWidth
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});
