import { Image as ExpoImage } from "expo-image";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { useTheme } from "@/hooks/use-theme";
import { Box } from "@/primitives";
import type { InstructorJobDetailViewModel } from "./instructor-job-detail-view-model";

const BANNER_FADE_ID = "instructor-job-detail-banner-fade";

const BADGE_TONE_STYLE = {
  primary: "primary",
  secondary: "secondary",
  muted: "muted",
  success: "success",
  warning: "warning",
} as const;

function DetailBadge({ label, tone }: { label: string; tone: keyof typeof BADGE_TONE_STYLE }) {
  const { color: palette } = useTheme();

  const colors = {
    primary: {
      backgroundColor: palette.primarySubtle,
      color: palette.primary,
    },
    secondary: {
      backgroundColor: palette.secondarySubtle,
      color: palette.secondary,
    },
    muted: {
      backgroundColor: palette.surfaceAlt,
      color: palette.textMuted,
    },
    success: {
      backgroundColor: palette.successSubtle,
      color: palette.success,
    },
    warning: {
      backgroundColor: palette.warningSubtle,
      color: palette.warning,
    },
  }[tone];

  return (
    <Box
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: BrandSpacing.sm,
        paddingVertical: 6,
        borderRadius: BrandRadius.pill,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <ThemedText
        type="micro"
        style={{
          color: colors.color,
          textTransform: "uppercase",
          fontWeight: "800",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </ThemedText>
    </Box>
  );
}

function DetailSection({
  title,
  items,
}: {
  title: string;
  items: InstructorJobDetailViewModel["sections"][number]["items"];
}) {
  const { color: palette } = useTheme();

  return (
    <Box
      style={{
        borderRadius: 22,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.outline,
        padding: BrandSpacing.lg,
        gap: BrandSpacing.md,
      }}
    >
      <ThemedText
        type="micro"
        style={{
          color: palette.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          fontWeight: "700",
        }}
      >
        {title}
      </ThemedText>

      <Box style={{ gap: BrandSpacing.md }}>
        {items.map((item) => (
          <Box key={item.key} style={{ gap: BrandSpacing.xxs }}>
            <ThemedText type="micro" style={{ color: palette.textMuted }}>
              {item.label}
            </ThemedText>
            <ThemedText type="bodyStrong" style={{ color: palette.text }}>
              {item.value}
            </ThemedText>
            {item.supportingText ? (
              <ThemedText type="caption" style={{ color: palette.textMuted }}>
                {item.supportingText}
              </ThemedText>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function InstructorJobDetailBanner({
  studioName,
  sportLabel,
  studioImageUrl,
  onBack,
}: {
  studioName: string;
  sportLabel: string;
  studioImageUrl?: string | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { color: palette } = useTheme();

  return (
    <Box
      style={{
        height: 228,
        overflow: "hidden",
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        backgroundColor: palette.surfaceElevated,
      }}
    >
      {studioImageUrl ? (
        <ExpoImage
          source={{ uri: studioImageUrl }}
          contentFit="cover"
          style={{ position: "absolute", inset: 0 }}
        />
      ) : null}
      <Svg pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
        <Defs>
          <SvgLinearGradient id={BANNER_FADE_ID} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0.02" />
            <Stop offset="40%" stopColor="#000000" stopOpacity="0.26" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.98" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${BANNER_FADE_ID})`} />
      </Svg>

      <Box
        style={{
          flex: 1,
          paddingHorizontal: BrandSpacing.xl,
          paddingTop: BrandSpacing.lg,
          paddingBottom: BrandSpacing.xl,
          justifyContent: "space-between",
        }}
      >
        <Box style={{ alignItems: "flex-start" }}>
          <IconButton
            accessibilityLabel={t("common.close")}
            onPress={onBack}
            size={36}
            backgroundColorOverride={palette.surfaceAlt}
            icon={<IconSymbol name="chevron.left" size={18} color={palette.text} />}
          />
        </Box>

        <Box style={{ alignItems: "center", gap: BrandSpacing.xs }}>
          <ThemedText
            type="micro"
            style={{
              color: palette.textMuted,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t("jobsTab.detail.bannerEyebrow")}
          </ThemedText>
          <ThemedText
            type="display"
            numberOfLines={2}
            style={{
              color: palette.text,
              textAlign: "center",
              fontSize: 28,
              lineHeight: 32,
              fontWeight: "800",
            }}
          >
            {studioName}
          </ThemedText>
        </Box>

        <Box style={{ alignItems: "center" }}>
          <ThemedText
            type="caption"
            style={{
              color: palette.textMuted,
              textAlign: "center",
            }}
          >
            {sportLabel}
          </ThemedText>
        </Box>
      </Box>
    </Box>
  );
}

export function InstructorJobDetailContent({
  viewModel,
  actionSlot,
}: {
  viewModel: InstructorJobDetailViewModel;
  actionSlot?: ReactNode;
}) {
  const { color: palette } = useTheme();

  return (
    <Box style={{ gap: BrandSpacing.md }}>
      <Box
        style={{
          borderRadius: BrandRadius.card,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.outline,
          padding: BrandSpacing.xl,
          gap: BrandSpacing.lg,
        }}
      >
        <Box style={{ gap: BrandSpacing.sm }}>
          <ThemedText
            type="micro"
            style={{
              color: palette.textMuted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              fontWeight: "700",
            }}
          >
            {viewModel.eyebrow}
          </ThemedText>
          <ThemedText type="title" style={{ color: palette.text }}>
            {viewModel.title}
          </ThemedText>
          {viewModel.badges.length > 0 ? (
            <Box style={{ flexDirection: "row", flexWrap: "wrap", gap: BrandSpacing.xs }}>
              {viewModel.badges.map((badge) => (
                <DetailBadge key={badge.key} label={badge.label} tone={badge.tone} />
              ))}
            </Box>
          ) : null}
        </Box>

        <Box style={{ gap: BrandSpacing.sm }}>
          {viewModel.sections.map((section) => (
            <DetailSection key={section.key} title={section.title} items={section.items} />
          ))}

          <Box
            style={{
              borderRadius: 22,
              backgroundColor: palette.surfaceElevated,
              borderWidth: 1,
              borderColor: palette.outline,
              padding: BrandSpacing.lg,
              gap: BrandSpacing.xs,
            }}
          >
            <ThemedText
              type="micro"
              style={{
                color: palette.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                fontWeight: "700",
              }}
            >
              {viewModel.notes.title}
            </ThemedText>
            <ThemedText type="body" style={{ color: palette.text }}>
              {viewModel.notes.body}
            </ThemedText>
          </Box>
        </Box>

        {actionSlot ? <Box>{actionSlot}</Box> : null}
      </Box>
    </Box>
  );
}
