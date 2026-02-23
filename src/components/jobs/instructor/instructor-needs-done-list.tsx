import type { Id } from "@/convex/_generated/dataModel";
import { toSportLabel } from "@/convex/constants";
import { ThemedText } from "@/components/themed-text";
import { KitButton, KitList, KitListItem } from "@/components/ui/kit";
import { BrandRadius, type BrandPalette } from "@/constants/brand";
import { formatDateTime } from "@/lib/jobs-utils";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { TFunction } from "i18next";

type NeedsDoneSession = {
  applicationId: string;
  jobId: Id<"jobs">;
  sport: string;
  studioName: string;
  endTime: number;
};

type InstructorNeedsDoneListProps = {
  sessions: NeedsDoneSession[];
  locale: string;
  palette: BrandPalette;
  markBusyJobId: string | null;
  onMarkDone: (jobId: Id<"jobs">) => void;
  t: TFunction;
};

export function InstructorNeedsDoneList({
  sessions,
  locale,
  palette,
  markBusyJobId,
  onMarkDone,
  t,
}: InstructorNeedsDoneListProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <ViewWrap style={{ paddingHorizontal: 16 }}>
      <KitList inset>
        {sessions.map((session, index) => (
          <KitListItem key={session.applicationId}>
            <Animated.View entering={FadeInUp.delay(Math.min(index, 4) * 36).duration(240).springify()}>
              <Row>
              <ViewWrap style={{ flex: 1, gap: 2 }}>
                <View
                  style={{
                    alignSelf: "flex-start",
                    borderWidth: 1,
                    borderRadius: BrandRadius.pill,
                    borderCurve: "continuous",
                    borderColor: palette.warning,
                    backgroundColor: palette.warningSubtle,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <ThemedText type="micro" style={{ color: palette.warning }}>
                    {t("jobsTab.needsDoneTitle", { count: 1 })}
                  </ThemedText>
                </View>
                <ThemedText type="defaultSemiBold">
                  {toSportLabel(session.sport as never)}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {session.studioName}
                </ThemedText>
                <ThemedText style={{ color: palette.textMuted }}>
                  {formatDateTime(session.endTime, locale)}
                </ThemedText>
              </ViewWrap>
              <KitButton
                label={
                  markBusyJobId === String(session.jobId)
                    ? t("jobsTab.actions.markingLessonDone")
                    : t("jobsTab.actions.markLessonDone")
                }
                variant="secondary"
                onPress={() => onMarkDone(session.jobId)}
                disabled={markBusyJobId === String(session.jobId)}
              />
              </Row>
            </Animated.View>
          </KitListItem>
        ))}
      </KitList>
    </ViewWrap>
  );
}

function ViewWrap({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>{children}</View>;
}


