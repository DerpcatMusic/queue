import { memo } from "react";
import { ProfileVerifiedBadge } from "@/components/profile/profile-verified-badge";
import { ActionButton } from "@/components/ui/action-button";
import { KitStatusBadge } from "@/components/ui/kit";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box, Text } from "@/primitives";
import type { ProfileHeroAction } from "./profile-hero-utils";
const BRIGHT_LIME = "#CCFF00";

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
  isVerified?: boolean;
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
  isVerified = false,
}: ProfileDesktopHeroPanelProps) {
  const theme = useTheme();

  return (
    <Box
      style={{
        borderRadius: BrandRadius.soft,
        borderCurve: "continuous",
        backgroundColor: theme.scheme === "light" ? "#FFFFFF" : theme.color.surfaceElevated,
        paddingHorizontal: BrandSpacing.xl,
        paddingVertical: BrandSpacing.xl,
        gap: BrandSpacing.lg,
        shadowColor: "#000000",
        shadowOpacity: theme.scheme === "light" ? 0.05 : 0.06,
        shadowRadius: theme.scheme === "light" ? 22 : 18,
        shadowOffset: { width: 0, height: theme.scheme === "light" ? 10 : 8 },
        elevation: theme.scheme === "light" ? 0 : 2,
      }}
    >
      <Box
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BrandSpacing.componentPadding,
        }}
      >
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={profileName}
          size={BrandSpacing.iconContainerLarge + BrandSpacing.xs + BrandSpacing.xs / 2}
          roundedSquare
        />
        <Box style={{ flex: 1, gap: BrandSpacing.xs }}>
          <Text
            style={{
              ...BrandType.micro,
              color: BRIGHT_LIME,
            }}
          >
            {roleLabel}
          </Text>
          <Box
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BrandSpacing.xs,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                ...BrandType.headingDisplay,
                color: theme.color.text,
                flexShrink: 1,
              }}
            >
              {profileName}
            </Text>
            {isVerified ? <ProfileVerifiedBadge /> : null}
          </Box>
        </Box>
      </Box>

      <Box style={{ gap: BrandSpacing.sm }}>
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
      </Box>

      <Box style={{ flexDirection: "row", gap: BrandSpacing.sm }}>
        <Box style={{ flex: 1 }}>
          <ActionButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            fullWidth
            colors={{
              backgroundColor: BRIGHT_LIME,
              pressedBackgroundColor: "#D9FF4D",
              disabledBackgroundColor: "#E7EEAF",
              labelColor: "#161E00",
              disabledLabelColor: "#7B7B7B",
            }}
          />
        </Box>
        {onOpenSwitcher ? (
          <Box style={{ flex: 1 }}>
            <ActionButton
              label={switcherActionLabel ?? "Switch account"}
              onPress={onOpenSwitcher}
              tone="secondary"
              fullWidth
            />
          </Box>
        ) : null}
        {secondaryAction ? (
          <Box style={{ flex: 1 }}>
            <ActionButton
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
              tone="secondary"
              fullWidth
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});
