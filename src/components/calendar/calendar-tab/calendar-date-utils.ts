import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

export const RAIL_LEFT = 24;
export const RAIL_DOT_DAY = 10;
export const RAIL_DOT_LESSON = 6;

export function toDayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayKeyToTimestamp(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

export function formatDayHeading(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
  });
}

export function formatDaySubtitle(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
  });
}

export function formatMonthYear(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function formatSelectedDayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
  });
}

export function hashSport(sport: string) {
  let h = 0;
  for (let i = 0; i < sport.length; i++) {
    h = sport.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

export const calendarTimelineStyles = {
  timelineViewport: {
    flex: 1,
    position: "relative",
  },
  timelineContent: {
    paddingTop: 4,
  },
  timelineBottomMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 1,
  },
  visibilitySection: {
    gap: 8,
  },
  visibilityChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  headerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingLeft: 8,
  },
  railGutter: {
    width: RAIL_LEFT * 2,
    alignItems: "center",
    position: "relative",
  },
  railLine: {
    position: "absolute",
    width: 2,
    top: 0,
    bottom: 0,
    left: RAIL_LEFT - 1,
    borderRadius: 1,
    opacity: 0.3,
  },
  railDotDay: {
    position: "absolute",
    left: RAIL_LEFT - RAIL_DOT_DAY / 2,
    top: "50%",
    width: RAIL_DOT_DAY,
    height: RAIL_DOT_DAY,
    borderRadius: RAIL_DOT_DAY / 2,
    marginTop: -(RAIL_DOT_DAY / 2),
    zIndex: 1,
  },
  railDotLesson: {
    position: "absolute",
    left: RAIL_LEFT - RAIL_DOT_LESSON / 2,
    top: "50%",
    width: RAIL_DOT_LESSON,
    height: RAIL_DOT_LESSON,
    borderRadius: RAIL_DOT_LESSON / 2,
    marginTop: -(RAIL_DOT_LESSON / 2),
    zIndex: 1,
  },
  dayHeaderContent: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 4,
    paddingRight: 16,
  },
  dayHeading: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  daySubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 1,
  },
  lessonCard: {
    flex: 1,
    marginRight: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  lessonRowCompact: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  lessonTimeColumn: {
    width: 64,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 1,
  },
  lessonTimePrimary: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  lessonTimeSecondary: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
  lessonAccent: {
    width: 3,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
  },
  lessonContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lessonTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  lifecycleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
  },
  lifecycleBadgeText: {
    ...BrandType.micro,
    fontWeight: "600",
  },
  lessonTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 19,
  },
  lessonMeta: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  lessonSource: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
  emptyStateCard: {
    flex: 1,
    marginRight: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
} as const;

export const calendarSheetStyles = {
  root: {
    gap: BrandSpacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleColumn: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...BrandType.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    ...BrandType.caption,
    opacity: 0.72,
  },
  actionsColumn: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  summaryCountPill: {
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  agendaHeader: {
    gap: BrandSpacing.xs,
    paddingTop: BrandSpacing.xs,
    paddingBottom: BrandSpacing.xs,
  },
  agendaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
  },
  datePickerBlock: {
    gap: BrandSpacing.sm,
    paddingTop: BrandSpacing.xs,
  },
  datePickerActions: {
    paddingBottom: BrandSpacing.xs,
  },
} as const;
