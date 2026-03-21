import { Pressable, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { BrandPalette } from "@/constants/brand";
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

type JobAction = {
  label: string;
  icon: string;
  onPress: () => void;
};

type StatItem = {
  id: string;
  label: string;
  value: string;
  highlight?: boolean;
};

type JobsTopSheetProps = {
  displayName: string;
  profileImageUrl?: string | null;
  palette: BrandPalette;
  statusLabel?: string;
  stats?: StatItem[];
  actions?: JobAction[];
  onAvatarPress?: () => void;
};

export function JobsTopSheet({
  displayName,
  profileImageUrl,
  palette,
  statusLabel,
  stats,
  actions,
  onAvatarPress,
}: JobsTopSheetProps) {
  return (
    <View style={{ gap: BrandSpacing.md }}>
      {/* Header Row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
        <Pressable onPress={onAvatarPress} style={{ borderRadius: 28 }}>
          <ProfileAvatar
            imageUrl={profileImageUrl}
            fallbackName={displayName}
            palette={palette}
            size={56}
            roundedSquare
          />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              ...BrandType.title,
              color: palette.text as string,
            }}
          >
            {statusLabel || `Hey ${displayName.split(" ")[0]}!`}
          </Text>
          {stats && stats.length > 0 ? (
            <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
              {stats.map((stat) => (
                <Text
                  key={stat.id}
                  style={{
                    ...BrandType.caption,
                    color: stat.highlight ? palette.primary : (palette.textMuted as string),
                  }}
                >
                  {stat.value}{" "}
                  <Text style={{ color: palette.textMuted as string }}>{stat.label}</Text>
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* Action Chips */}
      {actions && actions.length > 0 ? (
        <View style={{ flexDirection: "row", gap: BrandSpacing.sm, flexWrap: "wrap" }}>
          {actions.map((action) => (
            <Pressable
              key={`${action.label}-${action.icon}`}
              onPress={action.onPress}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: palette.primarySubtle as string,
                borderRadius: BrandRadius.button,
                borderCurve: "continuous",
                paddingHorizontal: BrandSpacing.md,
                paddingVertical: BrandSpacing.sm,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <IconSymbol name={action.icon as any} size={14} color={palette.primary as string} />
              <Text
                style={{
                  ...BrandType.caption,
                  color: palette.primary as string,
                  fontWeight: "600",
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Studio version with different styling
type StudioJobsTopSheetProps = {
  studioName: string;
  profileImageUrl?: string | null;
  palette: BrandPalette;
  stats?: StatItem[];
  onManageJobsPress?: () => void;
};

export function StudioJobsTopSheet({
  studioName,
  profileImageUrl,
  palette,
  stats,
  onManageJobsPress,
}: StudioJobsTopSheetProps) {
  return (
    <View style={{ gap: BrandSpacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: BrandSpacing.md }}>
        <ProfileAvatar
          imageUrl={profileImageUrl}
          fallbackName={studioName}
          palette={palette}
          size={56}
          roundedSquare
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              ...BrandType.title,
              color: palette.text as string,
            }}
          >
            {studioName}
          </Text>
          {stats && stats.length > 0 ? (
            <View style={{ flexDirection: "row", gap: BrandSpacing.md }}>
              {stats.map((stat) => (
                <Text
                  key={stat.id}
                  style={{
                    ...BrandType.caption,
                    color: stat.highlight ? palette.primary : (palette.textMuted as string),
                  }}
                >
                  {stat.value}{" "}
                  <Text style={{ color: palette.textMuted as string }}>{stat.label}</Text>
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {onManageJobsPress ? (
        <Pressable
          onPress={onManageJobsPress}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: palette.primary as string,
            borderRadius: BrandRadius.button,
            paddingHorizontal: BrandSpacing.md,
            paddingVertical: BrandSpacing.sm + 2,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <IconSymbol name="plus" size={16} color={palette.onPrimary as string} />
          <Text
            style={{
              ...BrandType.bodyMedium,
              color: palette.onPrimary as string,
            }}
          >
            Post a Job
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
