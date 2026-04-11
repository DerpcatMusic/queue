import { Image } from "expo-image";
import { useMemo, useState } from "react";
import type { ColorValue } from "react-native";
import { View, type ViewProps } from "react-native";
import { AppSymbol } from "@/components/ui/app-symbol";
import { BrandType } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { FontSize, IconSize, LetterSpacing } from "@/lib/design-system";
import { Text } from "@/primitives";

type ProfileAvatarProps = {
  imageUrl?: string | null | undefined;
  fallbackName?: string | null;
  size?: number;
  roundedSquare?: boolean;
  fallbackIcon?: string;
  backgroundColor?: ColorValue;
} & Pick<ViewProps, "accessibilityLabel">;

function toInitials(name: string | null | undefined) {
  if (!name) return null;
  const segments = name
    .trim()
    .split(/\s+/)
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;
  if (segments.length === 1) {
    return segments[0]?.slice(0, 1).toUpperCase() ?? null;
  }
  return `${segments[0]?.slice(0, 1) ?? ""}${segments[1]?.slice(0, 1) ?? ""}`.toUpperCase();
}

export function ProfileAvatar({
  imageUrl,
  fallbackName,
  size = 56,
  roundedSquare = true,
  fallbackIcon = "person.fill",
  backgroundColor,
  accessibilityLabel,
}: ProfileAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const { color } = useTheme();

  const initials = useMemo(() => toInitials(fallbackName), [fallbackName]);
  const borderRadius = roundedSquare ? Math.round(size * 0.3) : Math.round(size / 2);
  const normalizedImageUrl = imageUrl ?? undefined;
  const canRenderImage = Boolean(normalizedImageUrl) && failedImageUrl !== normalizedImageUrl;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius,
        borderCurve: "continuous",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: backgroundColor ?? color.surfaceAlt,
      }}
    >
      {canRenderImage && normalizedImageUrl ? (
        <Image
          source={{ uri: normalizedImageUrl }}
          onError={() => {
            setFailedImageUrl(normalizedImageUrl);
          }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      ) : initials ? (
        <Text
          style={{
            ...BrandType.title,
            color: color.text,
            fontSize: Math.max(FontSize.caption, Math.round(size * 0.34)),
            letterSpacing: LetterSpacing.initials,
            lineHeight: Math.max(FontSize.body, Math.round(size * 0.38)),
          }}
        >
          {initials}
        </Text>
      ) : (
        <AppSymbol
          name={fallbackIcon}
          size={Math.max(IconSize.sm, Math.round(size * 0.42))}
          tintColor={color.textMuted}
        />
      )}
    </View>
  );
}
