import { AppSymbol } from "@/components/ui/app-symbol";
import type { BrandPalette } from "@/constants/brand";
import { useMemo, useState } from "react";
import { Image, Text, View } from "react-native";

type ProfileAvatarProps = {
  imageUrl?: string | null | undefined;
  fallbackName?: string | null;
  palette: BrandPalette;
  size?: number;
  roundedSquare?: boolean;
  fallbackIcon?: string;
};

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
  palette,
  size = 56,
  roundedSquare = true,
  fallbackIcon = "person.fill",
}: ProfileAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const initials = useMemo(() => toInitials(fallbackName), [fallbackName]);
  const borderRadius = roundedSquare ? Math.round(size * 0.3) : Math.round(size / 2);
  const normalizedImageUrl = imageUrl ?? undefined;
  const canRenderImage =
    Boolean(normalizedImageUrl) && failedImageUrl !== normalizedImageUrl;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        borderCurve: "continuous",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: palette.border as string,
        backgroundColor: palette.surfaceAlt as string,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {canRenderImage ? (
        <Image
          source={{ uri: normalizedImageUrl }}
          onError={() => {
            if (normalizedImageUrl) {
              setFailedImageUrl(normalizedImageUrl);
            }
          }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : initials ? (
        <Text
          style={{
            fontFamily: "Rubik_600SemiBold",
            color: palette.text as string,
            fontSize: Math.max(14, Math.round(size * 0.34)),
            letterSpacing: -0.3,
          }}
        >
          {initials}
        </Text>
      ) : (
        <AppSymbol
          name={fallbackIcon}
          size={Math.max(16, Math.round(size * 0.42))}
          tintColor={palette.textMuted as string}
        />
      )}
    </View>
  );
}
