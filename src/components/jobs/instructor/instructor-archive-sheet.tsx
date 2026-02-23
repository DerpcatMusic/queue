import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import type { BrandPalette } from "@/constants/brand";
import { formatCompactDateTime } from "@/lib/jobs-utils";
import { type RefObject, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import type { TFunction } from "i18next";

type ArchiveSession = {
  applicationId: string;
  sport: string;
  studioName: string;
  startTime: number;
  pay: number;
};

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
            <ThemedText type="defaultSemiBold">{t("jobsTab.archiveTitle")}</ThemedText>
            <ThemedText type="caption" style={{ color: palette.textMuted }}>
              {t("jobsTab.emptyArchive")}
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
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="defaultSemiBold">
                    {toSportLabel(session.sport as never)}
                  </ThemedText>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {session.studioName}
                  </ThemedText>
                  <ThemedText style={{ color: palette.textMuted }}>
                    {formatCompactDateTime(session.startTime, locale)}
                  </ThemedText>
                </View>
                <ThemedText type="bodyStrong" selectable style={{ fontVariant: ["tabular-nums"] }}>
                  {t("jobsTab.card.pay", { value: session.pay })}
                </ThemedText>
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
