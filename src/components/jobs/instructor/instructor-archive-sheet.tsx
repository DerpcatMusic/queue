import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import type { BrandPalette } from "@/constants/brand";
import { formatTime, formatDateWithWeekday } from "@/lib/jobs-utils";
import { getPaymentStatusLabel, getPaymentStatusTone, type StatusTone } from "@/lib/payments-utils";
import { type RefObject, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import type { TFunction } from "i18next";
import { AppSymbol } from "@/components/ui/app-symbol";
import * as WebBrowser from "expo-web-browser";

type ArchiveSession = {
  applicationId: string;
  sport: string;
  studioName: string;
  startTime: number;
  endTime: number;
  pay: number;
  paymentDetails?: {
    status: string;
    payoutStatus?: string;
    externalInvoiceUrl?: string;
  };
};

function toneToken(tone: StatusTone, palette: BrandPalette) {
  switch (tone) {
    case "success":
      return { fg: palette.success as import("react-native").ColorValue, bg: palette.successSubtle, border: palette.success as import("react-native").ColorValue };
    case "warning":
      return { fg: palette.warning as import("react-native").ColorValue, bg: palette.warningSubtle, border: palette.warning as import("react-native").ColorValue };
    case "danger":
      return { fg: palette.danger, bg: palette.dangerSubtle, border: palette.danger };
    case "primary":
      return { fg: palette.primary, bg: palette.primarySubtle, border: palette.primary };
    default:
      return { fg: palette.textMuted, bg: palette.surfaceAlt, border: palette.borderStrong };
  }
}

function StatusBadge({ label, tone, palette }: { label: string; tone: StatusTone; palette: BrandPalette }) {
  const token = toneToken(tone, palette);
  return (
    <View style={{ borderWidth: 1, borderRadius: 999, borderCurve: "continuous", borderColor: token.border, backgroundColor: token.bg, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
      <ThemedText type="micro" style={{ color: token.fg, fontWeight: "500" }}>{label}</ThemedText>
    </View>
  );
}

type InstructorArchiveSheetProps = {
  sheetRef: RefObject<BottomSheet | null>;
  sessions: ArchiveSession[];
  locale: string;
  palette: BrandPalette;
  resolvedScheme: string;
  t: TFunction;
};

export function InstructorArchiveSheet({
  sheetRef,
  sessions,
  locale,
  palette,
  resolvedScheme,
  t,
}: InstructorArchiveSheetProps) {
  const backdropComponent = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  const backgroundComponent = useCallback(
    ({ style }: BottomSheetBackgroundProps) => (
      <Animated.View style={[style, { backgroundColor: "transparent" }]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderCurve: "continuous",
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: palette.border,
            },
          ]}
        />
      </Animated.View>
    ),
    [palette],
  );

  const handleComponent = useCallback(
    () => (
      <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ width: 32, height: 4, borderRadius: 999, backgroundColor: palette.borderStrong }} />
      </View>
    ),
    [palette],
  );

  return (
    <BottomSheet
      key={`archive-sheet-${resolvedScheme}`}
      ref={sheetRef}
      index={-1}
      snapPoints={["62%"]}
      enablePanDownToClose
      backdropComponent={backdropComponent}
      backgroundComponent={backgroundComponent}
      handleComponent={handleComponent}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 10, flex: 1 }}>
        <View style={styles.header}>
          <View style={{ gap: 2 }}>
            <ThemedText type="title" style={{ fontWeight: "600" }}>
              {t("jobsTab.archiveTitle")}
            </ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {`${sessions.length} records`}
            </ThemedText>
          </View>
          <Pressable onPress={() => sheetRef.current?.close()}>
            <MaterialIcons name="close" size={18} color={palette.textMuted} />
          </Pressable>
        </View>

        {sessions.length === 0 ? (
          <ThemedText style={{ color: palette.textMuted }}>
            {t("jobsTab.emptyArchive")}
          </ThemedText>
        ) : (
          <BottomSheetScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sessions.map((session, index) => (
              <View
                key={session.applicationId}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  paddingBottom: 12,
                  paddingHorizontal: 10,
                  gap: 8,
                  borderTopColor: palette.border,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: index % 2 === 0 ? palette.surface : palette.surfaceAlt,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText type="bodyStrong" style={{ fontSize: 18 }}>
                    {toSportLabel(session.sport as never)}
                  </ThemedText>
                  <ThemedText style={{ color: palette.textMuted, fontWeight: "500" }}>
                    {session.studioName}
                  </ThemedText>
                  
                  <View style={{ gap: 4, marginTop: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <AppSymbol name="calendar.circle.fill" size={14} tintColor={palette.textMuted} />
                      <ThemedText type="caption" style={{ color: palette.textMuted }}>
                        {formatDateWithWeekday(session.startTime, locale)}
                      </ThemedText>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <AppSymbol name="clock.fill" size={14} tintColor={palette.textMuted} />
                      <ThemedText type="caption" style={{ color: palette.textMuted }}>
                        {`${formatTime(session.startTime, locale)} - ${formatTime(session.endTime, locale)}`}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <ThemedText
                    type="title"
                    selectable
                    style={{ fontVariant: ["tabular-nums"], fontSize: 22, fontWeight: "700" }}
                  >
                    {t("jobsTab.card.pay", { value: session.pay })}
                  </ThemedText>
                  
                  {session.paymentDetails ? (
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <StatusBadge
                        label={getPaymentStatusLabel(session.paymentDetails.status as any)}
                        tone={getPaymentStatusTone(session.paymentDetails.status as any)}
                        palette={palette}
                      />
                      {session.paymentDetails.externalInvoiceUrl ? (
                        <Pressable
                          onPress={() => WebBrowser.openBrowserAsync(session.paymentDetails!.externalInvoiceUrl!)}
                          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                        >
                          <ThemedText type="caption" style={{ color: palette.primary, fontWeight: "600" }}>
                            Receipt
                          </ThemedText>
                          <AppSymbol name="arrow.up.right.square" size={12} tintColor={palette.primary} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <StatusBadge label="Unpaid" tone="muted" palette={palette} />
                  )}
                </View>
              </View>
            ))}
          </BottomSheetScrollView>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
});
